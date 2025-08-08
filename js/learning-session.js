// ============================================================================
// LEARNING SESSION MANAGEMENT
// ============================================================================

// Use global variables if they exist, otherwise declare locally
if (typeof currentLearningWord === 'undefined') {
    var currentLearningWord = null;
}
if (typeof learningSession === 'undefined') {
    var learningSession = [];
}
if (typeof sessionStats === 'undefined') {
    var sessionStats = { correct: 0, total: 0, streak: 0 };
}

// ============================================================================
// LEARNING SESSION FUNCTIONS  
// ============================================================================

function prepareLearningSession() {
    const wordsForReview = window.SpacedRepetition?.getWordsForReview?.() || [];
    const learningContent = document.getElementById('learningContent');

    if (wordsForReview.length === 0) {
        // Check if we have any words at all
        const vocabulary = window.DataManager?.vocabulary || [];
        const hasWords = vocabulary.length > 0;
        
        if (!hasWords) {
            const emptyStateHtml = window.UIComponents?.createEmptyState?.(
                'Ready to learn! 📚',
                'Add some words first to start learning.',
                [{ text: '➕ Add More Words', onclick: 'showTab(\'add\')', type: 'primary' }]
            ) || '';
            learningContent.innerHTML = emptyStateHtml;
        } else {
            const emptyStateHtml = window.UIComponents?.createEmptyState?.(
                'Great job! 🎉',
                'No words need review right now. Come back later or add more words!',
                [
                    { text: '➕ Add More Words', onclick: 'showTab(\'add\')', type: 'primary' },
                    { text: '🔄 Practice All Words', onclick: 'forceStartLearning()', type: 'secondary', style: 'background: #ff9500; color: white; border: none;' }
                ]
            ) || '';
            learningContent.innerHTML = emptyStateHtml;
        }
        return;
    }

    learningSession = [...wordsForReview].sort(() => Math.random() - 0.5);
    
    // Initialize session exercise types tracking for all words
    learningSession.forEach(word => {
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

    learningSession = [...wordsForReview].sort(() => Math.random() - 0.5);
    
    // Initialize session exercise types tracking for all words
    learningSession.forEach(word => {
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
    });
    
    currentLearningWord = learningSession[0];
    showLearningCard();
}

function forceStartLearning() {
    // Practice all words regardless of schedule - useful for debugging and extra practice
    const vocabulary = window.DataManager?.vocabulary || [];
    if (vocabulary.length === 0) {
        alert('No words available to practice!');
        return;
    }

    console.log('🚀 Force starting learning session with all words');
    learningSession = [...vocabulary].sort(() => Math.random() - 0.5);
    
    // Initialize session exercise types tracking for all words
    learningSession.forEach(word => {
        if (!word.sessionExerciseTypes) {
            word.sessionExerciseTypes = [];
        }
    });
    
    currentLearningWord = learningSession[0];
    showLearningCard();
}

function showLearningCard() {
    if (!currentLearningWord) {
        endLearningSession();
        return;
    }

    // Determine exercise type for this word
    const exerciseType = determineExerciseType(currentLearningWord);
    currentLearningWord.currentExerciseType = exerciseType;
    currentLearningWord.lastExerciseDate = new Date().toISOString();
    currentLearningWord.lastExerciseType = exerciseType;

    // Show appropriate exercise type
    if (exerciseType === 'reverse') {
        showReverseTranslationCard();
        return;
    }

    // Continue with regular exercise (existing code)
    const learningContent = document.getElementById('learningContent');
    
    // Calculate progress data for enhanced display (unused but kept for potential future use)
    // const progressPercentage = Math.round(((currentLearningWord.easeFactor - 1.3) / (3.5 - 1.3)) * 100);
    
    // Define actions for learning card
    const actions = [
        {
            type: 'primary',
            icon: '🔊',
            onclick: `speakWord('${currentLearningWord.english}')`,
            title: 'Pronounce word'
        }
    ];
    
    // Prepare progress data
    const userProgress = window.DataManager?.userProgress || {};
    const progress = userProgress[currentLearningWord.id] || { correctCount: 0, totalAttempts: 0, lastSeen: null };
    // Extended progress data (unused but kept for potential future use)
    // const extendedProgress = {
    //     ...progress,
    //     repetitions: currentLearningWord.repetition || 0,
    //     addedDate: new Date(currentLearningWord.addedDate || currentLearningWord.createdAt)
    // };
    
    // Create unified word card for learning
    const cardHtml = window.UIComponents?.createWordCard?.(currentLearningWord, 'learning', actions, true) || '';
    
    learningContent.innerHTML = `
        ${cardHtml}
        
        <!-- Action Button -->
        <div id="showAnswerButton" style="margin-bottom: 12px;">
            ${window.UIComponents?.createButton?.('Show Answer', 'showTranslation()', 'primary', false, '', '', 'btn-block') || ''}
        </div>
        
        <!-- Translation Card Placeholder -->
        <div id="cardTranslation" style="text-align: center;">
            <div class="section-subtitle">💭 Tap to reveal answer</div>
        </div>
        
        <!-- Session Progress -->
        ${window.UIComponents?.createSessionProgress?.(
            learningSession.length - learningSession.indexOf(currentLearningWord), 
            learningSession.length
        ) || ''}
    `;
    
    // Auto-play pronunciation when showing new word
    const speechSettings = window.SpeechManager?.speechSettings;
    if (speechSettings?.enabled && speechSettings?.autoPlay) {
        setTimeout(() => {
            window.speakWord?.(currentLearningWord.english);
        }, 500); // Delay for DOM initialization
    }
}

async function showTranslation() {
    const card = document.getElementById('cardTranslation');
    
    // Prepare metadata for current learning word
    const userProgress = window.DataManager?.userProgress || {};
    const progress = userProgress[currentLearningWord.id] || { correctCount: 0, totalAttempts: 0, lastSeen: null };
    const extendedProgress = {
        ...progress,
        repetitions: currentLearningWord.repetition || 0,
        addedDate: new Date(currentLearningWord.addedDate || currentLearningWord.createdAt)
    };
    
    // Use unified function to create complete answer content
    const content = window.UIComponents?.createLearningAnswerContent?.(currentLearningWord, extendedProgress, 'learning') || '';
    
    // Add difficulty buttons to the content using unified component
    const difficultyButtonsHtml = window.UIComponents?.createDifficultyButtons?.() || '';
    
    card.innerHTML = content + difficultyButtonsHtml;
    card.style.opacity = '1';
    
    // Hide Show Answer button
    document.getElementById('showAnswerButton').style.display = 'none';
}

function markDifficulty(difficulty) {
    const word = currentLearningWord;
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
    sessionStats.total++;
    if (difficulty === 'easy' || difficulty === 'perfect') {
        sessionStats.correct++;
        sessionStats.streak++;
    } else {
        sessionStats.streak = 0;
    }

    // Move to next word
    learningSession.shift();
    currentLearningWord = learningSession[0];

    window.DataManager?.saveUserProgress?.();
    showLearningCard();
}

function endLearningSession() {
    const learningContent = document.getElementById('learningContent');
    
    const accuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
    const message = `Great work! You reviewed ${sessionStats.total} words.<br>Accuracy: ${accuracy}%<br>Best streak: ${sessionStats.streak}`;
    
    const emptyStateHtml = window.UIComponents?.createEmptyState?.(
        'Session Complete! 🎉',
        message,
        [
            { text: '🔄 Start New Session', onclick: 'startLearning()', type: 'primary' },
            { text: '📊 View Statistics', onclick: 'showTab(\'stats\')', type: 'secondary' }
        ]
    ) || '';
    
    learningContent.innerHTML = emptyStateHtml;
    sessionStats = { correct: 0, total: 0, streak: 0 };
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
    const sessionWords = window.learningSession || learningSession || [];
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
    if (!currentLearningWord) {
        endLearningSession();
        return;
    }

    const learningContent = document.getElementById('learningContent');
    
    // Calculate progress data for enhanced display
    const progressPercentage = Math.round(((currentLearningWord.easeFactor - 1.3) / (3.5 - 1.3)) * 100);
    
    // Define actions for learning card
    const actions = [
        {
            type: 'primary',
            icon: '🔊',
            onclick: `speakWord('${currentLearningWord.russian}', 'ru')`,
            title: 'Pronounce Russian word'
        }
    ];
    
    // Prepare progress data
    const userProgress = window.DataManager?.userProgress || {};
    const progress = userProgress[currentLearningWord.id] || { correctCount: 0, totalAttempts: 0, lastSeen: null };
    // Extended progress data (unused but kept for potential future use)
    // const extendedProgress = {
    //     ...progress,
    //     repetitions: currentLearningWord.repetition || 0,
    //     addedDate: new Date(currentLearningWord.addedDate || currentLearningWord.createdAt)
    // };
    
    // Create reverse translation word object for display
    const reverseWord = {
        ...currentLearningWord,
        english: currentLearningWord.russian,
        russian: currentLearningWord.english
    };
    
    // Create unified word card for reverse translation
    const cardHtml = window.UIComponents?.createWordCard?.(reverseWord, 'learning', actions, true) || '';
    
    learningContent.innerHTML = `
        ${cardHtml}
        

            
        <!-- Translation Input -->
        <div style="margin: 20px 0;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">
                Type the English translation:
            </label>
            <input type="text" 
                   id="reverseTranslationInput" 
                   class="translation-input"
                   placeholder="Enter English word or phrase..."
                   autocomplete="off"
                   autocorrect="off"
                   autocapitalize="off"
                   spellcheck="false"
                   onkeypress="handleReverseInputKeyPress(event)"
                   oninput="validateReverseInput()">
            <div id="typingFeedback" class="typing-feedback"></div>
        </div>
        
        <!-- Action Buttons -->
        ${window.UIComponents?.createButtonGroup?.([
            { text: '✓ Check Answer', onclick: 'checkReverseTranslation()', type: 'primary', id: 'checkAnswerButton', disabled: true },
            { text: '👁️ Show Answer', onclick: 'showAnswerForReverse()', type: 'secondary' }
        ]) || ''}
        

        
        <!-- Session Progress -->
        ${window.UIComponents?.createSessionProgress?.(
            learningSession.length - learningSession.indexOf(currentLearningWord), 
            learningSession.length
        ) || ''}
    `;
    
    // Focus on input
    setTimeout(() => {
        const input = document.getElementById('reverseTranslationInput');
        if (input) input.focus();
    }, 100);
}

function handleReverseInputKeyPress(event) {
    if (event.key === 'Enter') {
        const button = document.getElementById('checkAnswerButton');
        if (!button.disabled) {
            checkReverseTranslation();
        }
    }
}

function validateReverseInput() {
    const input = document.getElementById('reverseTranslationInput');
    const button = document.getElementById('checkAnswerButton');
    const feedback = document.getElementById('typingFeedback');
    
    if (!input || !button) return;
    
    const userInput = input.value.trim();
    
    if (userInput.length > 0) {
        button.disabled = false;
        button.style.opacity = '1';
        
        // Show real-time feedback
        const accuracy = calculateTypingAccuracy(userInput, currentLearningWord.english);
        if (accuracy.accuracy === 100) {
            feedback.innerHTML = '<span style="color: #28a745;">✓ Perfect match!</span>';
        } else if (accuracy.accuracy >= 90) {
            feedback.innerHTML = '<span style="color: #ffc107;">Close enough!</span>';
        } else {
            feedback.innerHTML = '<span style="color: #6c757d;">Keep typing...</span>';
        }
    } else {
        button.disabled = true;
        button.style.opacity = '0.5';
        feedback.innerHTML = '';
    }
}

function checkReverseTranslation() {
    const input = document.getElementById('reverseTranslationInput');
    if (!input) return;
    
    const userInput = input.value.trim();
    const correctAnswer = currentLearningWord.english;
    
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
    currentLearningWord.reverseTranslationResult = result;
    
    // Hide input and check button
    input.disabled = true;
    document.getElementById('checkAnswerButton').style.display = 'none';
    
    // Show difficulty buttons for user to choose
    showDifficultyButtonsForReverse();
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
    feedback.innerHTML = `<span style="color: #007aff; font-weight: 600;">💡 Answer: "${currentLearningWord.english}"</span>`;
    
    // Show word details using unified component
    const detailsHtml = window.UIComponents?.createWordDetailSections?.(currentLearningWord, 'learning') || '';
    
    // Add difficulty buttons to the content using unified component
    const difficultyButtonsHtml = window.UIComponents?.createDifficultyButtons?.() || '';
    
    // Add details and buttons after the current content
    const learningContent = document.getElementById('learningContent');
    if (detailsHtml) {
        learningContent.insertAdjacentHTML('beforeend', detailsHtml);
    }
    learningContent.insertAdjacentHTML('beforeend', difficultyButtonsHtml);
    
    // Hide input and check button
    const input = document.getElementById('reverseTranslationInput');
    if (input) input.disabled = true;
    
    document.getElementById('checkAnswerButton').style.display = 'none';
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
    get currentLearningWord() { return currentLearningWord; },
    set currentLearningWord(value) { currentLearningWord = value; },
    get learningSession() { return learningSession; },
    set learningSession(value) { learningSession = value; },
    get sessionStats() { return sessionStats; },
    set sessionStats(value) { sessionStats = value; }
};

// Make functions globally available for compatibility
window.prepareLearningSession = prepareLearningSession;
window.startLearning = startLearning;
window.forceStartLearning = forceStartLearning;
window.showReverseTranslationCard = showReverseTranslationCard;
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