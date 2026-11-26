// ============================================================================
// WRITING: the word is typed from its translation; hints type its first letters,
// Check tints the field and marks the mistakes letter by letter
// ============================================================================

const { escapeHtml, createButton, createLabeledTextInput } = require('../ui-components.js');
const {
    scheduleOnScreen, currentWordPrompt, VERDICT_FEEDBACK, getMaxRating, showExerciseScreen, renderExerciseCard, revealCorrectAnswer
} = require('./exercise-screen.js');

// Lets the card settle before the field takes focus
const FOCUS_DELAY_MS = 50;

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

function focusAnswerInput() {
    const input = document.getElementById('reverseTranslationInput');
    if (!input) return;
    input.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

function showReverseTranslationCard() {
    window.SV.AppState.reverseHintCount = 0;
    const word = window.SV.AppState.currentLearningWord;
    const { main, detail } = currentWordPrompt();
    const hasHints = getMaxHints(word.original.trim()) > 0;
    showExerciseScreen({
        task: 'Write it in English',
        cardHtml: renderExerciseCard({
            chip: /\s/.test(word.original.trim()) ? 'phrase' : 'word',
            title: main,
            definition: detail
        }),
        controlsHtml: `
            ${createLabeledTextInput({
                inputId: 'reverseTranslationInput',
                label: 'Your answer',
                placeholder: 'Enter original word or phrase...',
                enterButtonId: 'checkReverseButton'
            })}
            <div id="reverseActions" class="typing-actions">
                ${createButton(hintButtonText(0, 0), 'show-hint-reverse', 'secondary', !hasHints, 'hintReverseButton')}
                ${createButton('Check', 'check-reverse', 'primary', false, 'checkReverseButton', '', '', 'reverse-check')}
            </div>
        `
    });
    scheduleOnScreen(focusAnswerInput, FOCUS_DELAY_MS);
}

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

function renderAnswerDiff(segments) {
    return segments.map(({ type, text }) => {
        const safeText = escapeHtml(text);
        if (type === 'wrong') return `<del class="typing-diff__wrong">${safeText}</del>`;
        if (type === 'missing') return `<ins class="typing-diff__missing">${safeText}</ins>`;
        return safeText;
    }).join('');
}

// The field is locked and Hint/Check give way to the answer
function finishWriting(maxRating) {
    document.getElementById('reverseTranslationInput').disabled = true;
    document.getElementById('reverseActions').style.display = 'none';
    revealCorrectAnswer(maxRating);
}

// An empty Check shows the answer and counts as a miss
function checkReverseTranslation() {
    const input = document.getElementById('reverseTranslationInput');
    const feedback = document.getElementById('typingFeedback');
    const diff = document.getElementById('typingDiff');
    if (!input || !feedback || !diff || input.disabled) return;

    if (!input.value.trim()) {
        finishWriting(getMaxRating('wrong'));
        return;
    }

    const answer = window.SV.AppState.currentLearningWord.original;
    const verdict = getTypingVerdict(input.value, answer);
    const { tone, text } = VERDICT_FEEDBACK[verdict];
    input.classList.add(`typing-input--${tone}`);
    feedback.textContent = text;
    if (verdict !== 'exact') diff.innerHTML = renderAnswerDiff(diffAnswer(input.value, answer));
    finishWriting(getMaxRating(verdict, window.SV.AppState.reverseHintCount));
}

module.exports = {
    showReverseTranslationCard,
    showHintForReverse,
    checkReverseTranslation,
    getTypingVerdict,
    getHintPrefix,
    getMaxHints,
    diffAnswer
};
