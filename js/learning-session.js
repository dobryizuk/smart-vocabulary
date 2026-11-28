// ============================================================================
// LEARNING SESSION: the batch, the queue, each word's exercise, rating → SM-2,
// progress and the end of the session. The exercises live in js/exercises/.
// ============================================================================

const { createEmptyState } = require('./ui-components.js');
const { secureShuffle } = require('./secure-shuffle.js');
const { clearScreenTimeouts } = require('./exercises/exercise-screen.js');
const { showRecognitionCard, showTranslation } = require('./exercises/recognition.js');
const { showBuildCard, placeBuildLetter, undoBuildLetter, checkBuildAnswer } = require('./exercises/build.js');
const { showReverseTranslationCard, showHintForReverse, checkReverseTranslation } = require('./exercises/writing.js');

// Exercises in the order a word moves through them, by their name in the review history
const EXERCISE_STAGES = ['regular', 'build', 'reverse'];
const SHOW_EXERCISE = { regular: showRecognitionCard, build: showBuildCard, reverse: showReverseTranslationCard };

// Ratings of the "OK" and "Easy" buttons
const PASSED_RATINGS = ['easy', 'perfect'];

// A third of the slots (rounded up) goes to new words, oldest added first; the rest to
// reviewed words, oldest nextReview first. Whichever kind runs short, the other fills in.
function selectSessionBatch(words, size) {
    const byDate = (field) => (a, b) => new Date(a[field]) - new Date(b[field]);
    const newWords = words.filter(w => !w.nextReview).sort(byDate('createdAt'));
    const reviews = words.filter(w => w.nextReview).sort(byDate('nextReview'));
    const newSlots = Math.min(newWords.length, Math.max(Math.ceil(size / 3), size - reviews.length));
    const picked = [...newWords.slice(0, newSlots), ...reviews.slice(0, size - newSlots)];
    return secureShuffle(picked);
}

function stageShift(difficulty) {
    if (PASSED_RATINGS.includes(difficulty)) return 1;
    return difficulty === 'hard' ? -1 : 0;
}

// The stage follows the last rating: OK/Easy moves a word one stage forward, Hard one stage back
function determineExerciseType(word) {
    const history = word.reviewHistory || [];
    const last = history[history.length - 1];
    if (!last) return EXERCISE_STAGES[0];

    const stage = Math.max(0, EXERCISE_STAGES.indexOf(last.exerciseType ?? 'regular'));
    return EXERCISE_STAGES[Math.min(EXERCISE_STAGES.length - 1, Math.max(0, stage + stageShift(last.difficulty)))];
}

function beginSession(candidates) {
    const AppState = window.SV.AppState;
    const size = window.SV?.SessionSettings?.getSessionSize?.() ?? 15;
    AppState.learningSession = selectSessionBatch(candidates, size);
    AppState.sessionTotal = AppState.learningSession.length;
    AppState.currentLearningWord = AppState.learningSession[0];
    window.SV?.Today?.showSession?.();
    showLearningCard();
}

// Opening the Today tab: a running session continues, otherwise the overview shows
function prepareLearningSession() {
    const AppState = window.SV.AppState;
    if (AppState.currentLearningWord && AppState.learningSession.length > 0) {
        window.SV?.Today?.showSession?.();
        showLearningCard();
        return;
    }
    window.SV?.Today?.showOverview?.();
}

function startLearning() {
    const wordsForReview = window.SV?.SpacedRepetition?.getWordsForReview?.() || [];
    if (wordsForReview.length === 0) {
        window.SV?.Today?.showOverview?.();
        return;
    }
    beginSession(wordsForReview);
}

function forceStartLearning() {
    // Practice all words regardless of schedule - useful for debugging and extra practice
    const vocabulary = window.SV?.DataManager?.vocabulary || [];
    if (vocabulary.length === 0) {
        // No words at all: go to Add tab instead of showing a second placeholder
        window.SV?.AppMain?.showTab?.('add');
        return;
    }

    window.SV?.debugLog?.('🚀 Force starting learning session with all words');
    beginSession(vocabulary);
}

function showLearningCard() {
    const word = window.SV.AppState.currentLearningWord;
    if (!word) {
        endLearningSession();
        return;
    }
    clearScreenTimeouts();
    word.currentExerciseType = determineExerciseType(word);
    SHOW_EXERCISE[word.currentExerciseType]();
}

function recordReview(word, difficulty) {
    const reviewData = window.SV?.SpacedRepetition?.calculateNextReview?.(difficulty, word);
    if (!reviewData) return;

    const answeredAt = new Date().toISOString();
    Object.assign(word, reviewData, { updatedAt: answeredAt });
    word.reviewHistory.push({
        date: answeredAt,
        difficulty,
        exerciseType: word.currentExerciseType || 'regular'
    });
}

function countAnswer(difficulty) {
    const stats = window.SV.AppState.sessionStats;
    stats.total++;
    if (PASSED_RATINGS.includes(difficulty)) {
        stats.correct++;
        stats.streak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
        stats.streak = 0;
    }
}

// A word rated Hard comes back once at the end of the session, one stage easier, as practice
function queueRepeat(word) {
    const AppState = window.SV.AppState;
    AppState.repeatedWords.add(word);
    AppState.learningSession.push(word);
    AppState.sessionTotal++;
}

// Ratings exist only on a word's first card of the session; its repeat moves on with Next
function markDifficulty(difficulty) {
    const word = window.SV.AppState.currentLearningWord;
    recordReview(word, difficulty);
    countAnswer(difficulty);
    if (difficulty === 'hard') queueRepeat(word);
    window.SV?.DataManager?.save?.();
    showNextCard();
}

function showNextCard() {
    const AppState = window.SV.AppState;
    AppState.learningSession.shift();
    AppState.currentLearningWord = AppState.learningSession[0];
    showLearningCard();
}

function resetSessionState() {
    clearScreenTimeouts();
    const AppState = window.SV.AppState;
    AppState.sessionStats = { correct: 0, total: 0, streak: 0, bestStreak: 0 };
    AppState.learningSession = [];
    AppState.sessionTotal = 0;
    AppState.repeatedWords = new Set();
    AppState.currentLearningWord = null;
}

function endLearningSession() {
    const { total, correct, bestStreak } = window.SV.AppState.sessionStats;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const message = `Great work! You reviewed ${total} words.<br>Accuracy: ${accuracy}%<br>Best streak: ${bestStreak}`;

    document.getElementById('learningContent').innerHTML = createEmptyState(
        'Session Complete!',
        message,
        [
            { text: 'Start New Session', action: 'start-learning', type: 'primary' },
            { text: 'Back to Today', action: 'show-tab', type: 'secondary', arg: 'today' }
        ]
    );
    resetSessionState();
}

// The close button: answers are saved per card, so leaving needs no confirmation
function stopLearningSession() {
    resetSessionState();
    const learningContent = document.getElementById('learningContent');
    if (learningContent) learningContent.innerHTML = '';
    window.SV?.Today?.showOverview?.();
}

module.exports = {
    prepareLearningSession,
    startLearning,
    forceStartLearning,
    showLearningCard,
    markDifficulty,
    showNextCard,
    endLearningSession,
    stopLearningSession,
    selectSessionBatch,
    determineExerciseType,
    // The exercises' buttons (data-action handlers in app-init.js) reach them through the session
    showTranslation,
    placeBuildLetter,
    undoBuildLetter,
    checkBuildAnswer,
    showHintForReverse,
    checkReverseTranslation
};
