// ============================================================================
// IN-MEMORY VOCABULARY with DI (persistence lives in vocabulary-store.js)
// ============================================================================

const defaultVocabularyStore = require('./vocabulary-store.js');

const LOAD_ERROR = 'Could not load your saved words. They were left untouched; please report this problem.';
const SAVE_ERROR = 'Could not save your words: device storage may be full. Make a backup now.';

function createDataManager(context) {
    const ctx = context || {};
    const store = ctx.store || defaultVocabularyStore;
    const debugLog = ctx.debugLog || (() => undefined);
    const appMain = ctx.appMain || {};
    const onSaved = ctx.onSaved || (() => undefined);

    let vocabulary = [];
    let loadFailed = false;

    function initializeVocabulary() {
        try {
            vocabulary = store.load();
            loadFailed = false;
            debugLog(`✅ Vocabulary initialized with ${vocabulary.length} words`);
        } catch (error) {
            console.error('❌ Failed to load vocabulary:', error);
            vocabulary = [];
            loadFailed = true;
            appMain.showMessage?.(LOAD_ERROR, 'error');
        }
    }

    function persist(write) {
        if (loadFailed) {
            appMain.showMessage?.(LOAD_ERROR, 'error');
            return;
        }
        try {
            write();
            debugLog('💾 Vocabulary saved:', vocabulary.length, 'words');
        } catch (error) {
            console.error('❌ Failed to save vocabulary:', error.message);
            appMain.showMessage?.(SAVE_ERROR, 'error');
            return;
        }
        onSaved();
    }

    function save() {
        persist(() => store.save(vocabulary));
    }

    function deleteWord(id) {
        vocabulary = vocabulary.filter(word => word.id !== id);
        persist(() => {
            store.recordDeletion(id);
            store.save(vocabulary);
        });
    }

    return {
        initializeVocabulary,
        save,
        deleteWord,
        get loadFailed() { return loadFailed; },
        get vocabulary() { return vocabulary; },
        set vocabulary(value) { vocabulary = value; }
    };
}

function createDefaultDataManager() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createDataManager({
        store: defaultVocabularyStore,
        debugLog: (...args) => g.SV?.debugLog?.(...args),
        appMain: { showMessage: (...args) => g.SV?.AppMain?.showMessage?.(...args) },
        onSaved: () => g.SV?.Sync?.schedulePush?.()
    });
}

const defaultDataManager = createDefaultDataManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultDataManager;
    module.exports.createDataManager = createDataManager;
}
