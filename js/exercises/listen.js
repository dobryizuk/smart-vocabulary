// ============================================================================
// LISTENING: the word is heard, not shown, and typed (the typed answer is in typed-answer.js);
// its meaning comes with the answer after Check
// ============================================================================

const { escapeHtml } = require('../ui-components.js');
const { icon } = require('../icons.js');
const { scheduleAutoPlay, revealCorrectAnswer } = require('./exercise-screen.js');
const { answerKind, showTypedAnswerScreen, checkTypedAnswer } = require('./typed-answer.js');

function renderListenCard(original) {
    return `
        <section class="exercise-card listen-card">
            <span class="exercise-card__chip">${answerKind(original)}</span>
            <button type="button" class="action-btn listen-card__speaker" data-action="speak-word" data-arg="${escapeHtml(original)}" aria-label="Play the word">${icon('speaker')}</button>
        </section>
    `;
}

// The word plays as the card opens, whatever the auto-play setting: the exercise is to hear it
function showListenCard() {
    showTypedAnswerScreen({
        task: 'Write what you hear',
        cardHtml: renderListenCard(window.SV.AppState.currentLearningWord.original),
        checkAction: 'check-listen'
    });
    scheduleAutoPlay();
}

function checkListenAnswer() {
    checkTypedAnswer((maxRating) => revealCorrectAnswer(maxRating, { withMeaning: true }));
}

module.exports = { showListenCard, checkListenAnswer };
