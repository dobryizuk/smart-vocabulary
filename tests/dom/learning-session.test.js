import { describe, it, expect, beforeEach, vi } from 'vitest';

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

describe('Exercise stage of a word', () => {
  const stageAfter = (...reviews) => LS.determineExerciseType({ reviewHistory: reviews });

  it('starts every word with recognition', () => {
    expect(LS.determineExerciseType({ repetition: 0 })).toBe('regular');
    expect(stageAfter()).toBe('regular');
  });

  it('moves forward after OK or Easy', () => {
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'regular' })).toBe('build');
    expect(stageAfter({ difficulty: 'perfect', exerciseType: 'regular' })).toBe('build');
    expect(stageAfter({ difficulty: 'perfect', exerciseType: 'build' })).toBe('reverse');
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'build' })).toBe('reverse');
  });

  it('stays on writing after OK or Easy in writing', () => {
    expect(stageAfter({ difficulty: 'easy', exerciseType: 'reverse' })).toBe('reverse');
    expect(stageAfter({ difficulty: 'perfect', exerciseType: 'reverse' })).toBe('reverse');
  });

  it('moves back one stage after Hard, but not below recognition', () => {
    expect(stageAfter({ difficulty: 'hard', exerciseType: 'reverse' })).toBe('build');
    expect(stageAfter({ difficulty: 'hard', exerciseType: 'build' })).toBe('regular');
    expect(stageAfter({ difficulty: 'hard', exerciseType: 'regular' })).toBe('regular');
  });

  it('keeps the stage after Medium', () => {
    expect(stageAfter({ difficulty: 'medium', exerciseType: 'regular' })).toBe('regular');
    expect(stageAfter({ difficulty: 'medium', exerciseType: 'build' })).toBe('build');
    expect(stageAfter({ difficulty: 'medium', exerciseType: 'reverse' })).toBe('reverse');
  });

  it('looks only at the last review', () => {
    expect(stageAfter(
      { difficulty: 'hard', exerciseType: 'regular' },
      { difficulty: 'easy', exerciseType: 'regular' }
    )).toBe('build');
    expect(stageAfter(
      { difficulty: 'easy', exerciseType: 'build' },
      { difficulty: 'hard', exerciseType: 'reverse' }
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
    LS.showTranslation();

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

  it('renders correct order for reverse translation after Show Answer', () => {
    const word = setupWord();
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];

    // Render reverse exercise and then show answer
    LS.showReverseTranslationCard();
    LS.showAnswerForReverse();

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
    window.SV.AppState.sessionStats = { correct: 0, total: 0, streak: 0 };
    window.SV.DataManager = { vocabulary: words.map((w) => ({ ...w })), save: vi.fn() };
  });

  it('counts the current card against the whole session', () => {
    LS.forceStartLearning();
    expect(progressText()).toBe('1 / 3');
    expect(progressWidth()).toBe('33%');

    LS.markDifficulty('easy');
    expect(progressText()).toBe('2 / 3');
    expect(progressWidth()).toBe('67%');

    LS.markDifficulty('hard');
    expect(progressText()).toBe('3 / 3');
    expect(progressWidth()).toBe('100%');
  });
});

describe('Writing exercise hint', () => {
  const startExercise = (original) => {
    const word = { id: 'h1', original, translation: 'перевод', repetition: 2, easeFactor: 2.5, reviewHistory: [] };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    LS.showReverseTranslationCard();
  };
  const hint = () => document.getElementById('reverseHint').textContent;
  const hintBtn = () => document.getElementById('hintReverseButton');

  it('reveals one more letter per press, up to three', () => {
    startExercise('Devolve');
    expect(hint()).toBe('');
    expect(hintBtn().textContent).toBe('Hint');
    expect(hintBtn().className).toBe('btn btn--secondary');

    LS.showHintForReverse();
    expect(hint()).toBe('D…');
    expect(hintBtn().textContent).toBe('Hint (2 left)');

    LS.showHintForReverse();
    expect(hint()).toBe('De…');

    LS.showHintForReverse();
    expect(hint()).toBe('Dev…');
    expect(hintBtn().disabled).toBe(true);

    LS.showHintForReverse();
    expect(hint()).toBe('Dev…');
  });

  it('starts from zero hints for the next word', () => {
    startExercise('Devolve');
    LS.showHintForReverse();
    startExercise('Forthright');

    expect(hint()).toBe('');
    LS.showHintForReverse();
    expect(hint()).toBe('F…');
  });

  it('never reveals the whole answer of a short word', () => {
    startExercise('go');
    LS.showHintForReverse();
    LS.showHintForReverse();

    expect(hint()).toBe('g…');
    expect(hintBtn().disabled).toBe(true);
  });

  it('disables the hint for a one-letter answer', () => {
    startExercise('I');
    expect(hintBtn().disabled).toBe(true);
    LS.showHintForReverse();
    expect(hint()).toBe('');
  });

  it('hides the hint, check and show answer buttons once the answer is shown', () => {
    startExercise('Devolve');
    LS.showAnswerForReverse();
    expect(document.getElementById('reverseActions').style.display).toBe('none');
  });

  it('counts letters, not spaces, in phrases', () => {
    expect(LS.getHintPrefix('a lot', 2)).toBe('a l');
    expect(LS.getHintPrefix('  break the ice'.trim(), 3)).toBe('bre');
    expect(LS.getMaxHints('a lot')).toBe(3);
    expect(LS.getMaxHints('ox')).toBe(1);
    expect(LS.getMaxHints('')).toBe(0);
  });
});

describe('Writing exercise verdict', () => {
  it('is Correct only for an exact match, ignoring case and punctuation', () => {
    expect(LS.getTypingVerdict('hello', 'hello')).toEqual({ tone: 'success', text: 'Correct!' });
    expect(LS.getTypingVerdict('  Hello! ', 'hello')).toEqual({ tone: 'success', text: 'Correct!' });
  });

  it('warns from 90% accuracy', () => {
    expect(LS.calculateTypingAccuracy('abcdefghi', 'abcdefghij').accuracy).toBe(90);
    expect(LS.getTypingVerdict('abcdefghi', 'abcdefghij')).toEqual({ tone: 'warn', text: 'Almost \u2014 check the spelling' });
  });

  it('fails below 90% accuracy', () => {
    expect(LS.calculateTypingAccuracy('abcdefghijklmnop', 'abcdefghijklmnopqr').accuracy).toBe(89);
    expect(LS.getTypingVerdict('abcdefghijklmnop', 'abcdefghijklmnopqr')).toEqual({ tone: 'danger', text: 'Not quite' });
    expect(LS.getTypingVerdict('xyz', 'hello').tone).toBe('danger');
  });

  it('does not call a long near miss exact when its accuracy rounds to 100', () => {
    const answer = 'a'.repeat(300);
    expect(LS.calculateTypingAccuracy(`${answer}b`, answer).accuracy).toBe(100);
    expect(LS.getTypingVerdict(`${answer}b`, answer).tone).toBe('warn');
  });
});

describe('Writing exercise check', () => {
  const start = (original) => {
    const word = { id: 'w1', original, translation: 'перевод', repetition: 2, easeFactor: 2.5, reviewHistory: [] };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    window.SV.AppState.sessionTotal = 1;
    document.body.innerHTML = '<div id="learningContent"></div>';
    LS.showReverseTranslationCard();
  };
  const input = () => document.getElementById('reverseTranslationInput');
  const feedback = () => document.getElementById('typingFeedback');
  const answerShown = () => document.querySelector('.difficulty-buttons') !== null;

  it('renders Hint and Check side by side with Show Answer below and no inline handlers', () => {
    start('hello');
    const actions = document.getElementById('reverseActions');
    expect([...actions.children].map((button) => button.textContent)).toEqual(['Hint', 'Check', 'Show Answer']);
    expect(document.getElementById('checkReverseButton').dataset.action).toBe('check-reverse');
    expect(document.querySelector('#learningContent [onclick], #learningContent [oninput], #learningContent [onkeypress]')).toBeNull();
    expect(input().dataset.enterButton).toBe('checkReverseButton');
  });

  it('shows Correct! with a success border, then the answer and rating buttons', () => {
    start('hello');
    input().value = 'Hello';
    LS.checkReverseTranslation();

    expect(feedback().textContent).toBe('Correct!');
    expect(feedback().querySelector('.typing-feedback--success')).not.toBeNull();
    expect(input().classList.contains('typing-input--success')).toBe(true);
    expect(input().disabled).toBe(true);
    expect(answerShown()).toBe(true);
    expect(document.getElementById('reverseActions').style.display).toBe('none');
  });

  it('shows the warn verdict for a near miss', () => {
    start('abcdefghij');
    input().value = 'abcdefghi';
    LS.checkReverseTranslation();

    expect(feedback().textContent).toBe('Almost \u2014 check the spelling');
    expect(input().classList.contains('typing-input--warn')).toBe(true);
  });

  it('shows Not quite with a danger border for a wrong answer and still reveals the answer', () => {
    start('hello');
    input().value = 'world';
    LS.checkReverseTranslation();

    expect(feedback().textContent).toBe('Not quite');
    expect(input().classList.contains('typing-input--danger')).toBe(true);
    expect(answerShown()).toBe(true);
  });

  it('does nothing for an empty answer', () => {
    start('hello');
    input().value = '   ';
    LS.checkReverseTranslation();

    expect(feedback().textContent).toBe('');
    expect(answerShown()).toBe(false);
    expect(input().disabled).toBe(false);
  });

  it('reveals the answer without a verdict when Show Answer is used', () => {
    start('hello');
    input().value = 'hello';
    LS.showAnswerForReverse();

    expect(feedback().textContent).toBe('');
    expect(input().className).not.toMatch(/typing-input--/);
    expect(answerShown()).toBe(true);
  });
});

describe('Session batch selection', () => {
  const word = (original, nextReview) => ({ original, translation: original, nextReview });
  const names = (words) => words.map(w => w.original).sort();

  it('picks at most N words, oldest nextReview first', () => {
    const words = [
      word('c', '2026-01-03T00:00:00Z'),
      word('a', '2026-01-01T00:00:00Z'),
      word('d', '2026-01-04T00:00:00Z'),
      word('b', '2026-01-02T00:00:00Z')
    ];
    expect(names(LS.selectSessionBatch(words, 2))).toEqual(['a', 'b']);
  });

  it('puts new words after due ones', () => {
    const words = [word('new1', null), word('due1', '2026-01-02T00:00:00Z'), word('new2', null), word('due2', '2026-01-01T00:00:00Z')];
    const batch = LS.selectSessionBatch(words, 3);
    expect(batch.filter(w => w.nextReview)).toHaveLength(2);
    expect(batch.filter(w => !w.nextReview)).toHaveLength(1);
    expect(names(batch.filter(w => w.nextReview))).toEqual(['due1', 'due2']);
  });

  it('returns all candidates when there are fewer than N', () => {
    const words = [word('a', null), word('b', '2026-01-01T00:00:00Z')];
    expect(names(LS.selectSessionBatch(words, 15))).toEqual(['a', 'b']);
  });

  it('does not change the input array', () => {
    const words = [word('b', '2026-01-02T00:00:00Z'), word('a', '2026-01-01T00:00:00Z')];
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

    LS.placeBuildLetter('a');
    LS.placeBuildLetter('b');
    expect(document.querySelector('[data-action="build-check"]').disabled).toBe(false);
    LS.checkBuildAnswer();

    expect(document.querySelector('.build-feedback--correct')).toBeTruthy();
    expect(document.querySelector('.card-translation').textContent).toContain('ab');
    expect(document.querySelector('.difficulty-buttons')).toBeTruthy();
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
