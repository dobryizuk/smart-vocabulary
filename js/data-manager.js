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

    function save() {
        if (loadFailed) {
            appMain.showMessage?.(LOAD_ERROR, 'error');
            return;
        }
        try {
            store.save(vocabulary);
            debugLog('💾 Vocabulary saved:', vocabulary.length, 'words');
        } catch (error) {
            console.error('❌ Failed to save vocabulary:', error.message);
            appMain.showMessage?.(SAVE_ERROR, 'error');
        }
    }

    return {
        initializeVocabulary,
        save,
        get vocabulary() { return vocabulary; },
        set vocabulary(value) { vocabulary = value; }
    };
}

function createDefaultDataManager() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createDataManager({
        store: defaultVocabularyStore,
        debugLog: (...args) => g.SV?.debugLog?.(...args),
        appMain: { showMessage: (...args) => g.SV?.AppMain?.showMessage?.(...args) }
    });
}

const defaultDataManager = createDefaultDataManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultDataManager;
    module.exports.createDataManager = createDataManager;
}
