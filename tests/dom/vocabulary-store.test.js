import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './test-helpers.js';

const { createVocabularyStore, WORD_FIELDS, findInvalidWordField } = require('../../js/vocabulary-store.js');
const fixture = require('../test-vocabulary.json');

const NOW = new Date('2030-01-02T03:04:05.000Z');
const LATER = new Date('2030-02-01T00:00:00.000Z');
const [first, second] = fixture.vocabulary;
const STALE = { repetition: 0, easeFactor: 1.3, nextReview: null, reviewHistory: [] };

// What the production version stores: words with stale progress + current progress by id
const oldWords = [
    { ...first, ...STALE },
    { ...second, ...STALE, created_date: '2024-05-05T00:00:00.000Z' },
    { id: 'no_progress', original: 'new', translation: 'новый' }
];
const oldProgress = {
    [first.id]: {
        repetition: first.repetition,
        easeFactor: first.easeFactor,
        nextReview: first.nextReview,
        reviewHistory: first.reviewHistory,
        addedDate: first.addedDate
    },
    [second.id]: {
        repetition: 4,
        easeFactor: 2.1,
        nextReview: '2031-01-01T00:00:00.000Z',
        reviewHistory: [{ date: '2030-01-01T00:00:00.000Z', difficulty: 'easy', exerciseType: 'regular' }]
    }
};
// The words the production version shows for the data above
const expectedWords = [
    { ...first, createdAt: first.addedDate },
    {
        ...second,
        created_date: '2024-05-05T00:00:00.000Z',
        createdAt: '2024-05-05T00:00:00.000Z',
        addedDate: '2024-05-05T00:00:00.000Z',
        ...oldProgress[second.id]
    },
    {
        id: 'no_progress',
        original: 'new',
        translation: 'новый',
        createdAt: NOW.toISOString(),
        addedDate: NOW.toISOString(),
        ...STALE
    }
];

// What `vocabulary` holds for them: the same words without fields outside WORD_FIELDS (here: created_date)
const secondStored = { ...expectedWords[1] };
delete secondStored.created_date;
const expectedStored = [expectedWords[0], secondStored, expectedWords[2]];

function oldFormatStorage() {
    return createMemoryStorage({
        allVocabulary: JSON.stringify(oldWords),
        userProgress: JSON.stringify(oldProgress)
    });
}

describe('VocabularyStore migration from the two old keys', () => {
    it('returns the merged words, writes `vocabulary` once and leaves the old keys byte-identical', () => {
        const storage = oldFormatStorage();
        const rawWords = storage.data.allVocabulary;
        const rawProgress = storage.data.userProgress;

        const words = createVocabularyStore({ storage, now: () => NOW }).load();

        expect(words).toEqual(expectedWords);
        expect(storage.setItem).toHaveBeenCalledTimes(1);
        expect(storage.setItem).toHaveBeenCalledWith('vocabulary', expect.any(String));
        expect(JSON.parse(storage.data.vocabulary)).toEqual({ schemaVersion: 1, words: expectedStored });
        expect(storage.data.allVocabulary).toBe(rawWords);
        expect(storage.data.userProgress).toBe(rawProgress);
        expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('reads `vocabulary` on the next load and writes nothing', () => {
        const storage = oldFormatStorage();
        createVocabularyStore({ storage, now: () => NOW }).load();
        storage.setItem.mockClear();

        const words = createVocabularyStore({ storage, now: () => LATER }).load();

        expect(words).toEqual(expectedStored);
        expect(storage.setItem).not.toHaveBeenCalled();
        expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('migrates when only one old key exists', () => {
        const storage = createMemoryStorage({ allVocabulary: JSON.stringify([oldWords[2]]) });
        expect(createVocabularyStore({ storage, now: () => NOW }).load()).toEqual([expectedWords[2]]);
        expect(JSON.parse(storage.data.vocabulary).words).toEqual([expectedWords[2]]);
    });

    it('refuses unreadable old keys and writes nothing', () => {
        const storage = createMemoryStorage({ allVocabulary: JSON.stringify(oldWords), userProgress: '{broken' });
        expect(() => createVocabularyStore({ storage, now: () => NOW }).load()).toThrow();
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('returns no words and writes nothing on an empty device', () => {
        const storage = createMemoryStorage();
        expect(createVocabularyStore({ storage, now: () => NOW }).load()).toEqual([]);
        expect(storage.setItem).not.toHaveBeenCalled();
    });
});

describe('VocabularyStore with the `vocabulary` key', () => {
    it('ignores the old keys once `vocabulary` exists', () => {
        const storage = oldFormatStorage();
        storage.data.vocabulary = JSON.stringify({ schemaVersion: 1, words: [expectedWords[2]] });
        expect(createVocabularyStore({ storage, now: () => NOW }).load()).toEqual([expectedWords[2]]);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it.each([
        ['not JSON', '{broken'],
        ['an unknown schemaVersion', JSON.stringify({ schemaVersion: 2, words: [] })],
        ['words that are not a list', JSON.stringify({ schemaVersion: 1, words: {} })]
    ])('throws on %s without touching storage or falling back to old keys', (_, raw) => {
        const storage = oldFormatStorage();
        storage.data.vocabulary = raw;
        const before = { ...storage.data };

        expect(() => createVocabularyStore({ storage, now: () => NOW }).load()).toThrow();

        expect(storage.data).toEqual(before);
        expect(storage.setItem).not.toHaveBeenCalled();
        expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('dates a word without createdAt by its addedDate, not by now', () => {
        const storage = createMemoryStorage();
        const word = { ...first, addedDate: '2025-07-24T10:00:00.000Z' };
        expect(word).not.toHaveProperty('createdAt');
        storage.data.vocabulary = JSON.stringify({ schemaVersion: 1, words: [word] });

        const [loaded] = createVocabularyStore({ storage, now: () => NOW }).load();

        expect(loaded.createdAt).toBe('2025-07-24T10:00:00.000Z');
        expect(loaded.addedDate).toBe('2025-07-24T10:00:00.000Z');
    });

    it('dates a word with neither createdAt nor addedDate by now', () => {
        const storage = createMemoryStorage();
        const word = { ...first };
        delete word.addedDate;
        expect(word).not.toHaveProperty('createdAt');
        storage.data.vocabulary = JSON.stringify({ schemaVersion: 1, words: [word] });

        const [loaded] = createVocabularyStore({ storage, now: () => NOW }).load();

        expect(loaded.createdAt).toBe(NOW.toISOString());
        expect(loaded.addedDate).toBe(NOW.toISOString());
    });

    it('round-trips save then load', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.save(expectedStored);
        expect(store.load()).toEqual(expectedStored);
    });

    it('writes only the word fields of the backup file, leaving session fields in memory', () => {
        const storage = createMemoryStorage();
        const saved = { ...first, createdAt: '2025-07-24T10:00:00.000Z', updatedAt: '2025-07-25T10:00:00.000Z' };
        const inMemory = {
            ...saved,
            sessionExerciseTypes: ['regular', 'reverse'],
            currentExerciseType: 'reverse',
            lastExerciseType: 'reverse',
            lastExerciseDate: '2030-01-01T00:00:00.000Z',
            interval: 6
        };

        createVocabularyStore({ storage, now: () => NOW }).save([inMemory]);

        const [stored] = JSON.parse(storage.data.vocabulary).words;
        expect(stored).toEqual(saved);
        expect(Object.keys(stored)).toEqual(WORD_FIELDS);
        expect(inMemory.sessionExerciseTypes).toEqual(['regular', 'reverse']);
    });

    it('throws when the write fails', () => {
        const storage = createMemoryStorage();
        storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
        expect(() => createVocabularyStore({ storage, now: () => NOW }).save(expectedWords)).toThrow('QuotaExceededError');
    });
});

const stamped = (words, at = NOW) => words.map(word => ({ ...word, updatedAt: at.toISOString() }));

describe('VocabularyStore snapshot', () => {
    it('restores the snapshot words stamped now and records deletions for words missing from it', () => {
        const raw = JSON.stringify({ schemaVersion: 1, words: expectedStored });
        const storage = createMemoryStorage({ vocabulary: raw });
        const store = createVocabularyStore({ storage, now: () => NOW });
        expect(store.getSnapshotDate()).toBeNull();

        store.saveSnapshot();
        expect(JSON.parse(storage.data.snapshotBeforeImport)).toEqual({ savedAt: NOW.toISOString(), vocabulary: raw });
        expect(store.getSnapshotDate()).toBe('2030-01-02');

        const restoring = createVocabularyStore({ storage, now: () => LATER });
        restoring.save([{ ...expectedStored[0], repetition: 9 }, { id: 'imported' }]);
        restoring.restoreSnapshot();

        expect(restoring.load()).toEqual(stamped(expectedStored, LATER));
        expect(restoring.loadDeletions()).toEqual({ imported: LATER.toISOString() });
        expect(storage.data.snapshotBeforeImport).toBeUndefined();
        expect(restoring.getSnapshotDate()).toBeNull();
    });

    it('restore to a device that had no words leaves none and records deletions for all', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.saveSnapshot();
        store.save(expectedStored);

        store.restoreSnapshot();

        expect(store.load()).toEqual([]);
        expect(store.loadDeletions()).toEqual(Object.fromEntries(expectedStored.map(w => [w.id, NOW.toISOString()])));
        expect(storage.data.snapshotBeforeImport).toBeUndefined();
    });

    it('restores an old-shape snapshot by migrating its two keys, leaving the old keys as they are', () => {
        const storage = createMemoryStorage({
            allVocabulary: '[]',
            userProgress: '{}',
            vocabulary: JSON.stringify({ schemaVersion: 1, words: [] }),
            snapshotBeforeImport: JSON.stringify({ savedAt: '2026-11-20T10:00:00.000Z', allVocabulary: JSON.stringify(oldWords), userProgress: JSON.stringify(oldProgress) })
        });
        const store = createVocabularyStore({ storage, now: () => NOW });
        expect(store.getSnapshotDate()).toBe('2026-11-20');

        store.restoreSnapshot();

        expect(JSON.parse(storage.data.vocabulary)).toEqual({ schemaVersion: 1, words: stamped(expectedStored) });
        expect(storage.data.allVocabulary).toBe('[]');
        expect(storage.data.userProgress).toBe('{}');
        expect(storage.data.snapshotBeforeImport).toBeUndefined();
    });

    it('restores an old-shape snapshot whose progress key was empty', () => {
        const storage = createMemoryStorage({
            snapshotBeforeImport: JSON.stringify({ savedAt: '2026-11-20T10:00:00.000Z', allVocabulary: JSON.stringify([oldWords[2]]), userProgress: null })
        });
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.restoreSnapshot();
        expect(store.load()).toEqual(stamped([expectedWords[2]]));
    });

    it('keeps everything when the snapshot is unreadable', () => {
        const storage = createMemoryStorage({
            vocabulary: 'kept',
            snapshotBeforeImport: JSON.stringify({ savedAt: '2026-11-20T10:00:00.000Z', vocabulary: '{broken' })
        });
        const before = { ...storage.data };
        expect(() => createVocabularyStore({ storage, now: () => NOW }).restoreSnapshot()).toThrow();
        expect(storage.data).toEqual(before);
    });

    it('restore does nothing without a snapshot', () => {
        const storage = createMemoryStorage({ vocabulary: 'kept' });
        createVocabularyStore({ storage, now: () => NOW }).restoreSnapshot();
        expect(storage.data).toEqual({ vocabulary: 'kept' });
    });
});

describe('VocabularyStore replace all and deletions', () => {
    it('replaceAll stamps every word now, records deletions for missing ids and returns the stamped words', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.save([expectedStored[0], expectedStored[1]]);

        const result = createVocabularyStore({ storage, now: () => LATER }).replaceAll([expectedStored[1], expectedStored[2]]);

        expect(result).toEqual(stamped([expectedStored[1], expectedStored[2]], LATER));
        expect(store.load()).toEqual(result);
        expect(store.loadDeletions()).toEqual({ [expectedStored[0].id]: LATER.toISOString() });
    });

    it('replaceAll keeps earlier deletions and drops those of words that come back', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.recordDeletion('gone');
        store.recordDeletion(expectedStored[0].id);
        createVocabularyStore({ storage, now: () => LATER }).replaceAll([expectedStored[0]]);
        expect(store.loadDeletions()).toEqual({ gone: NOW.toISOString() });
    });

    it('replaceAll writes deletions before the words, so a failed write never loses a deletion', () => {
        const storage = createMemoryStorage({ vocabulary: JSON.stringify({ schemaVersion: 1, words: [expectedStored[0]] }) });
        const write = storage.setItem.getMockImplementation();
        storage.setItem.mockImplementation((key, value) => {
            if (key === 'vocabulary') throw new Error('QuotaExceededError');
            write(key, value);
        });
        const store = createVocabularyStore({ storage, now: () => NOW });

        expect(() => store.replaceAll([])).toThrow('QuotaExceededError');
        expect(store.loadDeletions()).toEqual({ [expectedStored[0].id]: NOW.toISOString() });
        expect(store.load()).toEqual([expectedStored[0]]);
    });

    it('recordDeletion adds one deletion per id with the time of deletion', () => {
        const storage = createMemoryStorage();
        createVocabularyStore({ storage, now: () => NOW }).recordDeletion('a');
        const store = createVocabularyStore({ storage, now: () => LATER });
        store.recordDeletion('b');
        expect(store.loadDeletions()).toEqual({ a: NOW.toISOString(), b: LATER.toISOString() });
    });

    it('treats missing or unreadable deletions as none', () => {
        expect(createVocabularyStore({ storage: createMemoryStorage(), now: () => NOW }).loadDeletions()).toEqual({});
        const broken = createMemoryStorage({ deletedWords: '{broken' });
        expect(createVocabularyStore({ storage: broken, now: () => NOW }).loadDeletions()).toEqual({});
    });
});

describe('findInvalidWordField', () => {
    it('accepts a complete word and names the first missing or invalid field', () => {
        expect(findInvalidWordField(first)).toBeUndefined();
        expect(findInvalidWordField({ ...first, translation: '' })).toBe('translation');
        expect(findInvalidWordField({ ...first, reviewHistory: undefined })).toBe('reviewHistory');
        expect(findInvalidWordField({ id: 'spike-1', original: 'hello', translation: 'привет' })).toBe('easeFactor');
        expect(findInvalidWordField(null)).toBe('id');
    });
});
