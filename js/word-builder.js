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
    return { slots, tiles, entered: [], mistakes: 0 };
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

// A letter placed where the answer has another one is a mistake; Undo does not take it back
function placeLetter(state, letter) {
    if (isComplete(state) || remainingCount(state, letter) <= 0) return state;
    const placed = { ...state, entered: [...state.entered, letter] };
    return { ...placed, mistakes: state.mistakes + Number(!isLetterRight(placed, state.entered.length)) };
}

function undoLetter(state) {
    return { ...state, entered: state.entered.slice(0, -1) };
}

function expectedLetters(state) {
    return state.slots.filter(({ fixed }) => !fixed).map(({ char }) => char.toLowerCase());
}

// Whether the letter placed at `index` is the letter the answer has there
function isLetterRight(state, index) {
    return index < state.entered.length && state.entered[index] === expectedLetters(state)[index];
}

// One entry per character of the answer; `active` marks the next slot to fill,
// `right` tells whether a placed letter fits its slot (null for empty and fixed slots)
function getCharView(state) {
    let built = 0;
    return state.slots.map(({ char, fixed }) => {
        if (fixed) return { char, fixed, active: false, right: null };
        const placed = built < state.entered.length;
        const slot = {
            char: placed ? state.entered[built] : '',
            fixed,
            active: built === state.entered.length,
            right: placed ? isLetterRight(state, built) : null
        };
        built++;
        return slot;
    });
}

// The slots of each word of the answer; the gaps between words are not slots
function getSlotView(state) {
    const words = [[]];
    getCharView(state).forEach((slot, index) => {
        if (/\s/.test(state.slots[index].char)) {
            if (words.at(-1).length > 0) words.push([]);
            return;
        }
        words.at(-1).push(slot);
    });
    return words.filter((word) => word.length > 0);
}

function getBuiltText(state) {
    return getCharView(state).map(({ char }) => char).join('');
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
    isLetterRight,
    getSlotView,
    getBuiltText,
    isCorrect,
    checkBuild
};
