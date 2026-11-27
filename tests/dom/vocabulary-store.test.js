import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './test-helpers.js';

const { createVocabularyStore, WORD_FIELDS, findInvalidWordField, withCreatedAt } = require('../../js/vocabulary-store.js');
const fixture = require('../test-vocabulary.json');

const NOW = new Date('2030-01-02T03:04:05.000Z');
const LATER = new Date('2030-02-01T00:00:00.000Z');
const [first, second] = fixture.vocabulary;
const STALE = { repetition: 0, easeFactor: 1.3, nextReview: null, reviewHistory: [] };

// What the production version stores: words with stale progress + current progress by id.
// The creation date may also sit in `addedDate` (in the progress) or `created_date` (in the word).
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
        addedDate: '2025-07-20'
    },
    [second.id]: {
        repetition: 4,
        easeFactor: 2.1,
        nextReview: '2031-01-01T00:00:00.000Z',
        reviewHistory: [{ date: '2030-01-01T00:00:00.000Z', difficulty: 'easy', exerciseType: 'regular' }]
    }
};
// The words for the data above: dated by the earliest of their dates, without the duplicates
const expectedWords = [
    { ...first, createdAt: '2025-07-20T00:00:00.000Z' },
    { ...second, createdAt: '2024-05-05T00:00:00.000Z', ...oldProgress[second.id] },
    { id: 'no_progress', original: 'new', translation: 'новый', createdAt: NOW.toISOString(), ...STALE }
];

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
        expect(JSON.parse(storage.data.vocabulary)).toEqual({ schemaVersion: 1, words: expectedWords });
        expect(storage.data.allVocabulary).toBe(rawWords);
        expect(storage.data.userProgress).toBe(rawProgress);
        expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('reads `vocabulary` on the next load and writes nothing', () => {
        const storage = oldFormatStorage();
        createVocabularyStore({ storage, now: () => NOW }).load();
        storage.setItem.mockClear();

        const words = createVocabularyStore({ storage, now: () => LATER }).load();

        expect(words).toEqual(expectedWords);
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

    it('repairs a createdAt later than addedDate on every load without writing', () => {
        const legacy = { ...first, createdAt: '2025-08-30T09:00:00.000Z', addedDate: '2025-07-24' };
        const raw = JSON.stringify({ schemaVersion: 1, words: [legacy] });
        const storage = createMemoryStorage({ vocabulary: raw });

        const [loaded] = createVocabularyStore({ storage, now: () => NOW }).load();

        expect(loaded).toEqual({ ...first, createdAt: '2025-07-24T00:00:00.000Z' });
        expect(loaded).not.toHaveProperty('addedDate');
        expect(storage.setItem).not.toHaveBeenCalled();
        expect(storage.data.vocabulary).toBe(raw);
    });

    it('stores the repaired date without addedDate at the next save', () => {
        const legacy = { ...first, createdAt: '2025-08-30T09:00:00.000Z', addedDate: '2025-07-24T10:00:00.000Z' };
        const storage = createMemoryStorage({ vocabulary: JSON.stringify({ schemaVersion: 1, words: [legacy] }) });
        const store = createVocabularyStore({ storage, now: () => NOW });

        store.save(store.load());

        const [stored] = JSON.parse(storage.data.vocabulary).words;
        expect(stored.createdAt).toBe('2025-07-24T10:00:00.000Z');
        expect(stored).not.toHaveProperty('addedDate');
        expect(WORD_FIELDS).not.toContain('addedDate');
    });

    it('round-trips save then load', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.save(expectedWords);
        expect(store.load()).toEqual(expectedWords);
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
        const raw = JSON.stringify({ schemaVersion: 1, words: expectedWords });
        const storage = createMemoryStorage({ vocabulary: raw });
        const store = createVocabularyStore({ storage, now: () => NOW });
        expect(store.getSnapshotDate()).toBeNull();

        store.saveSnapshot();
        expect(JSON.parse(storage.data.snapshotBeforeImport)).toEqual({ savedAt: NOW.toISOString(), vocabulary: raw });
        expect(store.getSnapshotDate()).toBe('2030-01-02');

        const restoring = createVocabularyStore({ storage, now: () => LATER });
        restoring.save([{ ...expectedWords[0], repetition: 9 }, { id: 'imported' }]);
        restoring.restoreSnapshot();

        expect(restoring.load()).toEqual(stamped(expectedWords, LATER));
        expect(restoring.loadDeletions()).toEqual({ imported: LATER.toISOString() });
        expect(storage.data.snapshotBeforeImport).toBeUndefined();
        expect(restoring.getSnapshotDate()).toBeNull();
    });

    it('restore to a device that had no words leaves none and records deletions for all', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.saveSnapshot();
        store.save(expectedWords);

        store.restoreSnapshot();

        expect(store.load()).toEqual([]);
        expect(store.loadDeletions()).toEqual(Object.fromEntries(expectedWords.map(w => [w.id, NOW.toISOString()])));
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

        expect(JSON.parse(storage.data.vocabulary)).toEqual({ schemaVersion: 1, words: stamped(expectedWords) });
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
        store.save([expectedWords[0], expectedWords[1]]);

        const result = createVocabularyStore({ storage, now: () => LATER }).replaceAll([expectedWords[1], expectedWords[2]]);

        expect(result).toEqual(stamped([expectedWords[1], expectedWords[2]], LATER));
        expect(store.load()).toEqual(result);
        expect(store.loadDeletions()).toEqual({ [expectedWords[0].id]: LATER.toISOString() });
    });

    it('replaceAll keeps earlier deletions and drops those of words that come back', () => {
        const storage = createMemoryStorage();
        const store = createVocabularyStore({ storage, now: () => NOW });
        store.recordDeletion('gone');
        store.recordDeletion(expectedWords[0].id);
        createVocabularyStore({ storage, now: () => LATER }).replaceAll([expectedWords[0]]);
        expect(store.loadDeletions()).toEqual({ gone: NOW.toISOString() });
    });

    it('replaceAll writes deletions before the words, so a failed write never loses a deletion', () => {
        const storage = createMemoryStorage({ vocabulary: JSON.stringify({ schemaVersion: 1, words: [expectedWords[0]] }) });
        const write = storage.setItem.getMockImplementation();
        storage.setItem.mockImplementation((key, value) => {
            if (key === 'vocabulary') throw new Error('QuotaExceededError');
            write(key, value);
        });
        const store = createVocabularyStore({ storage, now: () => NOW });

        expect(() => store.replaceAll([])).toThrow('QuotaExceededError');
        expect(store.loadDeletions()).toEqual({ [expectedWords[0].id]: NOW.toISOString() });
        expect(store.load()).toEqual([expectedWords[0]]);
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

describe('withCreatedAt', () => {
    const at = NOW.toISOString();
    const created = (dates) => withCreatedAt({ id: 'w', original: 'a', translation: 'б', ...dates }, at).createdAt;

    it.each([
        ['createdAt later than addedDate takes addedDate', { createdAt: '2025-09-01T08:00:00.000Z', addedDate: '2025-07-24T10:00:00.000Z' }, '2025-07-24T10:00:00.000Z'],
        ['createdAt earlier than addedDate is kept', { createdAt: '2025-07-01T08:00:00.000Z', addedDate: '2025-07-24T10:00:00.000Z' }, '2025-07-01T08:00:00.000Z'],
        ['equal dates stay', { createdAt: '2025-07-24T10:00:00.000Z', addedDate: '2025-07-24T10:00:00.000Z' }, '2025-07-24T10:00:00.000Z'],
        ['a date-only addedDate is the start of that UTC day', { createdAt: '2025-08-30T09:00:00.000Z', addedDate: '2025-06-29' }, '2025-06-29T00:00:00.000Z'],
        ['a date-only addedDate after createdAt loses', { createdAt: '2025-06-28T23:00:00.000Z', addedDate: '2025-06-29' }, '2025-06-28T23:00:00.000Z'],
        ['an offset is compared as an instant', { createdAt: '2025-07-24T01:00:00+03:00', addedDate: '2025-07-23T23:00:00.000Z' }, '2025-07-23T22:00:00.000Z'],
        ['a createdAt without milliseconds becomes full ISO', { createdAt: '2025-07-24T10:00:00Z' }, '2025-07-24T10:00:00.000Z'],
        ['only createdAt', { createdAt: '2025-07-24T10:00:00.000Z' }, '2025-07-24T10:00:00.000Z'],
        ['only addedDate', { addedDate: '2025-07-24T10:00:00.000Z' }, '2025-07-24T10:00:00.000Z'],
        ['only created_date', { created_date: '2024-05-05T00:00:00.000Z' }, '2024-05-05T00:00:00.000Z'],
        ['created_date counts too', { createdAt: '2025-07-24T10:00:00.000Z', addedDate: '2025-07-20', created_date: '2024-05-05T00:00:00.000Z' }, '2024-05-05T00:00:00.000Z'],
        ['neither: now', {}, NOW.toISOString()],
        ['empty strings and null: now', { createdAt: '', addedDate: null }, NOW.toISOString()],
        ['an invalid createdAt gives way to addedDate', { createdAt: 'yesterday', addedDate: '2025-07-24' }, '2025-07-24T00:00:00.000Z'],
        ['an invalid addedDate is ignored', { createdAt: '2025-07-24T10:00:00.000Z', addedDate: '2025-13-45' }, '2025-07-24T10:00:00.000Z'],
        ['strings that only look like dates to a lenient parser are ignored', { createdAt: '1', addedDate: 'Jan 1' }, NOW.toISOString()],
        ['non-string dates are ignored', { createdAt: 1700000000000, addedDate: {} }, NOW.toISOString()]
    ])('%s', (_, dates, expected) => {
        expect(created(dates)).toBe(expected);
    });

    it('drops addedDate and created_date, keeps every other field and leaves the input as it was', () => {
        const legacy = { ...first, createdAt: '2025-09-01T08:00:00.000Z', addedDate: '2025-07-20', created_date: '2025-07-22', updatedAt: '2025-09-02T00:00:00.000Z' };
        const before = JSON.parse(JSON.stringify(legacy));

        const repaired = withCreatedAt(legacy, at);

        expect(repaired).toEqual({ ...first, createdAt: '2025-07-20T00:00:00.000Z', updatedAt: '2025-09-02T00:00:00.000Z' });
        expect(repaired).not.toHaveProperty('addedDate');
        expect(repaired).not.toHaveProperty('created_date');
        expect(repaired.reviewHistory).toBe(legacy.reviewHistory);
        expect(legacy).toEqual(before);
    });

    it('changes nothing on a second pass', () => {
        const once = withCreatedAt({ ...first, createdAt: '2025-09-01T08:00:00.000Z', addedDate: '2025-07-20' }, at);
        expect(withCreatedAt(once, LATER.toISOString())).toEqual(once);
    });
});
