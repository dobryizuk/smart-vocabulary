// ============================================================================
// APP STATE - Centralized global state container
// ============================================================================

(function initAppState(global) {
  const initialState = {
    currentLearningWord: null,
    learningSession: [],
    sessionStats: { correct: 0, total: 0, streak: 0 },
    currentDictionaryData: null,
  };

  const AppState = global.AppState || { ...initialState };

  function defineAlias(propName) {
    if (Object.prototype.hasOwnProperty.call(global, propName)) return;
    Object.defineProperty(global, propName, {
      configurable: true,
      enumerable: true,
      get() {
        return AppState[propName];
      },
      set(value) {
        AppState[propName] = value;
      },
    });
  }

  // Expose AppState
  global.AppState = AppState;
  // Mirror on globalThis for test environments
  try { globalThis.AppState = AppState; } catch { /* noop */ }

  // Backward-compatible aliases
  ['currentLearningWord', 'learningSession', 'sessionStats', 'currentDictionaryData'].forEach(defineAlias);
})(window);


