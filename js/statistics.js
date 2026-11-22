// ============================================================================
// STATISTICS AND ANALYTICS with DI
// ============================================================================

function createStatistics(context) {
    const ctx = context ?? {};
    const getVocabulary = ctx.getVocabulary ?? (() => []);
    const calcProgress = ctx.calculateLearningProgress ?? (() => 0);
    const getWordsForReview = ctx.getWordsForReview ?? (() => []);
    const doc = ctx.document ?? (typeof document !== 'undefined' ? document : null);
    const debugLog = ctx.debugLog ?? (() => undefined);

    function countTrailingSuccess(history) {
        if (!Array.isArray(history) || history.length === 0) return 0;
        let count = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            const diff = history[i] && history[i].difficulty;
            if (diff === 'easy' || diff === 'perfect') count++;
            else break;
        }
        return count;
    }

    function longestTrailingSuccess(vocabulary) {
        let streak = 0;
        for (let i = 0; i < vocabulary.length; i++) {
            const s = countTrailingSuccess(vocabulary[i]?.reviewHistory);
            if (s > streak) streak = s;
        }
        return streak;
    }

    function updateStats() {
        const vocabularyRaw = getVocabulary();
        const vocabulary = Array.isArray(vocabularyRaw) ? vocabularyRaw : [];
        const totalWords = vocabulary.length;

        // Single pass counters with clear thresholds per UI labels
        // Well Known: 75%+
        // In Progress: 50-75%
        // Difficult: <50%
        let wellKnownWords = 0;
        let inProgressWords = 0;
        let difficultWords = 0;

        for (let i = 0; i < vocabulary.length; i++) {
            const word = vocabulary[i];
            const ease = (word && typeof word.easeFactor === 'number') ? word.easeFactor : 1.3;
            const progress = Number(calcProgress(ease));
            const p = Number.isFinite(progress) ? progress : 0;
            if (p >= 75) wellKnownWords++;
            else if (p >= 50) inProgressWords++;
            else difficultWords++;
        }

        const reviewList = getWordsForReview();
        const reviewWords = Array.isArray(reviewList) ? reviewList.length : 0;

        const streak = longestTrailingSuccess(vocabulary);

        const updateElement = (id, value) => {
            if (!doc) return;
            const element = doc.getElementById(id);
            if (element) element.textContent = value;
        };

        updateElement('totalWordsCount', totalWords);
        updateElement('learnedWordsCount', wellKnownWords);
        updateElement('inProgressWordsCount', inProgressWords);
        updateElement('difficultWordsCount', difficultWords);
        updateElement('reviewWordsCount', reviewWords);
        updateElement('streakCount', streak);
        
        debugLog('📊 Stats Update:');
        debugLog(`Total words: ${totalWords}`);
        debugLog(`Well known (75%+): ${wellKnownWords}`);
        debugLog(`In progress (50-75%): ${inProgressWords}`);
        debugLog(`Difficult (<50%): ${difficultWords}`);
        debugLog(`Words ready for review: ${reviewWords}`);
        
        if (reviewWords === 0 && totalWords > 0) {
            logReviewDebug(vocabulary);
        }
    }

    function logReviewDebug(vocabulary) {
        debugLog('🔍 Debug: No words for review. Checking word details:');
        vocabulary.slice(0, 5).forEach(word => {
            const nextReview = word.nextReview ? new Date(word.nextReview) : null;
            debugLog(`${word.original}: next review ${nextReview ? nextReview.toLocaleString() : 'never'} (repetition: ${word.repetition})`);
        });
    }

    return { updateStats };
}

function createDefaultStatistics() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createStatistics({
        getVocabulary: () => g.SV?.DataManager?.vocabulary ?? [],
        calculateLearningProgress: (ease) => g.SV?.SpacedRepetition?.calculateLearningProgress?.(ease) ?? 0,
        getWordsForReview: () => g.SV?.SpacedRepetition?.getWordsForReview?.() ?? [],
        document: (typeof document !== 'undefined' ? document : null),
        debugLog: (...args) => g.SV?.debugLog?.(...args)
    });
}

const defaultStatistics = createDefaultStatistics();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultStatistics;
    module.exports.createStatistics = createStatistics;
}