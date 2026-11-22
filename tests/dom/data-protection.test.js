import { describe, it, expect, beforeEach, vi } from 'vitest';

const { createDataManager } = require('../../js/data-manager.js');
const { createImportExport } = require('../../js/import-export.js');
const fixture = require('../test-vocabulary.json');

const NOW = new Date('2026-11-22T10:00:00.000Z');
const PROGRESS_FIELDS = ['repetition', 'easeFactor', 'nextReview', 'reviewHistory'];

function createMemoryStorage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => { data[key] = String(value); },
        removeItem: (key) => { delete data[key]; }
    };
}

function createApp({ storage = createMemoryStorage(), confirmResult = true } = {}) {
    const appMain = { showMessage: vi.fn(), renderWordList: vi.fn() };
    const dm = createDataManager({ storage, appMain, now: () => NOW });
    const reload = vi.fn();
    const confirm = vi.fn(() => confirmResult);
    const ie = createImportExport({
        getVocabulary: () => dm.vocabulary,
        setVocabulary: (v) => { dm.vocabulary = v; },
        saveUserProgress: () => dm.saveUserProgress(),
        saveAllVocabulary: () => dm.saveAllVocabulary(),
        storage,
        appMain,
        confirm,
        reload,
        getNow: () => NOW
    });
    return { storage, appMain, dm, ie, reload, confirm };
}

const fixtureText = () => JSON.stringify(fixture);

describe('Data protection: export', () => {
    it('exports the current progress, not the stale copy in allVocabulary', async () => {
        const { dm, ie } = createApp();
        dm.vocabulary = [{ id: 'w1', original: 'a', translation: 'б', repetition: 0, easeFactor: 1.3, nextReview: null, reviewHistory: [] }];
        dm.saveAllVocabulary();

        const history = [{ date: '2026-11-20', difficulty: 'easy' }, { date: '2026-11-21', difficulty: 'perfect' }];
        Object.assign(dm.vocabulary[0], { repetition: 3, easeFactor: 2.0, nextReview: '2026-12-01T00:00:00.000Z', reviewHistory: history });
        await dm.saveUserProgress();

        const [word] = ie.createExportData().vocabulary;
        expect(word.repetition).toBe(3);
        expect(word.easeFactor).toBe(2.0);
        expect(word.nextReview).toBe('2026-12-01T00:00:00.000Z');
        expect(word.reviewHistory).toEqual(history);
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
        const cancelled = createApp({ confirmResult: false });
        cancelled.storage.setItem('allVocabulary', '[{"id":"keep"}]');
        cancelled.storage.setItem('userProgress', '{"keep":{}}');
        const before = { ...cancelled.storage.data };

        await cancelled.ie.importFromText(fixtureText());

        expect(cancelled.storage.data).toEqual(before);
        expect(cancelled.reload).not.toHaveBeenCalled();
    });

    it('snapshots the previous raw values and restore puts them back exactly', async () => {
        const rawVocabulary = '[{"id":"old","original":"old","translation":"старый"}]';
        const rawProgress = '{"old":{"repetition":4,"easeFactor":2.1,"nextReview":null,"reviewHistory":[]}}';
        app.storage.setItem('allVocabulary', rawVocabulary);
        app.storage.setItem('userProgress', rawProgress);
        expect(app.ie.getSnapshotDate()).toBeNull();

        await app.ie.importFromText(fixtureText());

        expect(app.storage.getItem('allVocabulary')).not.toBe(rawVocabulary);
        const snapshot = JSON.parse(app.storage.getItem('snapshotBeforeImport'));
        expect(snapshot).toEqual({ savedAt: NOW.toISOString(), allVocabulary: rawVocabulary, userProgress: rawProgress });
        expect(app.ie.getSnapshotDate()).toBe('2026-11-22');

        const afterImport = { ...app.storage.data };

        app.confirm.mockReturnValueOnce(false);
        app.reload.mockClear();
        app.ie.restoreSnapshot();
        expect(app.storage.data).toEqual(afterImport);
        expect(app.reload).not.toHaveBeenCalled();

        app.ie.restoreSnapshot();

        expect(app.confirm).toHaveBeenLastCalledWith(expect.stringContaining('from before the restore on 2026-11-22'));
        expect(app.storage.getItem('allVocabulary')).toBe(rawVocabulary);
        expect(app.storage.getItem('userProgress')).toBe(rawProgress);
        expect(app.storage.getItem('snapshotBeforeImport')).toBeNull();
        expect(app.ie.getSnapshotDate()).toBeNull();
        expect(app.reload).toHaveBeenCalledTimes(1);
    });

    it('restore removes keys that did not exist before the import', async () => {
        await app.ie.importFromText(fixtureText());
        app.ie.restoreSnapshot();
        expect(app.storage.getItem('allVocabulary')).toBeNull();
        expect(app.storage.getItem('userProgress')).toBeNull();
    });

    it('restore does nothing without a snapshot', () => {
        app.ie.restoreSnapshot();
        expect(app.reload).not.toHaveBeenCalled();
    });

    it('keeps the old data when the snapshot cannot be written', async () => {
        app.storage.setItem('allVocabulary', '[{"id":"keep"}]');
        const setItem = app.storage.setItem;
        app.storage.setItem = (key, value) => {
            if (key === 'snapshotBeforeImport') throw new Error('quota');
            setItem(key, value);
        };
        await app.ie.importFromText(fixtureText());
        expect(app.storage.getItem('allVocabulary')).toBe('[{"id":"keep"}]');
        expect(app.appMain.showMessage).toHaveBeenLastCalledWith(expect.stringContaining('quota'), 'error');
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
});

describe('Data protection: write failures', () => {
    it('shows an error when saving progress or words fails', async () => {
        const storage = createMemoryStorage();
        storage.setItem = () => { throw new Error('QuotaExceededError'); };
        const { dm, appMain } = createApp({ storage });
        dm.vocabulary = [{ id: 'w1', original: 'a', translation: 'б', repetition: 0, easeFactor: 1.3, reviewHistory: [] }];

        await dm.saveUserProgress();
        expect(appMain.showMessage).toHaveBeenLastCalledWith(expect.stringContaining('save your progress'), 'error');

        dm.saveAllVocabulary();
        expect(appMain.showMessage).toHaveBeenLastCalledWith(expect.stringContaining('save your words'), 'error');
    });
});
