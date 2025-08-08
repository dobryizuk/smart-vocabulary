import { describe, it, expect, beforeEach } from 'vitest';

// Mock DOM environment
beforeEach(() => {
  global.window = global;
  global.DataManager = {
    vocabulary: [],
    userProgress: {}
  };
  global.SpacedRepetition = {
    calculateLearningProgress: (easeFactor) => Math.round(((easeFactor - 1.3) / (3.5 - 1.3)) * 100)
  };
  
  // Mock DOM elements
  document.body.innerHTML = '<div id="learningContent"></div>';
});

// Load learning session code
const fs = require('fs');
const path = require('path');
const learningSessionCode = fs.readFileSync(path.join(__dirname, '../../js/learning-session.js'), 'utf8');
eval(learningSessionCode);

describe('Learning Session - Reverse Translation Logic', () => {
  describe('isEligibleForReverseTranslation', () => {
    it('should not allow reverse translation for new words', () => {
      const newWord = { repetition: 0 };
      expect(window.isEligibleForReverseTranslation(newWord)).toBe(false);
    });

    it('should not allow reverse translation for words with last answer "hard"', () => {
      const hardWord = {
        repetition: 2,
        reviewHistory: [
          { difficulty: 'medium', date: '2025-08-01' },
          { difficulty: 'hard', date: '2025-08-02' }
        ]
      };
      expect(window.isEligibleForReverseTranslation(hardWord)).toBe(false);
    });

    it('should allow reverse translation for words with repetition > 0 and no hard answer', () => {
      const eligibleWord = {
        repetition: 2,
        reviewHistory: [
          { difficulty: 'medium', date: '2025-08-01' },
          { difficulty: 'easy', date: '2025-08-02' }
        ]
      };
      expect(window.isEligibleForReverseTranslation(eligibleWord)).toBe(true);
    });

    it('should allow reverse translation for words with repetition > 0 and no review history', () => {
      const eligibleWord = { repetition: 1 };
      expect(window.isEligibleForReverseTranslation(eligibleWord)).toBe(true);
    });
  });

  describe('determineExerciseType', () => {
    beforeEach(() => {
      // Mock learningSession
      global.learningSession = [];
    });

    it('should return regular for new words', () => {
      const newWord = { repetition: 0 };
      expect(window.determineExerciseType(newWord)).toBe('regular');
    });

    it('should return regular for words not eligible for reverse translation', () => {
      const hardWord = {
        repetition: 2,
        reviewHistory: [{ difficulty: 'hard' }]
      };
      expect(window.determineExerciseType(hardWord)).toBe('regular');
    });

    it('should return reverse for eligible words that have not shown reverse yet', () => {
      const eligibleWord = {
        repetition: 2,
        sessionExerciseTypes: ['regular']
      };
      expect(window.determineExerciseType(eligibleWord)).toBe('reverse');
    });

    it('should return regular for eligible words that have not shown regular yet', () => {
      const eligibleWord = {
        repetition: 2,
        sessionExerciseTypes: ['reverse']
      };
      expect(window.determineExerciseType(eligibleWord)).toBe('regular');
    });

    it('should return regular for eligible words that have shown both types', () => {
      const eligibleWord = {
        repetition: 2,
        sessionExerciseTypes: ['regular', 'reverse']
      };
      expect(window.determineExerciseType(eligibleWord)).toBe('regular');
    });

    it('should alternate for single word in session', () => {
      const word = {
        repetition: 2,
        lastExerciseType: 'reverse',
        lastExerciseDate: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
      };
      
      // Set both global and window learningSession
      global.learningSession = [word];
      window.learningSession = [word];
      
      // Also set the global variable that the function uses
      if (typeof learningSession !== 'undefined') {
        learningSession = [word];
      }
      
      expect(window.determineExerciseType(word)).toBe('regular');
    });
  });

  describe('canShowReverseExercise', () => {
    it('should allow reverse exercise if no last exercise date', () => {
      const word = {};
      expect(window.canShowReverseExercise(word)).toBe(true);
    });

    it('should allow reverse exercise if different exercise type', () => {
      const word = {
        lastExerciseDate: new Date().toISOString(),
        lastExerciseType: 'regular'
      };
      expect(window.canShowReverseExercise(word)).toBe(true);
    });

    it('should allow reverse exercise if enough time has passed', () => {
      const word = {
        lastExerciseDate: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        lastExerciseType: 'reverse'
      };
      expect(window.canShowReverseExercise(word)).toBe(true);
    });

    it('should not allow reverse exercise if same type and not enough time passed', () => {
      const word = {
        lastExerciseDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        lastExerciseType: 'reverse'
      };
      expect(window.canShowReverseExercise(word)).toBe(false);
    });
  });
});
