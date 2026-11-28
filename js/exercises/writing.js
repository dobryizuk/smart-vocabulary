// ============================================================================
// WRITING: the word is typed from its translation (the typed answer is in typed-answer.js)
// ============================================================================

const { currentWordPrompt, renderExerciseCard, revealCorrectAnswer } = require('./exercise-screen.js');
const { answerKind, showTypedAnswerScreen, checkTypedAnswer } = require('./typed-answer.js');

function showReverseTranslationCard() {
    const { main, detail } = currentWordPrompt();
    showTypedAnswerScreen({
        task: 'Write it in English',
        cardHtml: renderExerciseCard({
            chip: answerKind(window.SV.AppState.currentLearningWord.original),
            title: main,
            definition: detail
        }),
        checkAction: 'check-reverse'
    });
}

// The card already shows the meaning, so the answer is the word alone
function checkReverseTranslation() {
    checkTypedAnswer(revealCorrectAnswer);
}

module.exports = { showReverseTranslationCard, checkReverseTranslation };
