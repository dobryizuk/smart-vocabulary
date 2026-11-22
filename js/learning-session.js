// ============================================================================
// LEARNING SESSION MANAGEMENT
// ============================================================================

// AppState is provided by js/app-state.js and attached globally

// Use centralized AppState

// ============================================================================
// LEARNING SESSION FUNCTIONS  
// ============================================================================

function getSecureRandomInt(maxExclusive) {
    const cryptoObj = (typeof window !== 'undefined' && window.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (!cryptoObj || !cryptoObj.getRandomValues) {
        throw new Error('Secure random generator is not available');
    }
    const array = new Uint32Array(1);
    const range = 0x100000000; // 2^32
    const limit = range - (range % maxExclusive); // Rejection sampling to avoid modulo bias
    let value;
    do {
        cryptoObj.getRandomValues(array);
        value = array[0];
    } while (value >= limit);
    return value % maxExclusive;
}

function secureShuffle(inputArray) {
    const array = [...inputArray];
    for (let i = array.length - 1; i > 0; i--) {
        const j = getSecureRandomInt(i + 1);
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
    return array;
}

function prepareLearningSession() {
    const SR = window.SV?.SpacedRepetition;
    const wordsForReview = SR?.getWordsForReview?.() || [];
    ensureLearningLayout();

    if (wordsForReview.length === 0) {
        // Check if we have any words at all
        const vocabulary = window.SV?.DataManager?.vocabulary || [];
        const hasWords = vocabulary.length > 0;
        renderLearningEmptyState(hasWords);
        return;
    }

    window.SV.AppState.learningSession = secureShuffle(wordsForReview);
    
    // Initialize session exercise types tracking for all words
    window.SV.AppState.learningSession.forEach(word => {
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
    });
    
    startLearning();
}

function startLearning() {
    const SR = window.SV?.SpacedRepetition;
    const wordsForReview = SR?.getWordsForReview?.() || [];
    
    if (wordsForReview.length === 0) {
        prepareLearningSession();
        return;
    }

    window.SV.AppState.learningSession = secureShuffle(wordsForReview);
    
    // Initialize session exercise types tracking for all words
    window.SV.AppState.learningSession.forEach(word => {
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
    });
    
    window.SV.AppState.currentLearningWord = window.SV.AppState.learningSession[0];
    showLearningCard();
}

// Track scheduled timeouts to avoid leaks and stale callbacks across view transitions
const learningSessionTimeouts = [];
function trackTimeout(id) {
    if (typeof id === 'number') {
        learningSessionTimeouts.push(id);
    }
}
function clearLearningSessionTimeouts() {
    if (typeof clearTimeout !== 'function') return;
    while (learningSessionTimeouts.length) {
        const id = learningSessionTimeouts.pop();
        try { clearTimeout(id); } catch (err) { window.SV?.debugLog?.('clearTimeout failed:', err); }
    }
}

function ensureLearningLayout(resetMain = false) {
    const learningContent = document.getElementById('learningContent');
    if (!learningContent) return { mainEl: null, progressEl: null };
    let mainEl = document.getElementById('learningMain');
    let progressEl = document.getElementById('sessionProgressContainer');
    if (!mainEl || !progressEl) {
        learningContent.innerHTML = `
            <div id="learningMain"></div>
            <div id="sessionProgressContainer"></div>
        `;
        mainEl = document.getElementById('learningMain');
        progressEl = document.getElementById('sessionProgressContainer');
    } else if (resetMain) {
        // Clear only the main content for a fresh render when requested
        mainEl.innerHTML = '';
    }
    return { mainEl, progressEl };
}

function renderLearningEmptyState(hasWords) {
    const { mainEl, progressEl } = ensureLearningLayout(true);
    if (!mainEl || !progressEl) return;
    const actions = [
        { text: 'Start New Session', action: 'force-start-learning', type: 'primary' }
    ];
    const title = hasWords ? 'Great job! 🎉' : 'Ready to learn! 📚';
    const subtitle = hasWords
        ? 'No words need review right now. Start a new session to practice.'
        : 'Add some words first, then start a new session.';
    const emptyStateHtml = window.SV?.UIComponents?.createEmptyState?.(title, subtitle, actions) || '';
    mainEl.innerHTML = emptyStateHtml;
    progressEl.innerHTML = '';
}

function forceStartLearning() {
    // Practice all words regardless of schedule - useful for debugging and extra practice
    const vocabulary = window.SV?.DataManager?.vocabulary || [];
    if (vocabulary.length === 0) {
        // No words at all: go to Add tab instead of showing a second placeholder
        if (window.SV?.AppMain?.showTab) {
            window.SV.AppMain.showTab('add');
        }
        return;
    }

    window.SV?.debugLog?.('🚀 Force starting learning session with all words');
    window.SV.AppState.learningSession = secureShuffle(vocabulary);
    
    // Initialize session exercise types tracking for all words
    window.SV.AppState.learningSession.forEach(word => {
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
    });
    
    window.SV.AppState.currentLearningWord = window.SV.AppState.learningSession[0];
    showLearningCard();
}

function showLearningCard() {
    if (!window.SV.AppState.currentLearningWord) {
        endLearningSession();
        return;
    }

    // Clear any pending timers before rendering a new screen
    clearLearningSessionTimeouts();

    // Determine exercise type for this word
    const exerciseType = determineExerciseType(window.SV.AppState.currentLearningWord);
    window.SV.AppState.currentLearningWord.currentExerciseType = exerciseType;
    window.SV.AppState.currentLearningWord.lastExerciseDate = new Date().toISOString();
    window.SV.AppState.currentLearningWord.lastExerciseType = exerciseType;

    // Show appropriate exercise type
    if (exerciseType === 'reverse') {
        showReverseTranslationCard();
        return;
    }

    // Continue with regular exercise (existing code)
    const { mainEl, progressEl } = ensureLearningLayout(true);
    
    // Calculate progress data for enhanced display (unused but kept for potential future use)
    // const progressPercentage = Math.round(((currentLearningWord.easeFactor - 1.3) / (3.5 - 1.3)) * 100);
    
    // Define actions for learning card
    const actions = [
        {
            type: 'primary',
            icon: '🔊',
            action: 'speak-word',
            arg: window.SV.AppState.currentLearningWord.original,
            title: 'Pronounce word'
        }
    ];
    
    // Prepare actions for learning card only (progress metadata is computed by UI component as needed)
    
    // Create unified word card for learning
    const UI = window.SV?.UIComponents;
    const cardHtml = UI?.createWordCard?.(window.SV.AppState.currentLearningWord, 'learning', actions, true) || '';
    mainEl.insertAdjacentHTML('beforeend', cardHtml);
    mainEl.insertAdjacentHTML('beforeend', `
        ${window.SV?.UIComponents?.createButtonGroup?.([
            { text: 'Show Answer', action: 'show-translation', type: 'primary', id: 'showAnswerButton' }
        ]) || ''}
        <div id="cardTranslation"></div>
    `);
    if (progressEl) progressEl.innerHTML = window.SV?.UIComponents?.createSessionProgress?.(
        window.SV.AppState.learningSession.length - window.SV.AppState.learningSession.indexOf(window.SV.AppState.currentLearningWord),
        window.SV.AppState.learningSession.length
    ) || '';
    
    // Auto-play pronunciation when showing new word
    const speechSettings = window.SV?.SpeechManager?.speechSettings;
    if (speechSettings?.enabled && speechSettings?.autoPlay) {
        const id = setTimeout(() => {
            if (typeof window === 'undefined' || typeof document === 'undefined') return;
            window.SV?.SpeechManager?.speakWord?.(window.SV.AppState.currentLearningWord.original);
        }, 500); // Delay for DOM initialization
        trackTimeout(id);
    }
}

async function showTranslation() {
    const card = document.getElementById('cardTranslation');

    // Build specific block for direct translation: compact translation header
    const UI2 = window.SV?.UIComponents;
    const specificHtml = UI2?.createTranslationBlock?.(window.SV.AppState.currentLearningWord, 'learning') || '';
    const layoutHtml = UI2?.createAnswerLayout?.({
        specificHtml,
        word: window.SV.AppState.currentLearningWord,
        variant: 'learning'
    }) || '';

    card.innerHTML = layoutHtml;
    card.style.opacity = '1';

    const showBtn = document.getElementById('showAnswerButton');
    if (showBtn) showBtn.style.display = 'none';

    window.SV?.SpeechManager?.speakWord?.(window.SV.AppState.currentLearningWord.original);
    renderSessionProgressBottom();
}

function markDifficulty(difficulty) {
    const word = window.SV.AppState.currentLearningWord;
    const SRcalc = window.SV?.SpacedRepetition;
    const reviewData = SRcalc?.calculateNextReview?.(
        difficulty, 
        word.repetition, 
        word.easeFactor
    );

    if (reviewData) {
        // Update word data
        Object.assign(word, reviewData);
        word.reviewHistory.push({
            date: new Date().toISOString(),
            difficulty,
            exerciseType: word.currentExerciseType || 'regular'
        });
        
        // Track exercise types in this session
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
        const exerciseType = word.currentExerciseType || 'regular';
        if (!word.sessionExerciseTypes.includes(exerciseType)) {
            word.sessionExerciseTypes.push(exerciseType);
        }
    }

    // Update session stats
    window.SV.AppState.sessionStats.total++;
    if (difficulty === 'easy' || difficulty === 'perfect') {
        window.SV.AppState.sessionStats.correct++;
        window.SV.AppState.sessionStats.streak++;
    } else {
        window.SV.AppState.sessionStats.streak = 0;
    }

    // Move to next word
    window.SV.AppState.learningSession.shift();
    window.SV.AppState.currentLearningWord = window.SV.AppState.learningSession[0];

    window.SV?.DataManager?.saveUserProgress?.();
    showLearningCard();
}

function endLearningSession() {
    // Clear any pending timers to avoid stale callbacks after session ends
    clearLearningSessionTimeouts();
    const learningContent = document.getElementById('learningContent');
    
    const accuracy = window.SV.AppState.sessionStats.total > 0 ? Math.round((window.SV.AppState.sessionStats.correct / window.SV.AppState.sessionStats.total) * 100) : 0;
    const message = `Great work! You reviewed ${AppState.sessionStats.total} words.<br>Accuracy: ${accuracy}%<br>Best streak: ${AppState.sessionStats.streak}`;
    
    const UI3 = window.SV?.UIComponents;
    const emptyStateHtml = UI3?.createEmptyState?.(
        'Session Complete! 🎉',
        message,
        [
            { text: '🔄 Start New Session', action: 'start-learning', type: 'primary' },
            { text: '📊 View Statistics', action: 'show-tab', type: 'secondary', arg: 'stats' }
        ]
    ) || '';
    
    learningContent.innerHTML = emptyStateHtml;
    window.SV.AppState.sessionStats = { correct: 0, total: 0, streak: 0 };
}

// ============================================================================
// REVERSE TRANSLATION SYSTEM
// ============================================================================

function isEligibleForReverseTranslation(word) {
    // Word is eligible for reverse translation from first repetition onward
    // But not for new words (repetition = 0)
    if (word.repetition === 0) {
        return false;
    }
    
    // Check if user last answered 'hard' - don't show reverse exercise for hard words
    if (word.reviewHistory && word.reviewHistory.length > 0) {
        const lastReview = word.reviewHistory[word.reviewHistory.length - 1];
        if (lastReview.difficulty === 'hard') {
            return false;
        }
    }
    
    return word.repetition > 0 || (word.reviewHistory && word.reviewHistory.length > 0);
}

function canShowReverseExercise(word) {
    // Check if enough time has passed since last exercise of same type
    const now = new Date();
    const lastExerciseDate = word.lastExerciseDate ? new Date(word.lastExerciseDate) : null;
    const timeSinceLastExercise = lastExerciseDate ? now - lastExerciseDate : Infinity;
    const minInterval = 10 * 60 * 1000; // 10 minutes
    
    // Allow if different exercise type or enough time has passed
    return !lastExerciseDate || 
           word.lastExerciseType !== 'reverse' || 
           timeSinceLastExercise >= minInterval;
}

function determineExerciseType(word) {
    if (!isEligibleForReverseTranslation(word)) {
        return 'regular';
    }
    
    if (!canShowReverseExercise(word)) {
        return 'regular';
    }
    
    // Check if this word has already been shown in this session
    const sessionWords = (typeof window !== 'undefined' && window.SV?.AppState?.learningSession) || [];
    // const wordIndex = sessionWords.findIndex(w => w.id === word.id); // Unused variable
    
    // If this is the only word in session, alternate between regular and reverse
    if (sessionWords.length === 1) {
        return word.lastExerciseType === 'reverse' ? 'regular' : 'reverse';
    }
    
    // Check if we've already shown both regular and reverse for this word in this session
    const hasShownRegular = word.sessionExerciseTypes && word.sessionExerciseTypes.includes('regular');
    const hasShownReverse = word.sessionExerciseTypes && word.sessionExerciseTypes.includes('reverse');
    
    // If we haven't shown reverse yet, show it
    if (!hasShownReverse) {
        return 'reverse';
    }
    
    // If we haven't shown regular yet, show it
    if (!hasShownRegular) {
        return 'regular';
    }
    
    // If we've shown both, prefer regular to avoid too much reverse
    return 'regular';
}

function normalizeText(text) {
    return text.toLowerCase()
        .trim()
        .replace(/[.,!?;:]/g, '') // Remove punctuation
        .replace(/\s+/g, ' '); // Normalize whitespace
}

function calculateTypingAccuracy(userInput, correctAnswer) {
    const normalizedInput = normalizeText(userInput);
    const normalizedAnswer = normalizeText(correctAnswer);
    
    if (normalizedInput === normalizedAnswer) {
        return { accuracy: 100, difficulty: 'perfect' };
    }
    
    // Calculate Levenshtein distance for similarity
    const distance = levenshteinDistance(normalizedInput, normalizedAnswer);
    const maxLength = Math.max(normalizedInput.length, normalizedAnswer.length);
    const accuracy = Math.max(0, Math.round((1 - distance / maxLength) * 100));
    
    // Determine difficulty based on accuracy
    if (accuracy >= 90) return { accuracy, difficulty: 'easy' };
    if (accuracy >= 70) return { accuracy, difficulty: 'medium' };
    return { accuracy, difficulty: 'hard' };
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

const MAX_HINT_LETTERS = 3;

function countLetters(text) {
    return text.replace(/\s/g, '').length;
}

// Prefix holding `count` letters of the answer; spaces are kept but not counted
function getHintPrefix(answer, count) {
    let letters = 0;
    let end = 0;
    while (end < answer.length && letters < count) {
        if (!/\s/.test(answer[end])) letters++;
        end++;
    }
    return answer.slice(0, end);
}

// Up to 3 letters, but never the whole answer
function getMaxHints(answer) {
    return Math.max(0, Math.min(MAX_HINT_LETTERS, countLetters(answer) - 1));
}

function hintButtonText(remaining, used) {
    return used === 0 ? '💡 Hint' : `💡 Hint (${remaining} left)`;
}

function showHintForReverse() {
    const word = window.SV.AppState.currentLearningWord;
    const hintEl = document.getElementById('reverseHint');
    if (!word || !hintEl) return;

    const answer = word.original.trim();
    const maxHints = getMaxHints(answer);
    const used = Math.min(window.SV.AppState.reverseHintCount + 1, maxHints);
    window.SV.AppState.reverseHintCount = used;
    hintEl.textContent = used > 0 ? `💡 ${getHintPrefix(answer, used)}…` : '';

    const hintBtn = document.getElementById('hintReverseButton');
    if (hintBtn) {
        hintBtn.textContent = hintButtonText(maxHints - used, used);
        hintBtn.disabled = used >= maxHints;
    }
    document.getElementById('reverseTranslationInput')?.focus?.();
}

function showReverseTranslationCard() {
    if (!window.SV.AppState.currentLearningWord) {
        endLearningSession();
        return;
    }
    window.SV.AppState.reverseHintCount = 0;

    // Clear any pending timers before rendering a new screen
    clearLearningSessionTimeouts();

    const { mainEl, progressEl } = ensureLearningLayout();
    
    // Progress percentage computed by UI components as needed
    
    // No pronounce button in reverse translation exercise
    const actions = [];
    
    // Progress metadata is handled by UI components when rendering
    
    // Create reverse translation word object for display
    const reverseWord = {
        ...window.SV.AppState.currentLearningWord,
        original: window.SV.AppState.currentLearningWord.translation,
        translation: window.SV.AppState.currentLearningWord.original
    };
    
    // Create unified word card for reverse translation
    const UI4 = window.SV?.UIComponents;
    const cardHtml = UI4?.createWordCard?.(reverseWord, 'learning', actions, true) || '';
    
    const inputBlock = window.SV?.UIComponents?.createLabeledTextInput?.({
        inputId: 'reverseTranslationInput',
        label: 'Type the Original word:',
        placeholder: 'Enter original word or phrase...',
        onKeyPress: 'handleReverseInputKeyPress(event)',
        onInput: 'validateReverseInput()'
    }) || '';

    const hasHints = getMaxHints(window.SV.AppState.currentLearningWord.original.trim()) > 0;
    mainEl.innerHTML = `
        ${cardHtml}
        ${inputBlock}
        <div id="reverseHint" class="typing-hint" aria-live="polite"></div>

        ${window.SV?.UIComponents?.createButtonGroup?.([
            { text: hintButtonText(0, 0), action: 'show-hint-reverse', type: 'secondary', id: 'hintReverseButton', disabled: !hasHints },
            { text: 'Show Answer', action: 'show-answer-reverse', type: 'primary', id: 'showAnswerReverseButton' }
        ]) || ''}
    `;
    
    // Render session progress in dedicated container
    progressEl.innerHTML = window.SV?.UIComponents?.createSessionProgress?.(
        window.SV.AppState.learningSession.length - window.SV.AppState.learningSession.indexOf(window.SV.AppState.currentLearningWord), 
        window.SV.AppState.learningSession.length
    ) || '';
    
    // Focus on input
    const id = setTimeout(() => {
        if (typeof document === 'undefined') return;
        const input = document.getElementById('reverseTranslationInput');
        if (input && typeof input.focus === 'function') {
            try {
                input.focus({ preventScroll: true });
            } catch {
                input.focus();
            }
            if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }
        }
    }, 50);
    trackTimeout(id);
}

function handleReverseInputKeyPress(event) {
    if (event.key === 'Enter') {
        showAnswerForReverse();
    }
}

function validateReverseInput() {
    const input = document.getElementById('reverseTranslationInput');
    const feedback = document.getElementById('typingFeedback');
    if (!input || !feedback) return;
    const userInput = input.value.trim();
    if (userInput.length > 0) {
        const accuracy = calculateTypingAccuracy(userInput, window.SV.AppState.currentLearningWord.original);
        if (accuracy.accuracy === 100) {
            feedback.innerHTML = '<span style="color: #28a745;">✓ Perfect match!</span>';
        } else if (accuracy.accuracy >= 90) {
            feedback.innerHTML = '<span style="color: #ffc107;">Close enough!</span>';
        } else {
            feedback.innerHTML = '<span style="color: #6c757d;">Keep typing...</span>';
        }
    } else {
        feedback.innerHTML = '';
    }
}

function checkReverseTranslation() {
    const input = document.getElementById('reverseTranslationInput');
    if (!input) return;
    
    const userInput = input.value.trim();
    const correctAnswer = window.SV.AppState.currentLearningWord.original;
    
    const result = calculateTypingAccuracy(userInput, correctAnswer);
    
    // Show result feedback
    const feedback = document.getElementById('typingFeedback');
    if (result.accuracy === 100) {
        feedback.innerHTML = `<span style="color: #28a745; font-weight: 600;">🎯 Perfect! "${correctAnswer}"</span>`;
    } else if (result.accuracy >= 90) {
        feedback.innerHTML = `<span style="color: #28a745; font-weight: 600;">✅ Correct! "${correctAnswer}" (${result.accuracy}% accuracy)</span>`;
    } else if (result.accuracy >= 70) {
        feedback.innerHTML = `<span style="color: #ffc107; font-weight: 600;">📝 Close: "${correctAnswer}" (${result.accuracy}% accuracy)</span>`;
    } else {
        feedback.innerHTML = `<span style="color: #dc3545; font-weight: 600;">❌ Answer: "${correctAnswer}" (${result.accuracy}% accuracy)</span>`;
    }
    
    // Store the result for automatic difficulty marking
    window.SV.AppState.currentLearningWord.reverseTranslationResult = result;
    
    // Hide input and check button
    input.disabled = true;
    document.getElementById('checkAnswerButton').style.display = 'none';
    
    // Reveal answer blocks (details + metadata) and difficulty buttons
    showAnswerForReverse();
}

function showDifficultyButtonsForReverse() {
    // Add difficulty buttons to the content using unified component
    const difficultyButtonsHtml = window.SV?.UIComponents?.createDifficultyButtons?.() || '';
    
    // Add buttons after the current content
    const learningContent = document.getElementById('learningContent');
    learningContent.insertAdjacentHTML('beforeend', difficultyButtonsHtml);
}

function showAnswerForReverse() {
    const feedback = document.getElementById('typingFeedback');
    // Clear the lightweight "Answer" hint to avoid duplication with the full "Correct answer" block
    if (feedback) feedback.innerHTML = '';

    const UI5 = window.SV?.UIComponents;
    const specificHtml = UI5?.createPrimaryAnswerBlock?.('Correct answer', window.SV.AppState.currentLearningWord.original) || '';
    const layoutHtml = UI5?.createAnswerLayout?.({
        specificHtml,
        word: window.SV.AppState.currentLearningWord,
        variant: 'learning'
    }) || '';

    const { mainEl } = ensureLearningLayout();
    if (mainEl) mainEl.insertAdjacentHTML('beforeend', layoutHtml);
    renderSessionProgressBottom();

    const input = document.getElementById('reverseTranslationInput');
    if (input) input.disabled = true;
    const showBtn = document.getElementById('showAnswerReverseButton');
    if (showBtn) showBtn.style.display = 'none';
    const hintBtn = document.getElementById('hintReverseButton');
    if (hintBtn) hintBtn.style.display = 'none';
    window.SV?.SpeechManager?.speakWord?.(window.SV.AppState.currentLearningWord.original);
}

function renderSessionProgressBottom() {
    const progressEl = document.getElementById('sessionProgressContainer');
    const learningContent = document.getElementById('learningContent');
    const currentIndex = window.SV.AppState.learningSession.length - window.SV.AppState.learningSession.indexOf(window.SV.AppState.currentLearningWord);
    const totalWords = window.SV.AppState.learningSession.length;
    const progressHtml = window.SV?.UIComponents?.createSessionProgress?.(currentIndex, totalWords) || '';
    if (progressEl) {
        progressEl.innerHTML = progressHtml;
        return;
    }
    if (!learningContent) return;
    learningContent.querySelectorAll('.session-progress').forEach((el) => el.remove());
    learningContent.insertAdjacentHTML('beforeend', progressHtml);
}

// Export functions via CJS only (SV picks up in app-init)

// Export for both CommonJS and browser
const LearningSessionExports = {
    prepareLearningSession,
    startLearning,
    forceStartLearning,
    showLearningCard,
    showReverseTranslationCard,
    showTranslation,
    markDifficulty,
    endLearningSession,
    isEligibleForReverseTranslation,
    canShowReverseExercise,
    determineExerciseType,
    handleReverseInputKeyPress,
    validateReverseInput,
    checkReverseTranslation,
    showAnswerForReverse,
    showHintForReverse,
    getHintPrefix,
    getMaxHints,
    showDifficultyButtonsForReverse,
    normalizeText,
    calculateTypingAccuracy,
    levenshteinDistance
};

function createDefaultLearningSession() {
    return LearningSessionExports;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearningSessionExports;
}

// Provide factory for browser attach in app-init
try {
    if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-restricted-syntax
        window.createDefaultLearningSession = createDefaultLearningSession;
    }
} catch (_err) {}