import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DOM environment
beforeEach(() => {
  global.window = global;
  global.DataManager = {
    vocabulary: []
  };
});

// Load spaced repetition module via CommonJS export
const SpacedRepetition = require('../../js/spaced-repetition.js');

describe('Spaced Repetition Algorithm', () => {
  describe('getPreviousInterval', () => {
    const history = (date) => [{ date, difficulty: 'easy' }];

    it('is 0 without nextReview or without history', () => {
      expect(SpacedRepetition.getPreviousInterval({})).toBe(0);
      expect(SpacedRepetition.getPreviousInterval({ nextReview: '2026-11-10T10:00:00.000Z', reviewHistory: [] })).toBe(0);
      expect(SpacedRepetition.getPreviousInterval({ reviewHistory: history('2026-11-01T10:00:00.000Z') })).toBe(0);
    });

    it('measures whole days from the last review to nextReview', () => {
      const word = {
        nextReview: '2026-11-10T10:00:00.000Z',
        reviewHistory: [...history('2026-10-01T10:00:00.000Z'), ...history('2026-11-04T10:00:00.000Z')]
      };
      expect(SpacedRepetition.getPreviousInterval(word)).toBe(6);
    });

    it('rounds across a DST-like gap that is not a multiple of 24h', () => {
      const shortDay = { nextReview: '2026-03-29T09:00:00.000Z', reviewHistory: history('2026-03-26T10:00:00.000Z') };
      const longDay = { nextReview: '2026-11-04T11:00:00.000Z', reviewHistory: history('2026-11-01T10:00:00.000Z') };
      expect(SpacedRepetition.getPreviousInterval(shortDay)).toBe(3);
      expect(SpacedRepetition.getPreviousInterval(longDay)).toBe(3);
    });

    it('never goes negative', () => {
      const word = { nextReview: '2026-11-01T10:00:00.000Z', reviewHistory: history('2026-11-05T10:00:00.000Z') };
      expect(SpacedRepetition.getPreviousInterval(word)).toBe(0);
    });
  });

  describe('calculateNextReview', () => {
    const DAY = 24 * 60 * 60 * 1000;

    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-06-01T12:00:00.000Z') });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function newWord(easeFactor = 1.3) {
      return { easeFactor, repetition: 0, nextReview: null, reviewHistory: [] };
    }

    function answer(word, difficulty) {
      const review = SpacedRepetition.calculateNextReview(difficulty, word);
      word.reviewHistory.push({ date: new Date().toISOString(), difficulty });
      Object.assign(word, review);
      const days = SpacedRepetition.getPreviousInterval(word);
      vi.setSystemTime(Date.now() + days * DAY);
      return days;
    }

    function answerAll(word, ...difficulties) {
      return difficulties.map((difficulty) => answer(word, difficulty));
    }

    it('gives a new word 1 day for any answer', () => {
      for (const difficulty of ['hard', 'medium', 'easy', 'perfect']) {
        const word = newWord();
        expect(answer(word, difficulty)).toBe(1);
        expect(word.repetition).toBe(1);
      }
    });

    it('does not return an interval field', () => {
      expect(SpacedRepetition.calculateNextReview('easy', newWord())).not.toHaveProperty('interval');
    });

    it('schedules nextReview that many days ahead', () => {
      const word = newWord();
      const { nextReview } = SpacedRepetition.calculateNextReview('easy', word);
      expect(new Date(nextReview).getTime() - Date.now()).toBe(DAY);
    });

    it('grows intervals for easy answers in a row', () => {
      expect(answerAll(newWord(), ...Array(9).fill('easy')))
        .toEqual([1, 2, 3, 6, 12, 26, 61, 152, 180]);
    });

    it('resets to 1 day on hard and then recovers from the short interval', () => {
      const word = newWord();
      expect(answerAll(word, 'easy', 'easy', 'easy', 'hard', 'easy', 'easy', 'easy')).toEqual([1, 2, 3, 1, 2, 4, 8]);
    });

    it('never gets a word stuck at the minimum ease factor', () => {
      const word = { easeFactor: 1.3, repetition: 5, nextReview: '2026-06-02T12:00:00.000Z', reviewHistory: [{ date: '2026-06-01T12:00:00.000Z', difficulty: 'hard' }] };
      expect(answerAll(word, 'medium', 'medium', 'medium', 'medium')).toEqual([2, 3, 4, 5]);
    });

    it('caps the interval at 180 days', () => {
      const word = { easeFactor: 3.4, repetition: 9, nextReview: '2026-12-01T12:00:00.000Z', reviewHistory: [{ date: '2026-06-01T12:00:00.000Z', difficulty: 'perfect' }] };
      expect(answer(word, 'perfect')).toBe(180);
      expect(answer(word, 'perfect')).toBe(180);
    });

    it('treats a word with nextReview but empty history as new', () => {
      const word = { easeFactor: 2, repetition: 3, nextReview: '2026-07-01T12:00:00.000Z', reviewHistory: [] };
      expect(answer(word, 'perfect')).toBe(1);
      expect(word.repetition).toBe(4);
    });

    it('applies the multiplier per difficulty', () => {
      const wordAt10Days = (difficulty) => {
        const word = { easeFactor: 2, repetition: 4, nextReview: '2026-06-11T12:00:00.000Z', reviewHistory: [{ date: '2026-06-01T12:00:00.000Z', difficulty: 'easy' }] };
        return SpacedRepetition.calculateNextReview(difficulty, word);
      };
      const daysAhead = ({ nextReview }) => Math.round((new Date(nextReview) - Date.now()) / DAY);

      expect(daysAhead(wordAt10Days('medium'))).toBe(Math.round(10 * 2.05 * 0.9));
      expect(daysAhead(wordAt10Days('easy'))).toBe(Math.round(10 * 2.15));
      expect(daysAhead(wordAt10Days('perfect'))).toBe(Math.round(10 * 2.25 * 1.2));
      expect(daysAhead(wordAt10Days('hard'))).toBe(1);
    });

    it('adjusts the ease factor within 1.3 to 3.5', () => {
      const ease = (difficulty, easeFactor) => SpacedRepetition.calculateNextReview(difficulty, newWord(easeFactor)).easeFactor;

      expect(ease('hard', 2)).toBeCloseTo(1.85);
      expect(ease('medium', 2)).toBeCloseTo(2.05);
      expect(ease('easy', 2)).toBeCloseTo(2.15);
      expect(ease('perfect', 2)).toBeCloseTo(2.25);
      expect(ease('hard', 1.3)).toBe(1.3);
      expect(ease('perfect', 3.4)).toBe(3.5);
    });

    it('counts every answer in repetition', () => {
      const word = newWord();
      answerAll(word, 'hard', 'easy', 'medium');
      expect(word.repetition).toBe(3);
    });
  });

  describe('calculateLearningProgress', () => {
    it('should return 0 for minimum ease factor', () => {
      const progress = SpacedRepetition.calculateLearningProgress(1.3);
      expect(progress).toBe(0);
    });

    it('should return 100 for maximum ease factor', () => {
      const progress = SpacedRepetition.calculateLearningProgress(3.5);
      expect(progress).toBe(100);
    });

    it('should return 50 for middle ease factor', () => {
      const progress = SpacedRepetition.calculateLearningProgress(2.4);
      expect(progress).toBe(50);
    });
  });
});
