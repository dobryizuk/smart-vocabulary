// ============================================================================
// DATA STRUCTURES & PERSISTENCE with DI
// ============================================================================

function createDataManager(context) {
    const ctx = context || {};
    const storage = ctx.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const debugLog = ctx.debugLog || ((..._args) => undefined);
    const appMain = ctx.appMain || {};
    const stats = ctx.stats || {};
    const now = ctx.now || (() => new Date());

    let wordDatabase = null;
    let userProgress = {};
    try {
        userProgress = storage ? JSON.parse(storage.getItem('userProgress') || '{}') : {};
    } catch {
        userProgress = {};
    }
    let vocabulary = [];

    function getTranslationSuggestion(originalWord) {
        if (!wordDatabase || !wordDatabase.words) return null;
        const word = wordDatabase.words.find(w => w.original.toLowerCase() === originalWord.toLowerCase().trim());
        return word ? word.translation : null;
    }

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
        }
    }

    function saveAllVocabulary() {
        try {
            const vocabularyStr = JSON.stringify(vocabulary);
            if (storage) storage.setItem('allVocabulary', vocabularyStr);
            debugLog('💾 All vocabulary saved:', vocabulary.length, 'words');
        } catch (error) {
            console.error('❌ Failed to save vocabulary:', error.message);
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

    async function resetUserProgress() {
        if (typeof confirm === 'function' ? confirm('This will reset all your learning progress but keep your words. Are you sure?') : true) {
            try {
                userProgress = {};
                if (storage) storage.removeItem('userProgress');
                debugLog('🗑️ User progress reset successfully');
                await initializeVocabulary();
                appMain.renderWordList?.();
                stats.updateStats?.();
                appMain.showMessage?.('Learning progress reset!', 'success');
            } catch (error) {
                console.error('❌ Failed to reset progress:', error.message);
                appMain.showMessage?.('Failed to reset progress. Please try again.', 'error');
            }
        }
    }

    async function loadWordDatabase() {
        try {
            debugLog('📱 iOS WebView detected - starting with empty database');
            debugLog('💡 Use the Import button to load your vocabulary');
            wordDatabase = {
                metadata: { description: "Empty database - use Import to load vocabulary", totalWords: 0, version: "1.0" },
                words: []
            };
            await initializeVocabulary();
        } catch (error) {
            console.error('❌ Failed to initialize word database:', error.message);
            stats.showDatabaseError?.();
        }
    }

    async function initializeVocabulary() {
        try {
            let allWords = [];
            if (wordDatabase) {
                if (Array.isArray(wordDatabase)) {
                    allWords = wordDatabase;
                } else if (wordDatabase.words && Array.isArray(wordDatabase.words)) {
                    allWords = wordDatabase.words;
                } else {
                    console.warn('⚠️ Invalid wordDatabase structure:', Object.keys(wordDatabase));
                }
            } else {
                console.warn('⚠️ No word database available. Please import vocabulary data.');
            }
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
        getTranslationSuggestion,
        saveUserProgress,
        saveAllVocabulary,
        loadUserProgress,
        resetUserProgress,
        loadWordDatabase,
        initializeVocabulary,
        get vocabulary() { return vocabulary; },
        set vocabulary(value) { vocabulary = value; },
        get userProgress() { return userProgress; },
        set userProgress(value) { userProgress = value; },
        get wordDatabase() { return wordDatabase; },
        set wordDatabase(value) { wordDatabase = value; }
    };
}

function createDefaultDataManager() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createDataManager({
        storage: (typeof localStorage !== 'undefined' ? localStorage : null),
        debugLog: (...args) => g.SV?.debugLog?.(...args),
        appMain: g.SV?.AppMain || {},
        stats: g.SV?.Statistics || {},
        now: () => new Date()
    });
}

const defaultDataManager = createDefaultDataManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultDataManager;
    module.exports.createDataManager = createDataManager;
}

// Provide factory for browser attach in app-init
try {
    if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-restricted-syntax
        window.createDefaultDataManager = createDefaultDataManager;
    }
} catch (_err) {}