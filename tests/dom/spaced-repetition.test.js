import { describe, it, expect, beforeEach } from 'vitest';

// Mock DOM environment
beforeEach(() => {
  global.window = global;
  global.DataManager = {
    vocabulary: [],
    userProgress: {}
  };
});

// Load spaced repetition code
const fs = require('fs');
const path = require('path');
const spacedRepetitionCode = fs.readFileSync(path.join(__dirname, '../../js/spaced-repetition.js'), 'utf8');
/* eslint-disable sonarjs/code-eval */
eval(spacedRepetitionCode);
/* eslint-enable sonarjs/code-eval */

// Make SpacedRepetition available globally for tests
const SpacedRepetition = window.SpacedRepetition;

describe('Spaced Repetition Algorithm', () => {
  describe('calculateNextReview', () => {
    it('should handle new words (repetition = 0)', () => {
      const result = SpacedRepetition.calculateNextReview('medium', 0, 1.3);
      
      expect(result.repetition).toBe(1);
      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBeGreaterThan(1.3);
    });

    it('should handle first repetition (repetition = 1)', () => {
      const result = SpacedRepetition.calculateNextReview('easy', 1, 1.3);
      
      expect(result.repetition).toBe(2);
      expect(result.interval).toBe(6);
      expect(result.easeFactor).toBeGreaterThan(1.3);
    });

    it('should reset interval to 1 day for hard answers', () => {
      const result = SpacedRepetition.calculateNextReview('hard', 2, 1.45);
      
      expect(result.repetition).toBe(3);
      // Hard answers reset interval to 1 day regardless of base interval
      expect(result.interval).toBe(1);
      // easeFactor should decrease
      expect(result.easeFactor).toBeLessThan(1.45);
    });

    it('should slightly reduce interval for medium answers', () => {
      const result = SpacedRepetition.calculateNextReview('medium', 2, 1.45);
      
      expect(result.repetition).toBe(3);
      // Base interval: 2 * 1.45 = 2.9 ≈ 3, then reduced by 10% = 2.7 ≈ 3
      expect(result.interval).toBe(3);
      // easeFactor should increase slightly
      expect(result.easeFactor).toBeGreaterThan(1.45);
    });

    it('should maintain interval for easy answers', () => {
      const result = SpacedRepetition.calculateNextReview('easy', 2, 1.45);
      
      expect(result.repetition).toBe(3);
      // Base interval: 2 * 1.45 = 2.9 ≈ 3, no change
      expect(result.interval).toBe(3);
      // easeFactor should increase
      expect(result.easeFactor).toBeGreaterThan(1.45);
    });

    it('should increase interval for perfect answers', () => {
      const result = SpacedRepetition.calculateNextReview('perfect', 2, 1.45);
      
      expect(result.repetition).toBe(3);
      // Base interval: 2 * 1.45 = 2.9 ≈ 3, then increased by 20% = 3.6 ≈ 4
      expect(result.interval).toBe(4);
      // easeFactor should increase significantly
      expect(result.easeFactor).toBeGreaterThan(1.45);
    });

    it('should not let easeFactor go below minimum', () => {
      const result = SpacedRepetition.calculateNextReview('hard', 2, 1.3);
      
      expect(result.interval).toBe(1); // Should reset to 1 day
      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('should not let easeFactor exceed maximum', () => {
      const result = SpacedRepetition.calculateNextReview('perfect', 2, 3.4);
      
      expect(result.easeFactor).toBeLessThanOrEqual(3.5);
    });

    it('should always reset interval to 1 day for hard answers regardless of repetition', () => {
      // Test with different repetition counts
      const result1 = SpacedRepetition.calculateNextReview('hard', 1, 1.3);
      const result2 = SpacedRepetition.calculateNextReview('hard', 5, 2.0);
      const result3 = SpacedRepetition.calculateNextReview('hard', 10, 3.0);
      
      expect(result1.interval).toBe(1);
      expect(result2.interval).toBe(1);
      expect(result3.interval).toBe(1);
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
