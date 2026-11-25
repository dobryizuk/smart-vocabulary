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

const ratingButtons = () => [...document.querySelectorAll('.difficulty-btn')];
const enabledRatings = () => ratingButtons().filter((button) => !button.disabled).map((button) => button.dataset.difficulty);

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

  it('leaves every rating free in recognition', () => {
    const word = setupWord();
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];

    LS.showLearningCard();
    LS.showTranslation();

    expect(ratingButtons().map((button) => button.textContent)).toEqual(['Hard', 'Medium', 'OK', 'Easy']);
    expect(enabledRatings()).toEqual(['hard', 'medium', 'easy', 'perfect']);
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
  const hint = () => document.getElementById('reverseTranslationInput').value;
  const hintBtn = () => document.getElementById('hintReverseButton');

  it('reveals one more letter per press, up to three', () => {
    startExercise('Devolve');
    expect(hint()).toBe('');
    expect(hintBtn().textContent).toBe('Hint');
    expect(hintBtn().className).toBe('btn btn--secondary');

    LS.showHintForReverse();
    expect(hint()).toBe('D');
    expect(hintBtn().textContent).toBe('Hint (2 left)');

    LS.showHintForReverse();
    expect(hint()).toBe('De');

    LS.showHintForReverse();
    expect(hint()).toBe('Dev');
    expect(hintBtn().disabled).toBe(true);

    LS.showHintForReverse();
    expect(hint()).toBe('Dev');
  });

  it('replaces what was typed and puts the caret at the end', () => {
    startExercise('Devolve');
    const input = document.getElementById('reverseTranslationInput');
    input.value = 'xyz';
    LS.showHintForReverse();

    expect(input.value).toBe('D');
    expect(input.selectionStart).toBe(1);
    expect(document.activeElement).toBe(input);
    expect(document.getElementById('reverseHint')).toBeNull();
  });

  it('starts from zero hints for the next word', () => {
    startExercise('Devolve');
    LS.showHintForReverse();
    startExercise('Forthright');

    expect(hint()).toBe('');
    LS.showHintForReverse();
    expect(hint()).toBe('F');
  });

  it('never reveals the whole answer of a short word', () => {
    startExercise('go');
    LS.showHintForReverse();
    LS.showHintForReverse();

    expect(hint()).toBe('g');
    expect(hintBtn().disabled).toBe(true);
  });

  it('disables the hint for a one-letter answer', () => {
    startExercise('I');
    expect(hintBtn().disabled).toBe(true);
    LS.showHintForReverse();
    expect(hint()).toBe('');
  });

  it('leaves no hint behind once the answer is shown', () => {
    startExercise('Devolve');
    LS.showHintForReverse();
    LS.showAnswerForReverse();
    expect(document.getElementById('reverseActions').style.display).toBe('none');
    expect(document.getElementById('reverseHint')).toBeNull();
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
  it('is exact only for an equal answer, ignoring case, punctuation and extra spaces', () => {
    expect(LS.getTypingVerdict('hello', 'hello')).toBe('exact');
    expect(LS.getTypingVerdict('  Hello! ', 'hello')).toBe('exact');
    expect(LS.getTypingVerdict('break  the ice', 'Break the ice.')).toBe('exact');
  });

  it('allows no typo in answers shorter than 4 characters', () => {
    expect(LS.getTypingVerdict('cut', 'cat')).toBe('wrong');
    expect(LS.getTypingVerdict('ca', 'cat')).toBe('wrong');
    expect(LS.getTypingVerdict('teh', 'the')).toBe('wrong');
  });

  it('counts two swapped neighbouring letters as one typo', () => {
    expect(LS.getTypingVerdict('decisoin', 'decision')).toBe('close');
    expect(LS.getTypingVerdict('hlelo', 'hello')).toBe('close');
    expect(LS.getTypingVerdict('dceisoin', 'decision')).toBe('wrong');
    expect(LS.getTypingVerdict('rseponsibilitise', 'responsibilities')).toBe('close');
    expect(LS.getTypingVerdict('rseponsibiltiise', 'responsibilities')).toBe('wrong');
  });

  it('does not count letters swapped across a gap as one typo', () => {
    expect(LS.getTypingVerdict('dicesion', 'decision')).toBe('wrong');
  });

  it('allows one edit from 4 to 15 characters', () => {
    expect(LS.getTypingVerdict('bost', 'boat')).toBe('close');
    expect(LS.getTypingVerdict('bat', 'boat')).toBe('close');
    expect(LS.getTypingVerdict('bist', 'boat')).toBe('wrong');
    expect('personification').toHaveLength(15);
    expect(LS.getTypingVerdict('personificatian', 'personification')).toBe('close');
    expect(LS.getTypingVerdict('persanificatian', 'personification')).toBe('wrong');
  });

  it('counts one wrong, missing or extra letter in decision as a typo', () => {
    expect(LS.getTypingVerdict('decison', 'decision')).toBe('close');
    expect(LS.getTypingVerdict('decisiom', 'decision')).toBe('close');
    expect(LS.getTypingVerdict('decission', 'decision')).toBe('close');
  });

  it('allows two edits from 16 characters', () => {
    expect('responsibilities').toHaveLength(16);
    expect(LS.getTypingVerdict('responsibilitias', 'responsibilities')).toBe('close');
    expect(LS.getTypingVerdict('respansibilitias', 'responsibilities')).toBe('close');
    expect(LS.getTypingVerdict('respansibilitiaz', 'responsibilities')).toBe('wrong');
  });

  it('measures the length of the correct answer after normalisation', () => {
    expect(LS.getTypingVerdict('cats', 'Cat!')).toBe('wrong');
    expect(LS.getTypingVerdict('a lott', 'a lot')).toBe('close');
  });

  it('calls a long near miss close, not exact', () => {
    const answer = 'a'.repeat(300);
    expect(LS.getTypingVerdict(`${answer}b`, answer)).toBe('close');
  });

  it('fails an unrelated answer', () => {
    expect(LS.getTypingVerdict('xyz', 'hello')).toBe('wrong');
    expect(LS.getTypingVerdict('world', 'hello')).toBe('wrong');
  });
});

describe('Strongest rating a checked answer allows', () => {
  it('allows every rating for an exact writing answer without hints', () => {
    expect(LS.getMaxRating('exact', 0)).toBe('perfect');
  });

  it('allows up to Medium for an exact writing answer after a hint', () => {
    expect(LS.getMaxRating('exact', 1)).toBe('medium');
    expect(LS.getMaxRating('exact', 3)).toBe('medium');
  });

  it('allows up to Medium for a typo, with or without hints', () => {
    expect(LS.getMaxRating('close', 0)).toBe('medium');
    expect(LS.getMaxRating('close', 2)).toBe('medium');
  });

  it('allows only Hard for a wrong answer or a give-up, whatever the hints', () => {
    expect(LS.getMaxRating('wrong', 0)).toBe('hard');
    expect(LS.getMaxRating('wrong', 3)).toBe('hard');
  });

  it('allows every rating for right tiles and only Hard for wrong ones', () => {
    expect(LS.getMaxRating('exact')).toBe('perfect');
    expect(LS.getMaxRating('wrong')).toBe('hard');
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
  const diff = () => document.getElementById('typingDiff');
  const answerShown = () => document.querySelector('.difficulty-buttons') !== null;

  it('renders Hint and Check side by side with Show Answer below and no inline handlers', () => {
    start('hello');
    const actions = document.getElementById('reverseActions');
    expect([...actions.children].map((button) => button.textContent)).toEqual(['Hint', 'Check', 'Show Answer']);
    expect(document.getElementById('checkReverseButton').dataset.action).toBe('check-reverse');
    expect(document.querySelector('#learningContent [onclick], #learningContent [oninput], #learningContent [onkeypress]')).toBeNull();
    expect(input().dataset.enterButton).toBe('checkReverseButton');
  });

  it('tints the field for a right answer and tells screen readers, without a visible verdict', () => {
    start('hello');
    input().value = 'Hello';
    LS.checkReverseTranslation();

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
    LS.checkReverseTranslation();

    expect(feedback().textContent).toBe('Almost \u2014 check the spelling');
    expect(input().classList.contains('typing-input--warn')).toBe(true);
    expect(diff().innerHTML).toBe('abcdefghi<ins class="typing-diff__missing">j</ins>');
  });

  it('tints the field danger for a wrong answer, marks it and still reveals the answer', () => {
    start('hello');
    input().value = 'world';
    LS.checkReverseTranslation();

    expect(feedback().textContent).toBe('Not quite');
    expect(input().classList.contains('typing-input--danger')).toBe(true);
    expect(diff().querySelector('.typing-diff__wrong')).not.toBeNull();
    expect(answerShown()).toBe(true);
  });

  it('shows the typed answer with struck wrong letters and the missing ones inserted', () => {
    start('inconceivable');
    input().value = 'inconcievable';
    LS.checkReverseTranslation();

    expect(diff().innerHTML).toBe('inconc<del class="typing-diff__wrong">ie</del><ins class="typing-diff__missing">ei</ins>vable');
  });

  it('escapes what was typed in the difference', () => {
    start('hello');
    input().value = '<b>';
    LS.checkReverseTranslation();

    expect(diff().querySelector('b')).toBeNull();
    expect(diff().textContent).toContain('<b>');
  });

  it('gives the correct answer a speaker button', () => {
    start('hello');
    input().value = 'hello';
    LS.checkReverseTranslation();

    const speak = document.querySelector('.card-translation [data-action="speak-word"]');
    expect(speak.dataset.arg).toBe('hello');
  });

  it('does nothing for an empty answer', () => {
    start('hello');
    input().value = '   ';
    LS.checkReverseTranslation();

    expect(feedback().textContent).toBe('');
    expect(diff().innerHTML).toBe('');
    expect(answerShown()).toBe(false);
    expect(input().disabled).toBe(false);
  });

  it('reveals the answer without a verdict when Show Answer is used', () => {
    start('hello');
    input().value = 'hello';
    LS.showAnswerForReverse();

    expect(feedback().textContent).toBe('');
    expect(diff().innerHTML).toBe('');
    expect(input().className).not.toMatch(/typing-input--/);
    expect(answerShown()).toBe(true);
  });

  it('allows only Hard after a wrong answer, keeping the other ratings visible but disabled', () => {
    start('hello');
    input().value = 'world';
    LS.checkReverseTranslation();

    expect(ratingButtons()).toHaveLength(4);
    expect(enabledRatings()).toEqual(['hard']);
    expect(ratingButtons().filter((button) => button.hasAttribute('disabled'))).toHaveLength(3);
  });

  it('allows every rating after an exact answer without hints', () => {
    start('hello');
    input().value = 'Hello';
    LS.checkReverseTranslation();

    expect(enabledRatings()).toEqual(['hard', 'medium', 'easy', 'perfect']);
  });

  it('allows up to Medium after a typo', () => {
    start('hello');
    input().value = 'helo';
    LS.checkReverseTranslation();

    expect(input().classList.contains('typing-input--warn')).toBe(true);
    expect(enabledRatings()).toEqual(['hard', 'medium']);
  });

  it('allows up to Medium after an exact answer finished from a hint', () => {
    start('hello');
    LS.showHintForReverse();
    input().value = 'hello';
    LS.checkReverseTranslation();

    expect(input().classList.contains('typing-input--success')).toBe(true);
    expect(enabledRatings()).toEqual(['hard', 'medium']);
  });

  it('allows only Hard after Show Answer, even when the field holds the right answer', () => {
    start('hello');
    input().value = 'hello';
    LS.showAnswerForReverse();

    expect(enabledRatings()).toEqual(['hard']);
  });

  it('tints a 3-letter answer with one wrong letter as wrong and allows only Hard', () => {
    start('cat');
    input().value = 'cut';
    LS.checkReverseTranslation();

    expect(input().classList.contains('typing-input--danger')).toBe(true);
    expect(feedback().textContent).toBe('Not quite');
    expect(enabledRatings()).toEqual(['hard']);
  });
});

describe('Answer difference', () => {
  const diff = (input, answer) => LS.diffAnswer(input, answer);

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
    window.SV.AppState.sessionStats = { correct: 2, total: 3, streak: 1 };
    const closeButton = document.querySelector('[data-testid="session-progress"] [data-action="stop-session"]');
    expect(closeButton.getAttribute('aria-label')).toBe('End session');

    LS.stopLearningSession();

    expect(window.SV.Today.showOverview).toHaveBeenCalledTimes(1);
    expect(document.getElementById('learningContent').textContent).not.toContain('Session Complete');
    expect(window.SV.AppState.learningSession).toEqual([]);
    expect(window.SV.AppState.sessionTotal).toBe(0);
    expect(window.SV.AppState.currentLearningWord).toBeNull();
    expect(window.SV.AppState.sessionStats).toEqual({ correct: 0, total: 0, streak: 0 });
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

    LS.placeBuildLetter('a');
    LS.placeBuildLetter('b');
    expect(document.querySelector('[data-action="build-check"]').disabled).toBe(false);
    LS.checkBuildAnswer();

    expect(document.querySelector('.build-feedback--correct')).toBeTruthy();
    expect(document.querySelector('.card-translation').textContent).toContain('ab');
    expect(enabledRatings()).toEqual(['hard', 'medium', 'easy', 'perfect']);
  });

  it('allows only Hard after checking a wrongly built word', () => {
    const word = {
      original: 'ab', translation: 't', repetition: 2, easeFactor: 2.5,
      reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }]
    };
    window.SV.AppState.currentLearningWord = word;
    window.SV.AppState.learningSession = [word];
    LS.showLearningCard();

    LS.placeBuildLetter('b');
    LS.placeBuildLetter('a');
    LS.checkBuildAnswer();

    expect(document.querySelector('.build-feedback--wrong')).toBeTruthy();
    expect(ratingButtons()).toHaveLength(4);
    expect(enabledRatings()).toEqual(['hard']);
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
    expect(LS.getWordPrompt(withDefinition, false)).toEqual({ label: 'Translation', main: 'привет', detail: 'A greeting.' });
  });

  it('uses the definition alone when the setting is on', () => {
    expect(LS.getWordPrompt(withDefinition, true)).toEqual({ label: 'Definition', main: 'A greeting.', detail: '' });
  });

  it('falls back to the translation for a word without a definition', () => {
    expect(LS.getWordPrompt(withoutDefinition, true)).toEqual({ label: 'Translation', main: 'привет', detail: undefined });
    expect(LS.getWordPrompt({ ...withoutDefinition, definition: '' }, true).main).toBe('привет');
    expect(LS.getWordPrompt(withoutDefinition, false).main).toBe('привет');
  });
});
