import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './test-helpers.js';

const { createVocabularyStore, WORD_FIELDS } = require('../../js/vocabulary-store.js');
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
    { ...first, createdAt: NOW.toISOString() },
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

    it('round-trips save then load', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.save(expectedStored);
        expect(store.load()).toEqual(expectedStored);
    });

    it('writes only the word fields of the backup file, leaving session fields in memory', () => {
        const storage = createMemoryStorage();
        const saved = { ...first, createdAt: '2025-07-24T10:00:00.000Z' };
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

describe('VocabularyStore snapshot', () => {
    it('saves the raw `vocabulary` string and restores it exactly', () => {
        const raw = JSON.stringify({ schemaVersion: 1, words: expectedWords });
        const storage = createMemoryStorage({ vocabulary: raw });
        const store = createVocabularyStore({ storage, now: () => NOW });
        expect(store.getSnapshotDate()).toBeNull();

        store.saveSnapshot();
        expect(JSON.parse(storage.data.snapshotBeforeImport)).toEqual({ savedAt: NOW.toISOString(), vocabulary: raw });
        expect(store.getSnapshotDate()).toBe('2030-01-02');

        store.save([]);
        store.restoreSnapshot();

        expect(storage.data.vocabulary).toBe(raw);
        expect(storage.data.snapshotBeforeImport).toBeUndefined();
        expect(store.getSnapshotDate()).toBeNull();
    });

    it('restore removes `vocabulary` when there was none before the snapshot', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.saveSnapshot();
        store.save(expectedWords);

        store.restoreSnapshot();

        expect(storage.data).toEqual({});
    });

    it('restores an old-shape snapshot: writes both old keys, removes `vocabulary`, next load migrates them', () => {
        const rawWords = JSON.stringify(oldWords);
        const rawProgress = JSON.stringify(oldProgress);
        const storage = createMemoryStorage({
            allVocabulary: '[]',
            userProgress: '{}',
            vocabulary: JSON.stringify({ schemaVersion: 1, words: [] }),
            snapshotBeforeImport: JSON.stringify({ savedAt: '2026-11-20T10:00:00.000Z', allVocabulary: rawWords, userProgress: rawProgress })
        });
        const store = createVocabularyStore({ storage, now: () => NOW });
        expect(store.getSnapshotDate()).toBe('2026-11-20');

        store.restoreSnapshot();

        expect(storage.data).toEqual({ allVocabulary: rawWords, userProgress: rawProgress });
        expect(store.load()).toEqual(expectedWords);
        expect(JSON.parse(storage.data.vocabulary)).toEqual({ schemaVersion: 1, words: expectedStored });
    });

    it('restores an old-shape snapshot whose progress key was empty by removing it', () => {
        const storage = createMemoryStorage({
            userProgress: '{}',
            snapshotBeforeImport: JSON.stringify({ savedAt: '2026-11-20T10:00:00.000Z', allVocabulary: '[]', userProgress: null })
        });
        createVocabularyStore({ storage, now: () => NOW }).restoreSnapshot();
        expect(storage.data).toEqual({ allVocabulary: '[]' });
    });

    it('restore does nothing without a snapshot', () => {
        const storage = createMemoryStorage({ vocabulary: 'kept' });
        createVocabularyStore({ storage, now: () => NOW }).restoreSnapshot();
        expect(storage.data).toEqual({ vocabulary: 'kept' });
    });
});
