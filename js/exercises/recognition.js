// ============================================================================
// RECOGNITION: the word is shown, Show Answer reveals its meaning, every rating is free
// ============================================================================

const { createSpeakAction, createWordCard, createButtonGroup } = require('../ui-components.js');
const { scheduleAutoPlay, currentWordPrompt, showExerciseScreen, showAnswer } = require('./exercise-screen.js');

function showRecognitionCard() {
    const word = window.SV.AppState.currentLearningWord;
    showExerciseScreen({
        task: 'Do you know this word?',
        cardHtml: createWordCard(word, 'learning', [createSpeakAction(word.original)]),
        controlsHtml: `
            ${createButtonGroup([{ text: 'Show Answer', action: 'show-translation', type: 'primary', id: 'showAnswerButton' }])}
            <div id="cardTranslation"></div>
        `
    });

    const speechSettings = window.SV?.SpeechManager?.speechSettings;
    if (speechSettings?.enabled && speechSettings?.autoPlay) {
        scheduleAutoPlay();
    }
}

function showTranslation() {
    // The answer takes the place of the button
    document.getElementById('showAnswerButton')?.closest('.btn-group').remove();

    const { label, main, detail } = currentWordPrompt();
    showAnswer(document.getElementById('cardTranslation'), {
        label,
        value: main,
        showDefinition: Boolean(detail)
    });
}

module.exports = { showRecognitionCard, showTranslation };
