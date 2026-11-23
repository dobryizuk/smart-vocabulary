// ============================================================================
// WORD BUILDER: the model behind the "build the word from letter tiles" exercise
// ============================================================================

// Spaces, hyphens and apostrophes are shown in the answer row but never built by the user
const FIXED_CHARACTER = /[\s'’-]/;

const keepOrder = (items) => items;

function createBuildState(original, shuffle = keepOrder) {
    const slots = [...original.trim()].map((char) => ({ char, fixed: FIXED_CHARACTER.test(char) }));
    const totals = new Map();
    slots.filter(({ fixed }) => !fixed).forEach(({ char }) => {
        const letter = char.toLowerCase();
        totals.set(letter, (totals.get(letter) || 0) + 1);
    });
    const tiles = shuffle([...totals].map(([letter, total]) => ({ letter, total })));
    return { slots, tiles, entered: [] };
}

function countLettersToBuild(state) {
    return state.slots.filter(({ fixed }) => !fixed).length;
}

function remainingCount(state, letter) {
    const tile = state.tiles.find((candidate) => candidate.letter === letter);
    if (!tile) return 0;
    return tile.total - state.entered.filter((entered) => entered === letter).length;
}

function isComplete(state) {
    return state.entered.length === countLettersToBuild(state);
}

function placeLetter(state, letter) {
    if (isComplete(state) || remainingCount(state, letter) <= 0) return state;
    return { ...state, entered: [...state.entered, letter] };
}

function undoLetter(state) {
    return { ...state, entered: state.entered.slice(0, -1) };
}

// One entry per character of the answer; `active` marks the next slot to fill
function getSlotView(state) {
    let built = 0;
    return state.slots.map(({ char, fixed }) => {
        if (fixed) return { char, fixed, active: false };
        const slot = { char: state.entered[built] ?? '', fixed, active: built === state.entered.length };
        built++;
        return slot;
    });
}

function getBuiltText(state) {
    return getSlotView(state).map(({ char }) => char).join('');
}

function isCorrect(state, original) {
    return isComplete(state) && getBuiltText(state).toLowerCase() === original.trim().toLowerCase();
}

function checkBuild(state, original) {
    return { ...state, correct: isCorrect(state, original) };
}

module.exports = {
    createBuildState,
    countLettersToBuild,
    remainingCount,
    isComplete,
    placeLetter,
    undoLetter,
    getSlotView,
    getBuiltText,
    isCorrect,
    checkBuild
};
