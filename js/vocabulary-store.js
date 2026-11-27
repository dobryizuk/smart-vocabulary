// ============================================================================
// VOCABULARY STORAGE: the only code that knows where words and progress live
// ============================================================================

const VOCABULARY_KEY = 'vocabulary';
const SNAPSHOT_KEY = 'snapshotBeforeImport';
const DELETED_KEY = 'deletedWords';
const OLD_WORDS_KEY = 'allVocabulary';
const OLD_PROGRESS_KEY = 'userProgress';
const SCHEMA_VERSION = 1;

// The fields of a word that are kept on the device and in backup files; anything else is memory-only
const WORD_FIELDS = [
    'id', 'original', 'translation', 'definition', 'examples', 'phonetic', 'synonyms',
    'easeFactor', 'repetition', 'nextReview', 'reviewHistory', 'createdAt', 'updatedAt'
];

function pickWordFields(word) {
    return Object.fromEntries(WORD_FIELDS.map(field => [field, word[field]]));
}

const isFilledString = value => typeof value === 'string' && value !== '';
const isNumber = value => typeof value === 'number';

// What every word from outside the device (backup file, server) needs for learning to work
const REQUIRED_WORD_FIELDS = {
    id: isFilledString,
    original: isFilledString,
    translation: isFilledString,
    easeFactor: isNumber,
    repetition: isNumber,
    reviewHistory: Array.isArray
};

function findInvalidWordField(word) {
    return Object.keys(REQUIRED_WORD_FIELDS).find(field => !REQUIRED_WORD_FIELDS[field](word?.[field]));
}

// Milliseconds of an ISO date ("2025-06-29", a UTC day) or date-time; NaN for anything else
function isoTime(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? Date.parse(value) : NaN;
}

// Older versions also kept the creation date as `addedDate` or `created_date`, and some `createdAt`
// were set after the word was added (at the first save after a migration). A word is created at the
// earliest valid one of them; only a word without any is created now. Every word from storage, a
// backup file or the server passes here, so the duplicates never get further.
function withCreatedAt(word, timestamp) {
    const { addedDate, created_date: createdDate, ...rest } = word;
    const times = [word.createdAt, addedDate, createdDate].map(isoTime).filter(Number.isFinite);
    return { ...rest, createdAt: times.length ? new Date(Math.min(...times)).toISOString() : timestamp };
}

function parseVocabulary(raw) {
    const data = JSON.parse(raw);
    if (data?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.words)) {
        throw new Error(`Saved vocabulary has an unsupported format (schemaVersion ${data?.schemaVersion})`);
    }
    return data.words;
}

function mergeOldKeys(rawWords, rawProgress, timestamp) {
    const words = JSON.parse(rawWords || '[]');
    const progressById = JSON.parse(rawProgress || '{}');
    if (!Array.isArray(words) || !progressById || typeof progressById !== 'object') {
        throw new Error('Saved words or progress in the old format are unreadable');
    }
    return words.map(word => withCreatedAt({
        ...word,
        ...(progressById[word.id] || { repetition: 0, easeFactor: 1.3, nextReview: null, reviewHistory: [] })
    }, timestamp));
}

function createVocabularyStore({ storage, now }) {
    function save(words) {
        storage.setItem(VOCABULARY_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, words: words.map(pickWordFields) }));
    }

    function load() {
        const timestamp = now().toISOString();
        const raw = storage.getItem(VOCABULARY_KEY);
        if (raw !== null) return parseVocabulary(raw).map(word => withCreatedAt(word, timestamp));

        const rawWords = storage.getItem(OLD_WORDS_KEY);
        const rawProgress = storage.getItem(OLD_PROGRESS_KEY);
        if (rawWords === null && rawProgress === null) return [];
        const words = mergeOldKeys(rawWords, rawProgress, timestamp);
        save(words);
        return words;
    }

    function readJson(key, fallback) {
        try {
            return JSON.parse(storage.getItem(key)) ?? fallback;
        } catch {
            return fallback;
        }
    }

    // Deleted word ids with the deletion time, so sync can tell other devices: {id: deletedAtISO}
    function loadDeletions() {
        return readJson(DELETED_KEY, {});
    }

    function recordDeletion(id) {
        storage.setItem(DELETED_KEY, JSON.stringify({ ...loadDeletions(), [id]: now().toISOString() }));
    }

    function storedWordIds() {
        const raw = storage.getItem(VOCABULARY_KEY);
        try {
            return raw === null ? [] : parseVocabulary(raw).map(word => word.id);
        } catch {
            return [];
        }
    }

    // Replaces all words (from a backup file or the snapshot) so that the result wins over the server:
    // every word is stamped now, every word that disappears gets a deletion, every word that comes back
    // loses its deletion.
    // Deletions are written first: a deletion of a word that is still present is ignored,
    // a missing one would let sync bring the word back.
    function replaceAll(words) {
        const timestamp = now().toISOString();
        const keptIds = new Set(words.map(word => word.id));
        const deletions = loadDeletions();
        keptIds.forEach(id => { delete deletions[id]; });
        storedWordIds().filter(id => !keptIds.has(id)).forEach(id => { deletions[id] = timestamp; });
        storage.setItem(DELETED_KEY, JSON.stringify(deletions));
        const stamped = words.map(word => ({ ...withCreatedAt(word, timestamp), updatedAt: timestamp }));
        save(stamped);
        return stamped;
    }

    function readSnapshot() {
        return readJson(SNAPSHOT_KEY, null);
    }

    function getSnapshotDate() {
        return readSnapshot()?.savedAt?.slice(0, 10) || null;
    }

    function saveSnapshot() {
        storage.setItem(SNAPSHOT_KEY, JSON.stringify({
            savedAt: now().toISOString(),
            vocabulary: storage.getItem(VOCABULARY_KEY)
        }));
    }

    function snapshotWords(snapshot) {
        if (snapshot[OLD_WORDS_KEY] !== undefined) {
            // Snapshot made by the version that stored two keys
            return mergeOldKeys(snapshot[OLD_WORDS_KEY], snapshot[OLD_PROGRESS_KEY], now().toISOString());
        }
        return typeof snapshot.vocabulary === 'string' ? parseVocabulary(snapshot.vocabulary) : [];
    }

    function restoreSnapshot() {
        const snapshot = readSnapshot();
        if (!snapshot) return;
        replaceAll(snapshotWords(snapshot));
        storage.removeItem(SNAPSHOT_KEY);
    }

    return { load, save, replaceAll, loadDeletions, recordDeletion, saveSnapshot, getSnapshotDate, restoreSnapshot };
}

const defaultVocabularyStore = createVocabularyStore({
    storage: (typeof localStorage !== 'undefined' ? localStorage : null),
    now: () => new Date()
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultVocabularyStore;
    module.exports.createVocabularyStore = createVocabularyStore;
    module.exports.WORD_FIELDS = WORD_FIELDS;
    module.exports.pickWordFields = pickWordFields;
    module.exports.findInvalidWordField = findInvalidWordField;
    module.exports.withCreatedAt = withCreatedAt;
}
