// ============================================================================
// BUILD: the word is built from letter tiles, Check marks each letter
// ============================================================================

const WordBuilder = require('../word-builder.js');
const { escapeHtml } = require('../ui-components.js');
const { secureShuffle } = require('../secure-shuffle.js');
const {
    currentWordPrompt, getMaxRating, showExerciseScreen, renderExerciseCard, revealCorrectAnswer
} = require('./exercise-screen.js');

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
    AppState.buildState = WordBuilder.createBuildState(AppState.currentLearningWord.original, secureShuffle);
    const letters = WordBuilder.countLettersToBuild(AppState.buildState);

    const { main, detail } = currentWordPrompt();
    showExerciseScreen({
        task: 'Build the word',
        cardHtml: renderExerciseCard({
            extraClass: 'build-card',
            chip: `${letters} ${letters === 1 ? 'letter' : 'letters'}`,
            title: main,
            definition: detail
        }),
        controlsHtml: '<div id="buildArea"></div>'
    });
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
    revealCorrectAnswer(getMaxRating(AppState.buildState.correct ? 'exact' : 'wrong'));
}

module.exports = { showBuildCard, placeBuildLetter, undoBuildLetter, checkBuildAnswer };
