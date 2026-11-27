// ============================================================================
// CLOUD SYNC: optional and local-first. A full sync pulls all of the user's rows, keeps the
// newer version of every word on both sides and pushes what the server lacks. After a save
// only the words and deletions changed here since the last successful push are sent.
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
const defaultVocabularyStore = require('./vocabulary-store.js');
const defaultDataManager = require('./data-manager.js');
const { pickWordFields, findInvalidWordField, withCreatedAt } = defaultVocabularyStore;

const SUPABASE_URL = 'https://jubhtxkygbxkdafiabps.supabase.co';
// Publishable by design: row level security limits every user to their own rows
const SUPABASE_KEY = 'sb_publishable_fyIOTEICA086Y6KFmviv-g_6wLTbwDl';
const TABLE = 'words';
const PAGE_SIZE = 500;
const SAVE_DEBOUNCE_MS = 5000;
const EPOCH = new Date(0).toISOString();

// Words and deletions without a timestamp count as the oldest
const time = (iso) => Date.parse(iso) || 0;
const errorText = (error) => error?.message || String(error);

const wordRow = (word) => ({ id: word.id, data: pickWordFields(word), updated_at: word.updatedAt || EPOCH, deleted: false });
const deletedRow = (id, deletedAt) => ({ id, data: { id }, updated_at: deletedAt, deleted: true });
// The row's id and updated_at are authoritative over the copies inside its data. Rows written by
// older versions may still carry a late createdAt next to addedDate: they get the same repair as
// words loaded here, so a pulled row never brings the wrong date back.
const rowWord = (row, timestamp) => ({
    ...pickWordFields(withCreatedAt(row.data || {}, timestamp)), id: row.id, updatedAt: row.updated_at
});
// Rows that are not words of this app (e.g. written by an experiment) are ignored
const isUsableRow = (row) => row.deleted || !findInvalidWordField({ ...row.data, id: row.id });

// Per id the newer side wins. Returns the resulting local words (the same objects where
// nothing changed) and the rows the server lacks or holds in an older version.
// `timestamp` dates a pulled word that has no creation date at all.
function mergeWords(words, deletions, rows, timestamp) {
    const remote = new Map(rows.filter(isUsableRow).map(row => [row.id, row]));
    const localIds = new Set(words.map(word => word.id));
    const merged = [];
    const upload = [];
    let changed = false;

    words.forEach(word => {
        const row = remote.get(word.id);
        const localTime = time(word.updatedAt);
        const remoteTime = row ? time(row.updated_at) : -1;
        if (localTime > remoteTime) upload.push(wordRow(word));
        if (localTime >= remoteTime) {
            merged.push(word);
            return;
        }
        changed = true;
        if (!row.deleted) merged.push({ ...word, ...rowWord(row, timestamp) });
    });

    remote.forEach(row => {
        if (localIds.has(row.id) || row.deleted) return;
        const deletedAt = deletions[row.id];
        const deletedTime = deletedAt === undefined ? -1 : time(deletedAt);
        if (deletedTime > time(row.updated_at)) {
            upload.push(deletedRow(row.id, deletedAt));
        } else if (time(row.updated_at) > deletedTime) {
            merged.push(rowWord(row, timestamp));
            changed = true;
        }
    });

    Object.entries(deletions).forEach(([id, deletedAt]) => {
        if (!localIds.has(id) && !remote.has(id)) upload.push(deletedRow(id, deletedAt));
    });

    return { words: merged, upload, changed };
}

function createSync(context) {
    const ctx = context || {};
    const getClient = ctx.getClient;
    const store = ctx.store || defaultVocabularyStore;
    const dataManager = ctx.dataManager || defaultDataManager;
    const onStatus = ctx.onStatus || (() => undefined);
    const onChange = ctx.onChange || (() => undefined);
    const now = ctx.now || (() => new Date());
    const win = ctx.window || null;
    const doc = ctx.document || null;
    const setTimer = ctx.setTimeout || setTimeout;
    const clearTimer = ctx.clearTimeout || clearTimeout;

    let status = { state: 'signed-out', email: null, lastSyncedAt: null, error: null };
    let running = null;
    let pending = null;
    let timer = null;
    // When the last successful full sync or push started; anything changed since is pushed next
    let pushedAt = null;

    function setStatus(patch) {
        status = { ...status, ...patch };
        onStatus(status);
    }

    async function currentUser() {
        const { data, error } = await getClient().auth.getSession();
        if (error) throw error;
        return data.session?.user || null;
    }

    async function pullRows() {
        const rows = [];
        for (let from = 0; ; from += PAGE_SIZE) {
            const { data, error } = await getClient().from(TABLE)
                .select('id, data, updated_at, deleted')
                .order('id')
                .range(from, from + PAGE_SIZE - 1);
            if (error) throw error;
            rows.push(...data);
            if (data.length < PAGE_SIZE) return rows;
        }
    }

    async function pushRows(rows) {
        for (let from = 0; from < rows.length; from += PAGE_SIZE) {
            const { error } = await getClient().from(TABLE).upsert(rows.slice(from, from + PAGE_SIZE));
            if (error) throw error;
        }
    }

    // Updates the existing word objects in place so a running learning session keeps working on them
    function applyLocally(words) {
        store.save(words);
        const current = new Map(dataManager.vocabulary.map(word => [word.id, word]));
        dataManager.vocabulary = words.map(word => (current.has(word.id) ? Object.assign(current.get(word.id), word) : word));
        onChange();
    }

    const forUser = (rows, user) => rows.map(row => ({ ...row, user_id: user.id }));

    function changedSince(since) {
        const changed = (iso) => time(iso) > time(since);
        const words = dataManager.vocabulary.filter(word => changed(word.updatedAt)).map(wordRow);
        const deletions = Object.entries(store.loadDeletions())
            .filter(([, deletedAt]) => changed(deletedAt))
            .map(([id, deletedAt]) => deletedRow(id, deletedAt));
        return [...words, ...deletions];
    }

    async function fullSync(user) {
        if (dataManager.loadFailed) throw new Error('saved words could not be loaded');
        const rows = await pullRows();
        const result = mergeWords(dataManager.vocabulary, store.loadDeletions(), rows, now().toISOString());
        if (result.changed) applyLocally(result.words);
        await pushRows(forUser(result.upload, user));
    }

    // A push before any successful full sync becomes a full sync
    async function runOnce(kind) {
        try {
            const user = await currentUser();
            if (!user) {
                pushedAt = null;
                setStatus({ state: 'signed-out', email: null, lastSyncedAt: null, error: null });
                return;
            }
            const startedAt = now().toISOString();
            const pushOnly = kind === 'push' && pushedAt !== null;
            const changes = pushOnly ? changedSince(pushedAt) : null;
            if (pushOnly && changes.length === 0) return;
            setStatus({ state: 'syncing', email: user.email, error: null });
            if (pushOnly) await pushRows(forUser(changes, user));
            else await fullSync(user);
            pushedAt = startedAt;
            setStatus({ state: 'synced', lastSyncedAt: now().toISOString() });
        } catch (error) {
            setStatus({ state: 'error', error: errorText(error) });
        }
    }

    // One request at a time; what is asked during it runs after it, a full sync winning over a push
    function request(kind) {
        if (running) {
            if (pending !== 'full') pending = kind;
            return running;
        }
        running = (async () => {
            for (let next = kind; next; next = pending) {
                pending = null;
                await runOnce(next);
            }
            running = null;
        })();
        return running;
    }

    const sync = () => request('full');
    const push = () => request('push');

    function schedulePush() {
        clearTimer(timer);
        timer = setTimer(push, SAVE_DEBOUNCE_MS);
    }

    async function signIn(email, password) {
        try {
            const { error } = await getClient().auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch (error) {
            setStatus({ state: 'signed-out', error: errorText(error) });
            return;
        }
        await sync();
    }

    // Ends the session on this device only; local words stay as they are
    async function signOut() {
        clearTimer(timer);
        await running;
        try {
            const { error } = await getClient().auth.signOut({ scope: 'local' });
            if (error) throw error;
        } catch (error) {
            setStatus({ error: errorText(error) });
            return;
        }
        pushedAt = null;
        setStatus({ state: 'signed-out', email: null, lastSyncedAt: null, error: null });
    }

    function start() {
        win?.addEventListener('online', () => sync());
        doc?.addEventListener('visibilitychange', () => {
            if (doc.visibilityState === 'visible') sync();
        });
        return sync();
    }

    return { sync, push, schedulePush, signIn, signOut, start, getStatus: () => status };
}

// The client is created on first use, so loading the bundle opens no connection by itself
function createDefaultSync({ onStatus, onChange } = {}) {
    let client = null;
    return createSync({
        getClient: () => client || (client = createClient(SUPABASE_URL, SUPABASE_KEY)),
        onStatus,
        onChange,
        window: typeof window !== 'undefined' ? window : null,
        document: typeof document !== 'undefined' ? document : null
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports.createSync = createSync;
    module.exports.createDefaultSync = createDefaultSync;
}
