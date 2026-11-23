// ============================================================================
// SPACED REPETITION ALGORITHM with DI
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const MAX_EASE = 3.5;
const MAX_INTERVAL_DAYS = 180;
const STATUS_WINDOW = 5;
const STATUS_LABELS = { mastered: 'Mastered', learning: 'Learning', difficult: 'Difficult', new: 'New' };
const ANSWER_SCORE = { perfect: 1, easy: 1, medium: 0.5, hard: 0 };
const EASE_DELTA = { hard: -0.15, medium: 0.05, easy: 0.15, perfect: 0.25 };
const INTERVAL_MULTIPLIER = { medium: 0.9, easy: 1, perfect: 1.2 };

// A word is due when it was never reviewed or its review date has come
function isDue(word, now = new Date()) {
    return !word.nextReview || new Date(word.nextReview) <= now;
}

const status = (key) => ({ key, label: STATUS_LABELS[key] });

// Mean score of the last answers (1 = all right), or null while the word has none
function getRecentScore(word) {
    const answers = (word.reviewHistory || []).slice(-STATUS_WINDOW);
    if (answers.length === 0) return null;
    return answers.reduce((sum, answer) => sum + (ANSWER_SCORE[answer.difficulty] ?? 0), 0) / answers.length;
}

// Status from the recent score: struggling words show as Difficult
function getWordStatus(word) {
    const score = getRecentScore(word);
    if (score === null) return status('new');
    if (score < 0.5) return status('difficult');
    if (score < 0.8) return status('learning');
    return status('mastered');
}

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
        
        const wordsForReview = vocabulary.filter(word => isDue(word, now));
        debugLog(`📚 Found ${wordsForReview.length} words ready for review out of ${vocabulary.length} total`);
        return wordsForReview;
    }

    return { getPreviousInterval, calculateNextReview, getWordsForReview, isDue, getRecentScore, getWordStatus };
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
    module.exports.STATUS_LABELS = STATUS_LABELS;
}
