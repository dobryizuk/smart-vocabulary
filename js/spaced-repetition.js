// ============================================================================
// SPACED REPETITION ALGORITHM
// ============================================================================

class SpacedRepetition {
    static calculateNextReview(difficulty, repetition = 0, easeFactor = 1.3) {
        let interval;
        
        if (repetition === 0) {
            interval = 1;
        } else if (repetition === 1) {
            interval = 6;
        } else {
            interval = Math.round(repetition * easeFactor);
        }

        console.log(`📊 Spaced Repetition Debug:`);
        console.log(`   Word repetition: ${repetition}`);
        console.log(`   Initial easeFactor: ${easeFactor}`);
        console.log(`   Base interval: ${interval} days`);
        console.log(`   User difficulty: ${difficulty}`);

        // Adjust based on difficulty - more sensitive to user performance
        switch(difficulty) {
            case 'hard':
                // If user finds it hard, reset interval to 1 day and decrease ease factor
                easeFactor = Math.max(1.3, easeFactor - 0.15); // Decrease ease factor
                interval = 1; // Reset to 1 day - user will see this word tomorrow
                break;
            case 'medium':
                easeFactor = Math.min(3.5, easeFactor + 0.05); // Small progress increase
                interval = Math.round(interval * 0.9); // Slight reduction
                break;
            case 'easy':
                easeFactor = Math.min(3.5, easeFactor + 0.15); // Good progress increase
                break;
            case 'perfect':
                easeFactor = Math.min(3.5, easeFactor + 0.25); // Best progress increase
                interval = Math.round(interval * 1.2);
                break;
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);

        console.log(`   Final interval: ${interval} days`);
        console.log(`   Final easeFactor: ${easeFactor}`);
        console.log(`   Next review: ${nextReview.toISOString()}`);

        return {
            nextReview: nextReview.toISOString(),
            interval,
            easeFactor,
            repetition: repetition + 1
        };
    }

    static getWordsForReview() {
        const vocabulary = window.DataManager?.vocabulary || [];
        const now = new Date();
        console.log('🔍 Checking words for review at:', now.toISOString());
        
        const wordsForReview = vocabulary.filter(word => {
            // Always include new words (no nextReview date)
            if (!word.nextReview) {
                console.log('✅ New word ready:', word.original);
                return true;
            }
            
            const reviewDate = new Date(word.nextReview);
            const isReady = reviewDate <= now;
            
            console.log(`${isReady ? '✅' : '⏰'} ${word.original}: review ${reviewDate.toISOString()} vs now ${now.toISOString()}`);
            
            return isReady;
        });
        
        console.log(`📚 Found ${wordsForReview.length} words ready for review out of ${vocabulary.length} total`);
        return wordsForReview;
    }

    static calculateLearningProgress(easeFactor) {
        const MIN_EASE = 1.3;
        const MAX_EASE = 3.5;
        
        if (easeFactor <= MIN_EASE) return 0;
        if (easeFactor >= MAX_EASE) return 100;
        
        return Math.round(((easeFactor - MIN_EASE) / (MAX_EASE - MIN_EASE)) * 100);
    }
}

// Export the class and make individual functions globally available
window.SpacedRepetition = SpacedRepetition;
window.calculateLearningProgress = SpacedRepetition.calculateLearningProgress;