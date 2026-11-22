// ============================================================================
// VOCABULARY STORAGE: the only code that knows where words and progress live
// ============================================================================

const VOCABULARY_KEY = 'vocabulary';
const SNAPSHOT_KEY = 'snapshotBeforeImport';
const OLD_WORDS_KEY = 'allVocabulary';
const OLD_PROGRESS_KEY = 'userProgress';
const SCHEMA_VERSION = 1;

// The fields of a word that are kept on the device and in backup files; anything else is memory-only
const WORD_FIELDS = [
    'id', 'original', 'translation', 'definition', 'examples', 'phonetic', 'synonyms',
    'easeFactor', 'repetition', 'nextReview', 'reviewHistory', 'createdAt', 'addedDate'
];

function pickWordFields(word) {
    return Object.fromEntries(WORD_FIELDS.map(field => [field, word[field]]));
}

function withDates(word, timestamp) {
    return {
        ...word,
        createdAt: word.created_date || word.createdAt || timestamp,
        addedDate: word.created_date || word.addedDate || timestamp
    };
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
    return words.map(word => ({
        ...withDates(word, timestamp),
        ...(progressById[word.id] || { repetition: 0, easeFactor: 1.3, nextReview: null, reviewHistory: [] })
    }));
}

function createVocabularyStore({ storage, now }) {
    function save(words) {
        storage.setItem(VOCABULARY_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, words: words.map(pickWordFields) }));
    }

    function load() {
        const timestamp = now().toISOString();
        const raw = storage.getItem(VOCABULARY_KEY);
        if (raw !== null) return parseVocabulary(raw).map(word => withDates(word, timestamp));

        const rawWords = storage.getItem(OLD_WORDS_KEY);
        const rawProgress = storage.getItem(OLD_PROGRESS_KEY);
        if (rawWords === null && rawProgress === null) return [];
        const words = mergeOldKeys(rawWords, rawProgress, timestamp);
        save(words);
        return words;
    }

    function readSnapshot() {
        try {
            return JSON.parse(storage.getItem(SNAPSHOT_KEY) || 'null');
        } catch {
            return null;
        }
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

    function writeOrRemove(key, value) {
        if (typeof value === 'string') storage.setItem(key, value);
        else storage.removeItem(key);
    }

    function restoreSnapshot() {
        const snapshot = readSnapshot();
        if (!snapshot) return;
        if (snapshot[OLD_WORDS_KEY] === undefined) {
            writeOrRemove(VOCABULARY_KEY, snapshot.vocabulary);
        } else {
            // Snapshot made by the version that stored two keys: put them back and migrate again on load
            writeOrRemove(OLD_WORDS_KEY, snapshot[OLD_WORDS_KEY]);
            writeOrRemove(OLD_PROGRESS_KEY, snapshot[OLD_PROGRESS_KEY]);
            storage.removeItem(VOCABULARY_KEY);
        }
        storage.removeItem(SNAPSHOT_KEY);
    }

    return { load, save, saveSnapshot, getSnapshotDate, restoreSnapshot };
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
}
