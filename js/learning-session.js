// ============================================================================
// LEARNING SESSION MANAGEMENT
// ============================================================================

// Ensure AppState exists when this file is executed standalone (e.g., in unit tests)
if (typeof window !== 'undefined') {
    window.AppState = window.AppState || {
        currentLearningWord: null,
        learningSession: [],
        sessionStats: { correct: 0, total: 0, streak: 0 },
        currentDictionaryData: null
    };
}

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
    const wordsForReview = window.SpacedRepetition?.getWordsForReview?.() || [];
    ensureLearningLayout();

    if (wordsForReview.length === 0) {
        // Check if we have any words at all
        const vocabulary = window.DataManager?.vocabulary || [];
        const hasWords = vocabulary.length > 0;
        renderLearningEmptyState(hasWords);
        return;
    }

    AppState.learningSession = secureShuffle(wordsForReview);
    
    // Initialize session exercise types tracking for all words
    AppState.learningSession.forEach(word => {
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
    });
    
    startLearning();
}

function startLearning() {
    const wordsForReview = window.SpacedRepetition?.getWordsForReview?.() || [];
    
    if (wordsForReview.length === 0) {
        prepareLearningSession();
        return;
    }

    AppState.learningSession = secureShuffle(wordsForReview);
    
    // Initialize session exercise types tracking for all words
    AppState.learningSession.forEach(word => {
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
    });
    
    AppState.currentLearningWord = AppState.learningSession[0];
    showLearningCard();
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
        { text: 'Start New Session', onclick: 'forceStartLearning()', type: 'primary' }
    ];
    const title = hasWords ? 'Great job! 🎉' : 'Ready to learn! 📚';
    const subtitle = hasWords
        ? 'No words need review right now. Start a new session to practice.'
        : 'Add some words first, then start a new session.';
    const emptyStateHtml = window.UIComponents?.createEmptyState?.(title, subtitle, actions) || '';
    mainEl.innerHTML = emptyStateHtml;
    progressEl.innerHTML = '';
}

function forceStartLearning() {
    // Practice all words regardless of schedule - useful for debugging and extra practice
    const vocabulary = window.DataManager?.vocabulary || [];
    if (vocabulary.length === 0) {
        // No words at all: go to Add tab instead of showing a second placeholder
        if (typeof window.showTab === 'function') {
            window.showTab('add');
        }
        return;
    }

    console.log('🚀 Force starting learning session with all words');
    AppState.learningSession = secureShuffle(vocabulary);
    
    // Initialize session exercise types tracking for all words
    AppState.learningSession.forEach(word => {
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
    });
    
    AppState.currentLearningWord = AppState.learningSession[0];
    showLearningCard();
}

function showLearningCard() {
    if (!AppState.currentLearningWord) {
        endLearningSession();
        return;
    }

    // Determine exercise type for this word
    const exerciseType = determineExerciseType(AppState.currentLearningWord);
    AppState.currentLearningWord.currentExerciseType = exerciseType;
    AppState.currentLearningWord.lastExerciseDate = new Date().toISOString();
    AppState.currentLearningWord.lastExerciseType = exerciseType;

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
            onclick: `speakWord('${AppState.currentLearningWord.english}')`,
            title: 'Pronounce word'
        }
    ];
    
    // Prepare actions for learning card only (progress metadata is computed by UI component as needed)
    
    // Create unified word card for learning
    const cardHtml = window.UIComponents?.createWordCard?.(AppState.currentLearningWord, 'learning', actions, true) || '';
    mainEl.insertAdjacentHTML('beforeend', cardHtml);
    mainEl.insertAdjacentHTML('beforeend', `
        ${window.UIComponents?.createButtonGroup?.([
            { text: 'Show Answer', onclick: 'showTranslation()', type: 'primary', id: 'showAnswerButton' }
        ]) || ''}
        <div id="cardTranslation"></div>
    `);
    if (progressEl) progressEl.innerHTML = window.UIComponents?.createSessionProgress?.(
        AppState.learningSession.length - AppState.learningSession.indexOf(AppState.currentLearningWord),
        AppState.learningSession.length
    ) || '';
    
    // Auto-play pronunciation when showing new word
    const speechSettings = window.SpeechManager?.speechSettings;
    if (speechSettings?.enabled && speechSettings?.autoPlay) {
        setTimeout(() => {
            window.speakWord?.(AppState.currentLearningWord.english);
        }, 500); // Delay for DOM initialization
    }
}

async function showTranslation() {
    const card = document.getElementById('cardTranslation');

    // Build specific block for direct translation: compact translation header
    const specificHtml = window.UIComponents?.createTranslationBlock?.(AppState.currentLearningWord, 'learning') || '';
    const layoutHtml = window.UIComponents?.createAnswerLayout?.({
        specificHtml,
        word: AppState.currentLearningWord,
        variant: 'learning'
    }) || '';

    card.innerHTML = layoutHtml;
    card.style.opacity = '1';

    const showBtn = document.getElementById('showAnswerButton');
    if (showBtn) showBtn.style.display = 'none';

    window.speakWord?.(AppState.currentLearningWord.english);
    renderSessionProgressBottom();
}

function markDifficulty(difficulty) {
    const word = AppState.currentLearningWord;
    const reviewData = window.SpacedRepetition?.calculateNextReview?.(
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
    AppState.sessionStats.total++;
    if (difficulty === 'easy' || difficulty === 'perfect') {
        AppState.sessionStats.correct++;
        AppState.sessionStats.streak++;
    } else {
        AppState.sessionStats.streak = 0;
    }

    // Move to next word
    AppState.learningSession.shift();
    AppState.currentLearningWord = AppState.learningSession[0];

    window.DataManager?.saveUserProgress?.();
    showLearningCard();
}

function endLearningSession() {
    const learningContent = document.getElementById('learningContent');
    
    const accuracy = AppState.sessionStats.total > 0 ? Math.round((AppState.sessionStats.correct / AppState.sessionStats.total) * 100) : 0;
    const message = `Great work! You reviewed ${AppState.sessionStats.total} words.<br>Accuracy: ${accuracy}%<br>Best streak: ${AppState.sessionStats.streak}`;
    
    const emptyStateHtml = window.UIComponents?.createEmptyState?.(
        'Session Complete! 🎉',
        message,
        [
            { text: '🔄 Start New Session', onclick: 'startLearning()', type: 'primary' },
            { text: '📊 View Statistics', onclick: 'showTab(\'stats\')', type: 'secondary' }
        ]
    ) || '';
    
    learningContent.innerHTML = emptyStateHtml;
    AppState.sessionStats = { correct: 0, total: 0, streak: 0 };
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
    const sessionWords = window.AppState?.learningSession || AppState.learningSession || [];
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

function showReverseTranslationCard() {
    if (!AppState.currentLearningWord) {
        endLearningSession();
        return;
    }

    const { mainEl, progressEl } = ensureLearningLayout();
    
    // Progress percentage computed by UI components as needed
    
    // No pronounce button in reverse translation exercise
    const actions = [];
    
    // Progress metadata is handled by UI components when rendering
    
    // Create reverse translation word object for display
    const reverseWord = {
        ...AppState.currentLearningWord,
        english: AppState.currentLearningWord.russian,
        russian: AppState.currentLearningWord.english
    };
    
    // Create unified word card for reverse translation
    const cardHtml = window.UIComponents?.createWordCard?.(reverseWord, 'learning', actions, true) || '';
    
    const inputBlock = window.UIComponents?.createLabeledTextInput?.({
        inputId: 'reverseTranslationInput',
        label: 'Type the English translation:',
        placeholder: 'Enter English word or phrase...',
        onKeyPress: 'handleReverseInputKeyPress(event)',
        onInput: 'validateReverseInput()'
    }) || '';

    mainEl.innerHTML = `
        ${cardHtml}
        ${inputBlock}
        
        <!-- Action Button: Show Answer only -->
        ${window.UIComponents?.createButtonGroup?.([
            { text: 'Show Answer', onclick: 'showAnswerForReverse()', type: 'primary', id: 'showAnswerReverseButton' }
        ]) || ''}
    `;
    
    // Render session progress in dedicated container
    progressEl.innerHTML = window.UIComponents?.createSessionProgress?.(
        AppState.learningSession.length - AppState.learningSession.indexOf(AppState.currentLearningWord), 
        AppState.learningSession.length
    ) || '';
    
    // Focus on input
    setTimeout(() => {
        const input = document.getElementById('reverseTranslationInput');
        if (input && typeof input.focus === 'function') {
            try {
                input.focus({ preventScroll: true });
            } catch {
                input.focus();
            }
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
    }, 50);
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
        const accuracy = calculateTypingAccuracy(userInput, AppState.currentLearningWord.english);
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
    const correctAnswer = AppState.currentLearningWord.english;
    
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
    AppState.currentLearningWord.reverseTranslationResult = result;
    
    // Hide input and check button
    input.disabled = true;
    document.getElementById('checkAnswerButton').style.display = 'none';
    
    // Reveal answer blocks (details + metadata) and difficulty buttons
    showAnswerForReverse();
}

function showDifficultyButtonsForReverse() {
    // Add difficulty buttons to the content using unified component
    const difficultyButtonsHtml = window.UIComponents?.createDifficultyButtons?.() || '';
    
    // Add buttons after the current content
    const learningContent = document.getElementById('learningContent');
    learningContent.insertAdjacentHTML('beforeend', difficultyButtonsHtml);
}

function showAnswerForReverse() {
    const feedback = document.getElementById('typingFeedback');
    // Clear the lightweight "Answer" hint to avoid duplication with the full "Correct answer" block
    if (feedback) feedback.innerHTML = '';

    const specificHtml = window.UIComponents?.createPrimaryAnswerBlock?.('Correct answer', AppState.currentLearningWord.english) || '';
    const layoutHtml = window.UIComponents?.createAnswerLayout?.({
        specificHtml,
        word: AppState.currentLearningWord,
        variant: 'learning'
    }) || '';

    const { mainEl } = ensureLearningLayout();
    if (mainEl) mainEl.insertAdjacentHTML('beforeend', layoutHtml);
    renderSessionProgressBottom();

    const input = document.getElementById('reverseTranslationInput');
    if (input) input.disabled = true;
    const showBtn = document.getElementById('showAnswerReverseButton');
    if (showBtn) showBtn.style.display = 'none';
    window.speakWord?.(AppState.currentLearningWord.english);
}

function renderSessionProgressBottom() {
    const progressEl = document.getElementById('sessionProgressContainer');
    const learningContent = document.getElementById('learningContent');
    const currentIndex = AppState.learningSession.length - AppState.learningSession.indexOf(AppState.currentLearningWord);
    const totalWords = AppState.learningSession.length;
    const progressHtml = window.UIComponents?.createSessionProgress?.(currentIndex, totalWords) || '';
    if (progressEl) {
        progressEl.innerHTML = progressHtml;
        return;
    }
    if (!learningContent) return;
    learningContent.querySelectorAll('.session-progress').forEach((el) => el.remove());
    learningContent.insertAdjacentHTML('beforeend', progressHtml);
}

// Export functions for global access
window.LearningSession = {
    prepareLearningSession,
    startLearning,
    forceStartLearning,
    showLearningCard,
    showReverseTranslationCard,
    showTranslation,
    markDifficulty,
    endLearningSession,
    determineExerciseType,
    handleReverseInputKeyPress,
    validateReverseInput,
    checkReverseTranslation,
    showAnswerForReverse,
    showDifficultyButtonsForReverse,
    get currentLearningWord() { return AppState.currentLearningWord; },
    set currentLearningWord(value) { AppState.currentLearningWord = value; },
    get learningSession() { return AppState.learningSession; },
    set learningSession(value) { AppState.learningSession = value; },
    get sessionStats() { return AppState.sessionStats; },
    set sessionStats(value) { AppState.sessionStats = value; }
};

// Make functions globally available for compatibility
window.prepareLearningSession = prepareLearningSession;
window.startLearning = startLearning;
window.forceStartLearning = forceStartLearning;
window.showReverseTranslationCard = showReverseTranslationCard;
window.showLearningCard = showLearningCard;
window.showTranslation = showTranslation;
window.markDifficulty = markDifficulty;
window.handleReverseInputKeyPress = handleReverseInputKeyPress;
window.validateReverseInput = validateReverseInput;
window.checkReverseTranslation = checkReverseTranslation;
window.showAnswerForReverse = showAnswerForReverse;
window.isEligibleForReverseTranslation = isEligibleForReverseTranslation;
window.canShowReverseExercise = canShowReverseExercise;
window.determineExerciseType = determineExerciseType;
window.normalizeText = normalizeText;
window.calculateTypingAccuracy = calculateTypingAccuracy;
window.levenshteinDistance = levenshteinDistance;