import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMemoryStorage } from './test-helpers.js';

const { createDataManager } = require('../../js/data-manager.js');
const { createVocabularyStore } = require('../../js/vocabulary-store.js');
const fixture = require('../test-vocabulary.json');

const NOW = new Date('2030-01-02T03:04:05.000Z');
const words = fixture.vocabulary.map(word => ({ ...word, createdAt: word.addedDate }));

function createManager(storage) {
    const appMain = { showMessage: vi.fn() };
    const store = createVocabularyStore({ storage, now: () => NOW });
    return { appMain, store, dm: createDataManager({ store, appMain }) };
}

describe('DataManager', () => {
    it('loads the words from the store and saves changes back', () => {
        const storage = createMemoryStorage({ vocabulary: JSON.stringify({ schemaVersion: 1, words }) });
        const { dm, store } = createManager(storage);

        dm.initializeVocabulary();
        expect(dm.vocabulary).toEqual(words);

        dm.vocabulary[0].repetition = 9;
        dm.save();
        expect(store.load()[0].repetition).toBe(9);
    });

    it('shows an error for an unreadable `vocabulary` and never overwrites it', () => {
        const storage = createMemoryStorage({ vocabulary: '{broken' });
        const { dm, appMain } = createManager(storage);

        dm.initializeVocabulary();

        expect(dm.vocabulary).toEqual([]);
        expect(appMain.showMessage).toHaveBeenCalledWith(expect.stringContaining('Could not load your saved words'), 'error');

        dm.vocabulary.push(words[0]);
        dm.save();

        expect(storage.data.vocabulary).toBe('{broken');
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('shows the storage-full toast when the write fails', () => {
        const storage = createMemoryStorage();
        storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
        const { dm, appMain } = createManager(storage);
        dm.initializeVocabulary();
        dm.vocabulary = words;

        dm.save();

        expect(appMain.showMessage).toHaveBeenLastCalledWith(
            'Could not save your words: device storage may be full. Make a backup now.', 'error'
        );
    });
});

describe('AppMain.deleteWord', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div class="container"></div>';
    });

    it('removes the word and persists the rest', () => {
        const storage = createMemoryStorage({ vocabulary: JSON.stringify({ schemaVersion: 1, words }) });
        const { dm, store } = createManager(storage);
        dm.initializeVocabulary();
        window.SV = {
            DataManager: dm,
            UIComponents: { showDeleteConfirmation: (word, onConfirm) => onConfirm() }
        };

        require('../../js/app-main.js').deleteWord(words[1].id);

        const remainingIds = [words[0].id, words[2].id];
        expect(dm.vocabulary.map(w => w.id)).toEqual(remainingIds);
        expect(store.load().map(w => w.id)).toEqual(remainingIds);
    });
});
