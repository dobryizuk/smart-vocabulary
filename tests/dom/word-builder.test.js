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
    expect(WordBuilder.getSlotView(state)).toEqual([
      { char: 'a', fixed: false, active: false },
      { char: '-', fixed: true, active: false },
      { char: '', fixed: false, active: true }
    ]);
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
