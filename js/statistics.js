// ============================================================================
// STATISTICS AND ANALYTICS
// ============================================================================

function updateStats() {
    const vocabulary = window.DataManager?.vocabulary || [];
    const totalWords = vocabulary.length;
    
    // Calculate progress-based statistics
    const wellKnownWords = vocabulary.filter(word => {
        const progress = window.SpacedRepetition?.calculateLearningProgress?.(word.easeFactor || 1.3) || 0;
        return progress >= 70; // Green progress bar (well known)
    }).length;
    
    const inProgressWords = vocabulary.filter(word => {
        const progress = window.SpacedRepetition?.calculateLearningProgress?.(word.easeFactor || 1.3) || 0;
        return progress >= 40 && progress < 70; // Yellow/Orange progress bar (in progress)
    }).length;
    
    const difficultWords = vocabulary.filter(word => {
        const progress = window.SpacedRepetition?.calculateLearningProgress?.(word.easeFactor || 1.3) || 0;
        return progress < 40; // Red progress bar (difficult)
    }).length;
    
    const reviewWords = window.SpacedRepetition?.getWordsForReview?.()?.length || 0;
    const streak = Math.max(...vocabulary.map(word => 
        word.reviewHistory?.filter((review, index, arr) => 
            index === arr.length - 1 || 
            arr[index + 1] && (review.difficulty === 'easy' || review.difficulty === 'perfect')
        )?.length || 0
    ), 0);

    // Update DOM elements
    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    updateElement('totalWordsCount', totalWords);
    updateElement('learnedWordsCount', wellKnownWords);
    updateElement('inProgressWordsCount', inProgressWords);
    updateElement('difficultWordsCount', difficultWords);
    updateElement('reviewWordsCount', reviewWords);
    updateElement('streakCount', streak);
    
    // Debug info - log word review status
    console.log('📊 Stats Update:');
    console.log(`Total words: ${totalWords}`);
    console.log(`Well known (75%+): ${wellKnownWords}`);
    console.log(`In progress (50-75%): ${inProgressWords}`);
    console.log(`Difficult (<50%): ${difficultWords}`);
    console.log(`Words ready for review: ${reviewWords}`);
    
    if (reviewWords === 0 && totalWords > 0) {
        console.log('🔍 Debug: No words for review. Checking word details:');
        vocabulary.slice(0, 5).forEach(word => {
            const nextReview = word.nextReview ? new Date(word.nextReview) : null;
            // const now = new Date(); // Unused variable
            console.log(`${word.english}: next review ${nextReview ? nextReview.toLocaleString() : 'never'} (repetition: ${word.repetition})`);
        });
    }
}

// Show error when database fails to load
function showDatabaseError() {
    const errorMessage = `
        <div style="text-align: center; padding: 40px; color: #dc3545;">
            <h3>❌ Database Loading Error</h3>
            <p>Could not load the embedded word database. This should not happen in normal use.</p>
            <p>Please try refreshing the app or contact support if the issue persists.</p>
            <button class="btn btn-primary" onclick="location.reload()">🔄 Retry</button>
        </div>
    `;
    
    // Show error in all relevant places
    const wordList = document.getElementById('wordList');
    const learningContent = document.getElementById('learningContent');
    if (wordList) wordList.innerHTML = errorMessage;
    if (learningContent) learningContent.innerHTML = errorMessage;
}

// Export functions
window.Statistics = {
    updateStats,
    showDatabaseError
};

// Make functions globally available for compatibility
window.updateStats = updateStats;
window.showDatabaseError = showDatabaseError;