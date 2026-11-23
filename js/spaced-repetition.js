// ============================================================================
// SPACED REPETITION ALGORITHM with DI
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const MAX_EASE = 3.5;
const MAX_INTERVAL_DAYS = 180;
const EASE_DELTA = { hard: -0.15, medium: 0.05, easy: 0.15, perfect: 0.25 };
const INTERVAL_MULTIPLIER = { medium: 0.9, easy: 1, perfect: 1.2 };

function createSpacedRepetition(context) {
    const ctx = context || {};
    const getVocabulary = ctx.getVocabulary || (() => []);
    const debugLog = ctx.debugLog || (() => undefined);

    function getPreviousInterval(word) {
        const lastReview = word.reviewHistory?.at(-1);
        if (!word.nextReview || !lastReview) return 0;
        const elapsed = new Date(word.nextReview) - new Date(lastReview.date);
        return Math.max(0, Math.round(elapsed / MS_PER_DAY));
    }

    function calculateNextReview(difficulty, word) {
        const previousInterval = getPreviousInterval(word);
        const currentEase = word.easeFactor ?? MIN_EASE;
        const easeFactor = Math.min(MAX_EASE, Math.max(MIN_EASE, currentEase + EASE_DELTA[difficulty]));

        let interval = 1;
        if (difficulty !== 'hard' && previousInterval > 0) {
            const scaled = Math.round(previousInterval * easeFactor * INTERVAL_MULTIPLIER[difficulty]);
            interval = Math.min(MAX_INTERVAL_DAYS, Math.max(previousInterval + 1, scaled));
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);

        debugLog(`📊 Spaced Repetition: ${difficulty}, previous ${previousInterval}d -> ${interval}d, ease ${currentEase} -> ${easeFactor}, next ${nextReview.toISOString()}`);

        return {
            nextReview: nextReview.toISOString(),
            easeFactor,
            repetition: (word.repetition || 0) + 1
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
        if (easeFactor <= MIN_EASE) return 0;
        if (easeFactor >= MAX_EASE) return 100;
        
        return Math.round(((easeFactor - MIN_EASE) / (MAX_EASE - MIN_EASE)) * 100);
    }

    return { getPreviousInterval, calculateNextReview, getWordsForReview, calculateLearningProgress };
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
