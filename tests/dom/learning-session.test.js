import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DOM environment
beforeEach(() => {
  global.window = global;
  global.DataManager = {
    vocabulary: []
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
    const eligible = (...reviews) => LS.isEligibleForReverseTranslation({
      repetition: 3,
      reviewHistory: reviews.map(([exerciseType, difficulty]) => ({ exerciseType, difficulty, date: '2026-11-01' }))
    });

    it('blocks writing for a word that was never rated', () => {
      expect(LS.isEligibleForReverseTranslation({ repetition: 0 })).toBe(false);
      expect(LS.isEligibleForReverseTranslation({ repetition: 2, reviewHistory: [] })).toBe(false);
    });

    it('unlocks writing after recognition is rated OK or Easy', () => {
      expect(eligible(['regular', 'easy'])).toBe(true);
      expect(eligible(['regular', 'perfect'])).toBe(true);
    });

    it('keeps writing locked after recognition is rated Medium or Hard', () => {
      expect(eligible(['regular', 'medium'])).toBe(false);
      expect(eligible(['regular', 'hard'])).toBe(false);
      expect(eligible(['regular', 'easy'], ['regular', 'medium'])).toBe(false);
    });

    it('locks writing after Hard until recognition is rated OK again', () => {
      expect(eligible(['regular', 'easy'], ['regular', 'hard'])).toBe(false);
      expect(eligible(['regular', 'easy'], ['regular', 'hard'], ['regular', 'medium'])).toBe(false);
      expect(eligible(['regular', 'easy'], ['regular', 'hard'], ['regular', 'easy'])).toBe(true);
    });

    it('locks writing when Hard is chosen in the writing exercise itself', () => {
      expect(eligible(['regular', 'easy'], ['reverse', 'hard'])).toBe(false);
      expect(eligible(['regular', 'easy'], ['reverse', 'hard'], ['regular', 'easy'])).toBe(true);
    });

    it('stays unlocked after a non-Hard writing rating', () => {
      expect(eligible(['regular', 'easy'], ['reverse', 'medium'])).toBe(true);
      expect(eligible(['regular', 'perfect'], ['reverse', 'easy'])).toBe(true);
    });

    it('treats legacy reviews without exerciseType as recognition', () => {
      expect(LS.isEligibleForReverseTranslation({ repetition: 2, reviewHistory: [{ difficulty: 'easy' }] })).toBe(true);
      expect(LS.isEligibleForReverseTranslation({ repetition: 2, reviewHistory: [{ difficulty: 'medium' }] })).toBe(false);
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
        reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }],
        sessionExerciseTypes: ['regular']
      };
      expect(LS.determineExerciseType(eligibleWord)).toBe('reverse');
    });

    it('should return regular for eligible words that have not shown regular yet', () => {
      const eligibleWord = {
        repetition: 2,
        reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }],
        sessionExerciseTypes: ['reverse']
      };
      expect(LS.determineExerciseType(eligibleWord)).toBe('regular');
    });

    it('should return regular for eligible words that have shown both types', () => {
      const eligibleWord = {
        repetition: 2,
        reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }],
        sessionExerciseTypes: ['regular', 'reverse']
      };
      expect(LS.determineExerciseType(eligibleWord)).toBe('regular');
    });

    it('should alternate for single word in session', () => {
      const word = {
        repetition: 2,
        reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }],
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
  });

  it('limits a new session to the configured size', () => {
    LS.prepareLearningSession();
    expect(window.SV.AppState.learningSession).toHaveLength(10);
  });

  it('keeps the same session and current word when the tab is reopened', () => {
    LS.prepareLearningSession();
    const session = window.SV.AppState.learningSession;
    const current = window.SV.AppState.currentLearningWord;

    LS.prepareLearningSession();

    expect(window.SV.AppState.learningSession).toBe(session);
    expect(window.SV.AppState.currentLearningWord).toBe(current);
    expect(document.getElementById('learningContent').textContent).toContain(current.original);
  });

  it('leaves the session empty after it ends and builds a fresh batch next time', () => {
    LS.prepareLearningSession();
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

  it('offers reverse again in a new session to words that did both exercises in an earlier one', () => {
    const shownBothBefore = () => ({
      original: 'w', translation: 't', nextReview: null, repetition: 2, easeFactor: 2.5,
      reviewHistory: [{ difficulty: 'easy', exerciseType: 'regular' }],
      sessionExerciseTypes: ['regular', 'reverse']
    });
    window.SV.DataManager.vocabulary = [shownBothBefore(), shownBothBefore()];
    expect(LS.determineExerciseType(window.SV.DataManager.vocabulary[1])).toBe('regular');

    LS.forceStartLearning();

    const [current, next] = window.SV.AppState.learningSession;
    expect(current.currentExerciseType).toBe('reverse');
    expect(next.sessionExerciseTypes).toEqual([]);
    expect(LS.determineExerciseType(next)).toBe('reverse');
  });
});
