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

describe('Learning Session - Reverse Translation Logic', () => {
  describe('isEligibleForReverseTranslation', () => {
    it('should not allow reverse translation for new words', () => {
      const newWord = { repetition: 0 };
      expect(LS.isEligibleForReverseTranslation(newWord)).toBe(false);
    });

    it('should not allow reverse translation for words with last answer "hard"', () => {
      const hardWord = {
        repetition: 2,
        reviewHistory: [
          { difficulty: 'medium', date: '2025-08-01' },
          { difficulty: 'hard', date: '2025-08-02' }
        ]
      };
      expect(LS.isEligibleForReverseTranslation(hardWord)).toBe(false);
    });

    it('should allow reverse translation for words with repetition > 0 and no hard answer', () => {
      const eligibleWord = {
        repetition: 2,
        reviewHistory: [
          { difficulty: 'medium', date: '2025-08-01' },
          { difficulty: 'easy', date: '2025-08-02' }
        ]
      };
      expect(LS.isEligibleForReverseTranslation(eligibleWord)).toBe(true);
    });

    it('should allow reverse translation for words with repetition > 0 and no review history', () => {
      const eligibleWord = { repetition: 1 };
      expect(LS.isEligibleForReverseTranslation(eligibleWord)).toBe(true);
    });
  });

  describe('determineExerciseType', () => {
    beforeEach(() => {
      // Mock learningSession
      global.learningSession = [];
    });

    it('should return regular for new words', () => {
      const newWord = { repetition: 0 };
      expect(LS.determineExerciseType(newWord)).toBe('regular');
    });

    it('should return regular for words not eligible for reverse translation', () => {
      const hardWord = {
        repetition: 2,
        reviewHistory: [{ difficulty: 'hard' }]
      };
      expect(LS.determineExerciseType(hardWord)).toBe('regular');
    });

    it('should return reverse for eligible words that have not shown reverse yet', () => {
      const eligibleWord = {
        repetition: 2,
        sessionExerciseTypes: ['regular']
      };
      expect(LS.determineExerciseType(eligibleWord)).toBe('reverse');
    });

    it('should return regular for eligible words that have not shown regular yet', () => {
      const eligibleWord = {
        repetition: 2,
        sessionExerciseTypes: ['reverse']
      };
      expect(LS.determineExerciseType(eligibleWord)).toBe('regular');
    });

    it('should return regular for eligible words that have shown both types', () => {
      const eligibleWord = {
        repetition: 2,
        sessionExerciseTypes: ['regular', 'reverse']
      };
      expect(LS.determineExerciseType(eligibleWord)).toBe('regular');
    });

    it('should alternate for single word in session', () => {
      const word = {
        repetition: 2,
        lastExerciseType: 'reverse',
        lastExerciseDate: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
      };
      
  // Set AppState under SV
  window.SV = window.SV || {};
  window.SV.AppState = window.SV.AppState || { currentLearningWord: null, learningSession: [], sessionStats: { correct: 0, total: 0, streak: 0 } };
  window.SV.AppState.learningSession = [word];
  global.learningSession = [word];
  window.learningSession = [word];
      
  // Ensure the global variable used inside the module is available
  global.learningSession = [word];
      
      expect(LS.determineExerciseType(word)).toBe('regular');
    });
  });

  describe('canShowReverseExercise', () => {
    it('should allow reverse exercise if no last exercise date', () => {
      const word = {};
      expect(LS.canShowReverseExercise(word)).toBe(true);
    });

    it('should allow reverse exercise if different exercise type', () => {
      const word = {
        lastExerciseDate: new Date().toISOString(),
        lastExerciseType: 'regular'
      };
      expect(LS.canShowReverseExercise(word)).toBe(true);
    });

    it('should allow reverse exercise if enough time has passed', () => {
      const word = {
        lastExerciseDate: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        lastExerciseType: 'reverse'
      };
      expect(LS.canShowReverseExercise(word)).toBe(true);
    });

    it('should not allow reverse exercise if same type and not enough time passed', () => {
      const word = {
        lastExerciseDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        lastExerciseType: 'reverse'
      };
      expect(LS.canShowReverseExercise(word)).toBe(false);
    });
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
      '.difficulty-buttons',
      '.detail-block--definition',
      '.detail-block--examples',
      '.detail-block--synonyms'
    ]);
    // Ensure strictly increasing order
    expect(order).toEqual([...order].sort((a, b) => a - b));

    // Progress should exist and container should be last in learningContent
    const progressContainer = document.getElementById('sessionProgressContainer');
    expect(progressContainer.querySelector('[data-testid="session-progress"]')).toBeTruthy();
    const learningContent = document.getElementById('learningContent');
    expect(learningContent.lastElementChild.id).toBe('sessionProgressContainer');
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
    const def = mainEl.querySelector('.detail-block--definition');
    const ex = mainEl.querySelector('.detail-block--examples');
    const syn = mainEl.querySelector('.detail-block--synonyms');

    expect(firstSpecific && buttons && def && ex && syn).toBeTruthy();
    const children = Array.from(mainEl.children);
    const idx = (el) => children.indexOf(el);
    const indices = [idx(firstSpecific), idx(buttons), idx(def), idx(ex), idx(syn)];
    expect(indices).toEqual([...indices].sort((a, b) => a - b));

    const progressContainer = document.getElementById('sessionProgressContainer');
    expect(progressContainer.querySelector('[data-testid="session-progress"]')).toBeTruthy();
    const learningContent = document.getElementById('learningContent');
    expect(learningContent.lastElementChild.id).toBe('sessionProgressContainer');
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
    expect(hintBtn().textContent).toBe('💡 Hint');
    expect(hintBtn().className).toBe('btn btn--secondary');

    LS.showHintForReverse();
    expect(hint()).toBe('💡 D…');
    expect(hintBtn().textContent).toBe('💡 Hint (2 left)');

    LS.showHintForReverse();
    expect(hint()).toBe('💡 De…');

    LS.showHintForReverse();
    expect(hint()).toBe('💡 Dev…');
    expect(hintBtn().disabled).toBe(true);

    LS.showHintForReverse();
    expect(hint()).toBe('💡 Dev…');
  });

  it('starts from zero hints for the next word', () => {
    startExercise('Devolve');
    LS.showHintForReverse();
    startExercise('Forthright');

    expect(hint()).toBe('');
    LS.showHintForReverse();
    expect(hint()).toBe('💡 F…');
  });

  it('never reveals the whole answer of a short word', () => {
    startExercise('go');
    LS.showHintForReverse();
    LS.showHintForReverse();

    expect(hint()).toBe('💡 g…');
    expect(hintBtn().disabled).toBe(true);
  });

  it('disables the hint for a one-letter answer', () => {
    startExercise('I');
    expect(hintBtn().disabled).toBe(true);
    LS.showHintForReverse();
    expect(hint()).toBe('');
  });

  it('hides the hint button once the answer is shown', () => {
    startExercise('Devolve');
    LS.showAnswerForReverse();
    expect(hintBtn().style.display).toBe('none');
  });

  it('counts letters, not spaces, in phrases', () => {
    expect(LS.getHintPrefix('a lot', 2)).toBe('a l');
    expect(LS.getHintPrefix('  break the ice'.trim(), 3)).toBe('bre');
    expect(LS.getMaxHints('a lot')).toBe(3);
    expect(LS.getMaxHints('ox')).toBe(1);
    expect(LS.getMaxHints('')).toBe(0);
  });
});
