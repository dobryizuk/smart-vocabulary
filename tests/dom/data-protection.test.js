import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryStorage } from './test-helpers.js';

const { createDataManager } = require('../../js/data-manager.js');
const { createImportExport } = require('../../js/import-export.js');
const { createVocabularyStore, WORD_FIELDS } = require('../../js/vocabulary-store.js');
const fixture = require('../test-vocabulary.json');

const NOW = new Date('2026-11-22T10:00:00.000Z');
const PROGRESS_FIELDS = ['repetition', 'easeFactor', 'nextReview', 'reviewHistory'];

// Builds the app's data modules over one storage; calling it again on the same storage simulates a reload
function createApp({ storage = createMemoryStorage(), confirmResult = true } = {}) {
    const appMain = { showMessage: vi.fn(), renderWordList: vi.fn() };
    const store = createVocabularyStore({ storage, now: () => NOW });
    const dm = createDataManager({ store, appMain });
    dm.initializeVocabulary();
    const reload = vi.fn();
    const confirm = vi.fn(() => confirmResult);
    const ie = createImportExport({
        getVocabulary: () => dm.vocabulary,
        setVocabulary: (v) => { dm.vocabulary = v; },
        store,
        appMain,
        confirm,
        reload,
        getNow: () => NOW
    });
    return { storage, store, appMain, dm, ie, reload, confirm };
}

const fixtureText = () => JSON.stringify(fixture);
const rawVocabulary = (words) => JSON.stringify({ schemaVersion: 1, words });

describe('Data protection: export', () => {
    it('exports the current in-memory progress', () => {
        const { dm, ie } = createApp();
        dm.vocabulary = [{ id: 'w1', original: 'a', translation: 'б', repetition: 0, easeFactor: 1.3, nextReview: null, reviewHistory: [] }];
        dm.save();

        const history = [{ date: '2026-11-20', difficulty: 'easy' }, { date: '2026-11-21', difficulty: 'perfect' }];
        Object.assign(dm.vocabulary[0], { repetition: 3, easeFactor: 2.0, nextReview: '2026-12-01T00:00:00.000Z', reviewHistory: history });

        const [word] = ie.createExportData().vocabulary;
        expect(word.repetition).toBe(3);
        expect(word.easeFactor).toBe(2.0);
        expect(word.nextReview).toBe('2026-12-01T00:00:00.000Z');
        expect(word.reviewHistory).toEqual(history);
    });

    it('exports only the word fields of the backup file, without session fields', () => {
        const { dm, ie } = createApp();
        const word = { ...fixture.vocabulary[0], createdAt: '2025-07-24T10:00:00.000Z' };
        dm.vocabulary = [{
            ...word,
            sessionExerciseTypes: ['reverse'],
            currentExerciseType: 'reverse',
            lastExerciseType: 'reverse',
            lastExerciseDate: '2026-11-22T09:00:00.000Z',
            interval: 6
        }];

        const [exported] = ie.createExportData().vocabulary;

        expect(exported).toEqual(word);
        expect(Object.keys(exported)).toEqual(WORD_FIELDS);
    });

    it('exports no addedDate, also for words loaded from storage that still has it', () => {
        const legacy = { ...fixture.vocabulary[0], createdAt: '2025-09-01T08:00:00.000Z', addedDate: '2025-07-20' };
        const { ie } = createApp({ storage: createMemoryStorage({ vocabulary: rawVocabulary([legacy]) }) });

        const [exported] = ie.createExportData().vocabulary;

        expect(exported).not.toHaveProperty('addedDate');
        expect(exported.createdAt).toBe('2025-07-20T00:00:00.000Z');
    });

    it('writes schemaVersion 1 into the export', () => {
        const { ie } = createApp();
        expect(ie.createExportData().schemaVersion).toBe(1);
    });
});

describe('Data protection: import', () => {
    let app;
    beforeEach(() => {
        app = createApp();
    });

    it('accepts an old-format file without schemaVersion', async () => {
        expect(fixture.schemaVersion).toBeUndefined();
        await app.ie.importFromText(fixtureText());
        expect(app.dm.vocabulary).toHaveLength(fixture.vocabulary.length);
        expect(app.appMain.showMessage).toHaveBeenCalledWith(expect.stringContaining('imported successfully'), 'success');
        expect(app.reload).toHaveBeenCalled();
    });

    it('rejects an empty vocabulary and leaves storage unchanged', async () => {
        await app.ie.importFromText(fixtureText());
        const before = { ...app.storage.data };

        await app.ie.importFromText(JSON.stringify({ vocabulary: [] }));

        expect(app.storage.data).toEqual(before);
        expect(app.dm.vocabulary).toHaveLength(fixture.vocabulary.length);
        expect(app.appMain.showMessage).toHaveBeenLastCalledWith(expect.stringContaining('no words'), 'error');
    });

    it('rejects a file that is not JSON without touching storage', async () => {
        await app.ie.importFromText('not json');
        expect(app.storage.data).toEqual({});
        expect(app.appMain.showMessage).toHaveBeenLastCalledWith(expect.stringContaining('check the file format'), 'error');
    });

    it('asks for confirmation with counts and the backup date', async () => {
        await app.ie.importFromText(fixtureText());
        app.confirm.mockClear();
        await app.ie.importFromText(JSON.stringify({ ...fixture, exportDate: '2026-10-05T08:00:00.000Z' }));
        expect(app.confirm).toHaveBeenCalledWith(
            `Replace your ${fixture.vocabulary.length} words with ${fixture.vocabulary.length} words from the backup of 2026-10-05?`
        );
    });

    it('changes nothing when the confirmation is cancelled', async () => {
        const storage = createMemoryStorage({ vocabulary: rawVocabulary([{ id: 'keep' }]) });
        const cancelled = createApp({ storage, confirmResult: false });
        const before = { ...cancelled.storage.data };

        await cancelled.ie.importFromText(fixtureText());

        expect(cancelled.storage.data).toEqual(before);
        expect(cancelled.reload).not.toHaveBeenCalled();
    });

    it('snapshots the previous raw `vocabulary` and restore puts its words back, stamped now and dated right', async () => {
        // Stored by the previous version: a createdAt later than the word was added
        const oldWord = { id: 'old', original: 'old', translation: 'старый', repetition: 4, easeFactor: 2.1, nextReview: null, reviewHistory: [], createdAt: '2026-02-01T00:00:00.000Z', addedDate: '2026-01-01T00:00:00.000Z' };
        const raw = rawVocabulary([oldWord]);
        const restoring = createApp({ storage: createMemoryStorage({ vocabulary: raw }) });
        expect(restoring.store.getSnapshotDate()).toBeNull();

        await restoring.ie.importFromText(fixtureText());

        expect(restoring.storage.data.vocabulary).not.toBe(raw);
        const snapshot = JSON.parse(restoring.storage.data.snapshotBeforeImport);
        expect(snapshot).toEqual({ savedAt: NOW.toISOString(), vocabulary: raw });
        expect(restoring.store.getSnapshotDate()).toBe('2026-11-22');

        const afterImport = { ...restoring.storage.data };

        restoring.confirm.mockReturnValueOnce(false);
        restoring.reload.mockClear();
        restoring.ie.restoreSnapshot();
        expect(restoring.storage.data).toEqual(afterImport);
        expect(restoring.reload).not.toHaveBeenCalled();

        restoring.ie.restoreSnapshot();

        expect(restoring.confirm).toHaveBeenLastCalledWith(
            'Go back to your data from before the restore on 2026-11-22? Progress made since then will be lost.'
        );
        expect(restoring.storage.data.snapshotBeforeImport).toBeUndefined();
        const { addedDate, ...repaired } = oldWord;
        expect(restoring.store.load()).toEqual([{ ...repaired, createdAt: addedDate, updatedAt: NOW.toISOString() }]);
        expect(JSON.parse(restoring.storage.data.vocabulary).words[0]).not.toHaveProperty('addedDate');
        expect(Object.keys(restoring.store.loadDeletions())).toEqual(fixture.vocabulary.map(w => w.id));
        expect(restoring.reload).toHaveBeenCalledTimes(1);
    });

    it('restores an old-shape snapshot from the previous version and migrates it on the next load', () => {
        const oldWords = [{ id: 'old', original: 'old', translation: 'старый', createdAt: '2026-01-05T00:00:00.000Z' }];
        const oldProgress = { old: { repetition: 4, easeFactor: 2.1, nextReview: '2026-12-01T00:00:00.000Z', reviewHistory: [], addedDate: '2026-01-01' } };
        // State left by the previous version after an import: imported words in the old keys plus an old-shape snapshot
        const storage = createMemoryStorage({
            allVocabulary: JSON.stringify(fixture.vocabulary),
            userProgress: '{}',
            snapshotBeforeImport: JSON.stringify({
                savedAt: '2026-11-20T10:00:00.000Z',
                allVocabulary: JSON.stringify(oldWords),
                userProgress: JSON.stringify(oldProgress)
            })
        });
        const imported = createApp({ storage });
        expect(imported.dm.vocabulary).toHaveLength(fixture.vocabulary.length);
        expect(storage.data.vocabulary).toBeDefined();

        imported.ie.restoreSnapshot();

        expect(imported.confirm).toHaveBeenLastCalledWith(expect.stringContaining('from before the restore on 2026-11-20'));
        const reloaded = createApp({ storage });
        const { addedDate, ...progress } = oldProgress.old;
        expect(reloaded.dm.vocabulary).toEqual([{ ...oldWords[0], ...progress, createdAt: `${addedDate}T00:00:00.000Z`, updatedAt: NOW.toISOString() }]);
        expect(JSON.parse(storage.data.vocabulary).words).toEqual(reloaded.dm.vocabulary);
    });

    it('restore leaves no words when there were none before the import', async () => {
        await app.ie.importFromText(fixtureText());
        app.ie.restoreSnapshot();
        expect(createApp({ storage: app.storage }).dm.vocabulary).toEqual([]);
        expect(app.storage.data.snapshotBeforeImport).toBeUndefined();
    });

    it('shows an error and does not reload when the snapshot cannot be restored', () => {
        const storage = createMemoryStorage({
            vocabulary: rawVocabulary([]),
            snapshotBeforeImport: JSON.stringify({ savedAt: '2026-11-20T10:00:00.000Z', vocabulary: '{broken' })
        });
        const broken = createApp({ storage });

        broken.ie.restoreSnapshot();

        expect(broken.reload).not.toHaveBeenCalled();
        expect(broken.appMain.showMessage).toHaveBeenLastCalledWith(expect.stringContaining('Undo failed.'), 'error');
        expect(broken.store.getSnapshotDate()).toBe('2026-11-20');
    });

    it('restore does nothing without a snapshot', () => {
        app.ie.restoreSnapshot();
        expect(app.confirm).not.toHaveBeenCalled();
        expect(app.reload).not.toHaveBeenCalled();
    });

    it('keeps the old data when the snapshot cannot be written', async () => {
        const raw = rawVocabulary([{ id: 'keep' }]);
        const storage = createMemoryStorage({ vocabulary: raw });
        storage.setItem.mockImplementation((key) => { throw new Error(`quota ${key}`); });
        const blocked = createApp({ storage });

        await blocked.ie.importFromText(fixtureText());

        expect(storage.data).toEqual({ vocabulary: raw });
        expect(blocked.reload).not.toHaveBeenCalled();
        expect(blocked.appMain.showMessage).toHaveBeenLastCalledWith('Import failed. quota snapshotBeforeImport', 'error');
    });

    it('does not reload and keeps the snapshot when writing the imported words fails', async () => {
        const raw = rawVocabulary([{ id: 'keep' }]);
        const storage = createMemoryStorage({ vocabulary: raw });
        const failing = createApp({ storage });
        const setItem = storage.setItem.getMockImplementation();
        storage.setItem.mockImplementation((key, value) => {
            if (key === 'vocabulary') throw new Error('QuotaExceededError');
            setItem(key, value);
        });

        await failing.ie.importFromText(fixtureText());

        expect(failing.reload).not.toHaveBeenCalled();
        expect(failing.appMain.showMessage).toHaveBeenLastCalledWith('Import failed. QuotaExceededError', 'error');
        expect(failing.dm.vocabulary.map(w => w.id)).toEqual(['keep']);
        expect(storage.data.vocabulary).toBe(raw);
        expect(failing.store.getSnapshotDate()).toBe('2026-11-22');
    });

    it('round trip: fixture -> import -> export keeps words and progress', async () => {
        await app.ie.importFromText(fixtureText());
        const exported = app.ie.createExportData();

        expect(exported.vocabulary.map(w => w.id)).toEqual(fixture.vocabulary.map(w => w.id));
        fixture.vocabulary.forEach((original, i) => {
            const roundTripped = exported.vocabulary[i];
            expect(roundTripped.original).toBe(original.original);
            expect(roundTripped.translation).toBe(original.translation);
            PROGRESS_FIELDS.forEach(field => expect(roundTripped[field]).toEqual(original[field]));
        });
    });

    it('round trip across reloads: export -> import -> export is identical', async () => {
        await app.ie.importFromText(fixtureText());
        const firstExport = createApp({ storage: app.storage }).ie.createExportData();

        const second = createApp({ storage: app.storage });
        await second.ie.importFromText(JSON.stringify(firstExport));
        const secondExport = createApp({ storage: app.storage }).ie.createExportData();

        expect(secondExport).toEqual(firstExport);
        expect(firstExport.totalWords).toBe(fixture.vocabulary.length);
    });

    // A backup written by the previous version: dates in both fields and in both formats
    const [first, second, third] = fixture.vocabulary;
    const legacyBackup = {
        ...fixture,
        schemaVersion: 1,
        vocabulary: [
            { ...first, createdAt: '2025-09-01T08:00:00.000Z', addedDate: '2025-07-20' },
            { ...second, addedDate: '2025-08-01T10:00:00.000Z' },
            { ...third, createdAt: '2025-08-15T10:00:00.000Z', addedDate: '2025-07-28T10:00:00.000Z' }
        ]
    };
    const repairedDates = ['2025-07-20T00:00:00.000Z', second.createdAt, '2025-07-28T10:00:00.000Z'];

    it('restores a legacy backup with the earlier date as createdAt and without addedDate', async () => {
        await app.ie.importFromText(JSON.stringify(legacyBackup));

        expect(app.dm.vocabulary.map(w => w.createdAt)).toEqual(repairedDates);
        const stored = createApp({ storage: app.storage }).dm.vocabulary;
        expect(stored.map(w => w.createdAt)).toEqual(repairedDates);
        stored.forEach((word, i) => {
            expect(word).not.toHaveProperty('addedDate');
            expect(word).toEqual({ ...legacyBackup.vocabulary[i], addedDate: undefined, createdAt: repairedDates[i], updatedAt: NOW.toISOString() });
        });
    });

    it('round trip of a legacy backup: import -> export -> import -> export is identical and has no addedDate', async () => {
        await app.ie.importFromText(JSON.stringify(legacyBackup));
        const firstExport = createApp({ storage: app.storage }).ie.createExportData();

        await createApp({ storage: app.storage }).ie.importFromText(JSON.stringify(firstExport));
        const secondExport = createApp({ storage: app.storage }).ie.createExportData();

        expect(secondExport).toEqual(firstExport);
        expect(firstExport.vocabulary.map(w => w.createdAt)).toEqual(repairedDates);
        firstExport.vocabulary.forEach(word => expect(word).not.toHaveProperty('addedDate'));
    });
});
