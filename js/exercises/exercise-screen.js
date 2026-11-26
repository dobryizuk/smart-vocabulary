// ============================================================================
// EXERCISE SCREEN: what the exercises share — the card frame, the prompt card,
// the revealed answer, the word's voice and the screen's timers
// ============================================================================

const {
    escapeHtml, createSpeakAction, createSessionProgress, createAnswerLayout, createPrimaryAnswerBlock
} = require('../ui-components.js');

// Longer prompts (a definition, a phrase) get a smaller title so they do not fill the screen
const LONG_TITLE_MIN_LENGTH = 31;

const currentWord = () => window.SV.AppState.currentLearningWord;

// Timers of the screen on show: a new card or the end of the session cancels them
const screenTimeouts = [];

function scheduleOnScreen(callback, delay) {
    screenTimeouts.push(setTimeout(callback, delay));
}

function clearScreenTimeouts() {
    while (screenTimeouts.length) clearTimeout(screenTimeouts.pop());
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
    return getWordPrompt(currentWord(), showDefinition);
}

// The card's speaker button shows the wait while the word's natural voice clip is made
function speakCurrentWord() {
    const button = document.querySelector('#learningMain [data-action="speak-word"]');
    window.SV?.SpeechManager?.speakWord?.(currentWord().original, button);
}

// What a checked answer is told, by its verdict: the tone of the writing field and the text
const VERDICT_FEEDBACK = {
    exact: { tone: 'success', text: 'Correct!' },
    close: { tone: 'warn', text: 'Almost — check the spelling' },
    wrong: { tone: 'danger', text: 'Not quite' }
};

// The strongest rating a checked answer allows: Hard after a miss, Medium after a typo or a hint
function getMaxRating(verdict, hintsUsed = 0) {
    if (verdict === 'wrong') return 'hard';
    if (verdict === 'close' || hintsUsed > 0) return 'medium';
    return 'perfect';
}

function renderSessionProgress() {
    const { learningSession, sessionTotal } = window.SV.AppState;
    return createSessionProgress(sessionTotal - learningSession.length + 1, sessionTotal);
}

function getLearningLayout() {
    if (!document.getElementById('learningMain') || !document.getElementById('sessionProgressContainer')) {
        document.getElementById('learningContent').innerHTML = `
            <div id="sessionProgressContainer"></div>
            <div id="learningMain"></div>
        `;
    }
    return {
        mainEl: document.getElementById('learningMain'),
        progressEl: document.getElementById('sessionProgressContainer')
    };
}

// The frame of every exercise: session progress on top, then the task, the card and the exercise's controls
function showExerciseScreen({ task, cardHtml, controlsHtml }) {
    const { mainEl, progressEl } = getLearningLayout();
    mainEl.innerHTML = `<p class="learning-prompt">${task}</p>${cardHtml}${controlsHtml}`;
    progressEl.innerHTML = renderSessionProgress();
}

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

// The revealed answer: its main block, the word's details and the rating buttons up to maxRating;
// the word is spoken and the answer kept above the sticky rating bar
function showAnswer(container, { label, value, actions, showDefinition, maxRating }) {
    container.insertAdjacentHTML('beforeend', createAnswerLayout({
        specificHtml: createPrimaryAnswerBlock(label, value, actions),
        word: currentWord(),
        showDefinition,
        maxRating
    }));
    speakCurrentWord();
    document.querySelector('#learningContent .card-translation')?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
}

// After a check: the correct answer with its speaker; the definition is already on the card
function revealCorrectAnswer(maxRating) {
    const { original } = currentWord();
    showAnswer(getLearningLayout().mainEl, {
        label: 'Correct answer',
        value: escapeHtml(original),
        actions: [createSpeakAction(original)],
        showDefinition: false,
        maxRating
    });
}

module.exports = {
    LONG_TITLE_MIN_LENGTH,
    scheduleOnScreen,
    clearScreenTimeouts,
    getWordPrompt,
    currentWordPrompt,
    speakCurrentWord,
    VERDICT_FEEDBACK,
    getMaxRating,
    showExerciseScreen,
    renderExerciseCard,
    showAnswer,
    revealCorrectAnswer
};
