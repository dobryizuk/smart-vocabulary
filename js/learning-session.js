// ============================================================================
// LEARNING SESSION MANAGEMENT
// ============================================================================

// AppState is provided by js/app-state.js and attached globally

const WordBuilder = require('./word-builder.js');
const { escapeHtml, createButton } = require('./ui-components.js');

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
    
    // Create unified word card for learning
    const UI = window.SV?.UIComponents;
    const actions = [UI?.createSpeakAction?.(window.SV.AppState.currentLearningWord.original)].filter(Boolean);
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

// What a prompt or an answer says about the word: its translation, or its definition when that is preferred and exists
function getWordPrompt(word, showDefinition) {
    if (showDefinition && word.definition) {
        return { label: 'Definition', main: word.definition, detail: '' };
    }
    return { label: 'Translation', main: word.translation, detail: word.definition };
}

function currentWordPrompt() {
    const showDefinition = window.SV?.SessionSettings?.getShowDefinition?.() ?? false;
    return getWordPrompt(window.SV.AppState.currentLearningWord, showDefinition);
}

// Keeps the revealed answer above the sticky rating bar
function scrollAnswerIntoView() {
    document.querySelector('#learningContent .card-translation')?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
}

async function showTranslation() {
    const card = document.getElementById('cardTranslation');

    const UI2 = window.SV?.UIComponents;
    const { label, main, detail } = currentWordPrompt();
    const layoutHtml = UI2?.createAnswerLayout?.({
        specificHtml: UI2.createPrimaryAnswerBlock(label, escapeHtml(main)),
        word: window.SV.AppState.currentLearningWord,
        showDefinition: Boolean(detail)
    }) || '';

    card.innerHTML = layoutHtml;
    card.style.opacity = '1';

    const showBtn = document.getElementById('showAnswerButton');
    if (showBtn) showBtn.style.display = 'none';

    window.SV?.SpeechManager?.speakWord?.(window.SV.AppState.currentLearningWord.original);
    renderSessionProgressBottom();
    scrollAnswerIntoView();
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

function resetSessionState() {
    // Clear any pending timers to avoid stale callbacks after session ends
    clearLearningSessionTimeouts();
    window.SV.AppState.sessionStats = { correct: 0, total: 0, streak: 0 };
    window.SV.AppState.learningSession = [];
    window.SV.AppState.sessionTotal = 0;
    window.SV.AppState.currentLearningWord = null;
}

function endLearningSession() {
    const learningContent = document.getElementById('learningContent');

    const accuracy = window.SV.AppState.sessionStats.total > 0 ? Math.round((window.SV.AppState.sessionStats.correct / window.SV.AppState.sessionStats.total) * 100) : 0;
    const message = `Great work! You reviewed ${window.SV.AppState.sessionStats.total} words.<br>Accuracy: ${accuracy}%<br>Best streak: ${window.SV.AppState.sessionStats.streak}`;
    
    const UI3 = window.SV?.UIComponents;
    const emptyStateHtml = UI3?.createEmptyState?.(
        'Session Complete!',
        message,
        [
            { text: 'Start New Session', action: 'start-learning', type: 'primary' },
            { text: 'Back to Today', action: 'show-tab', type: 'secondary', arg: 'today' }
        ]
    ) || '';
    
    learningContent.innerHTML = emptyStateHtml;
    resetSessionState();
}

// The close button: answers are saved per card, so leaving needs no confirmation
function stopLearningSession() {
    resetSessionState();
    const learningContent = document.getElementById('learningContent');
    if (learningContent) learningContent.innerHTML = '';
    window.SV?.Today?.showOverview?.();
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

// Whether the two items before i and j are the same pair in swapped order
function isAdjacentSwap(from, to, i, j, same) {
    return i > 1 && j > 1 && same(from[i - 1], to[j - 2]) && same(from[i - 2], to[j - 1]);
}

// distances[i][j]: edits that turn the first i items of `from` into the first j items of `to`;
// with `swaps`, exchanging two adjacent items is one edit
function editDistanceTable(from, to, same, swaps = false) {
    const distances = Array.from({ length: from.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= to.length; j++) {
        distances[0][j] = j;
    }

    for (let i = 1; i <= from.length; i++) {
        for (let j = 1; j <= to.length; j++) {
            const substitution = same(from[i - 1], to[j - 1]) ? 0 : 1;
            const swap = swaps && isAdjacentSwap(from, to, i, j, same) ? distances[i - 2][j - 2] + 1 : Infinity;
            distances[i][j] = Math.min(
                distances[i - 1][j - 1] + substitution,
                distances[i][j - 1] + 1,
                distances[i - 1][j] + 1,
                swap
            );
        }
    }
    return distances;
}

const sameChar = (a, b) => a === b;

// Typing mistakes between two strings: wrong, missing or extra letters, and swapped neighbours
function typoDistance(typed, expected) {
    return editDistanceTable(typed, expected, sameChar, true)[typed.length][expected.length];
}

// Edit operations that turn `from` into `to`, walking back through the distance table
function editOperations(from, to, same) {
    const distances = editDistanceTable(from, to, same);
    const operations = [];
    let i = from.length;
    let j = to.length;
    while (i > 0 || j > 0) {
        const here = distances[i][j];
        if (i > 0 && j > 0 && same(from[i - 1], to[j - 1]) && here === distances[i - 1][j - 1]) {
            operations.push({ type: 'equal', text: from[i - 1] });
            i--;
            j--;
        } else if (i > 0 && j > 0 && here === distances[i - 1][j - 1] + 1) {
            operations.push({ type: 'missing', text: to[j - 1] }, { type: 'wrong', text: from[i - 1] });
            i--;
            j--;
        } else if (i > 0 && here === distances[i - 1][j] + 1) {
            operations.push({ type: 'wrong', text: from[i - 1] });
            i--;
        } else {
            operations.push({ type: 'missing', text: to[j - 1] });
            j--;
        }
    }
    return operations.reverse();
}

// Consecutive operations of one type become one segment; inside a changed run the wrong text comes before the missing one
function groupOperations(operations) {
    const segments = [];
    const push = (type, text) => {
        if (!text) return;
        const last = segments[segments.length - 1];
        if (last?.type === type) last.text += text;
        else segments.push({ type, text });
    };
    let run = [];
    const flushRun = () => {
        for (const type of ['wrong', 'missing']) {
            push(type, run.filter((operation) => operation.type === type).map((operation) => operation.text).join(''));
        }
        run = [];
    };
    for (const operation of operations) {
        if (operation.type === 'equal') {
            flushRun();
            push('equal', operation.text);
        } else {
            run.push(operation);
        }
    }
    flushRun();
    return segments;
}

// The typed answer against the correct one, ignoring case and the ends:
// equal characters, wrong or extra typed characters, and the characters that are missing
function diffAnswer(input, answer) {
    const typed = Array.from(input.trim());
    const expected = Array.from(answer.trim());
    const sameIgnoringCase = (a, b) => a.toLowerCase() === b.toLowerCase();
    return groupOperations(editOperations(typed, expected, sameIgnoringCase));
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
    return used === 0 ? 'Hint' : `Hint (${remaining} left)`;
}

function showHintForReverse() {
    const word = window.SV.AppState.currentLearningWord;
    const input = document.getElementById('reverseTranslationInput');
    if (!word || !input) return;

    const answer = word.original.trim();
    const maxHints = getMaxHints(answer);
    const used = Math.min(window.SV.AppState.reverseHintCount + 1, maxHints);
    window.SV.AppState.reverseHintCount = used;
    input.value = getHintPrefix(answer, used);

    const hintBtn = document.getElementById('hintReverseButton');
    if (hintBtn) {
        hintBtn.textContent = hintButtonText(maxHints - used, used);
        hintBtn.disabled = used >= maxHints;
    }
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
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
    const { main, detail } = currentWordPrompt();
    const cardHtml = renderExerciseCard({
        chip: /\s/.test(word.original.trim()) ? 'phrase' : 'word',
        title: main,
        definition: detail
    });

    const inputBlock = window.SV?.UIComponents?.createLabeledTextInput?.({
        inputId: 'reverseTranslationInput',
        label: 'Your answer',
        placeholder: 'Enter original word or phrase...',
        enterButtonId: 'checkReverseButton'
    }) || '';

    const hasHints = getMaxHints(word.original.trim()) > 0;
    mainEl.innerHTML = `
        <p class="learning-prompt">Write it in English</p>
        ${cardHtml}
        ${inputBlock}

        <div id="reverseActions" class="typing-actions">
            ${createButton(hintButtonText(0, 0), 'show-hint-reverse', 'secondary', !hasHints, 'hintReverseButton')}
            ${createButton('Check', 'check-reverse', 'primary', false, 'checkReverseButton', '', '', 'reverse-check')}
        </div>
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

const VERDICT_FEEDBACK = {
    exact: { tone: 'success', text: 'Correct!' },
    close: { tone: 'warn', text: 'Almost — check the spelling' },
    wrong: { tone: 'danger', text: 'Not quite' }
};

// Edits a typo may have: none in answers under 4 characters, one up to 15 characters, two from 16
function allowedTypoEdits(answerLength) {
    if (answerLength < 4) return 0;
    return answerLength < 16 ? 1 : 2;
}

// 'exact' when equal after normalisation, 'close' for a typo, otherwise 'wrong'
function getTypingVerdict(userInput, correctAnswer) {
    const typed = normalizeText(userInput);
    const expected = normalizeText(correctAnswer);
    if (typed === expected) return 'exact';
    return typoDistance(typed, expected) <= allowedTypoEdits(expected.length) ? 'close' : 'wrong';
}

// The strongest rating a checked answer allows: Hard after a miss, Medium after a typo or a hint
function getMaxRating(verdict, hintsUsed = 0) {
    if (verdict === 'wrong') return 'hard';
    if (verdict === 'close' || hintsUsed > 0) return 'medium';
    return 'perfect';
}

function renderAnswerDiff(segments) {
    return segments.map(({ type, text }) => {
        const safeText = escapeHtml(text);
        if (type === 'wrong') return `<del class="typing-diff__wrong">${safeText}</del>`;
        if (type === 'missing') return `<ins class="typing-diff__missing">${safeText}</ins>`;
        return safeText;
    }).join('');
}

function checkReverseTranslation() {
    const input = document.getElementById('reverseTranslationInput');
    const feedback = document.getElementById('typingFeedback');
    const diff = document.getElementById('typingDiff');
    if (!input || !feedback || !diff || input.disabled) return;

    if (!input.value.trim()) {
        revealAnswer(getMaxRating('wrong'));
        return;
    }

    const answer = window.SV.AppState.currentLearningWord.original;
    const verdict = getTypingVerdict(input.value, answer);
    const { tone, text } = VERDICT_FEEDBACK[verdict];
    input.classList.add(`typing-input--${tone}`);
    feedback.textContent = text;
    if (verdict !== 'exact') diff.innerHTML = renderAnswerDiff(diffAnswer(input.value, answer));
    revealAnswer(getMaxRating(verdict, window.SV.AppState.reverseHintCount));
}

function revealAnswer(maxRating) {
    const UI5 = window.SV?.UIComponents;
    const specificHtml = UI5?.createPrimaryAnswerBlock?.('Correct answer', window.SV.AppState.currentLearningWord.original, [UI5.createSpeakAction(window.SV.AppState.currentLearningWord.original)]) || '';
    const layoutHtml = UI5?.createAnswerLayout?.({
        specificHtml,
        word: window.SV.AppState.currentLearningWord,
        showDefinition: false,
        maxRating
    }) || '';

    const { mainEl } = ensureLearningLayout();
    if (mainEl) mainEl.insertAdjacentHTML('beforeend', layoutHtml);
    renderSessionProgressBottom();

    const input = document.getElementById('reverseTranslationInput');
    if (input) input.disabled = true;
    const actions = document.getElementById('reverseActions');
    if (actions) actions.style.display = 'none';
    window.SV?.SpeechManager?.speakWord?.(window.SV.AppState.currentLearningWord.original);
    scrollAnswerIntoView();
}

// ============================================================================
// BUILD EXERCISE
// ============================================================================

// Longer prompts (a definition, a phrase) get a smaller title so they do not fill the screen
const LONG_TITLE_MIN_LENGTH = 31;

// Prompt card of the exercises where the word is produced from its translation
function renderExerciseCard({ extraClass = '', chip, title, definition }) {
    const definitionHtml = definition ? `<p class="exercise-card__definition">${escapeHtml(definition)}</p>` : '';
    const titleClass = title.length >= LONG_TITLE_MIN_LENGTH ? 'exercise-card__title exercise-card__title--long' : 'exercise-card__title';
    return `
        <section class="exercise-card ${extraClass}">
            <span class="exercise-card__chip">${escapeHtml(chip)}</span>
            <h2 class="${titleClass}">${escapeHtml(title)}</h2>
            ${definitionHtml}
        </section>
    `;
}

const SLOT_RESULT_CLASS = { true: 'build-slot--right', false: 'build-slot--wrong' };

function renderBuildSlot({ char, fixed, active, right }) {
    const classes = ['build-slot', fixed && 'build-slot--fixed', active && 'build-slot--active', SLOT_RESULT_CLASS[right]].filter(Boolean).join(' ');
    return `<span class="${classes}">${escapeHtml(char)}</span>`;
}

function renderBuildSlots(state) {
    const wordsHtml = WordBuilder.getSlotView(state).map((word) => (
        `<span class="build-word" style="--letters: ${word.length};">${word.map(renderBuildSlot).join('')}</span>`
    )).join('');
    return `<div class="build-slots" data-testid="build-slots" aria-label="Your answer: ${escapeHtml(WordBuilder.getBuiltText(state))}">${wordsHtml}</div>`;
}

function renderBuildTiles(state) {
    const tilesHtml = state.tiles.map(({ letter, total }) => {
        const left = WordBuilder.remainingCount(state, letter);
        const label = total > 1 ? `${letter}, ${left} left` : letter;
        const badge = left > 1 ? `<span class="build-tile__count" aria-hidden="true">${left}</span>` : '';
        return `<button type="button" class="build-tile" data-action="build-place" data-arg="${escapeHtml(letter)}" aria-label="${escapeHtml(label)}"${left === 0 ? ' disabled' : ''}>${escapeHtml(letter)}${badge}</button>`;
    }).join('');
    return `<div class="build-tiles">${tilesHtml}</div>`;
}

function renderBuildFeedback(correct) {
    const text = correct ? 'Correct!' : 'Not quite';
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

    const { main, detail } = currentWordPrompt();
    const { mainEl, progressEl } = ensureLearningLayout(true);
    mainEl.innerHTML = `
        <p class="learning-prompt">Build the word</p>
        ${renderExerciseCard({
            extraClass: 'build-card',
            chip: `${letters} ${letters === 1 ? 'letter' : 'letters'}`,
            title: main,
            definition: detail
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
    revealAnswer(getMaxRating(AppState.buildState.correct ? 'exact' : 'wrong'));
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
    stopLearningSession,
    selectSessionBatch,
    determineExerciseType,
    showBuildCard,
    placeBuildLetter,
    undoBuildLetter,
    checkBuildAnswer,
    checkReverseTranslation,
    getTypingVerdict,
    getMaxRating,
    showHintForReverse,
    getHintPrefix,
    getMaxHints,
    normalizeText,
    diffAnswer,
    getWordPrompt,
    LONG_TITLE_MIN_LENGTH
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearningSessionExports;
}
