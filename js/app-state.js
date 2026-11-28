// ============================================================================
// APP STATE - Centralized global state container (SV namespace)
// ============================================================================

(function initAppState(global) {
  global.SV = global.SV || {};

  const initialState = {
    currentLearningWord: null,
    learningSession: [],
    sessionTotal: 0,
    // Words rated Hard whose one practice repeat is queued at the end of this session
    repeatedWords: new Set(),
    // streak: passed answers in a row now; bestStreak: the longest run of the session
    sessionStats: { correct: 0, total: 0, streak: 0, bestStreak: 0 },
    currentDictionaryData: null,
    editingWordId: null,
    reverseHintCount: 0,
    buildState: null,
    wordListFilter: 'all',
  };

  const AppState = global.SV.AppState || { ...initialState };

  // Expose only under SV namespace
  global.SV.AppState = AppState;
})(typeof window !== 'undefined' ? window : globalThis);

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    get AppState() {
      const g = (typeof window !== 'undefined' ? window : globalThis);
      g.SV = g.SV || {};
      return g.SV.AppState;
    }
  };
}

