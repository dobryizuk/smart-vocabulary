import { describe, it, expect, beforeEach } from 'vitest';

describe('Statistics module', () => {
  let createStatistics;

  function setupStatsDOM() {
    document.body.innerHTML = `
      <div id="statsGrid">
        <span id="totalWordsCount"></span>
        <span id="learnedWordsCount"></span>
        <span id="inProgressWordsCount"></span>
        <span id="difficultWordsCount"></span>
        <span id="reviewWordsCount"></span>
        <span id="streakCount"></span>
      </div>
    `;
  }

  beforeEach(() => {
    // jsdom env
    global.window = global;
    global.document = window.document;
    setupStatsDOM();
    // fresh require each test to avoid cache side-effects
     
    const mod = require('../../js/statistics.js');
    createStatistics = mod.createStatistics;
  });

  it('does not leak a global window.Statistics', () => {
    expect(global.Statistics).toBeUndefined();
  });

  it('updates counters based on vocabulary and review readiness', () => {
    const vocabulary = [
      // progress ~ 80 (>=75) → well known
      { id: 'w1', original: 'one', easeFactor: 3.06, reviewHistory: [{ difficulty: 'easy' }, { difficulty: 'perfect' }] },
      // progress ~ 60 (50-74) → in progress
      { id: 'w2', original: 'two', easeFactor: 2.62, reviewHistory: [{ difficulty: 'hard' }, { difficulty: 'easy' }] },
      // progress ~ 30 (<50) → difficult
      { id: 'w3', original: 'three', easeFactor: 1.96, reviewHistory: [{ difficulty: 'hard' }] }
    ];

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // two words ready for review: w1 new (no nextReview) and w2 past date; w3 future (not ready)
    vocabulary[0].nextReview = undefined;
    vocabulary[1].nextReview = oneDayAgo;
    vocabulary[2].nextReview = tomorrow;

    const calcProgress = (ease) => {
      const MIN_EASE = 1.3; const MAX_EASE = 3.5;
      if (ease <= MIN_EASE) return 0;
      if (ease >= MAX_EASE) return 100;
      return Math.round(((ease - MIN_EASE) / (MAX_EASE - MIN_EASE)) * 100);
    };

    const getWordsForReview = () => vocabulary.filter(w => !w.nextReview || new Date(w.nextReview) <= new Date());

    const stats = createStatistics({
      getVocabulary: () => vocabulary,
      calculateLearningProgress: calcProgress,
      getWordsForReview,
      document,
      debugLog: () => undefined
    });

    stats.updateStats();

    const text = (id) => document.getElementById(id).textContent;

    expect(text('totalWordsCount')).toBe('3');
    expect(text('learnedWordsCount')).toBe('1');
    expect(text('inProgressWordsCount')).toBe('1');
    expect(text('difficultWordsCount')).toBe('1');
    expect(text('reviewWordsCount')).toBe('2');
  });

  it('calculates streak as max trailing easy/perfect per word', () => {
    const vocabulary = [
      { id: 'a', original: 'a', easeFactor: 3.06, reviewHistory: [
        { difficulty: 'hard' }, { difficulty: 'easy' }, { difficulty: 'perfect' }
      ]}, // trailing successes = 2
      { id: 'b', original: 'b', easeFactor: 2.0, reviewHistory: [
        { difficulty: 'easy' }, { difficulty: 'easy' }, { difficulty: 'hard' }
      ]}, // trailing successes = 0
      { id: 'c', original: 'c', easeFactor: 1.5, reviewHistory: [
        { difficulty: 'easy' }, { difficulty: 'perfect' }, { difficulty: 'easy' }
      ]}  // trailing successes = 3
    ];

    const stats = createStatistics({
      getVocabulary: () => vocabulary,
      calculateLearningProgress: () => 0,
      getWordsForReview: () => [],
      document,
      debugLog: () => undefined
    });

    stats.updateStats();
    expect(document.getElementById('streakCount').textContent).toBe('3');
  });
});


