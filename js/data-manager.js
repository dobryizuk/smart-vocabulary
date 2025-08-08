// ============================================================================
// DATA STRUCTURES & PERSISTENCE
// ============================================================================

let wordDatabase = null;
let userProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
let vocabulary = [];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getTranslationSuggestion(englishWord) {
    if (!wordDatabase || !wordDatabase.words) return null;
    
    const word = wordDatabase.words.find(w => 
        w.english.toLowerCase() === englishWord.toLowerCase().trim()
    );
    
    return word ? word.russian : null;
}

// ============================================================================
// DATA PERSISTENCE FUNCTIONS
// ============================================================================

async function saveUserProgress() {
    // Save only user progress data, not the entire word database
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
        localStorage.setItem('userProgress', JSON.stringify(userProgress));
        console.log('💾 User progress saved:', Object.keys(userProgress).length, 'entries');
    } catch (error) {
        console.error('❌ Failed to save progress:', error.message);
    }
}

function saveAllVocabulary() {
    // Save entire vocabulary array to localStorage (simplified approach)
    try {
        const vocabularyStr = JSON.stringify(vocabulary);
        localStorage.setItem('allVocabulary', vocabularyStr);
        console.log('💾 All vocabulary saved:', vocabulary.length, 'words');
    } catch (error) {
        console.error('❌ Failed to save vocabulary:', error.message);
    }
}

async function loadUserProgress() {
    try {
        const localProgress = localStorage.getItem('userProgress');
        const progress = localProgress ? JSON.parse(localProgress) : {};
        console.log('📊 User progress loaded:', Object.keys(progress).length, 'entries');
        return progress;
    } catch (error) {
        console.error('❌ Failed to load progress:', error.message);
        return {};
    }
}

async function resetUserProgress() {
    if (confirm('This will reset all your learning progress but keep your words. Are you sure?')) {
        try {
            userProgress = {};
            localStorage.removeItem('userProgress');
            console.log('🗑️ User progress reset successfully');
            
            await initializeVocabulary();
            if (window.renderWordList) window.renderWordList();
            if (window.updateStats) window.updateStats();
            alert('Learning progress reset!');
        } catch (error) {
            console.error('❌ Failed to reset progress:', error.message);
            alert('Failed to reset progress. Please try again.');
        }
    }
}

// ============================================================================
// DATABASE LOADING FUNCTIONS
// ============================================================================

async function loadWordDatabase() {
    try {
        // iOS WebView doesn't allow fetch() to local files, so start with empty database
        // Users will import their vocabulary via the import button
        console.log('📱 iOS WebView detected - starting with empty database');
        console.log('💡 Use the Import button to load your vocabulary');
        
        wordDatabase = {
            metadata: {
                description: "Empty database - use Import to load vocabulary",
                totalWords: 0,
                version: "1.0"
            },
            words: []
        };
        
        await initializeVocabulary();
    } catch (error) {
        console.error('❌ Failed to initialize word database:', error.message);
        if (window.showDatabaseError) window.showDatabaseError();
    }
}

// Initialize vocabulary from local files only
async function initializeVocabulary() {
    try {
        // Use already loaded wordDatabase or load from local file
        let allWords = [];
        
        if (wordDatabase) {
            // Extract words from database object structure
            if (Array.isArray(wordDatabase)) {
                allWords = wordDatabase;
            } else if (wordDatabase.words && Array.isArray(wordDatabase.words)) {
                allWords = wordDatabase.words;
            } else {
                console.warn('⚠️ Invalid wordDatabase structure:', Object.keys(wordDatabase));
            }
        } else {
            // No database loaded - this should not happen after loadWordDatabase() is called
            console.warn('⚠️ No word database available. Please import vocabulary data.');
        }
        
        // Load complete vocabulary from storage if available
        try {
            const savedVocabularyStr = localStorage.getItem('allVocabulary');
            const savedVocabulary = JSON.parse(savedVocabularyStr || '[]');
            
            if (savedVocabulary.length > 0) {
                // Always use saved vocabulary if it exists (may contain custom words or deletions)
                allWords = savedVocabulary;
                console.log(`💾 Loaded ${savedVocabulary.length} words from storage`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load saved vocabulary:', error.message);
        }
        
        // Ensure proper date fields
        allWords = allWords.map(word => ({
            ...word,
            createdAt: word.created_date || word.createdAt || new Date().toISOString(),
            addedDate: word.created_date || word.addedDate || new Date().toISOString()
        }));
        
        // Merge with user progress
        vocabulary = allWords.map(word => {
            const progress = userProgress[word.id] || {
                repetition: 0,
                easeFactor: 1.3,
                nextReview: null,
                reviewHistory: []
            };
            
            return {
                ...word,
                ...progress
            };
        });
        
        console.log(`✅ Vocabulary initialized with ${vocabulary.length} words`);
        
    } catch (error) {
        console.error('❌ Failed to initialize vocabulary:', error);
        vocabulary = [];
    }
}

// Export functions
window.DataManager = {
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