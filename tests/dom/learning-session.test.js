import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemoryStorage } from './test-helpers.js';

// Mock DOM environment
beforeEach(() => {
  global.window = global;
  global.DataManager = {
    vocabulary: []
  };

  // Mock DOM elements
  document.body.innerHTML = '<div id="learningContent"></div>';
});

// Load AppState first to ensure SV.AppState is defined
require('../../js/app-state.js');
window.SV = window.SV || {};
window.SV.AppState = window.SV.AppState || (globalThis.SV && globalThis.SV.AppState) || {};
// Load UI components as module and attach to SV for tests
const UI = require('../../js/ui-components.js');
window.SV = window.SV || {};
window.SV.UIComponents = UI.UIComponents || UI;
// Load learning session code via CommonJS exports
const LS = require('../../js/learning-session.js');
const { createVocabularyStore, WORD_FIELDS } = require('../../js/vocabulary-store.js');
const Screen = require('../../js/exercises/exercise-screen.js');
const Recognition = require('../../js/exercises/recognition.js');
const Build = require('../../js/exercises/build.js');
const Writing = require('../../js/exercises/writing.js');
const Listen = require('../../js/exercises/listen.js');
const TypedAnswer = require('../../js/exercises/typed-answer.js');
const WordBuilder = require('../../js/word-builder.js');

const ratingButtons = () => [...document.querySelectorAll('.difficulty-btn')];
const enabledRatings = () => ratingButtons().filter((button) => !button.disabled).map((button) => button.dataset.difficulty);

// Sound on and a stored natural voice clip for every word, so the listening stage is open
function stubListening({ soundOn = true, hasClip = () => true } = {}) {
  window.SV.SpeechManager = { speechSettings: { enabled: soundOn, autoPlay: false }, speakWord: vi.fn() };
  window.SV.NaturalVoice = { hasClip };
}

function removeListeningStubs() {
  delete window.SV.SpeechManager;
  delete window.SV.NaturalVoice;
}

describe('Exercise stage of a word', () => {
  const stageAfter = (...reviews) => LS.determineExerciseType({ original: 'apple', reviewHistory: reviews });

  beforeEach(() => stubListening());
  afterEach(removeListeningStubs);

  it('starts every word with recognition', () => {
    expect(LS.determineExerciseType({ repetition: 0 })).toBe('regular');
    expect(stageAfter()).toBe('regular');
  });

  it('moves forward after OK or Easy', () => {
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'regular' })).toBe('build');
    expect(stageAfter({ difficulty: 'perfect', exerciseType: 'regular' })).toBe('build');
    expect(stageAfter({ difficulty: 'perfect', exerciseType: 'build' })).toBe('listen');
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'build' })).toBe('listen');
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'listen' })).toBe('reverse');
    expect(stageAfter({ difficulty: 'perfect', exerciseType: 'listen' })).toBe('reverse');
  });

  it('stays on writing after OK or Easy in writing', () => {
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'reverse' })).toBe('reverse');
    expect(stageAfter({ difficulty: 'perfect', exerciseType: 'reverse' })).toBe('reverse');
  });

  it('moves back one stage after Hard, but not below recognition', () => {
    expect(stageAfter({ difficulty: 'hard', exerciseType: 'reverse' })).toBe('listen');
    expect(stageAfter({ difficulty: 'hard', exerciseType: 'listen' })).toBe('build');
    expect(stageAfter({ difficulty: 'hard', exerciseType: 'build' })).toBe('regular');
    expect(stageAfter({ difficulty: 'hard', exerciseType: 'regular' })).toBe('regular');
  });

  it('keeps the stage after Medium', () => {
    expect(stageAfter({ difficulty: 'medium', exerciseType: 'regular' })).toBe('regular');
    expect(stageAfter({ difficulty: 'medium', exerciseType: 'build' })).toBe('build');
    expect(stageAfter({ difficulty: 'medium', exerciseType: 'listen' })).toBe('listen');
    expect(stageAfter({ difficulty: 'medium', exerciseType: 'reverse' })).toBe('reverse');
  });

  it('looks only at the last review', () => {
    expect(stageAfter(
      { difficulty: 'hard', exerciseType: 'regular' },
      { difficulty: 'easy', exerciseType: 'regular' }
    )).toBe('build');
    expect(stageAfter(
      { difficulty: 'easy', exerciseType: 'build' },
      { difficulty: 'hard', exerciseType: 'listen' }
    )).toBe('build');
  });

  it('treats legacy reviews without exerciseType as recognition', () => {
    expect(stageAfter({ difficulty: 'easy' })).toBe('build');
    expect(stageAfter({ difficulty: 'hard' })).toBe('regular');
  });

  it('continues from where a legacy history ended', () => {
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'regular' }, { difficulty: 'easy', exerciseType: 'reverse' })).toBe('reverse');
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'reverse' }, { difficulty: 'easy', exerciseType: 'regular' })).toBe('build');
  });

  it('reads an unknown exercise type as recognition, as a client older than listening reads listen', () => {
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'dictation' })).toBe('build');
    expect(stageAfter({ difficulty: 'hard', exerciseType: 'dictation' })).toBe('regular');
    expect(stageAfter({ difficulty: 'medium', exerciseType: 'dictation' })).toBe('regular');
  });
});

describe('Listening falls back without a clip', () => {
  const afterBuild = [{ difficulty: 'easy', exerciseType: 'build' }];
  const afterWriting = [{ difficulty: 'hard', exerciseType: 'reverse' }];
  const stageOf = (reviewHistory) => LS.determineExerciseType({ original: 'apple', reviewHistory });

  afterEach(removeListeningStubs);

  it('gives listening when sound is on and the word has a clip', () => {
    const hasClip = vi.fn(() => true);
    stubListening({ hasClip });
    expect(stageOf(afterBuild)).toBe('listen');
    expect(stageOf(afterWriting)).toBe('listen');
    expect(hasClip).toHaveBeenCalledWith('apple');
  });

  it('without a clip skips listening the way the word moves: up to writing, down to build', () => {
    stubListening({ hasClip: (text) => text !== 'apple' });
    expect(stageOf(afterBuild)).toBe('reverse');
    expect(stageOf(afterWriting)).toBe('build');
    expect(stageOf([{ difficulty: 'medium', exerciseType: 'listen' }])).toBe('reverse');
  });

  it('gives writing when sound is off in the settings, without asking for the clip', () => {
    const hasClip = vi.fn(() => true);
    stubListening({ soundOn: false, hasClip });
    expect(stageOf(afterBuild)).toBe('reverse');
    expect(hasClip).not.toHaveBeenCalled();
  });

  it('gives writing when there is no natural voice', () => {
    stubListening();
    delete window.SV.NaturalVoice;
    expect(stageOf(afterBuild)).toBe('reverse');
  });

  it('gives writing when there is no speech manager', () => {
    stubListening();
    delete window.SV.SpeechManager;
    expect(stageOf(afterBuild)).toBe('reverse');
  });

  it('leaves the other stages alone without a clip', () => {
    stubListening({ hasClip: () => false });
    expect(stageOf([])).toBe('regular');
    expect(stageOf([{ difficulty: 'easy', exerciseType: 'regular' }])).toBe('build');
    expect(stageOf([{ difficulty: 'hard', exerciseType: 'listen' }])).toBe('build');
  });
});

describe('Learning Answer Screen Layout', () => {
  function setupWord() {
    return {
      id: 'w1',
      original: 'apple',
      translation: 'яблоко',
      definition: 'A round fruit with red or green skin.',
      examples: ['I eat an apple every day.', 'Apple pie is delicious.'],
      synonyms: ['pome', 'fruit'],
      repetition: 2,
      easeFactor: 2,
      createdAt: new Date().toISOString()
    };
  }

  function indexesInParent(parent, selectors) {
    const elements = selectors.map((sel) => parent.querySelector(sel));
    elements.forEach((el, i) => expect(el, `${selectors[i]} should exist`).toBeTruthy());
    const positions = elements.map((el) => Array.from(parent.children).indexOf(el));
    return positions;
  }

  it('renders correct order for direct translation after Show Answer', () => {
    const word = setupWord();
    // Force direct translation path (not eligible for reverse)
    word.repetition = 0;
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];

    // Render learning card then show answer
    LS.showLearningCard();
    Recognition.showTranslation();

    const root = document.getElementById('cardTranslation');
    const order = indexesInParent(root, [
      '.card-translation',
      '.detail-block--definition',
      '.detail-block--examples',
      '.detail-block--synonyms',
      '.difficulty-buttons'
    ]);
    // Ensure strictly increasing order
    expect(order).toEqual([...order].sort((a, b) => a - b));

    // Progress should exist and its container should be first in learningContent
    const progressContainer = document.getElementById('sessionProgressContainer');
    expect(progressContainer.querySelector('[data-testid="session-progress"]')).toBeTruthy();
    const learningContent = document.getElementById('learningContent');
    expect(learningContent.firstElementChild.id).toBe('sessionProgressContainer');
    expect(learningContent.querySelectorAll('#sessionProgressContainer')).toHaveLength(1);
  });

  it('removes Show Answer with its button group when the answer is shown', () => {
    const word = setupWord();
    word.repetition = 0;
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    LS.showLearningCard();
    expect(document.querySelector('#learningMain .btn-group #showAnswerButton')).toBeTruthy();

    Recognition.showTranslation();

    expect(document.getElementById('showAnswerButton')).toBeNull();
    expect(document.querySelector('#learningMain .btn-group')).toBeNull();
    expect(document.querySelector('#cardTranslation .card-translation')).toBeTruthy();
  });

  it('speaks the word with the card speaker button after Show Answer', () => {
    const word = setupWord();
    word.repetition = 0;
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    window.SV.SpeechManager = { speechSettings: { enabled: true, autoPlay: false }, speakWord: vi.fn() };
    try {
      LS.showLearningCard();
      Recognition.showTranslation();

      const cardSpeaker = document.querySelector('#learningMain .word-card [data-action="speak-word"]');
      expect(cardSpeaker).toBeTruthy();
      expect(window.SV.SpeechManager.speakWord).toHaveBeenCalledWith('apple', cardSpeaker);
    } finally {
      delete window.SV.SpeechManager;
    }
  });

  it('leaves every rating free in recognition', () => {
    const word = setupWord();
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];

    LS.showLearningCard();
    Recognition.showTranslation();

    expect(ratingButtons().map((button) => button.textContent)).toEqual(['Hard', 'Medium', 'OK', 'Easy']);
    expect(enabledRatings()).toEqual(['hard', 'medium', 'easy', 'perfect']);
  });

  it('renders correct order for reverse translation after an empty Check', () => {
    const word = setupWord();
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];

    // Render reverse exercise and then show answer
    Writing.showReverseTranslationCard();
    Writing.checkReverseTranslation();

    const mainEl = document.getElementById('learningMain') || document.getElementById('learningContent');
    const firstSpecific = mainEl.querySelector('.card-translation');
    const buttons = mainEl.querySelector('.difficulty-buttons');
    const ex = mainEl.querySelector('.detail-block--examples');
    const syn = mainEl.querySelector('.detail-block--synonyms');

    expect(firstSpecific && buttons && ex && syn).toBeTruthy();
    const children = Array.from(mainEl.children);
    const idx = (el) => children.indexOf(el);
    const indices = [idx(firstSpecific), idx(ex), idx(syn), idx(buttons)];
    expect(indices).toEqual([...indices].sort((a, b) => a - b));

    // The definition is already on the exercise card, so the answer does not repeat it
    expect(mainEl.querySelector('.detail-block--definition')).toBeNull();
    expect(mainEl.querySelectorAll('.exercise-card__definition')).toHaveLength(1);

    const progressContainer = document.getElementById('sessionProgressContainer');
    expect(progressContainer.querySelector('[data-testid="session-progress"]')).toBeTruthy();
    const learningContent = document.getElementById('learningContent');
    expect(learningContent.firstElementChild.id).toBe('sessionProgressContainer');
    expect(learningContent.querySelectorAll('#sessionProgressContainer')).toHaveLength(1);
  });
});

describe('Session progress', () => {
  const words = ['a', 'b', 'c'].map((original) => ({
    id: original, original, translation: 't', repetition: 0, easeFactor: 2, reviewHistory: []
  }));

  const progressText = () => document.querySelector('[data-testid="session-progress"]').textContent.trim();
  const progressWidth = () => document.querySelector('.session-progress__fill').style.width;

  beforeEach(() => {
    document.body.innerHTML = '<div id="learningContent"></div>';
    window.SV.AppState.sessionStats = { correct: 0, total: 0, streak: 0, bestStreak: 0 };
    window.SV.DataManager = { vocabulary: words.map((w) => ({ ...w })), save: vi.fn() };
  });

  it('counts the current card against the whole session', () => {
    LS.forceStartLearning();
    expect(progressText()).toBe('1 / 3');
    expect(progressWidth()).toBe('33%');

    LS.markDifficulty('easy');
    expect(progressText()).toBe('2 / 3');
    expect(progressWidth()).toBe('67%');

    LS.markDifficulty('medium');
    expect(progressText()).toBe('3 / 3');
    expect(progressWidth()).toBe('100%');
  });

  it('ends with the best streak of the session, not the streak a later miss reset', () => {
    LS.forceStartLearning();
    LS.markDifficulty('easy');
    LS.markDifficulty('perfect');
    LS.markDifficulty('medium');

    const summary = document.getElementById('learningContent').textContent;
    expect(summary).toContain('Session Complete');
    expect(summary).toContain('Accuracy: 67%');
    expect(summary).toContain('Best streak: 2');
  });

  it('counts the best streak from zero when no answer passed', () => {
    LS.forceStartLearning();
    ['medium', 'medium', 'medium'].forEach((rating) => LS.markDifficulty(rating));

    expect(document.getElementById('learningContent').textContent).toContain('Best streak: 0');
  });
});

describe('Repeat of a word rated Hard (C35)', () => {
  const makeWord = (id, original, reviewHistory = []) => ({
    id, original, translation: `t-${original}`, repetition: 1, easeFactor: 2.5,
    nextReview: null, reviewHistory, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
  });
  const atStage = (exerciseType) => [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType }];

  const state = () => window.SV.AppState;
  const current = () => state().currentLearningWord;
  const content = () => document.getElementById('learningContent').textContent;
  const progressText = () => document.querySelector('[data-testid="session-progress"]').textContent.trim();
  const taskText = () => document.querySelector('.learning-prompt').textContent;
  const nextButton = () => document.querySelector('[data-testid="next-card-btn"]');

  const startWith = (...words) => {
    window.SV.DataManager = { vocabulary: words, save: vi.fn() };
    LS.forceStartLearning();
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="learningContent"></div>';
    window.SV.SpacedRepetition = require('../../js/spaced-repetition.js');
    window.SV.Today = { showSession: vi.fn(), showOverview: vi.fn() };
    stubListening();
    LS.stopLearningSession();
  });

  afterEach(removeListeningStubs);

  it('queues the word once more at the end and counts it in the progress', () => {
    startWith(makeWord('a', 'apple'), makeWord('b', 'bread'));
    const [first, second] = state().learningSession;

    LS.markDifficulty('hard');

    expect(state().learningSession).toEqual([second, first]);
    expect(state().sessionTotal).toBe(3);
    expect(progressText()).toBe('2 / 3');
  });

  it.each(['medium', 'easy', 'perfect'])('does not repeat a word rated %s', (rating) => {
    startWith(makeWord('a', 'apple'), makeWord('b', 'bread'));

    LS.markDifficulty(rating);

    expect(state().learningSession).toHaveLength(1);
    expect(state().sessionTotal).toBe(2);
  });

  it.each([
    ['build', 'regular', 'regular', 'Do you know this word?'],
    ['listen', 'build', 'build', 'Build the word'],
    ['reverse', 'listen', 'listen', 'Write what you hear']
  ])('shows the repeat of a %s card one stage easier, as %s', (stageBefore, repeatStage, previousStage, task) => {
    startWith(makeWord('a', 'apple', atStage(previousStage)));
    expect(current().currentExerciseType).toBe(stageBefore);

    LS.markDifficulty('hard');

    expect(current().currentExerciseType).toBe(repeatStage);
    expect(taskText()).toBe(`One more time: ${task}`);
  });

  it('records Hard on listening and answers its build repeat with Next', () => {
    startWith(makeWord('a', 'ab', atStage('build')));
    Listen.checkListenAnswer();
    expect(enabledRatings()).toEqual(['hard']);

    LS.markDifficulty('hard');

    expect(current().reviewHistory.at(-1)).toMatchObject({ difficulty: 'hard', exerciseType: 'listen' });
    expect(document.querySelector('.build-slots')).toBeTruthy();
    Build.placeBuildLetter('a');
    Build.placeBuildLetter('b');
    Build.checkBuildAnswer();
    expect(ratingButtons()).toHaveLength(0);
    expect(nextButton()).toBeTruthy();
  });

  it('builds the repeat of a writing card when the word has no clip', () => {
    stubListening({ hasClip: () => false });
    startWith(makeWord('a', 'apple', atStage('listen')));
    expect(current().currentExerciseType).toBe('reverse');

    LS.markDifficulty('hard');

    expect(current().currentExerciseType).toBe('build');
    expect(taskText()).toBe('One more time: Build the word');
  });

  it('answers the repeat with Next instead of the rating buttons', () => {
    startWith(makeWord('a', 'apple'));
    Recognition.showTranslation();
    expect(ratingButtons()).toHaveLength(4);
    expect(nextButton()).toBeNull();

    LS.markDifficulty('hard');
    Recognition.showTranslation();

    expect(ratingButtons()).toHaveLength(0);
    expect(nextButton().textContent).toBe('Next');
    expect(nextButton().dataset.action).toBe('next-card');
  });

  it('leaves SM-2, the review history, updatedAt, the stats and storage untouched by the repeat', () => {
    startWith(makeWord('a', 'apple'));
    LS.markDifficulty('hard');
    const word = current();
    const wordAfterHard = JSON.parse(JSON.stringify(word));

    Recognition.showTranslation();
    LS.showNextCard();

    expect(word).toEqual(wordAfterHard);
    expect(content()).toContain('You reviewed 1 words');
    expect(content()).toContain('Accuracy: 0%');
    expect(content()).toContain('Best streak: 0');
    expect(window.SV.DataManager.save).toHaveBeenCalledTimes(1);
  });

  it('does not queue a repeat that goes badly again', () => {
    startWith(makeWord('a', 'ab', atStage('build')));
    LS.markDifficulty('hard');
    expect(current().currentExerciseType).toBe('build');

    Build.placeBuildLetter('b');
    Build.placeBuildLetter('a');
    Build.checkBuildAnswer();
    expect(document.querySelector('.build-feedback--wrong')).toBeTruthy();
    expect(ratingButtons()).toHaveLength(0);
    expect(state().learningSession).toHaveLength(1);

    expect(nextButton()).toBeTruthy();
    LS.showNextCard();

    expect(content()).toContain('Session Complete');
    expect(state().learningSession).toEqual([]);
  });

  it('runs a session to its end through the repeat, which counts as no extra word', () => {
    startWith(makeWord('a', 'apple'), makeWord('b', 'bread'));
    const first = current();
    expect(progressText()).toBe('1 / 2');

    LS.markDifficulty('hard');
    LS.markDifficulty('easy');
    expect(current()).toBe(first);
    expect(progressText()).toBe('3 / 3');

    LS.showNextCard();

    expect(content()).toContain('You reviewed 2 words');
    expect(content()).toContain('Accuracy: 50%');
  });

  it('keeps the repeat mark out of the word and the saved vocabulary', () => {
    const storage = createMemoryStorage();
    const store = createVocabularyStore({ storage, now: () => new Date('2026-11-28T10:00:00Z') });
    const word = makeWord('a', 'apple');
    window.SV.DataManager = { vocabulary: [word], save: () => store.save([word]) };
    LS.forceStartLearning();
    const keysOnCard = Object.keys(word);

    LS.markDifficulty('hard');
    const savedAfterHard = storage.data.vocabulary;
    LS.showNextCard();

    expect(Object.keys(word)).toEqual(keysOnCard);
    expect(storage.data.vocabulary).toBe(savedAfterHard);
    expect(WORD_FIELDS).toEqual(expect.arrayContaining(Object.keys(JSON.parse(savedAfterHard).words[0])));
  });

  it('forgets the queued repeat when the session stops, so the next session rates the word', () => {
    startWith(makeWord('a', 'apple'));
    LS.markDifficulty('hard');

    LS.stopLearningSession();
    expect(state().repeatedWords.size).toBe(0);

    LS.forceStartLearning();
    Recognition.showTranslation();
    expect(ratingButtons()).toHaveLength(4);
    expect(taskText()).toBe('Do you know this word?');
  });
});

describe('Writing exercise hint', () => {
  const startExercise = (original) => {
    const word = { id: 'h1', original, translation: 'перевод', repetition: 2, easeFactor: 2.5, reviewHistory: [] };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    Writing.showReverseTranslationCard();
  };
  const hint = () => document.getElementById('reverseTranslationInput').value;
  const hintBtn = () => document.getElementById('hintReverseButton');

  it('reveals one more letter per press, up to three', () => {
    startExercise('Devolve');
    expect(hint()).toBe('');
    expect(hintBtn().textContent).toBe('Hint');
    expect(hintBtn().className).toBe('btn btn--secondary');

    TypedAnswer.showAnswerHint();
    expect(hint()).toBe('D');
    expect(hintBtn().textContent).toBe('Hint (2 left)');

    TypedAnswer.showAnswerHint();
    expect(hint()).toBe('De');

    TypedAnswer.showAnswerHint();
    expect(hint()).toBe('Dev');
    expect(hintBtn().disabled).toBe(true);

    TypedAnswer.showAnswerHint();
    expect(hint()).toBe('Dev');
  });

  it('replaces what was typed and puts the caret at the end', () => {
    startExercise('Devolve');
    const input = document.getElementById('reverseTranslationInput');
    input.value = 'xyz';
    TypedAnswer.showAnswerHint();

    expect(input.value).toBe('D');
    expect(input.selectionStart).toBe(1);
    expect(document.activeElement).toBe(input);
    expect(document.getElementById('reverseHint')).toBeNull();
  });

  it('starts from zero hints for the next word', () => {
    startExercise('Devolve');
    TypedAnswer.showAnswerHint();
    startExercise('Forthright');

    expect(hint()).toBe('');
    TypedAnswer.showAnswerHint();
    expect(hint()).toBe('F');
  });

  it('never reveals the whole answer of a short word', () => {
    startExercise('go');
    TypedAnswer.showAnswerHint();
    TypedAnswer.showAnswerHint();

    expect(hint()).toBe('g');
    expect(hintBtn().disabled).toBe(true);
  });

  it('disables the hint for a one-letter answer', () => {
    startExercise('I');
    expect(hintBtn().disabled).toBe(true);
    TypedAnswer.showAnswerHint();
    expect(hint()).toBe('');
  });

  it('leaves no hint behind once the answer is shown', () => {
    startExercise('Devolve');
    TypedAnswer.showAnswerHint();
    Writing.checkReverseTranslation();
    expect(document.getElementById('reverseActions').style.display).toBe('none');
    expect(document.getElementById('reverseHint')).toBeNull();
  });

  it('counts letters, not spaces, in phrases', () => {
    expect(TypedAnswer.getHintPrefix('a lot', 2)).toBe('a l');
    expect(TypedAnswer.getHintPrefix('  break the ice'.trim(), 3)).toBe('bre');
    expect(TypedAnswer.getMaxHints('a lot')).toBe(3);
    expect(TypedAnswer.getMaxHints('ox')).toBe(1);
    expect(TypedAnswer.getMaxHints('')).toBe(0);
  });
});

describe('Writing exercise verdict', () => {
  it('is exact only for an equal answer, ignoring case, punctuation and extra spaces', () => {
    expect(TypedAnswer.getTypingVerdict('hello', 'hello')).toBe('exact');
    expect(TypedAnswer.getTypingVerdict('  Hello! ', 'hello')).toBe('exact');
    expect(TypedAnswer.getTypingVerdict('break  the ice', 'Break the ice.')).toBe('exact');
  });

  it('allows no typo in answers shorter than 4 characters', () => {
    expect(TypedAnswer.getTypingVerdict('cut', 'cat')).toBe('wrong');
    expect(TypedAnswer.getTypingVerdict('ca', 'cat')).toBe('wrong');
    expect(TypedAnswer.getTypingVerdict('teh', 'the')).toBe('wrong');
  });

  it('counts two swapped neighbouring letters as one typo', () => {
    expect(TypedAnswer.getTypingVerdict('decisoin', 'decision')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('hlelo', 'hello')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('dceisoin', 'decision')).toBe('wrong');
    expect(TypedAnswer.getTypingVerdict('rseponsibilitise', 'responsibilities')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('rseponsibiltiise', 'responsibilities')).toBe('wrong');
  });

  it('does not count letters swapped across a gap as one typo', () => {
    expect(TypedAnswer.getTypingVerdict('dicesion', 'decision')).toBe('wrong');
  });

  it('allows one edit from 4 to 15 characters', () => {
    expect(TypedAnswer.getTypingVerdict('bost', 'boat')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('bat', 'boat')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('bist', 'boat')).toBe('wrong');
    expect('personification').toHaveLength(15);
    expect(TypedAnswer.getTypingVerdict('personificatian', 'personification')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('persanificatian', 'personification')).toBe('wrong');
  });

  it('counts one wrong, missing or extra letter in decision as a typo', () => {
    expect(TypedAnswer.getTypingVerdict('decison', 'decision')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('decisiom', 'decision')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('decission', 'decision')).toBe('close');
  });

  it('allows two edits from 16 characters', () => {
    expect('responsibilities').toHaveLength(16);
    expect(TypedAnswer.getTypingVerdict('responsibilitias', 'responsibilities')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('respansibilitias', 'responsibilities')).toBe('close');
    expect(TypedAnswer.getTypingVerdict('respansibilitiaz', 'responsibilities')).toBe('wrong');
  });

  it('measures the length of the correct answer after normalisation', () => {
    expect(TypedAnswer.getTypingVerdict('cats', 'Cat!')).toBe('wrong');
    expect(TypedAnswer.getTypingVerdict('a lott', 'a lot')).toBe('close');
  });

  it('calls a long near miss close, not exact', () => {
    const answer = 'a'.repeat(300);
    expect(TypedAnswer.getTypingVerdict(`${answer}b`, answer)).toBe('close');
  });

  it('fails an unrelated answer', () => {
    expect(TypedAnswer.getTypingVerdict('xyz', 'hello')).toBe('wrong');
    expect(TypedAnswer.getTypingVerdict('world', 'hello')).toBe('wrong');
  });
});

describe('Strongest rating a checked answer allows', () => {
  it('allows every rating for an exact writing answer without hints', () => {
    expect(Screen.getMaxRating('exact', 0)).toBe('perfect');
  });

  it('allows up to Medium for an exact writing answer after a hint', () => {
    expect(Screen.getMaxRating('exact', 1)).toBe('medium');
    expect(Screen.getMaxRating('exact', 3)).toBe('medium');
  });

  it('allows up to Medium for a typo, with or without hints', () => {
    expect(Screen.getMaxRating('close', 0)).toBe('medium');
    expect(Screen.getMaxRating('close', 2)).toBe('medium');
  });

  it('allows only Hard for a wrong answer or a give-up, whatever the hints', () => {
    expect(Screen.getMaxRating('wrong', 0)).toBe('hard');
    expect(Screen.getMaxRating('wrong', 3)).toBe('hard');
  });

  it('allows every rating for right tiles and only Hard for wrong ones', () => {
    expect(Screen.getMaxRating('exact')).toBe('perfect');
    expect(Screen.getMaxRating('wrong')).toBe('hard');
  });
});

describe('Rating cap of a built word', () => {
  // Letters to place in order; 'undo' takes the last one back
  const checked = (original, steps) => {
    const built = steps.reduce((state, step) => (step === 'undo' ? WordBuilder.undoLetter(state) : WordBuilder.placeLetter(state, step)),
      WordBuilder.createBuildState(original));
    return WordBuilder.checkBuild(built, original);
  };
  const capOf = (original, steps) => Screen.getMaxRating(Build.getBuildVerdict(checked(original, steps)));
  const LONG = 'responsibilities';

  it('allows every rating without mistakes', () => {
    expect(capOf('hello', [...'hello'])).toBe('perfect');
    expect(capOf(LONG, [...LONG])).toBe('perfect');
  });

  it('allows up to Medium for undone mistakes within the typo tolerance: one from 4 letters, two from 16', () => {
    expect(capOf('hello', ['o', 'undo', ...'hello'])).toBe('medium');
    expect(capOf(LONG, ['e', 'undo', 's', 'undo', ...LONG])).toBe('medium');
  });

  it('allows only Hard beyond the tolerance', () => {
    expect(capOf('hello', ['o', 'undo', 'e', 'undo', ...'hello'])).toBe('hard');
    expect(capOf(LONG, ['e', 'undo', 's', 'undo', 'p', 'undo', ...LONG])).toBe('hard');
  });

  it('has no tolerance under 4 letters', () => {
    expect(capOf('cat', [...'cat'])).toBe('perfect');
    expect(capOf('cat', ['t', 'undo', ...'cat'])).toBe('hard');
  });

  it('counts letters, not spaces or hyphens, toward the tolerance', () => {
    expect(capOf('a-b c', ['b', 'undo', ...'abc'])).toBe('hard');
  });

  it('allows only Hard for a wrong final word', () => {
    expect(capOf('hello', [...'olleh'])).toBe('hard');
  });

  it('caps the rating buttons after a wrong tile that was fixed', () => {
    const word = {
      original: 'hello', translation: 't', repetition: 2, easeFactor: 2.5,
      reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }]
    };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    LS.showLearningCard();

    Build.placeBuildLetter('o');
    Build.undoBuildLetter();
    [...'hello'].forEach(Build.placeBuildLetter);
    Build.checkBuildAnswer();

    expect(document.querySelector('.build-feedback--correct').textContent).toBe(Screen.VERDICT_FEEDBACK.exact.text);
    expect(enabledRatings()).toEqual(['hard', 'medium']);
  });
});

describe('Transcription in the revealed answer', () => {
  const phoneticsIn = (selector) => [...document.querySelectorAll(`${selector} .word-card__phonetic`)].map((el) => el.textContent);
  const show = (fields) => {
    const word = { id: 'w1', original: 'hello', translation: 'привет', repetition: 2, easeFactor: 2.5, reviewHistory: [], ...fields };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
  };

  it('shows the transcription under the answer text, escaped, and nothing without one', () => {
    const block = UI.createPrimaryAnswerBlock('Correct answer', 'hello', [], '<i>/həˈləʊ/</i>');
    document.body.innerHTML = block;
    expect(phoneticsIn('.card-translation .detail-block__body')).toEqual(['<i>/həˈləʊ/</i>']);
    expect(document.querySelector('.card-translation i')).toBeNull();

    document.body.innerHTML = UI.createPrimaryAnswerBlock('Correct answer', 'hello');
    expect(document.querySelector('.word-card__phonetic')).toBeNull();
  });

  it('shows it in the correct answer of build and writing', () => {
    show({ phonetic: '/həˈləʊ/' });
    Build.showBuildCard();
    Screen.revealCorrectAnswer('hard');
    expect(phoneticsIn('.card-translation')).toEqual(['/həˈləʊ/']);

    Writing.showReverseTranslationCard();
    Writing.checkReverseTranslation();
    expect(phoneticsIn('.card-translation')).toEqual(['/həˈləʊ/']);
  });

  it('shows nothing for a word without a transcription', () => {
    show({ phonetic: '' });
    Writing.showReverseTranslationCard();
    Writing.checkReverseTranslation();
    expect(document.querySelector('.card-translation')).toBeTruthy();
    expect(document.querySelector('#learningMain .word-card__phonetic')).toBeNull();
  });

  it('shows it once in recognition: on the card, not again in the answer', () => {
    show({ phonetic: '/həˈləʊ/', reviewHistory: [] });
    Recognition.showRecognitionCard();
    Recognition.showTranslation();
    expect(phoneticsIn('#learningMain')).toEqual(['/həˈləʊ/']);
    expect(phoneticsIn('.card-translation')).toEqual([]);
  });
});

describe('Writing exercise check', () => {
  const start = (original) => {
    const word = { id: 'w1', original, translation: 'перевод', repetition: 2, easeFactor: 2.5, reviewHistory: [] };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    window.SV.AppState.sessionTotal = 1;
    document.body.innerHTML = '<div id="learningContent"></div>';
    Writing.showReverseTranslationCard();
  };
  const input = () => document.getElementById('reverseTranslationInput');
  const feedback = () => document.getElementById('typingFeedback');
  const diff = () => document.getElementById('typingDiff');
  const answerShown = () => document.querySelector('.difficulty-buttons') !== null;

  it('shows a word with markup in the correct answer as text, not as HTML', () => {
    start('<b>x</b>');
    Writing.checkReverseTranslation();

    const answer = document.querySelector('.card-translation .detail-text');
    expect(answer.textContent).toBe('<b>x</b>');
    expect(answer.querySelector('b')).toBeNull();
  });

  it('renders only Hint and Check side by side, with no inline handlers', () => {
    start('hello');
    const actions = document.getElementById('reverseActions');
    expect([...actions.children].map((button) => button.textContent)).toEqual(['Hint', 'Check']);
    expect(document.getElementById('checkReverseButton').dataset.action).toBe('check-reverse');
    expect(document.querySelector('#learningContent [onclick], #learningContent [oninput], #learningContent [onkeypress]')).toBeNull();
    expect(input().dataset.enterButton).toBe('checkReverseButton');
  });

  it('tints the field for a right answer and tells screen readers, without a visible verdict', () => {
    start('hello');
    input().value = 'Hello';
    Writing.checkReverseTranslation();

    expect(input().classList.contains('typing-input--success')).toBe(true);
    expect(feedback().textContent).toBe('Correct!');
    expect(feedback().className).toBe('sr-only');
    expect(feedback().getAttribute('aria-live')).toBe('polite');
    expect(diff().innerHTML).toBe('');
    expect(input().disabled).toBe(true);
    expect(answerShown()).toBe(true);
    expect(document.getElementById('reverseActions').style.display).toBe('none');
  });

  it('tints the field warn for a near miss and marks the difference', () => {
    start('abcdefghij');
    input().value = 'abcdefghi';
    Writing.checkReverseTranslation();

    expect(feedback().textContent).toBe('Almost \u2014 check the spelling');
    expect(input().classList.contains('typing-input--warn')).toBe(true);
    expect(diff().innerHTML).toBe('abcdefghi<ins class="typing-diff__missing">j</ins>');
  });

  it('tints the field danger for a wrong answer, marks it and still reveals the answer', () => {
    start('hello');
    input().value = 'world';
    Writing.checkReverseTranslation();

    expect(feedback().textContent).toBe('Not quite');
    expect(input().classList.contains('typing-input--danger')).toBe(true);
    expect(diff().querySelector('.typing-diff__wrong')).not.toBeNull();
    expect(answerShown()).toBe(true);
  });

  it('shows the typed answer with struck wrong letters and the missing ones inserted', () => {
    start('inconceivable');
    input().value = 'inconcievable';
    Writing.checkReverseTranslation();

    expect(diff().innerHTML).toBe('inconc<del class="typing-diff__wrong">ie</del><ins class="typing-diff__missing">ei</ins>vable');
  });

  it('escapes what was typed in the difference', () => {
    start('hello');
    input().value = '<b>';
    Writing.checkReverseTranslation();

    expect(diff().querySelector('b')).toBeNull();
    expect(diff().textContent).toContain('<b>');
  });

  it('gives the correct answer a speaker button', () => {
    start('hello');
    input().value = 'hello';
    Writing.checkReverseTranslation();

    const speak = document.querySelector('.card-translation [data-action="speak-word"]');
    expect(speak.dataset.arg).toBe('hello');
  });

  it('speaks the answer with its speaker button, which shows the wait for a missing clip', () => {
    window.SV.SpeechManager = { speechSettings: { enabled: true, autoPlay: false }, speakWord: vi.fn() };
    try {
      start('hello');
      input().value = 'hello';
      Writing.checkReverseTranslation();

      const speak = document.querySelector('.card-translation [data-action="speak-word"]');
      expect(window.SV.SpeechManager.speakWord).toHaveBeenCalledWith('hello', speak);
    } finally {
      delete window.SV.SpeechManager;
    }
  });

  it('keeps Check enabled for an empty field', () => {
    start('hello');
    expect(document.getElementById('checkReverseButton').disabled).toBe(false);
  });

  it('allows only Hard after a wrong answer, keeping the other ratings visible but disabled', () => {
    start('hello');
    input().value = 'world';
    Writing.checkReverseTranslation();

    expect(ratingButtons()).toHaveLength(4);
    expect(enabledRatings()).toEqual(['hard']);
    expect(ratingButtons().filter((button) => button.hasAttribute('disabled'))).toHaveLength(3);
  });

  it('allows every rating after an exact answer without hints', () => {
    start('hello');
    input().value = 'Hello';
    Writing.checkReverseTranslation();

    expect(enabledRatings()).toEqual(['hard', 'medium', 'easy', 'perfect']);
  });

  it('allows up to Medium after a typo', () => {
    start('hello');
    input().value = 'helo';
    Writing.checkReverseTranslation();

    expect(input().classList.contains('typing-input--warn')).toBe(true);
    expect(enabledRatings()).toEqual(['hard', 'medium']);
  });

  it('allows up to Medium after an exact answer finished from a hint', () => {
    start('hello');
    TypedAnswer.showAnswerHint();
    input().value = 'hello';
    Writing.checkReverseTranslation();

    expect(input().classList.contains('typing-input--success')).toBe(true);
    expect(enabledRatings()).toEqual(['hard', 'medium']);
  });

  it('tints a 3-letter answer with one wrong letter as wrong and allows only Hard', () => {
    start('cat');
    input().value = 'cut';
    Writing.checkReverseTranslation();

    expect(input().classList.contains('typing-input--danger')).toBe(true);
    expect(feedback().textContent).toBe('Not quite');
    expect(enabledRatings()).toEqual(['hard']);
  });
});

describe('Answer difference', () => {
  const diff = (input, answer) => TypedAnswer.diffAnswer(input, answer);

  it('is one equal segment for an exact match, ignoring case and the ends', () => {
    expect(diff('hello', 'hello')).toEqual([{ type: 'equal', text: 'hello' }]);
    expect(diff('  Hello ', 'hello')).toEqual([{ type: 'equal', text: 'Hello' }]);
  });

  it('marks a substituted letter as wrong followed by the missing one', () => {
    expect(diff('hallo', 'hello')).toEqual([
      { type: 'equal', text: 'h' },
      { type: 'wrong', text: 'a' },
      { type: 'missing', text: 'e' },
      { type: 'equal', text: 'llo' }
    ]);
  });

  it('marks an inserted letter as extra', () => {
    expect(diff('helllo', 'hello')).toEqual([
      { type: 'equal', text: 'he' },
      { type: 'wrong', text: 'l' },
      { type: 'equal', text: 'llo' }
    ]);
  });

  it('marks a dropped letter as missing', () => {
    expect(diff('helo', 'hello')).toEqual([
      { type: 'equal', text: 'he' },
      { type: 'missing', text: 'l' },
      { type: 'equal', text: 'lo' }
    ]);
  });

  it('handles a transposition as one wrong run and one missing run', () => {
    expect(diff('inconcievable', 'inconceivable')).toEqual([
      { type: 'equal', text: 'inconc' },
      { type: 'wrong', text: 'ie' },
      { type: 'missing', text: 'ei' },
      { type: 'equal', text: 'vable' }
    ]);
  });

  it('aligns phrases with their spaces', () => {
    expect(diff('break teh ice', 'break the ice')).toEqual([
      { type: 'equal', text: 'break t' },
      { type: 'wrong', text: 'eh' },
      { type: 'missing', text: 'he' },
      { type: 'equal', text: ' ice' }
    ]);
    expect(diff('breakthe ice', 'break the ice')).toEqual([
      { type: 'equal', text: 'break' },
      { type: 'missing', text: ' ' },
      { type: 'equal', text: 'the ice' }
    ]);
  });

  it('reports the whole answer as missing for an empty input', () => {
    expect(diff('', 'hello')).toEqual([{ type: 'missing', text: 'hello' }]);
    expect(diff('   ', 'hello')).toEqual([{ type: 'missing', text: 'hello' }]);
  });

  it('reports everything typed as wrong against an empty answer', () => {
    expect(diff('abc', '')).toEqual([{ type: 'wrong', text: 'abc' }]);
  });
});

describe('Session batch selection', () => {
  const review = (original, nextReview) => ({ original, nextReview, createdAt: '2025-01-01T00:00:00Z' });
  const fresh = (original, createdAt) => ({ original, nextReview: null, createdAt });
  const day = (n) => `2026-01-${String(n).padStart(2, '0')}T00:00:00Z`;
  const reviews = (count) => Array.from({ length: count }, (_, i) => review(`r${i + 1}`, day(i + 1)));
  const freshWords = (count) => Array.from({ length: count }, (_, i) => fresh(`n${i + 1}`, day(i + 1)));
  const names = (words) => words.map(w => w.original).sort();
  const newOnes = (batch) => batch.filter(w => !w.nextReview);

  it('gives a third of the slots (rounded up) to new words when the backlog is bigger than the session', () => {
    const words = [...reviews(30), ...freshWords(30)];
    expect(newOnes(LS.selectSessionBatch(words, 15))).toHaveLength(5);
    expect(newOnes(LS.selectSessionBatch(words, 10))).toHaveLength(4);
    expect(newOnes(LS.selectSessionBatch(words, 20))).toHaveLength(7);
  });

  it('takes new words in the order they were added', () => {
    const words = [fresh('late', day(3)), fresh('first', day(1)), fresh('mid', day(2)), ...reviews(20)];
    const batch = LS.selectSessionBatch(words, 10);
    expect(names(newOnes(batch))).toEqual(['first', 'late', 'mid']);
    const many = [...freshWords(10).reverse(), ...reviews(20)];
    expect(names(newOnes(LS.selectSessionBatch(many, 10)))).toEqual(['n1', 'n2', 'n3', 'n4']);
  });

  it('takes the new word added first by its repaired date when an older version stored a later createdAt', () => {
    const stored = [
      fresh('second', '2026-02-01T00:00:00.000Z'),
      { ...fresh('first', '2026-03-01T00:00:00.000Z'), addedDate: '2026-01-01' },
      { ...fresh('third', '2026-02-15T00:00:00.000Z'), addedDate: '2026-02-20T00:00:00.000Z' },
      ...reviews(20)
    ];
    const storage = createMemoryStorage({ vocabulary: JSON.stringify({ schemaVersion: 1, words: stored }) });
    const words = createVocabularyStore({ storage, now: () => new Date('2026-11-27T00:00:00Z') }).load();

    expect(names(newOnes(LS.selectSessionBatch(words, 3)))).toEqual(['first']);
    expect(names(newOnes(LS.selectSessionBatch(words, 6)))).toEqual(['first', 'second']);
  });

  it('takes reviews with the oldest nextReview first', () => {
    const words = [...reviews(20).reverse(), ...freshWords(10)];
    const batch = LS.selectSessionBatch(words, 10);
    expect(names(batch.filter(w => w.nextReview))).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  });

  it('gives every slot to reviews when there are no new words', () => {
    const batch = LS.selectSessionBatch(reviews(20), 10);
    expect(names(batch)).toEqual(['r1', 'r10', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9']);
  });

  it('fills the session with new words when nothing is to review', () => {
    const batch = LS.selectSessionBatch(freshWords(20), 10);
    expect(names(batch)).toEqual(['n1', 'n10', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9']);
  });

  it('lets reviews fill the rest when there are fewer new words than their share', () => {
    const batch = LS.selectSessionBatch([...freshWords(2), ...reviews(20)], 15);
    expect(newOnes(batch)).toHaveLength(2);
    expect(batch).toHaveLength(15);
  });

  it('lets new words fill the rest when there are fewer reviews than their share', () => {
    const batch = LS.selectSessionBatch([...reviews(3), ...freshWords(20)], 15);
    expect(batch.filter(w => w.nextReview)).toHaveLength(3);
    expect(batch).toHaveLength(15);
  });

  it('returns everything when the session is larger than the pool', () => {
    const words = [fresh('a', day(1)), review('b', day(2))];
    expect(names(LS.selectSessionBatch(words, 15))).toEqual(['a', 'b']);
  });

  it('does not change the input array', () => {
    const words = [review('b', day(2)), review('a', day(1))];
    LS.selectSessionBatch(words, 1);
    expect(words.map(w => w.original)).toEqual(['b', 'a']);
  });
});

describe('Session resume and restart', () => {
  const makeWords = (count) => Array.from({ length: count }, (_, i) => ({
    original: `w${i}`, translation: `t${i}`, nextReview: null, repetition: 0, easeFactor: 2.5, reviewHistory: []
  }));

  beforeEach(() => {
    document.body.innerHTML = '<div id="learningContent"></div>';
    const vocabulary = makeWords(20);
    window.SV.DataManager = { vocabulary, save: vi.fn() };
    window.SV.SpacedRepetition = require('../../js/spaced-repetition.js');
    window.SV.SessionSettings = require('../../js/session-settings.js').createSessionSettings({
      storage: { getItem: () => '10', setItem: vi.fn() }
    });
    window.SV.AppState.learningSession = [];
    window.SV.AppState.currentLearningWord = null;
    window.SV.Today = { showSession: vi.fn(), showOverview: vi.fn() };
  });

  it('limits a new session to the configured size', () => {
    LS.startLearning();
    expect(window.SV.AppState.learningSession).toHaveLength(10);
    expect(window.SV.Today.showSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the same session and current word when the Today tab is reopened', () => {
    LS.startLearning();
    const session = window.SV.AppState.learningSession;
    const current = window.SV.AppState.currentLearningWord;
    window.SV.Today.showSession.mockClear();

    LS.prepareLearningSession();

    expect(window.SV.AppState.learningSession).toBe(session);
    expect(window.SV.AppState.currentLearningWord).toBe(current);
    expect(window.SV.Today.showSession).toHaveBeenCalledTimes(1);
    expect(window.SV.Today.showOverview).not.toHaveBeenCalled();
    expect(document.getElementById('learningContent').textContent).toContain(current.original);
  });

  it('shows the overview when the Today tab opens without a running session', () => {
    LS.prepareLearningSession();

    expect(window.SV.Today.showOverview).toHaveBeenCalledTimes(1);
    expect(window.SV.AppState.learningSession).toEqual([]);
  });

  it('returns to the overview instead of starting when no word is due', () => {
    window.SV.DataManager.vocabulary.forEach(word => { word.nextReview = '2999-01-01T00:00:00.000Z'; });

    LS.startLearning();

    expect(window.SV.Today.showOverview).toHaveBeenCalledTimes(1);
    expect(window.SV.Today.showSession).not.toHaveBeenCalled();
    expect(window.SV.AppState.learningSession).toEqual([]);
  });

  it('offers a way back to Today when a session ends', () => {
    LS.startLearning();
    LS.endLearningSession();

    const back = document.querySelector('[data-action="show-tab"][data-arg="today"]');
    expect(back.textContent).toContain('Back to Today');
  });

  it('stops on the close button: back to the overview, state cleared, no completion screen', () => {
    LS.startLearning();
    window.SV.Today.showOverview.mockClear();
    window.SV.AppState.sessionStats = { correct: 2, total: 3, streak: 1, bestStreak: 2 };
    const closeButton = document.querySelector('[data-testid="session-progress"] [data-action="stop-session"]');
    expect(closeButton.getAttribute('aria-label')).toBe('End session');

    LS.stopLearningSession();

    expect(window.SV.Today.showOverview).toHaveBeenCalledTimes(1);
    expect(document.getElementById('learningContent').textContent).not.toContain('Session Complete');
    expect(window.SV.AppState.learningSession).toEqual([]);
    expect(window.SV.AppState.sessionTotal).toBe(0);
    expect(window.SV.AppState.currentLearningWord).toBeNull();
    expect(window.SV.AppState.sessionStats).toEqual({ correct: 0, total: 0, streak: 0, bestStreak: 0 });
  });

  it('cancels pending timers when stopped', () => {
    window.SV.SpeechManager = { speechSettings: { enabled: true, autoPlay: true }, speakWord: vi.fn() };
    const schedule = vi.spyOn(globalThis, 'setTimeout').mockReturnValue(7);
    const clear = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});
    try {
      LS.startLearning();
      LS.stopLearningSession();
      expect(clear).toHaveBeenCalledWith(7);
    } finally {
      schedule.mockRestore();
      clear.mockRestore();
      delete window.SV.SpeechManager;
    }
  });

  it('leaves the session empty after it ends and builds a fresh batch next time', () => {
    LS.startLearning();
    LS.endLearningSession();

    expect(document.getElementById('learningContent').textContent).toContain('Session Complete');
    expect(window.SV.AppState.learningSession).toEqual([]);
    expect(window.SV.AppState.currentLearningWord).toBeNull();

    LS.startLearning();
    expect(window.SV.AppState.learningSession.length).toBeGreaterThan(0);
    expect(window.SV.AppState.currentLearningWord).toBe(window.SV.AppState.learningSession[0]);
  });

  it('force start limits the batch for the whole vocabulary', () => {
    LS.forceStartLearning();
    expect(window.SV.AppState.learningSession).toHaveLength(10);
  });

  it('opens each word of a new session with the exercise of its stage', () => {
    const wordAt = (original, exerciseType) => ({
      original, translation: 't', nextReview: null, repetition: 2, easeFactor: 2.5,
      reviewHistory: [{ difficulty: 'easy', exerciseType }]
    });
    window.SV.DataManager.vocabulary = [wordAt('a', 'regular')];

    LS.forceStartLearning();

    expect(window.SV.AppState.currentLearningWord.currentExerciseType).toBe('build');
    expect(document.querySelector('.build-slots')).toBeTruthy();
  });

  it('reveals the answer and rating buttons after checking a built word', () => {
    const word = {
      original: 'ab', translation: 't', repetition: 2, easeFactor: 2.5,
      reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }]
    };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    LS.showLearningCard();
    expect(document.querySelector('.difficulty-buttons')).toBeNull();
    expect(document.querySelector('[data-action="build-check"]').disabled).toBe(true);

    Build.placeBuildLetter('a');
    Build.placeBuildLetter('b');
    expect(document.querySelector('[data-action="build-check"]').disabled).toBe(false);
    Build.checkBuildAnswer();

    expect(document.querySelector('.build-feedback--correct').textContent).toBe(Screen.VERDICT_FEEDBACK.exact.text);
    expect(document.querySelector('.card-translation').textContent).toContain('ab');
    expect(enabledRatings()).toEqual(['hard', 'medium', 'easy', 'perfect']);
  });

  it('shows the tile count badge only while 2 or more of that letter remain', () => {
    const word = {
      original: 'llama', translation: 't', repetition: 2, easeFactor: 2.5,
      reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }]
    };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    LS.showLearningCard();
    const tile = (letter) => document.querySelector(`.build-tile[data-arg="${letter}"]`);
    const badge = (letter) => tile(letter).querySelector('.build-tile__count');

    expect(badge('l').textContent).toBe('2');
    expect(badge('a').textContent).toBe('2');
    expect(badge('m')).toBeNull();

    Build.placeBuildLetter('l');
    expect(badge('l')).toBeNull();
    expect(tile('l').disabled).toBe(false);
    expect(tile('l').getAttribute('aria-label')).toBe('l, 1 left');

    Build.placeBuildLetter('l');
    expect(badge('l')).toBeNull();
    expect(tile('l').disabled).toBe(true);
    expect(tile('l').getAttribute('aria-label')).toBe('l, 0 left');
  });

  it('shows a built word with markup in the correct answer as text, not as HTML', () => {
    const word = { original: '<b>x</b>', translation: 't', repetition: 2, easeFactor: 2.5, reviewHistory: [] };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    Build.showBuildCard();

    Screen.revealCorrectAnswer('hard');

    const answer = document.querySelector('.card-translation .detail-text');
    expect(answer.textContent).toBe('<b>x</b>');
    expect(answer.querySelector('b')).toBeNull();
  });

  it('allows only Hard after checking a wrongly built word', () => {
    const word = {
      original: 'ab', translation: 't', repetition: 2, easeFactor: 2.5,
      reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }]
    };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    LS.showLearningCard();

    Build.placeBuildLetter('b');
    Build.placeBuildLetter('a');
    Build.checkBuildAnswer();

    expect(document.querySelector('.build-feedback--wrong').textContent).toBe(Screen.VERDICT_FEEDBACK.wrong.text);
    expect(ratingButtons()).toHaveLength(4);
    expect(enabledRatings()).toEqual(['hard']);
  });

  describe('build area updates in place (C31: a rebuilt area threw the scrolled screen back up)', () => {
    const showBuild = (original) => {
      const word = { original, translation: 't', repetition: 2, easeFactor: 2.5, reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }] };
      window.SV.AppState.currentLearningWord = word;
      window.SV.AppState.learningSession = [word];
      LS.showLearningCard();
    };
    const area = () => document.getElementById('buildArea');
    const tile = (letter) => document.querySelector(`.build-tile[data-arg="${letter}"]`);
    const slots = () => [...document.querySelectorAll('.build-slot')];
    const nodes = () => [...area().querySelectorAll('*')];
    const control = (action) => document.querySelector(`[data-action="${action}"]`);

    it('keeps the tiles, slots and controls when a letter is placed and taken back', () => {
      showBuild('a llama');
      const before = { slotsEl: document.querySelector('.build-slots'), slots: slots(), l: tile('l'), a: tile('a'), undo: control('build-undo'), check: control('build-check') };

      Build.placeBuildLetter('a');
      Build.placeBuildLetter('l');

      expect(document.querySelector('.build-slots')).toBe(before.slotsEl);
      expect(slots()).toEqual(before.slots);
      slots().forEach((slot, index) => expect(slot).toBe(before.slots[index]));
      expect(tile('l')).toBe(before.l);
      expect(tile('a')).toBe(before.a);
      expect(control('build-undo')).toBe(before.undo);
      expect(control('build-check')).toBe(before.check);

      expect(slots().map((slot) => slot.textContent)).toEqual(['a', 'l', '', '', '', '']);
      expect(slots().map((slot) => slot.className)).toEqual([
        'build-slot build-slot--right', 'build-slot build-slot--right', 'build-slot build-slot--active', 'build-slot', 'build-slot', 'build-slot'
      ]);
      expect(before.slotsEl.getAttribute('aria-label')).toBe('Your answer: a l');
      expect(before.undo.disabled).toBe(false);

      Build.undoBuildLetter();
      expect(tile('l')).toBe(before.l);
      expect(before.l.querySelector('.build-tile__count').textContent).toBe('2');
      expect(before.l.getAttribute('aria-label')).toBe('l, 2 left');
      expect(slots()[1].textContent).toBe('');
      expect(slots()[1].className).toBe('build-slot build-slot--active');
      expect(before.slotsEl.getAttribute('aria-label')).toBe('Your answer: a ');
    });

    it('updates the pressed tile: badge, label and disabled when its last letter is used', () => {
      showBuild('aab');
      const a = tile('a');
      expect(a.querySelector('.build-tile__count').textContent).toBe('2');

      Build.placeBuildLetter('a');
      expect(a.querySelector('.build-tile__count')).toBeNull();
      expect(a.textContent).toBe('a');
      expect(a.getAttribute('aria-label')).toBe('a, 1 left');
      expect(a.disabled).toBe(false);

      Build.placeBuildLetter('a');
      expect(tile('a')).toBe(a);
      expect(a.disabled).toBe(true);
      expect(a.getAttribute('aria-label')).toBe('a, 0 left');

      Build.undoBuildLetter();
      expect(a.disabled).toBe(false);
      expect(a.getAttribute('aria-label')).toBe('a, 1 left');
    });

    it('enables Undo and Check with the letters and ignores a letter that has none left', () => {
      showBuild('ab');
      const [undo, check] = [control('build-undo'), control('build-check')];
      expect(undo.disabled).toBe(true);
      expect(check.disabled).toBe(true);

      Build.placeBuildLetter('a');
      const after = nodes();
      Build.placeBuildLetter('a');
      expect(nodes()).toEqual(after);
      expect(slots().map((slot) => slot.textContent)).toEqual(['a', '']);

      Build.placeBuildLetter('b');
      expect(check.disabled).toBe(false);
      Build.undoBuildLetter();
      Build.undoBuildLetter();
      expect(undo.disabled).toBe(true);
      expect(check.disabled).toBe(true);
      expect(slots()[0].className).toBe('build-slot build-slot--active');
    });

    it('on Check keeps the slots, marks each letter and swaps the tiles and controls for the verdict', () => {
      showBuild('ab');
      const slotsBefore = slots();
      Build.placeBuildLetter('b');
      Build.placeBuildLetter('a');

      Build.checkBuildAnswer();

      slots().forEach((slot, index) => expect(slot).toBe(slotsBefore[index]));
      expect(slots().map((slot) => slot.className)).toEqual(['build-slot build-slot--wrong', 'build-slot build-slot--wrong']);
      expect(area().querySelector('.build-tiles')).toBeNull();
      expect(area().querySelector('.build-controls')).toBeNull();
      expect(area().lastElementChild.className).toBe('build-feedback build-feedback--wrong');
      expect(area().querySelectorAll('.build-feedback')).toHaveLength(1);
    });

    it('does nothing on Check before the word is complete', () => {
      showBuild('ab');
      Build.placeBuildLetter('a');
      const html = area().innerHTML;

      Build.checkBuildAnswer();

      expect(area().innerHTML).toBe(html);
      expect(document.querySelector('.difficulty-buttons')).toBeNull();
    });

    it('shows a letter with markup in a slot and a tile as text', () => {
      showBuild('<b');
      Build.placeBuildLetter('<');
      expect(slots()[0].textContent).toBe('<');
      expect(slots()[0].children).toHaveLength(0);
      expect(tile('<').textContent).toBe('<');
      expect(document.querySelector('.build-slots').getAttribute('aria-label')).toBe('Your answer: <');
    });
  });

  it('records build in the review history', () => {
    const word = {
      original: 'ab', translation: 't', repetition: 2, easeFactor: 2.5,
      reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }]
    };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    LS.showLearningCard();

    LS.markDifficulty('easy');

    expect(word.reviewHistory.at(-1)).toMatchObject({ difficulty: 'easy', exerciseType: 'build' });
  });

  it('persists nextReview, easeFactor and repetition from the previous interval', () => {
    vi.useFakeTimers({ now: new Date('2026-11-22T10:00:00.000Z') });
    try {
      const word = {
        original: 'w', translation: 't', repetition: 2, easeFactor: 2,
        nextReview: '2026-11-22T09:00:00.000Z',
        reviewHistory: [{ date: '2026-11-18T09:00:00.000Z', difficulty: 'easy', exerciseType: 'regular' }]
      };
      window.SV.AppState.currentLearningWord = word;
      window.SV.AppState.learningSession = [word];

      LS.markDifficulty('easy');

      expect(word.easeFactor).toBeCloseTo(2.15);
      expect(word.repetition).toBe(3);
      expect(word.nextReview).toBe('2026-12-01T10:00:00.000Z');
      expect(word).not.toHaveProperty('interval');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stamps updatedAt on every answer and saves', () => {
    vi.useFakeTimers({ now: new Date('2026-11-22T10:00:00.000Z') });
    try {
      LS.startLearning();
      const answered = window.SV.AppState.currentLearningWord;

      LS.markDifficulty('easy');

      expect(answered.updatedAt).toBe('2026-11-22T10:00:00.000Z');
      expect(answered.reviewHistory.at(-1).date).toBe(answered.updatedAt);
      expect(window.SV.DataManager.save).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Prompt text of a word', () => {
  const withDefinition = { translation: 'привет', definition: 'A greeting.' };
  const withoutDefinition = { translation: 'привет' };

  it('uses the translation and keeps the definition as detail when the setting is off', () => {
    expect(Screen.getWordPrompt(withDefinition, false)).toEqual({ label: 'Translation', main: 'привет', detail: 'A greeting.' });
  });

  it('uses the definition alone when the setting is on', () => {
    expect(Screen.getWordPrompt(withDefinition, true)).toEqual({ label: 'Definition', main: 'A greeting.', detail: '' });
  });

  it('falls back to the translation for a word without a definition', () => {
    expect(Screen.getWordPrompt(withoutDefinition, true)).toEqual({ label: 'Translation', main: 'привет', detail: undefined });
    expect(Screen.getWordPrompt({ ...withoutDefinition, definition: '' }, true).main).toBe('привет');
    expect(Screen.getWordPrompt(withoutDefinition, false).main).toBe('привет');
  });
});

describe('Prompt title size on the writing card', () => {
  const titleFor = (translation) => {
    const word = { id: 'w1', original: 'hello', translation, repetition: 2, easeFactor: 2.5, reviewHistory: [] };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    window.SV.AppState.sessionTotal = 1;
    document.body.innerHTML = '<div id="learningContent"></div>';
    Writing.showReverseTranslationCard();
    return document.querySelector('.exercise-card__title');
  };

  it('keeps a short title in the big style', () => {
    expect(titleFor('привет').classList.contains('exercise-card__title--long')).toBe(false);
  });

  it('gives a long definition the smaller style', () => {
    const definition = 'To convey or transfer to another, as title, property, or right; to part voluntarily with ownership of.';
    expect(titleFor(definition).classList.contains('exercise-card__title--long')).toBe(true);
  });

  it('switches to the smaller style just above the length limit', () => {
    const limit = Screen.LONG_TITLE_MIN_LENGTH;
    expect(titleFor('я'.repeat(limit - 1)).classList.contains('exercise-card__title--long')).toBe(false);
    expect(titleFor('я'.repeat(limit)).classList.contains('exercise-card__title--long')).toBe(true);
  });
});

describe('Listening exercise (C34)', () => {
  const makeWord = (original) => ({
    id: 'l1', original, translation: 'яблоко', definition: 'A round fruit.', phonetic: '/ˈæp.əl/',
    examples: ['I eat an apple.'], synonyms: [], repetition: 2, easeFactor: 2.5, reviewHistory: []
  });
  const start = (original = 'apple') => {
    const word = makeWord(original);
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    window.SV.AppState.sessionTotal = 1;
    document.body.innerHTML = '<div id="learningContent"></div>';
    Listen.showListenCard();
    return word;
  };
  const main = () => document.getElementById('learningMain');
  const card = () => document.querySelector('.listen-card');
  const speaker = () => card().querySelector('[data-action="speak-word"]');
  const input = () => document.getElementById('reverseTranslationInput');
  const answerBlocks = () => [...document.querySelectorAll('.card-translation')];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.SV.SpeechManager = { speechSettings: { enabled: true, autoPlay: false }, speakWord: vi.fn() };
  });

  afterEach(() => {
    Screen.clearScreenTimeouts();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.SV.SpeechManager;
  });

  it('shows the task and a speaker, but neither the word, its translation nor its definition', () => {
    start();
    expect(document.querySelector('.learning-prompt').textContent).toBe('Write what you hear');
    expect(speaker().dataset.arg).toBe('apple');
    expect(speaker().getAttribute('aria-label')).toBe('Play the word');
    expect(card().querySelector('.exercise-card__chip').textContent).toBe('word');
    expect(main().textContent).not.toContain('apple');
    expect(main().textContent).not.toContain('яблоко');
    expect(main().textContent).not.toContain('A round fruit.');
    expect(main().querySelector('.exercise-card__title, .exercise-card__definition, .detail-block')).toBeNull();
  });

  it('calls a phrase a phrase on the chip', () => {
    start('break the ice');
    expect(card().querySelector('.exercise-card__chip').textContent).toBe('phrase');
  });

  it('escapes the word in the speaker', () => {
    start('<b>x</b>');
    expect(speaker().dataset.arg).toBe('<b>x</b>');
    expect(card().querySelector('b')).toBeNull();
  });

  it('plays the word with the card speaker as the card opens, even with auto-play off', () => {
    start();
    expect(window.SV.SpeechManager.speakWord).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(window.SV.SpeechManager.speakWord).toHaveBeenCalledTimes(1);
    expect(window.SV.SpeechManager.speakWord).toHaveBeenCalledWith('apple', speaker());
  });

  it('does not play the word of a card that is gone', () => {
    start();
    Screen.clearScreenTimeouts();
    vi.runAllTimers();
    expect(window.SV.SpeechManager.speakWord).not.toHaveBeenCalled();
  });

  it('checks with its own action and focuses the field', () => {
    start();
    expect(document.getElementById('checkReverseButton').dataset.action).toBe('check-listen');
    expect(document.getElementById('hintReverseButton').dataset.action).toBe('show-answer-hint');
    vi.runAllTimers();
    expect(document.activeElement).toBe(input());
  });

  it('reveals the word with its transcription, then its translation and definition after Check', () => {
    start();
    input().value = 'apple';
    Listen.checkListenAnswer();

    const [answer, translation] = answerBlocks();
    expect(answer.querySelector('.detail-title').textContent).toBe('Correct answer');
    expect(answer.querySelector('.detail-text').textContent).toBe('apple');
    expect(answer.textContent).toContain('/ˈæp.əl/');
    expect(answer.querySelector('[data-action="speak-word"]').dataset.arg).toBe('apple');
    expect(translation.querySelector('.detail-title').textContent).toBe('Translation');
    expect(translation.querySelector('.detail-text').textContent).toBe('яблоко');
    expect(main().querySelector('.detail-block--definition').textContent).toContain('A round fruit.');

    const children = [...main().children];
    const order = [answer, translation, main().querySelector('.detail-block--definition'),
      main().querySelector('.detail-block--examples'), main().querySelector('.difficulty-buttons')].map((el) => children.indexOf(el));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order[0]).toBeGreaterThan(-1);
  });

  it('reveals the translation after an empty Check too', () => {
    start();
    Listen.checkListenAnswer();
    expect(answerBlocks().map((block) => block.querySelector('.detail-text').textContent)).toEqual(['apple', 'яблоко']);
    expect(enabledRatings()).toEqual(['hard']);
  });

  it('answers with Next on a repeat', () => {
    const word = start();
    window.SV.AppState.repeatedWords = new Set([word]);
    Listen.showListenCard();
    expect(document.querySelector('.learning-prompt').textContent).toBe('One more time: Write what you hear');

    Listen.checkListenAnswer();

    expect(ratingButtons()).toHaveLength(0);
    expect(document.querySelector('[data-testid="next-card-btn"]')).toBeTruthy();
    window.SV.AppState.repeatedWords = new Set();
  });
});

describe('Typed answer shared by writing and listening', () => {
  const exercises = [
    ['writing', Writing.showReverseTranslationCard, Writing.checkReverseTranslation],
    ['listening', Listen.showListenCard, Listen.checkListenAnswer]
  ];
  const start = (show, original) => {
    const word = { id: 't1', original, translation: 'перевод', repetition: 2, easeFactor: 2.5, reviewHistory: [] };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    window.SV.AppState.sessionTotal = 1;
    document.body.innerHTML = '<div id="learningContent"></div>';
    show();
  };
  const input = () => document.getElementById('reverseTranslationInput');
  const controlsHtml = () => document.querySelector('.learning-input-block').outerHTML + document.getElementById('reverseActions').outerHTML;

  afterEach(() => Screen.clearScreenTimeouts());

  it('renders the same field, Hint and Check in both, apart from the Check action', () => {
    start(Writing.showReverseTranslationCard, 'hello');
    const writing = controlsHtml();
    start(Listen.showListenCard, 'hello');
    const listening = controlsHtml();

    expect(listening.replace('check-listen', 'check-reverse')).toBe(writing);
  });

  it.each(exercises)('starts %s from zero hints and types the first letters', (_, show) => {
    window.SV.AppState.reverseHintCount = 2;
    start(show, 'Devolve');
    TypedAnswer.showAnswerHint();
    TypedAnswer.showAnswerHint();
    expect(input().value).toBe('De');
    expect(document.getElementById('hintReverseButton').textContent).toBe('Hint (1 left)');
  });

  it.each(exercises.flatMap(([name, show, check]) => [
    [name, 'hello', 0, 'success', 'Correct!', ['hard', 'medium', 'easy', 'perfect'], show, check],
    [name, 'hello', 1, 'success', 'Correct!', ['hard', 'medium'], show, check],
    [name, 'hallo', 0, 'warn', 'Almost — check the spelling', ['hard', 'medium'], show, check],
    [name, 'world', 0, 'danger', 'Not quite', ['hard'], show, check]
  ]))('%s: "%s" after %i hints tints the field %s, says "%s" and allows %j', (_, typed, hints, tone, text, ratings, show, check) => {
    start(show, 'hello');
    for (let i = 0; i < hints; i++) TypedAnswer.showAnswerHint();
    input().value = typed;
    check();

    expect(input().className).toContain(`typing-input--${tone}`);
    expect(document.getElementById('typingFeedback').textContent).toBe(text);
    expect(input().disabled).toBe(true);
    expect(document.getElementById('reverseActions').style.display).toBe('none');
    expect(enabledRatings()).toEqual(ratings);
  });

  it.each(exercises)('%s: an empty Check gives up without a verdict and allows only Hard', (_, show, check) => {
    start(show, 'hello');
    check();

    expect(input().className).not.toContain('typing-input--');
    expect(document.getElementById('typingFeedback').textContent).toBe('');
    expect(enabledRatings()).toEqual(['hard']);
  });

  it.each(exercises)('%s: marks the difference of a misspelled answer', (_, show, check) => {
    start(show, 'hello');
    input().value = 'hallo';
    check();
    expect(document.getElementById('typingDiff').innerHTML)
      .toBe('h<del class="typing-diff__wrong">a</del><ins class="typing-diff__missing">e</ins>llo');
  });

  it.each(exercises)('%s: ignores a second Check', (_, show, check) => {
    start(show, 'hello');
    input().value = 'hello';
    check();
    check();
    expect(document.querySelectorAll('.difficulty-buttons')).toHaveLength(1);
  });

  it('shows the translation in the answer of listening only', () => {
    start(Writing.showReverseTranslationCard, 'hello');
    Writing.checkReverseTranslation();
    expect(document.querySelectorAll('.card-translation')).toHaveLength(1);

    start(Listen.showListenCard, 'hello');
    Listen.checkListenAnswer();
    expect(document.querySelectorAll('.card-translation')).toHaveLength(2);
  });
});
