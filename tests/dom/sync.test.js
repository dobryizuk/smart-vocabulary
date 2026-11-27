import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMemoryStorage } from './test-helpers.js';

const { createSync } = require('../../js/sync.js');
const { createVocabularyStore, pickWordFields } = require('../../js/vocabulary-store.js');
const { createDataManager } = require('../../js/data-manager.js');
const { createImportExport } = require('../../js/import-export.js');

const USER = { id: 'user-1', email: 'learner@example.com' };
const OTHER_USER = { id: 'user-2', email: 'other@example.com' };
const T1 = new Date('2026-11-01T10:00:00.000Z');
const T2 = new Date('2026-11-02T10:00:00.000Z');
const T3 = new Date('2026-11-03T10:00:00.000Z');
const T4 = new Date('2026-11-04T10:00:00.000Z');
const T5 = new Date('2026-11-05T10:00:00.000Z');
const iso = (date) => date.toISOString();
const VALID_SECRET = 'valid secret';

function word(id, overrides = {}) {
    return {
        id, original: `word ${id}`, translation: `слово ${id}`, easeFactor: 1.3, repetition: 0,
        nextReview: null, reviewHistory: [], createdAt: iso(T1), ...overrides
    };
}

const row = (w, at, extra = {}) => ({ user_id: USER.id, id: w.id, data: pickWordFields(w), updated_at: at, deleted: false, ...extra });

// In-memory `words` table: each client sees and writes only its signed-in user's rows (like RLS)
function createServer(rows = []) {
    const table = rows.map(r => JSON.parse(JSON.stringify(r)));

    function client(user = USER) {
        let session = user ? { user } : null;
        // offline: requests fail like fetch does; errors: the server answers with an error;
        // requests: every request made, in order; maxActive: most requests in flight at once
        const fake = { offline: false, errors: { select: null, upsert: null }, requests: [], active: 0, maxActive: 0, onUpsert: null };
        const ownRows = () => table.filter(r => r.user_id === session?.user.id);
        const unreachable = () => { throw new TypeError('Load failed'); };

        async function inFlight(request, respond) {
            fake.requests.push(request);
            fake.active += 1;
            fake.maxActive = Math.max(fake.maxActive, fake.active);
            try {
                await Promise.resolve();
                return respond();
            } finally {
                fake.active -= 1;
            }
        }

        function selectRows(from, to) {
            return inFlight({ type: 'select' }, () => respondToSelect(from, to));
        }

        function upsertRows(incoming) {
            return inFlight({ type: 'upsert', ids: incoming.map(r => r.id) }, () => respondToUpsert(incoming));
        }

        function respondToSelect(from, to) {
            if (fake.offline) unreachable();
            if (fake.errors.select) return { data: null, error: fake.errors.select };
            const data = ownRows()
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(from, to + 1)
                .map(({ id, data: d, updated_at: updatedAt, deleted }) => JSON.parse(JSON.stringify({ id, data: d, updated_at: updatedAt, deleted })));
            return { data, error: null };
        }

        function respondToUpsert(incoming) {
            fake.onUpsert?.();
            if (fake.offline) unreachable();
            if (fake.errors.upsert) return { error: fake.errors.upsert };
            if (incoming.some(r => r.user_id !== session?.user.id)) {
                return { error: { message: 'new row violates row-level security policy' } };
            }
            for (const r of incoming) {
                const copy = JSON.parse(JSON.stringify(r));
                const index = table.findIndex(t => t.user_id === copy.user_id && t.id === copy.id);
                if (index === -1) table.push(copy);
                else table[index] = copy;
            }
            return { error: null };
        }

        fake.auth = {
            getSession: vi.fn(async () => ({ data: { session }, error: null })),
            signInWithPassword: vi.fn(async ({ email, password }) => {
                if (password !== VALID_SECRET) return { data: {}, error: { message: 'Invalid login credentials' } };
                session = { user: { ...USER, email } };
                return { data: { session }, error: null };
            }),
            signOut: vi.fn(async () => {
                session = null;
                return { error: null };
            })
        };
        const query = { select: () => query, order: () => query, range: selectRows, upsert: upsertRows };
        fake.from = vi.fn(() => query);
        return fake;
    }

    const find = (id, userId = USER.id) => table.find(r => r.id === id && r.user_id === userId);
    return { table, client, find };
}

// One phone: its own storage, data modules and sync over a shared server
function createDevice({ server, user = USER, words = [], storage, clock = T1 } = {}) {
    let current = clock;
    const now = () => current;
    const deviceStorage = storage || createMemoryStorage({ vocabulary: JSON.stringify({ schemaVersion: 1, words }) });
    const store = createVocabularyStore({ storage: deviceStorage, now });
    const dm = createDataManager({ store, appMain: { showMessage: vi.fn() } });
    dm.initializeVocabulary();
    const client = server.client(user);
    const onChange = vi.fn();
    const onStatus = vi.fn();
    const sync = createSync({ getClient: () => client, store, dataManager: dm, onChange, onStatus, now });
    const ie = createImportExport({
        getVocabulary: () => dm.vocabulary,
        setVocabulary: (v) => { dm.vocabulary = v; },
        store,
        confirm: () => true,
        reload: vi.fn(),
        getNow: now
    });
    return {
        storage: deviceStorage, store, dm, client, sync, onChange, onStatus, ie,
        setClock: (date) => { current = date; },
        byId: (id) => dm.vocabulary.find(w => w.id === id)
    };
}

describe('Sync merge rules', () => {
    it('takes the remote version when it is newer, in place, and persists it', async () => {
        const server = createServer([row(word('a', { translation: 'новое', updatedAt: iso(T2) }), iso(T2))]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })] });
        const sessionWord = device.dm.vocabulary[0];

        await device.sync.sync();

        expect(device.dm.vocabulary[0]).toBe(sessionWord);
        expect(sessionWord.translation).toBe('новое');
        expect(device.store.load()[0].translation).toBe('новое');
        expect(device.onChange).toHaveBeenCalledTimes(1);
        expect(server.find('a').updated_at).toBe(iso(T2));
    });

    it('pushes the local version when it is newer', async () => {
        const server = createServer([row(word('a'), iso(T1))]);
        const device = createDevice({ server, words: [word('a', { translation: 'моё', updatedAt: iso(T2) })] });

        await device.sync.sync();

        expect(server.find('a')).toMatchObject({ updated_at: iso(T2), deleted: false, data: { translation: 'моё', updatedAt: iso(T2) } });
        expect(device.onChange).not.toHaveBeenCalled();
    });

    it('adds words that exist only on the server', async () => {
        const server = createServer([row(word('remote', { updatedAt: iso(T1) }), iso(T1))]);
        const device = createDevice({ server, words: [word('local', { updatedAt: iso(T1) })] });

        await device.sync.sync();

        expect(device.dm.vocabulary.map(w => w.id).sort()).toEqual(['local', 'remote']);
        expect(device.store.load().map(w => w.id).sort()).toEqual(['local', 'remote']);
    });

    it('pushes words that exist only on the device, for the signed-in user', async () => {
        const server = createServer();
        const device = createDevice({ server, words: [word('local', { updatedAt: iso(T1) })] });

        await device.sync.sync();

        expect(server.find('local')).toEqual({
            user_id: USER.id, id: 'local', data: JSON.parse(JSON.stringify(pickWordFields(device.byId('local')))), updated_at: iso(T1), deleted: false
        });
    });

    it('removes a local word deleted on the server later than it changed here', async () => {
        const server = createServer([row(word('a'), iso(T2), { deleted: true })]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) }), word('b', { updatedAt: iso(T1) })] });

        await device.sync.sync();

        expect(device.dm.vocabulary.map(w => w.id)).toEqual(['b']);
        expect(device.store.load().map(w => w.id)).toEqual(['b']);
    });

    it('pushes the word back when it changed here after the deletion on the server', async () => {
        const server = createServer([row(word('a'), iso(T1), { deleted: true })]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T2) })] });

        await device.sync.sync();

        expect(device.byId('a')).toBeDefined();
        expect(server.find('a')).toMatchObject({ deleted: false, updated_at: iso(T2) });
    });

    it('pushes a local deletion that is newer than the server row', async () => {
        const server = createServer([row(word('a'), iso(T1))]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })], clock: T2 });
        device.dm.deleteWord('a');

        await device.sync.sync();

        expect(server.find('a')).toMatchObject({ deleted: true, updated_at: iso(T2) });
        expect(device.dm.vocabulary).toEqual([]);
    });

    it('brings a word back when the server changed it after the local deletion', async () => {
        const server = createServer([row(word('a', { updatedAt: iso(T3) }), iso(T3))]);
        const device = createDevice({ server, words: [word('a')], clock: T2 });
        device.dm.deleteWord('a');

        await device.sync.sync();

        expect(device.byId('a')).toMatchObject({ updatedAt: iso(T3) });
        expect(server.find('a').deleted).toBe(false);
    });

    it('pushes deletions the server never saw', async () => {
        const server = createServer();
        const device = createDevice({ server, words: [word('a')], clock: T2 });
        device.dm.deleteWord('a');

        await device.sync.sync();

        expect(server.find('a')).toMatchObject({ deleted: true, updated_at: iso(T2) });
    });

    it('lets words without updatedAt lose to stamped ones on either side', async () => {
        const server = createServer([
            row(word('old-here', { translation: 'с сервера', updatedAt: iso(T1) }), iso(T1)),
            row(word('old-there'), new Date(0).toISOString())
        ]);
        const device = createDevice({ server, words: [word('old-here'), word('old-there', { translation: 'отсюда', updatedAt: iso(T1) })] });

        await device.sync.sync();

        expect(device.byId('old-here').translation).toBe('с сервера');
        expect(server.find('old-there').data.translation).toBe('отсюда');
    });

    it('pushes a word without updatedAt with the oldest timestamp', async () => {
        const server = createServer();
        const device = createDevice({ server, words: [word('legacy')] });

        await device.sync.sync();

        expect(server.find('legacy').updated_at).toBe(new Date(0).toISOString());
    });

    it('takes the time of a pulled word from its row, so the next sync changes nothing', async () => {
        const server = createServer([row(word('a', { translation: 'правка на сервере' }), iso(T2))]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })] });

        await device.sync.sync();
        await device.sync.sync();

        expect(device.byId('a')).toMatchObject({ translation: 'правка на сервере', updatedAt: iso(T2) });
        expect(device.onChange).toHaveBeenCalledTimes(1);
    });

    it('writes nothing when both sides already agree', async () => {
        const server = createServer([row(word('a', { updatedAt: iso(T1) }), iso(T1))]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })] });
        const rawBefore = device.storage.data.vocabulary;

        await device.sync.sync();

        expect(device.client.from).toHaveBeenCalledTimes(1);
        expect(device.storage.data.vocabulary).toBe(rawBefore);
        expect(device.onChange).not.toHaveBeenCalled();
    });

    it('ignores server rows that are not words of this app', async () => {
        const server = createServer([{ user_id: USER.id, id: 'spike-1', data: { original: 'hello', translation: 'привет' }, updated_at: iso(T2), deleted: false }]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })] });

        await device.sync.sync();

        expect(device.dm.vocabulary.map(w => w.id)).toEqual(['a']);
        expect(device.sync.getStatus().state).toBe('synced');
    });

    it('never sees or writes the rows of another user', async () => {
        const server = createServer([row(word('theirs', { updatedAt: iso(T1) }), iso(T1), { user_id: OTHER_USER.id })]);
        const device = createDevice({ server, words: [word('mine', { updatedAt: iso(T1) })] });

        await device.sync.sync();

        expect(device.dm.vocabulary.map(w => w.id)).toEqual(['mine']);
        expect(server.find('theirs', OTHER_USER.id).updated_at).toBe(iso(T1));
        expect(server.find('mine').user_id).toBe(USER.id);
    });

    it('pulls every page of a large vocabulary', async () => {
        const many = Array.from({ length: 1201 }, (_, i) => word(`w${String(i).padStart(4, '0')}`, { updatedAt: iso(T1) }));
        const server = createServer(many.map(w => row(w, iso(T1))));
        const device = createDevice({ server });

        await device.sync.sync();

        expect(device.dm.vocabulary).toHaveLength(1201);
        expect(server.table).toHaveLength(1201);
    });
});

describe('Sync of rows written by older versions (createdAt later than addedDate)', () => {
    const ADDED = '2026-10-01';
    const REPAIRED = '2026-10-01T00:00:00.000Z';
    // A row pushed by the previous version: a late createdAt with the real date in addedDate
    const legacyRow = (w, at) => ({ ...row(w, at), data: { ...pickWordFields(w), addedDate: ADDED } });
    const legacyStorage = (w) => createMemoryStorage({ vocabulary: JSON.stringify({ schemaVersion: 1, words: [{ ...pickWordFields(w), addedDate: ADDED }] }) });

    it('repairs the date of a newer pulled row and never keeps addedDate', async () => {
        const server = createServer([legacyRow(word('a', { createdAt: iso(T1), repetition: 3, updatedAt: iso(T3) }), iso(T3))]);
        const device = createDevice({ server, words: [word('a', { createdAt: REPAIRED, updatedAt: iso(T2) })] });

        await device.sync.sync();

        expect(device.byId('a')).toMatchObject({ createdAt: REPAIRED, repetition: 3, updatedAt: iso(T3) });
        expect(device.byId('a')).not.toHaveProperty('addedDate');
        expect(device.store.load()[0].createdAt).toBe(REPAIRED);
        expect(JSON.parse(device.storage.data.vocabulary).words[0]).not.toHaveProperty('addedDate');
    });

    it('repairs the date of a word that exists only on the server', async () => {
        const server = createServer([legacyRow(word('remote', { createdAt: iso(T1), updatedAt: iso(T1) }), iso(T1))]);
        const device = createDevice({ server });

        await device.sync.sync();

        expect(device.byId('remote').createdAt).toBe(REPAIRED);
        expect(device.byId('remote')).not.toHaveProperty('addedDate');
    });

    it('keeps the repaired local date against the same old row and writes nothing to the server', async () => {
        const legacy = word('a', { createdAt: iso(T1), updatedAt: iso(T1) });
        const server = createServer([legacyRow(legacy, iso(T1))]);
        const device = createDevice({ server, storage: legacyStorage(legacy) });
        expect(device.byId('a').createdAt).toBe(REPAIRED);

        await device.sync.sync();

        expect(device.byId('a').createdAt).toBe(REPAIRED);
        expect(device.client.requests.map(r => r.type)).toEqual(['select']);
        expect(server.find('a').data.addedDate).toBe(ADDED);
    });

    it('sends the repaired date without addedDate with the next change of the word', async () => {
        const legacy = word('a', { createdAt: iso(T1), updatedAt: iso(T1) });
        const server = createServer([legacyRow(legacy, iso(T1))]);
        const device = createDevice({ server, storage: legacyStorage(legacy) });
        await device.sync.sync();

        Object.assign(device.byId('a'), { repetition: 1, updatedAt: iso(T2) });
        device.dm.save();
        await device.sync.push();

        expect(server.find('a').data).toMatchObject({ createdAt: REPAIRED, repetition: 1 });
        expect(server.find('a').data).not.toHaveProperty('addedDate');
    });

    it('dates a pulled word without any creation date by the time of the sync', async () => {
        const undated = word('a', { updatedAt: iso(T1) });
        delete undated.createdAt;
        const server = createServer([row(undated, iso(T1))]);
        const device = createDevice({ server, clock: T4 });

        await device.sync.sync();

        expect(device.byId('a').createdAt).toBe(iso(T4));
    });
});

describe('Sync between two devices', () => {
    it('picks up an offline edit that was made earlier but pushed later', async () => {
        const server = createServer();
        const phone = createDevice({ server, words: [word('a', { updatedAt: iso(T1) }), word('b', { updatedAt: iso(T1) })] });
        await phone.sync.sync();
        const tablet = createDevice({ server, clock: T1 });
        await tablet.sync.sync();

        // The phone answers offline at T2; its sync fails
        phone.client.offline = true;
        phone.setClock(T2);
        phone.byId('a').translation = 'офлайн';
        phone.byId('a').updatedAt = iso(T2);
        phone.dm.save();
        await phone.sync.sync();
        expect(phone.sync.getStatus().state).toBe('error');

        // The tablet edits another word at T3 and syncs, so its last sync is after the phone's edit
        tablet.setClock(T3);
        tablet.byId('b').translation = 'с планшета';
        tablet.byId('b').updatedAt = iso(T3);
        await tablet.sync.sync();

        // The phone comes online at T4 and pushes its older edit
        phone.client.offline = false;
        phone.setClock(T4);
        await phone.sync.sync();
        expect(phone.byId('b').translation).toBe('с планшета');

        tablet.setClock(T5);
        await tablet.sync.sync();
        expect(tablet.byId('a').translation).toBe('офлайн');
        expect(tablet.store.load().find(w => w.id === 'a').translation).toBe('офлайн');
    });

    it('sends a deletion on one device to the other', async () => {
        const server = createServer();
        const phone = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })] });
        await phone.sync.sync();
        const tablet = createDevice({ server });
        await tablet.sync.sync();

        phone.setClock(T2);
        phone.dm.deleteWord('a');
        await phone.sync.sync();
        await tablet.sync.sync();

        expect(tablet.dm.vocabulary).toEqual([]);
    });
});

describe('Sync after replacing all words (import, undo)', () => {
    const backupFile = (words) => JSON.stringify({ vocabulary: words, exportDate: iso(T1) });

    it('import wins over the server and a following sync does not bring old words back', async () => {
        const server = createServer();
        const phone = createDevice({ server, words: [word('a', { updatedAt: iso(T2) }), word('b', { updatedAt: iso(T2) })], clock: T2 });
        await phone.sync.sync();
        const tablet = createDevice({ server, clock: T2 });
        await tablet.sync.sync();

        phone.setClock(T3);
        await phone.ie.importFromText(backupFile([word('b', { translation: 'из файла' }), word('c')]));
        expect(phone.dm.vocabulary.every(w => w.updatedAt === iso(T3))).toBe(true);
        expect(phone.store.loadDeletions()).toEqual({ a: iso(T3) });

        await phone.sync.sync();

        expect(phone.dm.vocabulary.map(w => w.id).sort()).toEqual(['b', 'c']);
        expect(phone.byId('b').translation).toBe('из файла');
        expect(server.find('a')).toMatchObject({ deleted: true, updated_at: iso(T3) });

        await tablet.sync.sync();
        expect(tablet.dm.vocabulary.map(w => w.id).sort()).toEqual(['b', 'c']);
        expect(tablet.byId('b').translation).toBe('из файла');
    });

    it('undo after an import wins over the server too', async () => {
        const server = createServer();
        const phone = createDevice({ server, words: [word('a', { updatedAt: iso(T2) })], clock: T2 });
        await phone.sync.sync();

        phone.setClock(T3);
        await phone.ie.importFromText(backupFile([word('c')]));
        await phone.sync.sync();
        expect(server.find('a').deleted).toBe(true);

        phone.setClock(T4);
        phone.ie.restoreSnapshot();
        const reloaded = createDevice({ server, storage: phone.storage, clock: T4 });
        expect(reloaded.dm.vocabulary).toEqual([expect.objectContaining({ id: 'a', updatedAt: iso(T4) })]);

        await reloaded.sync.sync();

        expect(reloaded.dm.vocabulary.map(w => w.id)).toEqual(['a']);
        expect(server.find('a')).toMatchObject({ deleted: false, updated_at: iso(T4) });
        expect(server.find('c')).toMatchObject({ deleted: true, updated_at: iso(T4) });
    });
});

describe('Sync failures and signed-out use', () => {
    it.each([
        ['the server is unreachable', (client) => { client.offline = true; }, 'Load failed'],
        ['the server returns an error', (client) => { client.errors.select = { message: 'project paused' }; }, 'project paused'],
        ['the session cannot be read', (client) => { client.auth.getSession.mockRejectedValue(new Error('storage blocked')); }, 'storage blocked']
    ])('records an error and keeps local data when %s', async (_, breakClient, reason) => {
        const server = createServer([row(word('remote', { updatedAt: iso(T2) }), iso(T2))]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })] });
        breakClient(device.client);
        const before = { ...device.storage.data };

        await expect(device.sync.sync()).resolves.toBeUndefined();

        expect(device.sync.getStatus()).toMatchObject({ state: 'error', error: reason });
        expect(device.storage.data).toEqual(before);
        expect(device.dm.vocabulary.map(w => w.id)).toEqual(['a']);
    });

    it('records an error when the push is refused, after taking the remote changes', async () => {
        const server = createServer([row(word('remote', { updatedAt: iso(T2) }), iso(T2))]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })] });
        device.client.errors.upsert = { message: 'timeout' };

        await device.sync.sync();

        expect(device.sync.getStatus()).toMatchObject({ state: 'error', error: 'timeout' });
        expect(device.store.load().map(w => w.id).sort()).toEqual(['a', 'remote']);
    });

    it('does not touch the server or storage when signed out', async () => {
        const server = createServer([row(word('remote', { updatedAt: iso(T2) }), iso(T2))]);
        const device = createDevice({ server, user: null, words: [word('a')] });
        const before = { ...device.storage.data };

        await device.sync.sync();

        expect(device.client.from).not.toHaveBeenCalled();
        expect(device.sync.getStatus()).toEqual({ state: 'signed-out', email: null, lastSyncedAt: null, error: null });
        expect(device.storage.data).toEqual(before);
    });

    it('does not sync over words that could not be loaded', async () => {
        const server = createServer([row(word('remote', { updatedAt: iso(T2) }), iso(T2))]);
        const device = createDevice({ server, storage: createMemoryStorage({ vocabulary: '{broken' }) });

        await device.sync.sync();

        expect(device.client.from).not.toHaveBeenCalled();
        expect(device.sync.getStatus().state).toBe('error');
        expect(device.storage.data).toEqual({ vocabulary: '{broken' });
    });

    it('reports syncing, then synced with the time and the account', async () => {
        const device = createDevice({ server: createServer(), clock: T2 });

        await device.sync.sync();

        expect(device.onStatus.mock.calls.map(([s]) => s.state)).toEqual(['syncing', 'synced']);
        expect(device.sync.getStatus()).toEqual({ state: 'synced', email: USER.email, lastSyncedAt: iso(T2), error: null });
    });
});

describe('Push after a save', () => {
    // A device that finished a full sync at T1 with words a and b on the server
    async function syncedDevice() {
        const server = createServer();
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) }), word('b', { updatedAt: iso(T1) })], clock: T1 });
        await device.sync.sync();
        device.client.requests.length = 0;
        return { server, device };
    }

    function answer(device, id, at) {
        device.setClock(at);
        Object.assign(device.byId(id), { repetition: 1, updatedAt: iso(at) });
        device.dm.save();
    }

    it('sends only the words changed since the last sync, without pulling', async () => {
        const { server, device } = await syncedDevice();
        answer(device, 'a', T2);

        await device.sync.push();

        expect(device.client.requests).toEqual([{ type: 'upsert', ids: ['a'] }]);
        expect(server.find('a')).toMatchObject({ updated_at: iso(T2), data: { repetition: 1 } });
        expect(device.sync.getStatus()).toMatchObject({ state: 'synced', lastSyncedAt: iso(T2) });
    });

    it('sends deletions made since the last sync', async () => {
        const { server, device } = await syncedDevice();
        device.setClock(T2);
        device.dm.deleteWord('b');

        await device.sync.push();

        expect(device.client.requests).toEqual([{ type: 'upsert', ids: ['b'] }]);
        expect(server.find('b')).toMatchObject({ deleted: true, updated_at: iso(T2) });
    });

    it('makes no request when nothing changed since the last push', async () => {
        const { device } = await syncedDevice();
        answer(device, 'a', T2);
        await device.sync.push();
        device.client.requests.length = 0;

        device.setClock(T3);
        await device.sync.push();

        expect(device.client.requests).toEqual([]);
    });

    it('retries a failed push with the next one', async () => {
        const { server, device } = await syncedDevice();
        device.client.offline = true;
        answer(device, 'a', T2);
        await device.sync.push();
        expect(device.sync.getStatus()).toMatchObject({ state: 'error', error: 'Load failed' });

        device.client.offline = false;
        answer(device, 'b', T3);
        device.client.requests.length = 0;
        await device.sync.push();

        expect(device.client.requests).toEqual([{ type: 'upsert', ids: ['a', 'b'] }]);
        expect(server.find('a').updated_at).toBe(iso(T2));
        expect(device.sync.getStatus().state).toBe('synced');
    });

    it('pushes next time a word that changed while a push was on its way', async () => {
        const { server, device } = await syncedDevice();
        answer(device, 'a', T2);
        device.client.onUpsert = () => {
            device.client.onUpsert = null;
            answer(device, 'b', T3);
        };

        await device.sync.push();
        expect(server.find('b').updated_at).toBe(iso(T1));

        device.client.requests.length = 0;
        await device.sync.push();
        expect(device.client.requests).toEqual([{ type: 'upsert', ids: ['b'] }]);
        expect(server.find('b').updated_at).toBe(iso(T3));
    });

    it('does a full sync when no full sync has succeeded yet', async () => {
        const server = createServer([row(word('remote', { updatedAt: iso(T1) }), iso(T1))]);
        const device = createDevice({ server, words: [word('a', { updatedAt: iso(T1) })] });

        await device.sync.push();

        expect(device.client.requests.map(r => r.type)).toEqual(['select', 'upsert']);
        expect(device.byId('remote')).toBeDefined();
    });

    it('runs a full sync asked for during a push right after it, never in parallel', async () => {
        const { device } = await syncedDevice();
        answer(device, 'a', T2);

        const pushing = device.sync.push();
        const syncing = device.sync.sync();
        await Promise.all([pushing, syncing]);

        expect(device.client.requests.map(r => r.type)).toEqual(['upsert', 'select']);
        expect(device.client.maxActive).toBe(1);
    });

    it('forgets the push mark on sign-out, so the next push after signing in is a full sync', async () => {
        const { device } = await syncedDevice();
        await device.sync.signOut();
        // Signed in again without the sync module's own full sync
        await device.client.auth.signInWithPassword({ email: USER.email, password: VALID_SECRET });

        await device.sync.push();

        expect(device.client.requests.map(r => r.type)).toEqual(['select']);
    });
});

describe('Sync triggers, sign-in and sign-out', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs one sync at a time and once more when asked during it', async () => {
        const device = createDevice({ server: createServer() });

        const first = device.sync.sync();
        const second = device.sync.sync();
        const third = device.sync.sync();
        await Promise.all([first, second, third]);

        expect(second).toBe(first);
        expect(third).toBe(first);
        expect(device.client.auth.getSession).toHaveBeenCalledTimes(2);
    });

    it('pushes five seconds after the last save', async () => {
        vi.useFakeTimers();
        const device = createDevice({ server: createServer() });

        device.sync.schedulePush();
        vi.advanceTimersByTime(4000);
        device.sync.schedulePush();
        vi.advanceTimersByTime(4999);
        expect(device.client.auth.getSession).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(device.client.auth.getSession).toHaveBeenCalledTimes(1);
    });

    it('DataManager asks for a push after every successful save and deletion', () => {
        const onSaved = vi.fn();
        const store = createVocabularyStore({ storage: createMemoryStorage(), now: () => T1 });
        const dm = createDataManager({ store, onSaved });
        dm.initializeVocabulary();
        dm.vocabulary = [word('a')];

        dm.save();
        dm.deleteWord('a');

        expect(onSaved).toHaveBeenCalledTimes(2);
    });

    it('DataManager does not ask for a push when saving fails', () => {
        const onSaved = vi.fn();
        const storage = createMemoryStorage();
        storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
        const dm = createDataManager({ store: createVocabularyStore({ storage, now: () => T1 }), onSaved, appMain: { showMessage: vi.fn() } });
        dm.initializeVocabulary();

        dm.save();

        expect(onSaved).not.toHaveBeenCalled();
    });

    it('runs a full sync at start, when the device comes online and when the app becomes visible', async () => {
        const device = createDevice({ server: createServer() });
        const pulls = () => device.client.requests.filter(r => r.type === 'select').length;
        const win = new window.EventTarget();
        const doc = Object.assign(new window.EventTarget(), { visibilityState: 'hidden' });
        const sync = createSync({ getClient: () => device.client, store: device.store, dataManager: device.dm, window: win, document: doc });

        const settle = () => new Promise(resolve => setTimeout(resolve, 0));

        await sync.start();
        expect(pulls()).toBe(1);

        doc.dispatchEvent(new window.Event('visibilitychange'));
        await settle();
        expect(pulls()).toBe(1);

        win.dispatchEvent(new window.Event('online'));
        await settle();
        expect(pulls()).toBe(2);

        doc.visibilityState = 'visible';
        doc.dispatchEvent(new window.Event('visibilitychange'));
        await settle();
        expect(pulls()).toBe(3);
        expect(sync.getStatus().state).toBe('synced');
    });

    it('shows the reason when sign-in fails and stays signed out', async () => {
        const device = createDevice({ server: createServer(), user: null, words: [word('a')] });

        await device.sync.signIn('learner@example.com', 'wrong');

        expect(device.sync.getStatus()).toMatchObject({ state: 'signed-out', error: 'Invalid login credentials' });
        expect(device.client.from).not.toHaveBeenCalled();
    });

    it('first sign-in on a device with words pushes them and keeps them', async () => {
        const server = createServer([row(word('remote', { updatedAt: iso(T1) }), iso(T1))]);
        const device = createDevice({ server, user: null, words: [word('local')] });

        await device.sync.signIn('learner@example.com', VALID_SECRET);

        expect(device.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'learner@example.com', password: VALID_SECRET });
        expect(server.find('local')).toBeDefined();
        expect(device.dm.vocabulary.map(w => w.id).sort()).toEqual(['local', 'remote']);
        expect(device.sync.getStatus()).toMatchObject({ state: 'synced', email: 'learner@example.com' });
    });

    it('sign-out ends the session on this device only and keeps local words', async () => {
        const device = createDevice({ server: createServer(), words: [word('a', { updatedAt: iso(T1) })] });
        await device.sync.sync();
        const before = { ...device.storage.data };

        await device.sync.signOut();

        expect(device.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
        expect(device.sync.getStatus()).toEqual({ state: 'signed-out', email: null, lastSyncedAt: null, error: null });
        expect(device.storage.data).toEqual(before);
        expect(device.dm.vocabulary.map(w => w.id)).toEqual(['a']);
    });
});
