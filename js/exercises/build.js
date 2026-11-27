// ============================================================================
// BUILD: the word is built from letter tiles, Check marks each letter
// ============================================================================

const WordBuilder = require('../word-builder.js');
const { escapeHtml } = require('../ui-components.js');
const { secureShuffle } = require('../secure-shuffle.js');
const {
    currentWordPrompt, VERDICT_FEEDBACK, getMaxRating, showExerciseScreen, renderExerciseCard, revealCorrectAnswer
} = require('./exercise-screen.js');

const SLOT_RESULT_CLASS = { true: 'build-slot--right', false: 'build-slot--wrong' };

// The area is drawn once per card; a tap, Undo and Check update its elements in place. The slots sit in
// a size container, and WebKit lays new elements out in one in an extra pass that clamps the screen's
// scroll, so rebuilding them would throw a user who scrolled down to the tiles back up
function buildSlotClass({ fixed, active, right }) {
    return ['build-slot', fixed && 'build-slot--fixed', active && 'build-slot--active', SLOT_RESULT_CLASS[right]].filter(Boolean).join(' ');
}

const buildSlotsLabel = (state) => `Your answer: ${WordBuilder.getBuiltText(state)}`;

function renderBuildSlots(state) {
    const wordsHtml = WordBuilder.getSlotView(state).map((word) => {
        const slotsHtml = word.map((slot) => `<span class="${buildSlotClass(slot)}">${escapeHtml(slot.char)}</span>`).join('');
        return `<span class="build-word" style="--letters: ${word.length};">${slotsHtml}</span>`;
    }).join('');
    return `<div class="build-slots" data-testid="build-slots" aria-label="${escapeHtml(buildSlotsLabel(state))}">${wordsHtml}</div>`;
}

function updateBuildSlots(slotsEl, state) {
    const slots = WordBuilder.getSlotView(state).flat();
    slotsEl.querySelectorAll('.build-slot').forEach((slotEl, index) => {
        slotEl.className = buildSlotClass(slots[index]);
        slotEl.textContent = slots[index].char;
    });
    slotsEl.setAttribute('aria-label', buildSlotsLabel(state));
}

// What a tile shows: its letter, how many are left in its label, and a badge while 2 or more are left
function getTileView(state, { letter, total }) {
    const left = WordBuilder.remainingCount(state, letter);
    const badge = left > 1 ? `<span class="build-tile__count" aria-hidden="true">${left}</span>` : '';
    return {
        label: total > 1 ? `${letter}, ${left} left` : letter,
        contentHtml: `${escapeHtml(letter)}${badge}`,
        disabled: left === 0
    };
}

function renderBuildTiles(state) {
    const tilesHtml = state.tiles.map((tile) => {
        const { label, contentHtml, disabled } = getTileView(state, tile);
        return `<button type="button" class="build-tile" data-action="build-place" data-arg="${escapeHtml(tile.letter)}" aria-label="${escapeHtml(label)}"${disabled ? ' disabled' : ''}>${contentHtml}</button>`;
    }).join('');
    return `<div class="build-tiles">${tilesHtml}</div>`;
}

function updateBuildTiles(area, state) {
    area.querySelectorAll('.build-tile').forEach((tileEl, index) => {
        const { label, contentHtml, disabled } = getTileView(state, state.tiles[index]);
        tileEl.setAttribute('aria-label', label);
        tileEl.innerHTML = contentHtml;
        tileEl.disabled = disabled;
    });
}

function renderBuildFeedback(correct) {
    const { text } = VERDICT_FEEDBACK[correct ? 'exact' : 'wrong'];
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

function updateBuildControls(area, state) {
    area.querySelector('[data-action="build-undo"]').disabled = state.entered.length === 0;
    area.querySelector('[data-action="build-check"]').disabled = !WordBuilder.isComplete(state);
}

// After a check the tiles and controls give way to the verdict
function updateBuildArea() {
    const area = document.getElementById('buildArea');
    const state = window.SV.AppState.buildState;
    if (!area || !state) return;
    updateBuildSlots(area.querySelector('.build-slots'), state);
    if (state.correct === undefined) {
        updateBuildTiles(area, state);
        updateBuildControls(area, state);
        return;
    }
    area.querySelector('.build-tiles').remove();
    area.querySelector('.build-controls').remove();
    area.insertAdjacentHTML('beforeend', renderBuildFeedback(state.correct));
}

function showBuildCard() {
    const AppState = window.SV.AppState;
    const state = WordBuilder.createBuildState(AppState.currentLearningWord.original, secureShuffle);
    AppState.buildState = state;
    const letters = WordBuilder.countLettersToBuild(state);

    const { main, detail } = currentWordPrompt();
    showExerciseScreen({
        task: 'Build the word',
        cardHtml: renderExerciseCard({
            extraClass: 'build-card',
            chip: `${letters} ${letters === 1 ? 'letter' : 'letters'}`,
            title: main,
            definition: detail
        }),
        controlsHtml: `<div id="buildArea">${renderBuildSlots(state)}${renderBuildTiles(state)}${renderBuildControls(state)}</div>`
    });
}

function placeBuildLetter(letter) {
    const AppState = window.SV.AppState;
    AppState.buildState = WordBuilder.placeLetter(AppState.buildState, letter);
    updateBuildArea();
}

function undoBuildLetter() {
    const AppState = window.SV.AppState;
    AppState.buildState = WordBuilder.undoLetter(AppState.buildState);
    updateBuildArea();
}

function checkBuildAnswer() {
    const AppState = window.SV.AppState;
    if (!WordBuilder.isComplete(AppState.buildState)) return;
    AppState.buildState = WordBuilder.checkBuild(AppState.buildState, AppState.currentLearningWord.original);
    updateBuildArea();
    revealCorrectAnswer(getMaxRating(AppState.buildState.correct ? 'exact' : 'wrong'));
}

module.exports = { showBuildCard, placeBuildLetter, undoBuildLetter, checkBuildAnswer };
