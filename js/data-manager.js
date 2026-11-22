// ============================================================================
// DATA STRUCTURES & PERSISTENCE with DI
// ============================================================================

function createDataManager(context) {
    const ctx = context || {};
    const storage = ctx.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const debugLog = ctx.debugLog || (() => undefined);
    const appMain = ctx.appMain || {};
    const now = ctx.now || (() => new Date());

    let userProgress = {};
    try {
        userProgress = storage ? JSON.parse(storage.getItem('userProgress') || '{}') : {};
    } catch {
        userProgress = {};
    }
    let vocabulary = [];

    async function saveUserProgress() {
        const progressData = {};
        vocabulary.forEach(word => {
            progressData[word.id] = {
                repetition: word.repetition,
                easeFactor: word.easeFactor,
                nextReview: word.nextReview,
                reviewHistory: word.reviewHistory,
                addedDate: word.addedDate
            };
        });
        userProgress = progressData;
        try {
            if (storage) storage.setItem('userProgress', JSON.stringify(userProgress));
            debugLog('💾 User progress saved:', Object.keys(userProgress).length, 'entries');
        } catch (error) {
            console.error('❌ Failed to save progress:', error.message);
            appMain.showMessage?.('Could not save your progress: device storage may be full. Make a backup now.', 'error');
        }
    }

    function saveAllVocabulary() {
        try {
            const vocabularyStr = JSON.stringify(vocabulary);
            if (storage) storage.setItem('allVocabulary', vocabularyStr);
            debugLog('💾 All vocabulary saved:', vocabulary.length, 'words');
        } catch (error) {
            console.error('❌ Failed to save vocabulary:', error.message);
            appMain.showMessage?.('Could not save your words: device storage may be full. Make a backup now.', 'error');
        }
    }

    async function loadUserProgress() {
        try {
            const localProgress = storage ? storage.getItem('userProgress') : null;
            const progress = localProgress ? JSON.parse(localProgress) : {};
            debugLog('📊 User progress loaded:', Object.keys(progress).length, 'entries');
            return progress;
        } catch (error) {
            console.error('❌ Failed to load progress:', error.message);
            return {};
        }
    }

    async function initializeVocabulary() {
        try {
            let allWords = [];
            try {
                const savedVocabularyStr = storage ? storage.getItem('allVocabulary') : null;
                const savedVocabulary = JSON.parse(savedVocabularyStr || '[]');
                if (savedVocabulary.length > 0) {
                    allWords = savedVocabulary;
                    debugLog(`💾 Loaded ${savedVocabulary.length} words from storage`);
                }
            } catch (error) {
                console.warn('⚠️ Failed to load saved vocabulary:', error.message);
            }
            allWords = allWords.map(word => ({
                ...word,
                createdAt: word.created_date || word.createdAt || now().toISOString(),
                addedDate: word.created_date || word.addedDate || now().toISOString()
            }));
            vocabulary = allWords.map(word => {
                const progress = userProgress[word.id] || { repetition: 0, easeFactor: 1.3, nextReview: null, reviewHistory: [] };
                return { ...word, ...progress };
            });
            debugLog(`✅ Vocabulary initialized with ${vocabulary.length} words`);
        } catch (error) {
            console.error('❌ Failed to initialize vocabulary:', error);
            vocabulary = [];
        }
    }

    return {
        saveUserProgress,
        saveAllVocabulary,
        loadUserProgress,
        initializeVocabulary,
        get vocabulary() { return vocabulary; },
        set vocabulary(value) { vocabulary = value; },
        get userProgress() { return userProgress; },
        set userProgress(value) { userProgress = value; }
    };
}

function createDefaultDataManager() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createDataManager({
        storage: (typeof localStorage !== 'undefined' ? localStorage : null),
        debugLog: (...args) => g.SV?.debugLog?.(...args),
        appMain: { showMessage: (...args) => g.SV?.AppMain?.showMessage?.(...args) },
        now: () => new Date()
    });
}

const defaultDataManager = createDefaultDataManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultDataManager;
    module.exports.createDataManager = createDataManager;
}
