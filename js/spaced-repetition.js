// ============================================================================
// SPACED REPETITION ALGORITHM with DI
// ============================================================================

function createSpacedRepetition(context) {
    const ctx = context || {};
    const getVocabulary = ctx.getVocabulary || (() => []);
    const debugLog = ctx.debugLog || ((..._args) => undefined);

    function calculateNextReview(difficulty, repetition = 0, easeFactor = 1.3) {
        let interval;
        
        if (repetition === 0) {
            interval = 1;
        } else if (repetition === 1) {
            interval = 6;
        } else {
            interval = Math.round(repetition * easeFactor);
        }

        debugLog(`📊 Spaced Repetition Debug:`);
        debugLog(`   Word repetition: ${repetition}`);
        debugLog(`   Initial easeFactor: ${easeFactor}`);
        debugLog(`   Base interval: ${interval} days`);
        debugLog(`   User difficulty: ${difficulty}`);

        switch(difficulty) {
            case 'hard':
                easeFactor = Math.max(1.3, easeFactor - 0.15);
                interval = 1;
                break;
            case 'medium':
                easeFactor = Math.min(3.5, easeFactor + 0.05);
                interval = Math.round(interval * 0.9);
                break;
            case 'easy':
                easeFactor = Math.min(3.5, easeFactor + 0.15);
                break;
            case 'perfect':
                easeFactor = Math.min(3.5, easeFactor + 0.25);
                interval = Math.round(interval * 1.2);
                break;
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);

        debugLog(`   Final interval: ${interval} days`);
        debugLog(`   Final easeFactor: ${easeFactor}`);
        debugLog(`   Next review: ${nextReview.toISOString()}`);

        return {
            nextReview: nextReview.toISOString(),
            interval,
            easeFactor,
            repetition: repetition + 1
        };
    }

    function getWordsForReview() {
        const vocabulary = getVocabulary() || [];
        const now = new Date();
        debugLog('🔍 Checking words for review at:', now.toISOString());
        
        const wordsForReview = vocabulary.filter(word => {
            if (!word.nextReview) {
                debugLog('✅ New word ready:', word.original);
                return true;
            }
            
            const reviewDate = new Date(word.nextReview);
            const isReady = reviewDate <= now;
            
            debugLog(`${isReady ? '✅' : '⏰'} ${word.original}: review ${reviewDate.toISOString()} vs now ${now.toISOString()}`);
            
            return isReady;
        });
        
        debugLog(`📚 Found ${wordsForReview.length} words ready for review out of ${vocabulary.length} total`);
        return wordsForReview;
    }

    function calculateLearningProgress(easeFactor) {
        const MIN_EASE = 1.3;
        const MAX_EASE = 3.5;
        
        if (easeFactor <= MIN_EASE) return 0;
        if (easeFactor >= MAX_EASE) return 100;
        
        return Math.round(((easeFactor - MIN_EASE) / (MAX_EASE - MIN_EASE)) * 100);
    }

    return { calculateNextReview, getWordsForReview, calculateLearningProgress };
}

function createDefaultSpacedRepetition() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createSpacedRepetition({
        getVocabulary: () => g.SV?.DataManager?.vocabulary || [],
        debugLog: (...args) => g.SV?.debugLog?.(...args)
    });
}

const defaultSR = createDefaultSpacedRepetition();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultSR;
    module.exports.createSpacedRepetition = createSpacedRepetition;
}

// Provide factory for browser attach in app-init
try {
    if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-restricted-syntax
        window.createDefaultSpacedRepetition = createDefaultSpacedRepetition;
    }
} catch (_err) {}