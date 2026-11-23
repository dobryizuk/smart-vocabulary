// ============================================================================
// APP STATE - Centralized global state container (SV namespace)
// ============================================================================

(function initAppState(global) {
  global.SV = global.SV || {};

  const initialState = {
    currentLearningWord: null,
    learningSession: [],
    sessionTotal: 0,
    sessionStats: { correct: 0, total: 0, streak: 0 },
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

