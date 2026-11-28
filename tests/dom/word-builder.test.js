import { describe, it, expect } from 'vitest';

const WordBuilder = require('../../js/word-builder.js');

const place = (state, ...letters) => letters.reduce(WordBuilder.placeLetter, state);

describe('Word builder tiles', () => {
  it('makes one tile per unique letter with the number of occurrences', () => {
    const { tiles } = WordBuilder.createBuildState('Hello');
    expect(tiles).toEqual([
      { letter: 'h', total: 1 },
      { letter: 'e', total: 1 },
      { letter: 'l', total: 2 },
      { letter: 'o', total: 1 }
    ]);
  });

  it('counts upper and lower case as the same letter', () => {
    const { tiles } = WordBuilder.createBuildState('AaA');
    expect(tiles).toEqual([{ letter: 'a', total: 3 }]);
  });

  it('orders tiles with the given shuffle', () => {
    const state = WordBuilder.createBuildState('abc', (items) => [...items].reverse());
    expect(state.tiles.map(({ letter }) => letter)).toEqual(['c', 'b', 'a']);
  });

  it('keeps space, hyphen and apostrophe as fixed slots without tiles', () => {
    const state = WordBuilder.createBuildState("rock-n'roll now");
    const fixed = state.slots.filter(({ fixed: isFixed }) => isFixed).map(({ char }) => char);
    expect(fixed).toEqual(['-', "'", ' ']);
    expect(state.tiles.map(({ letter }) => letter).join('')).toBe('rocknlw');
    expect(WordBuilder.countLettersToBuild(state)).toBe(12);
  });

  it('shows fixed characters pre-filled and highlights the next empty slot', () => {
    const state = place(WordBuilder.createBuildState('a-b'), 'a');
    expect(WordBuilder.getSlotView(state)).toEqual([[
      { char: 'a', fixed: false, active: false, right: true },
      { char: '-', fixed: true, active: false, right: null },
      { char: '', fixed: false, active: true, right: null }
    ]]);
  });

  it('groups the slots of a phrase by word and leaves the gaps out', () => {
    const state = WordBuilder.createBuildState('let me  out');
    const words = WordBuilder.getSlotView(state);
    expect(words.map((word) => word.length)).toEqual([3, 2, 3]);
    expect(words.flat().some(({ char }) => /\s/.test(char))).toBe(false);
    expect(WordBuilder.getBuiltText(place(state, 'l', 'e', 't', 'm', 'e', 'o', 'u', 't'))).toBe('let me  out');
  });

  it('keeps a hyphen and an apostrophe inside their word', () => {
    const state = WordBuilder.createBuildState("rock-n'roll now");
    const words = WordBuilder.getSlotView(state);
    expect(words.map((word) => word.map(({ char }) => char || '_').join(''))).toEqual(["____-_'____", '___']);
    expect(words[0].filter(({ fixed }) => fixed).map(({ char }) => char)).toEqual(['-', "'"]);
  });
});

describe('Word builder letter checking', () => {
  const rights = (state) => WordBuilder.getSlotView(state).flat().map(({ right }) => right);

  it('marks a placed letter right or wrong against its position, ignoring case', () => {
    const state = place(WordBuilder.createBuildState('Cat'), 'c', 't');
    expect(WordBuilder.isLetterRight(state, 0)).toBe(true);
    expect(WordBuilder.isLetterRight(state, 1)).toBe(false);
    expect(rights(state)).toEqual([true, false, null]);
  });

  it('is not right for a letter that is not placed yet', () => {
    const state = WordBuilder.createBuildState('cat');
    expect(WordBuilder.isLetterRight(state, 0)).toBe(false);
    expect(WordBuilder.isLetterRight(state, 5)).toBe(false);
  });

  it('matches letters by position and skips hyphens and apostrophes', () => {
    const state = place(WordBuilder.createBuildState("it's a-b"), 'i', 't', 'a');
    expect(rights(state)).toEqual([true, true, null, false, null, null, null]);
  });

  it('clears the mark of a wrong letter once it is undone', () => {
    let state = place(WordBuilder.createBuildState('let me'), 'l', 'm');
    expect(rights(state)).toEqual([true, false, null, null, null]);
    state = WordBuilder.undoLetter(state);
    expect(rights(state)).toEqual([true, null, null, null, null]);
    expect(WordBuilder.remainingCount(state, 'm')).toBe(1);
    state = place(state, 'e', 't');
    expect(rights(state)).toEqual([true, true, true, null, null]);
  });
});

describe('Word builder placing and undo', () => {
  it('decrements the remaining count and refuses a letter with nothing left', () => {
    let state = WordBuilder.createBuildState('lol');
    state = place(state, 'l');
    expect(WordBuilder.remainingCount(state, 'l')).toBe(1);
    state = place(state, 'l', 'l');
    expect(WordBuilder.remainingCount(state, 'l')).toBe(0);
    expect(state.entered).toEqual(['l', 'l']);
  });

  it('refuses letters that are not in the word and letters after the last slot', () => {
    const state = place(WordBuilder.createBuildState('ab'), 'z');
    expect(state.entered).toEqual([]);
    const full = place(WordBuilder.createBuildState('ab'), 'a', 'b', 'a');
    expect(full.entered).toEqual(['a', 'b']);
  });

  it('undo removes the last placed letter and returns it to its tile', () => {
    let state = place(WordBuilder.createBuildState('ab'), 'a', 'b');
    state = WordBuilder.undoLetter(state);
    expect(state.entered).toEqual(['a']);
    expect(WordBuilder.remainingCount(state, 'b')).toBe(1);
  });

  it('undo on an empty answer changes nothing', () => {
    const state = WordBuilder.undoLetter(WordBuilder.createBuildState('ab'));
    expect(state.entered).toEqual([]);
  });

  it('does not mutate the previous state', () => {
    const before = WordBuilder.createBuildState('ab');
    WordBuilder.placeLetter(before, 'a');
    expect(before.entered).toEqual([]);
  });
});

describe('Word builder completion and correctness', () => {
  it('is complete only when every slot is filled', () => {
    const state = WordBuilder.createBuildState('a b');
    expect(WordBuilder.isComplete(state)).toBe(false);
    expect(WordBuilder.isComplete(place(state, 'a'))).toBe(false);
    expect(WordBuilder.isComplete(place(state, 'a', 'b'))).toBe(true);
  });

  it('builds the text with fixed characters in place', () => {
    expect(WordBuilder.getBuiltText(place(WordBuilder.createBuildState("it's"), 'i', 't', 's'))).toBe("it's");
  });

  it('is correct ignoring case', () => {
    const state = place(WordBuilder.createBuildState('Paris'), 'p', 'a', 'r', 'i', 's');
    expect(WordBuilder.isCorrect(state, 'Paris')).toBe(true);
    expect(WordBuilder.checkBuild(state, 'Paris').correct).toBe(true);
  });

  it('is wrong for another order of the same letters', () => {
    const state = place(WordBuilder.createBuildState('ab'), 'b', 'a');
    expect(WordBuilder.isCorrect(state, 'ab')).toBe(false);
    expect(WordBuilder.checkBuild(state, 'ab').correct).toBe(false);
  });

  it('is not correct while incomplete', () => {
    const state = place(WordBuilder.createBuildState('ab'), 'a');
    expect(WordBuilder.isCorrect(state, 'ab')).toBe(false);
  });
});

describe('Word builder mistakes', () => {
  it('starts with no mistakes and right letters add none, fixed characters skipped', () => {
    expect(WordBuilder.createBuildState("it's").mistakes).toBe(0);
    expect(place(WordBuilder.createBuildState("it's"), 'i', 't', 's').mistakes).toBe(0);
    expect(place(WordBuilder.createBuildState('Cat'), 'c', 'a', 't').mistakes).toBe(0);
  });

  it('counts every letter placed where the answer has another one', () => {
    expect(place(WordBuilder.createBuildState('cat'), 'c', 't').mistakes).toBe(1);
    expect(place(WordBuilder.createBuildState('cat'), 't', 'a', 'c').mistakes).toBe(2);
  });

  it('keeps a mistake after the wrong letter is undone and counts it again when repeated', () => {
    let state = place(WordBuilder.createBuildState('hello'), 'o');
    state = WordBuilder.undoLetter(state);
    expect(state.mistakes).toBe(1);
    state = place(state, 'o');
    expect(state.mistakes).toBe(2);
    state = place(WordBuilder.undoLetter(state), 'h', 'e', 'l', 'l', 'o');
    expect(state.mistakes).toBe(2);
    expect(WordBuilder.isCorrect(state, 'hello')).toBe(true);
  });

  it('does not count a refused letter', () => {
    expect(place(WordBuilder.createBuildState('ab'), 'z').mistakes).toBe(0);
    expect(place(WordBuilder.createBuildState('ab'), 'a', 'b', 'a').mistakes).toBe(0);
    expect(place(WordBuilder.createBuildState('aab'), 'b', 'b').mistakes).toBe(1);
  });
});
