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

// Load UI components and learning session code
const fs = require('fs');
const path = require('path');
const uiComponentsCode = fs.readFileSync(path.join(__dirname, '../../js/ui-components.js'), 'utf8');
/* eslint-disable sonarjs/code-eval */
eval(uiComponentsCode);
/* eslint-enable sonarjs/code-eval */
const learningSessionCode = fs.readFileSync(path.join(__dirname, '../../js/learning-session.js'), 'utf8');
/* eslint-disable sonarjs/code-eval */
eval(learningSessionCode);
/* eslint-enable sonarjs/code-eval */

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
      
  // Set AppState and legacy globals
  window.AppState = window.AppState || { currentLearningWord: null, learningSession: [], sessionStats: { correct: 0, total: 0, streak: 0 } };
  window.AppState.learningSession = [word];
  global.learningSession = [word];
  window.learningSession = [word];
      
  // Ensure the global variable used inside the module is available
  global.learningSession = [word];
      
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

describe('Learning Answer Screen Layout', () => {
  function setupWord() {
    return {
      id: 'w1',
      english: 'apple',
      russian: 'яблоко',
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
    window.AppState.currentLearningWord = word;
    window.AppState.learningSession = [word];

    // Render learning card then show answer
    window.showLearningCard();
    window.showTranslation();

    const root = document.getElementById('cardTranslation');
    const order = indexesInParent(root, [
      '.card-translation',
      '.difficulty-buttons',
      '.detail-block--definition',
      '.detail-block--examples',
      '.detail-block--synonyms'
    ]);
    // Ensure strictly increasing order
    expect(order).toEqual([...order].sort((a, b) => a - b));

    // Progress should exist and container should be last in learningContent
    const progressContainer = document.getElementById('sessionProgressContainer');
    expect(progressContainer.querySelector('.session-progress')).toBeTruthy();
    const learningContent = document.getElementById('learningContent');
    expect(learningContent.lastElementChild.id).toBe('sessionProgressContainer');
  });

  it('renders correct order for reverse translation after Show Answer', () => {
    const word = setupWord();
    window.AppState.currentLearningWord = word;
    window.AppState.learningSession = [word];

    // Render reverse exercise and then show answer
    window.showReverseTranslationCard();
    window.showAnswerForReverse();

    const mainEl = document.getElementById('learningMain') || document.getElementById('learningContent');
    const firstSpecific = mainEl.querySelector('.card-translation');
    const buttons = mainEl.querySelector('.difficulty-buttons');
    const def = mainEl.querySelector('.detail-block--definition');
    const ex = mainEl.querySelector('.detail-block--examples');
    const syn = mainEl.querySelector('.detail-block--synonyms');

    expect(firstSpecific && buttons && def && ex && syn).toBeTruthy();
    const children = Array.from(mainEl.children);
    const idx = (el) => children.indexOf(el);
    const indices = [idx(firstSpecific), idx(buttons), idx(def), idx(ex), idx(syn)];
    expect(indices).toEqual([...indices].sort((a, b) => a - b));

    const progressContainer = document.getElementById('sessionProgressContainer');
    expect(progressContainer.querySelector('.session-progress')).toBeTruthy();
    const learningContent = document.getElementById('learningContent');
    expect(learningContent.lastElementChild.id).toBe('sessionProgressContainer');
  });
});
