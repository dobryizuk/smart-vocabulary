// ============================================================================
// LEARNING SESSION MANAGEMENT
// ============================================================================

// AppState is provided by js/app-state.js and attached globally

const WordBuilder = require('./word-builder.js');

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

// Due words with the oldest nextReview first, then new words (nextReview null)
function selectSessionBatch(words, size) {
    const byPriority = (a, b) => {
        if (!a.nextReview && !b.nextReview) return 0;
        if (!a.nextReview) return 1;
        if (!b.nextReview) return -1;
        return new Date(a.nextReview) - new Date(b.nextReview);
    };
    return secureShuffle([...words].sort(byPriority).slice(0, size));
}

function beginSession(candidates) {
    const AppState = window.SV.AppState;
    const size = window.SV?.SessionSettings?.getSessionSize?.() ?? 15;
    AppState.learningSession = selectSessionBatch(candidates, size);
    AppState.sessionTotal = AppState.learningSession.length;
    AppState.currentLearningWord = AppState.learningSession[0];
    showLearningCard();
}

function prepareLearningSession() {
    const AppState = window.SV.AppState;
    ensureLearningLayout();

    if (AppState.currentLearningWord && AppState.learningSession.length > 0) {
        showLearningCard();
        return;
    }

    const wordsForReview = window.SV?.SpacedRepetition?.getWordsForReview?.() || [];
    if (wordsForReview.length === 0) {
        const vocabulary = window.SV?.DataManager?.vocabulary || [];
        renderLearningEmptyState(vocabulary.length > 0);
        return;
    }

    beginSession(wordsForReview);
}

function startLearning() {
    const wordsForReview = window.SV?.SpacedRepetition?.getWordsForReview?.() || [];
    if (wordsForReview.length === 0) {
        prepareLearningSession();
        return;
    }
    beginSession(wordsForReview);
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

function renderSessionProgress() {
    const { learningSession, sessionTotal } = window.SV.AppState;
    return window.SV?.UIComponents?.createSessionProgress?.(sessionTotal - learningSession.length + 1, sessionTotal) || '';
}

const SPEAKER_ICON = '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"></path></svg>';

function ensureLearningLayout(resetMain = false) {
    const learningContent = document.getElementById('learningContent');
    if (!learningContent) return { mainEl: null, progressEl: null };
    let mainEl = document.getElementById('learningMain');
    let progressEl = document.getElementById('sessionProgressContainer');
    if (!mainEl || !progressEl) {
        learningContent.innerHTML = `
            <div id="sessionProgressContainer"></div>
            <div id="learningMain"></div>
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
    beginSession(vocabulary);
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

    // Show appropriate exercise type
    if (exerciseType === 'reverse') {
        showReverseTranslationCard();
        return;
    }
    if (exerciseType === 'build') {
        showBuildCard();
        return;
    }

    // Continue with regular exercise (existing code)
    const { mainEl, progressEl } = ensureLearningLayout(true);
    
    // Define actions for learning card
    const actions = [
        {
            type: 'primary',
            icon: SPEAKER_ICON,
            action: 'speak-word',
            arg: window.SV.AppState.currentLearningWord.original,
            title: 'Pronounce word'
        }
    ];
    
    // Prepare actions for learning card only (progress metadata is computed by UI component as needed)
    
    // Create unified word card for learning
    const UI = window.SV?.UIComponents;
    const cardHtml = UI?.createWordCard?.(window.SV.AppState.currentLearningWord, 'learning', actions) || '';
    mainEl.insertAdjacentHTML('beforeend', `<p class="learning-prompt">Do you know this word?</p>${cardHtml}`);
    mainEl.insertAdjacentHTML('beforeend', `
        ${window.SV?.UIComponents?.createButtonGroup?.([
            { text: 'Show Answer', action: 'show-translation', type: 'primary', id: 'showAnswerButton' }
        ]) || ''}
        <div id="cardTranslation"></div>
    `);
    if (progressEl) progressEl.innerHTML = renderSessionProgress();
    
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
    const reviewData = SRcalc?.calculateNextReview?.(difficulty, word);

    if (reviewData) {
        const answeredAt = new Date().toISOString();
        Object.assign(word, reviewData, { updatedAt: answeredAt });
        word.reviewHistory.push({
            date: answeredAt,
            difficulty,
            exerciseType: word.currentExerciseType || 'regular'
        });
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

    window.SV?.DataManager?.save?.();
    showLearningCard();
}

function endLearningSession() {
    // Clear any pending timers to avoid stale callbacks after session ends
    clearLearningSessionTimeouts();
    const learningContent = document.getElementById('learningContent');
    
    const accuracy = window.SV.AppState.sessionStats.total > 0 ? Math.round((window.SV.AppState.sessionStats.correct / window.SV.AppState.sessionStats.total) * 100) : 0;
    const message = `Great work! You reviewed ${window.SV.AppState.sessionStats.total} words.<br>Accuracy: ${accuracy}%<br>Best streak: ${window.SV.AppState.sessionStats.streak}`;
    
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
    window.SV.AppState.learningSession = [];
    window.SV.AppState.sessionTotal = 0;
    window.SV.AppState.currentLearningWord = null;
}

// ============================================================================
// REVERSE TRANSLATION SYSTEM
// ============================================================================

// Exercises in the order a word moves through them
const EXERCISE_STAGES = ['regular', 'build', 'reverse'];

// Ratings of the "OK" and "Easy" buttons
const PASSED_RATINGS = ['easy', 'perfect'];

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

    const word = window.SV.AppState.currentLearningWord;
    const cardHtml = renderExerciseCard({
        chip: /\s/.test(word.original.trim()) ? 'phrase' : 'word',
        title: word.translation,
        definition: word.definition
    });

    const inputBlock = window.SV?.UIComponents?.createLabeledTextInput?.({
        inputId: 'reverseTranslationInput',
        label: 'Your answer',
        placeholder: 'Enter original word or phrase...',
        onKeyPress: 'handleReverseInputKeyPress(event)',
        onInput: 'validateReverseInput()'
    }) || '';

    const hasHints = getMaxHints(word.original.trim()) > 0;
    mainEl.innerHTML = `
        <p class="learning-prompt">Write it in English</p>
        ${cardHtml}
        ${inputBlock}
        <div id="reverseHint" class="typing-hint" aria-live="polite"></div>

        ${window.SV?.UIComponents?.createButtonGroup?.([
            { text: hintButtonText(0, 0), action: 'show-hint-reverse', type: 'secondary', id: 'hintReverseButton', disabled: !hasHints },
            { text: 'Show Answer', action: 'show-answer-reverse', type: 'primary', id: 'showAnswerReverseButton' }
        ]) || ''}
    `;
    
    // Render session progress in dedicated container
    progressEl.innerHTML = renderSessionProgress();
    
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
        showDefinition: false
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

// ============================================================================
// BUILD EXERCISE
// ============================================================================

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// Prompt card of the exercises where the word is produced from its translation
function renderExerciseCard({ extraClass = '', chip, title, definition }) {
    const definitionHtml = definition ? `<p class="exercise-card__definition">${escapeHtml(definition)}</p>` : '';
    return `
        <section class="exercise-card ${extraClass}">
            <span class="exercise-card__chip">${escapeHtml(chip)}</span>
            <h2 class="exercise-card__title">${escapeHtml(title)}</h2>
            ${definitionHtml}
        </section>
    `;
}

const BUILD_RESULT_CLASS = { true: 'build-slots--correct', false: 'build-slots--wrong' };

function renderBuildSlots(state) {
    const slotsHtml = WordBuilder.getSlotView(state).map(({ char, fixed, active }) => {
        const classes = ['build-slot', fixed && 'build-slot--fixed', active && 'build-slot--active'].filter(Boolean).join(' ');
        return `<span class="${classes}">${escapeHtml(char)}</span>`;
    }).join('');
    const resultClass = BUILD_RESULT_CLASS[state.correct] ?? '';
    return `<div class="build-slots ${resultClass}" data-testid="build-slots" aria-label="Your answer: ${escapeHtml(WordBuilder.getBuiltText(state))}">${slotsHtml}</div>`;
}

function renderBuildTiles(state) {
    const tilesHtml = state.tiles.map(({ letter, total }) => {
        const left = WordBuilder.remainingCount(state, letter);
        const label = total > 1 ? `${letter}, ${left} left` : letter;
        const badge = total > 1 ? `<span class="build-tile__count" aria-hidden="true">${left}</span>` : '';
        return `<button type="button" class="build-tile" data-action="build-place" data-arg="${escapeHtml(letter)}" aria-label="${escapeHtml(label)}"${left === 0 ? ' disabled' : ''}>${escapeHtml(letter)}${badge}</button>`;
    }).join('');
    return `<div class="build-tiles">${tilesHtml}</div>`;
}

function renderBuildFeedback(correct) {
    const text = correct ? '✅ Correct!' : '❌ Not quite';
    return `<div class="build-feedback build-feedback--${correct ? 'correct' : 'wrong'}" role="status">${text}</div>`;
}

function renderBuildControls(state) {
    const undoDisabled = state.entered.length === 0 ? ' disabled' : '';
    const checkDisabled = WordBuilder.isComplete(state) ? '' : ' disabled';
    return `
        <div class="build-controls">
            <button type="button" class="build-control" data-action="build-undo"${undoDisabled}>Undo</button>
            <button type="button" class="build-control build-control--primary" data-action="build-check" data-testid="build-check"${checkDisabled}>Check</button>
        </div>
    `;
}

function renderBuildArea() {
    const area = document.getElementById('buildArea');
    const state = window.SV.AppState.buildState;
    if (!area || !state) return;
    if (state.correct === undefined) {
        area.innerHTML = renderBuildSlots(state) + renderBuildTiles(state) + renderBuildControls(state);
        return;
    }
    area.innerHTML = renderBuildSlots(state) + renderBuildFeedback(state.correct);
}

function showBuildCard() {
    const AppState = window.SV.AppState;
    const word = AppState.currentLearningWord;
    clearLearningSessionTimeouts();

    AppState.buildState = WordBuilder.createBuildState(word.original, secureShuffle);
    const letters = WordBuilder.countLettersToBuild(AppState.buildState);

    const { mainEl, progressEl } = ensureLearningLayout(true);
    mainEl.innerHTML = `
        <p class="learning-prompt">Build the word</p>
        ${renderExerciseCard({
            extraClass: 'build-card',
            chip: `${letters} ${letters === 1 ? 'letter' : 'letters'}`,
            title: word.translation,
            definition: word.definition
        })}
        <div id="buildArea"></div>
    `;
    progressEl.innerHTML = renderSessionProgress();
    renderBuildArea();
}

function placeBuildLetter(letter) {
    const AppState = window.SV.AppState;
    AppState.buildState = WordBuilder.placeLetter(AppState.buildState, letter);
    renderBuildArea();
}

function undoBuildLetter() {
    const AppState = window.SV.AppState;
    AppState.buildState = WordBuilder.undoLetter(AppState.buildState);
    renderBuildArea();
}

function checkBuildAnswer() {
    const AppState = window.SV.AppState;
    if (!WordBuilder.isComplete(AppState.buildState)) return;
    AppState.buildState = WordBuilder.checkBuild(AppState.buildState, AppState.currentLearningWord.original);
    renderBuildArea();
    showAnswerForReverse();
}

function renderSessionProgressBottom() {
    const progressEl = document.getElementById('sessionProgressContainer');
    const learningContent = document.getElementById('learningContent');
    const progressHtml = renderSessionProgress();
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
    selectSessionBatch,
    determineExerciseType,
    showBuildCard,
    placeBuildLetter,
    undoBuildLetter,
    checkBuildAnswer,
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearningSessionExports;
}
