// ============================================================================
// UNIFIED COMPONENT TEMPLATES
// ============================================================================

/**
 * Creates a unified word card component
 * @param {Object} word - Word object with english, russian, phonetic, etc.
 * @param {string} variant - 'compact', 'learning', or 'default'
 * @param {Array} actions - Array of action button objects
 * @param {boolean} showProgress - Whether to show progress component
 * @returns {string} HTML string for the word card
 */
function createWordCard(word, variant = 'default', actions = [], showProgress = false, expandable = false) {
    const userProgress = window.DataManager?.userProgress || {};
    const baseProgress = userProgress[word.id] || { correctCount: 0, totalAttempts: 0, lastSeen: null };
    const uniqueId = `word-card-${word.id}`;
    
    // Create extended progress with all metadata fields
    const nextReview = word.nextReview ? new Date(word.nextReview) : null;
    const isReady = !nextReview || isNaN(nextReview.getTime()) || nextReview <= new Date();
    const reviewText = nextReview && !isNaN(nextReview.getTime()) ? 
        (isReady ? 'Ready for review' : `Review: ${nextReview.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })}`) :
        'New word';
        
    const progress = {
        ...baseProgress,
        repetitions: word.repetition || 0,
        reviewStatus: reviewText,
        isReady: isReady,
        addedDate: new Date(word.createdAt || word.addedDate)
    };
    
    // Use the same progress calculation as in learning tab (based on easeFactor)
    const progressPercentage = window.SpacedRepetition?.calculateLearningProgress?.(word.easeFactor || 1.3) || 0;
    
    // Determine card classes based on variant
    const cardClasses = ['word-card'];
    const headerClasses = ['word-card__header'];
    const englishClasses = ['word-card__english'];
    const russianClasses = ['word-card__russian'];
    const actionsClasses = ['word-card__actions'];
    
    if (variant === 'compact') {
        cardClasses.push('word-card--compact');
        headerClasses.push('word-card__header--compact');
        actionsClasses.push('word-card__actions--compact');
    } else if (variant === 'learning') {
        cardClasses.push('word-card--learning');
        englishClasses.push('word-card__english--learning');
        russianClasses.push('word-card__russian--learning');
    }
    
    if (expandable) {
        cardClasses.push('word-card--expandable');
    }
    
    // Build actions HTML (with event stopping for expandable cards)
    const actionsHtml = actions.map(action => {
        const clickHandler = expandable ? 
            `event.stopPropagation(); ${action.onclick}` : 
            action.onclick;
        
        return `<button class="action-btn action-btn--${action.type}" onclick="${clickHandler}" title="${action.title || ''}">
            ${action.icon}
        </button>`;
    }).join('');
    
    // Build progress component if requested
    const progressHtml = showProgress ? createProgressComponent(progressPercentage, variant === 'compact' ? 'inline' : 'default', '') : '';
    
    // Create metadata and details
    const metadata = createWordMetadata(word, progress);
    const detailSections = createWordDetailSections(word, variant);
    
    // Expandable content (details + metadata)
    const expandableContent = expandable && (metadata || detailSections) ? `
        <div class="word-card__expandable-content">
            ${detailSections}
            ${metadata}
        </div>
    ` : '';
    
    // Toggle button for expandable cards
    const toggleButton = expandable && (metadata || detailSections) ? `
        <div class="word-card__toggle" onclick="toggleWordCard('${uniqueId}')" title="Show/hide details">
            ⌄
        </div>
    ` : '';
    
    return `
        <div class="${cardClasses.join(' ')}" id="${uniqueId}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div class="${headerClasses.join(' ')}" style="flex: 1;">
                    <div class="${englishClasses.join(' ')}">
                        ${word.english}
                        ${word.phonetic ? `<span class="word-card__phonetic">${word.phonetic}</span>` : ''}
                    </div>
                    ${variant !== 'learning' ? `<div class="${russianClasses.join(' ')}">${word.russian}</div>` : ''}
                </div>
                ${actionsHtml ? `<div class="${actionsClasses.join(' ')}">${actionsHtml}</div>` : ''}
            </div>
            ${progressHtml}
            ${!expandable && variant !== 'compact' && variant !== 'learning' && word.definition ? `<div class="word-card__definition">${word.definition}</div>` : ''}
            ${!expandable && variant !== 'compact' && variant !== 'learning' && word.examples ? `<div class="word-card__examples">${word.examples}</div>` : ''}
            ${expandableContent}
            ${toggleButton}
        </div>
    `;
}

/**
 * Creates a progress component
 * @param {number} percentage - Progress percentage (0-100)
 * @param {string} variant - 'default', 'inline', or 'compact'
 * @param {string} label - Optional label for the progress
 * @returns {string} HTML string for the progress component
 */
function createProgressComponent(percentage, variant = 'default', label = 'Learning Progress') {
    const componentClasses = ['progress-component'];
    const barClasses = ['progress-component__bar'];
    const percentageClasses = ['progress-component__percentage'];
    
    if (variant === 'inline') {
        componentClasses.push('progress-component--inline');
    }
    if (variant === 'compact') {
        barClasses.push('progress-component__bar--compact');
        percentageClasses.push('progress-component__percentage--compact');
    }
    
    const isCompact = variant === 'compact';
    const barHeight = isCompact ? '6px' : '8px';
    
    const headerHtml = label ? `
        <div class="progress-component__header">
            <span class="progress-component__label">${label}</span>
            <span class="${percentageClasses.join(' ')}">${percentage}%</span>
        </div>
    ` : `
        <div class="progress-component__header">
            <span class="${percentageClasses.join(' ')}">${percentage}%</span>
        </div>
    `;

    return `
        <div class="${componentClasses.join(' ')}">
            ${headerHtml}
            <div class="${barClasses.join(' ')}" style="height: ${barHeight}; width: 100%; background: #d1d3d4; border-radius: 4px; overflow: hidden; border: 1px solid #adb5bd; box-sizing: border-box; margin-top: 4px; display: block;">
                <div class="progress-component__fill" style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #ff3b30 0%, #ff9500 30%, #34c759 70%, #007aff 100%); border-radius: 3px; transition: width 0.3s ease; min-width: 1px; display: block; position: relative;"></div>
            </div>
        </div>
    `;
}

/**
 * Creates status badge component
 * @param {number} percentage - Progress percentage to determine status
 * @returns {string} HTML string for status badge
 */
function createStatusBadge(percentage) {
    let status = 'new';
    let statusText = 'New';
    
    if (percentage >= 75) {
        status = 'mastered';
        statusText = 'Mastered';
    } else if (percentage >= 50) {
        status = 'familiar';
        statusText = 'Familiar';
    } else if (percentage > 0) {
        status = 'learning';
        statusText = 'Learning';
    }
    
    return `<span class="status-badge status-badge--${status}">${statusText}</span>`;
}

/**
 * Creates word detail sections (definition, synonyms, examples)
 * @param {Object} word - Word object with definition, synonyms, examples
 * @param {string} variant - 'learning', 'compact', or 'default'
 * @returns {string} HTML string for detail sections
 */
function createWordDetailSections(word, variant = 'default') {
    let sectionsHtml = '';
    const isLearning = variant === 'learning';

    const baseClass = (type) => `detail-block detail-block--${type}${isLearning ? ' detail-block--learning' : ''}`;
    const title = (text) => `<div class="detail-title">${text}</div>`;
    const wrap = (type, content) => `<div class="${baseClass(type)}">${content}</div>`;

    // Definition
    if (word.definition) {
        sectionsHtml += wrap('definition', [
            title(isLearning ? 'Definition' : '📖 Definition'),
            `<div class="detail-text">${word.definition}</div>`
        ].join(''));
    }

    // Synonyms with chips
    if (word.synonyms && word.synonyms.length > 0) {
        const synonymChips = word.synonyms.map(synonym => 
            `<span class="synonym-chip">${synonym}</span>`
        ).join('');
        
        sectionsHtml += wrap('synonyms', [
            title('Synonyms'),
            `<div class="detail-text">${synonymChips}</div>`
        ].join(''));
    }

    // Examples
    if (word.examples && word.examples.length > 0) {
        const examplesHtml = word.examples
            .slice(0, isLearning ? 2 : word.examples.length)
            .map(example => {
                const text = typeof example === 'string' ? example : example.text || example.toString();
                return isLearning
                    ? `<div class="detail-text" style="font-size: 0.85em; font-style: italic; margin-bottom: 4px;">"${text}"</div>`
                    : `• ${text}`;
            }).join(isLearning ? '' : '<br>');

        sectionsHtml += wrap('examples', [
            title('💡 Examples'),
            `<div class="detail-text">${examplesHtml}</div>`
        ].join(''));
    }

    // Next review section removed - now handled in metadata at the bottom

    return sectionsHtml;
}

/**
 * Creates translation block component for learning screen
 * @param {Object} word - Word object
 * @param {string} variant - Component variant ('learning', 'default')
 * @returns {string} HTML string for translation block
 */
function createTranslationBlock(word, variant = 'learning') {
    if (!word.russian) return '';
    
    const isCompact = variant === 'learning';
    
    return `
        <div class="card-translation">
            <div class="section-subtitle">${isCompact ? 'Translation' : '🔤 Translation'}</div>
            <div style="font-size: 1.3em; font-weight: 700;">${word.russian}</div>
        </div>
    `;
}

/**
 * Creates complete answer content for learning screen (translation + details + metadata)
 * @param {Object} word - Word object
 * @param {Object} progress - Progress object
 * @param {string} variant - Component variant ('learning', 'default')
 * @returns {string} HTML string for complete answer content
 */
function createLearningAnswerContent(word, progress, variant = 'learning') {
    let content = '';
    
    // Add translation block
    content += createTranslationBlock(word, variant);
    
    // Add word detail sections
    content += createWordDetailSections(word, variant);
    
    // Add metadata if progress data is available
    if (progress) {
        content += createWordMetadata(word, progress);
    }
    
    return content;
}

/**
 * Creates metadata component for word cards
 * @param {Object} word - Word object
 * @param {Object} progress - Progress object
 * @returns {string} HTML string for metadata
 */
function createWordMetadata(word, progress) {
    const items = [];
    
    // Helper function to format date in European format (DD/MM/YYYY)
    const formatEuropeanDate = (date) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };
    
    // 1. Always show repetitions if available
    if (progress.repetitions !== undefined) {
        items.push({
            icon: '🔄',
            text: `${progress.repetitions} repetitions`,
            type: 'repetitions'
        });
    }
    
    // 2. Show next review if available
    if (word.nextReview) {
        const nextReviewDate = new Date(word.nextReview);
        
        // Check if date is valid
        if (!isNaN(nextReviewDate.getTime())) {
            const today = new Date();
            const isReady = nextReviewDate <= today;
            const reviewDate = formatEuropeanDate(nextReviewDate);
            
            items.push({
                icon: isReady ? '✅' : '📅',
                text: isReady ? `Ready for review (${reviewDate})` : `Next review: ${reviewDate}`,
                type: 'review'
            });
        }
    } else if (progress.reviewStatus) {
        // Fallback to progress.reviewStatus if word.nextReview is not available
        const isReady = progress.isReady;
        items.push({
            icon: isReady ? '✅' : '📅',
            text: progress.reviewStatus,
            type: 'review'
        });
    }
    
    // 3. Show added date if available
    if (progress.addedDate) {
        const addedDate = progress.addedDate instanceof Date ? 
            progress.addedDate : 
            new Date(progress.addedDate);
        
        // Check if date is valid
        if (!isNaN(addedDate.getTime())) {
            const formattedDate = formatEuropeanDate(addedDate);
            items.push({
                icon: '📅',
                text: `Added ${formattedDate}`,
                type: 'added'
            });
        }
    }
    
    // Show accuracy if available (optional, not in the main 3)
    if (progress.totalAttempts > 0) {
        items.push({
            icon: '📊',
            text: `${progress.correctCount}/${progress.totalAttempts} correct`,
            type: 'accuracy'
        });
    }
    
    // Show last seen if available (optional, not in the main 3)
    if (progress.lastSeen && progress.totalAttempts > 0) {
        const daysAgo = Math.floor((Date.now() - new Date(progress.lastSeen)) / (1000 * 60 * 60 * 24));
        items.push({
            icon: '⏰',
            text: daysAgo === 0 ? 'Today' : `${daysAgo} days ago`,
            type: 'lastSeen'
        });
    }
    
    if (items.length === 0) return '';
    
    const chipsHtml = items.map((item, _index) => {
        let chipClass = 'metadata-chip';
        
        // Apply different colors based on content type
        if (item.type === 'repetitions') {
            chipClass += ' metadata-chip--repetitions';
        } else if (item.type === 'review' || item.type === 'lastSeen') {
            chipClass += ' metadata-chip--review';
        } else if (item.type === 'added') {
            chipClass += ' metadata-chip--added';
        } else if (item.type === 'accuracy') {
            chipClass += ' metadata-chip--accuracy';
        }
        
        return `<span class="${chipClass}">${item.icon} ${item.text}</span>`;
    }).join('');
    
    return `<div class="word-metadata">${chipsHtml}</div>`;
}

/**
 * Creates difficulty buttons component
 * @param {string} variant - Optional variant for styling
 * @returns {string} HTML string for difficulty buttons
 */
function createDifficultyButtons(_variant = 'default') {
    const buttonsHtml = `
        <div class="difficulty-buttons" style="margin-top: 20px;">
            <button class="difficulty-btn difficulty-btn--hard" onclick="markDifficulty('hard')">
                <div class="difficulty-emoji">😰</div>
                <div>Hard</div>
            </button>
            <button class="difficulty-btn difficulty-btn--medium" onclick="markDifficulty('medium')">
                <div class="difficulty-emoji">🤔</div>
                <div>Medium</div>
            </button>
            <button class="difficulty-btn difficulty-btn--easy" onclick="markDifficulty('easy')">
                <div class="difficulty-emoji">😊</div>
                <div>OK</div>
            </button>
            <button class="difficulty-btn difficulty-btn--perfect" onclick="markDifficulty('perfect')">
                <div class="difficulty-emoji">🎯</div>
                <div>Easy</div>
            </button>
        </div>
    `;
    
    return buttonsHtml;
}

function showDeleteConfirmation(word, onConfirm) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; 
        top: 0; left: 0; right: 0; bottom: 0; 
        background: rgba(0,0,0,0.5); 
        z-index: 1000; 
        display: flex; 
        align-items: center; 
        justify-content: center;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white; 
        border-radius: 12px; 
        padding: 24px; 
        margin: 20px; 
        max-width: 300px; 
        text-align: center;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    `;
    
    dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #e53e3e;">🗑️ Delete Word</h3>
        <p style="margin: 0 0 20px 0; color: #333;">
            Delete "<strong>${word.english}</strong>"?<br>
            <small style="color: #666;">This action cannot be undone.</small>
        </p>
        <div style="display: flex; gap: 12px;">
            <button id="cancelDelete" style="
                flex: 1; padding: 12px; border: 1px solid #ccc; 
                background: white; border-radius: 8px; cursor: pointer;
            ">Cancel</button>
            <button id="confirmDelete" style="
                flex: 1; padding: 12px; border: none; 
                background: #e53e3e; color: white; border-radius: 8px; cursor: pointer;
            ">Delete</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Handle buttons
    document.getElementById('cancelDelete').onclick = () => {
        console.log('🗑️ Deletion cancelled by user');
        document.body.removeChild(overlay);
    };
    
    document.getElementById('confirmDelete').onclick = () => {
        document.body.removeChild(overlay);
        onConfirm();
    };
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            console.log('🗑️ Deletion cancelled by user');
            document.body.removeChild(overlay);
        }
    };
}

/**
 * Creates an empty state component
 * @param {string} title - The title/heading
 * @param {string} message - The description message
 * @param {Array} buttons - Array of button objects with {text, onclick, type, style}
 * @returns {string} HTML string for empty state
 */
function createEmptyState(title, message, buttons = []) {
    const buttonsHtml = buttons.map(button => {
        const buttonClass = `btn btn-${button.type || 'primary'}`;
        const style = button.style ? ` style="${button.style}"` : '';
        return `<button class="${buttonClass}" onclick="${button.onclick}"${style}>${button.text}</button>`;
    }).join('');
    
    const buttonsContainer = buttons.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
            ${buttonsHtml}
        </div>
    ` : '';
    
    return `
        <div class="empty-state">
            <h3>${title}</h3>
            <p>${message}</p>
            ${buttonsContainer}
        </div>
    `;
}

/**
 * Creates a session progress component
 * @param {number} currentIndex - Current word index (1-based)
 * @param {number} totalWords - Total number of words in session
 * @returns {string} HTML string for session progress
 */
function createSessionProgress(currentIndex, totalWords) {
    return `
        <div class="session-progress">
            ${currentIndex} of ${totalWords} words
        </div>
    `;
}

/**
 * Creates a button group component
 * @param {Array} buttons - Array of button objects with {text, onclick, type, disabled, id}
 * @param {string} justify - CSS justify-content value (default: 'center')
 * @returns {string} HTML string for button group
 */
function createButtonGroup(buttons, justify = 'center') {
    const buttonsHtml = buttons.map(button => {
        const buttonClass = `btn btn-${button.type || 'primary'}`;
        const disabled = button.disabled ? ' disabled' : '';
        const id = button.id ? ` id="${button.id}"` : '';
        const style = button.style ? ` style="${button.style}"` : '';
        return `<button class="${buttonClass}" onclick="${button.onclick}"${disabled}${id}${style}>${button.text}</button>`;
    }).join('');
    
    return `
        <div class="btn-group" style="justify-content: ${justify};">
            ${buttonsHtml}
        </div>
    `;
}

/**
 * Creates a single button component
 * @param {string} text - Button text
 * @param {string} onclick - Click handler
 * @param {string} type - Button type (primary, secondary, success, warning, danger)
 * @param {boolean} disabled - Whether button is disabled
 * @param {string} id - Button ID
 * @param {string} style - Additional CSS styles
 * @param {string} className - Additional CSS classes
 * @param {string} testId - data-testid attribute
 * @returns {string} HTML string for button
 */
function createButton(text, onclick, type = 'primary', disabled = false, id = '', style = '', className = '', testId = '') {
    const buttonClass = `btn btn-${type}${className ? ' ' + className : ''}`;
    const disabledAttr = disabled ? ' disabled' : '';
    const idAttr = id ? ` id="${id}"` : '';
    const styleAttr = style ? ` style="${style}"` : '';
    const testIdAttr = testId ? ` data-testid="${testId}"` : '';
    
    return `<button class="${buttonClass}" onclick="${onclick}"${disabledAttr}${idAttr}${styleAttr}${testIdAttr}>${text}</button>`;
}

/**
 * Creates a flex container with common patterns
 * @param {string} content - HTML content
 * @param {string} direction - flex-direction (row, column)
 * @param {string} justify - justify-content
 * @param {string} align - align-items
 * @param {string} gap - gap between items
 * @param {string} style - additional styles
 * @returns {string} HTML string for flex container
 */
function createFlexContainer(content, direction = 'row', justify = 'flex-start', align = 'stretch', gap = '0', style = '') {
    const flexStyle = `display: flex; flex-direction: ${direction}; justify-content: ${justify}; align-items: ${align}; gap: ${gap};${style ? ' ' + style : ''}`;
    return `<div style="${flexStyle}">${content}</div>`;
}

/**
 * Creates a styled container with common patterns
 * @param {string} content - HTML content
 * @param {string} background - background color
 * @param {string} padding - padding
 * @param {string} borderRadius - border radius
 * @param {string} margin - margin
 * @param {string} style - additional styles
 * @returns {string} HTML string for styled container
 */
function createStyledContainer(content, background = '', padding = '', borderRadius = '', margin = '', style = '') {
    const containerStyle = `${background ? 'background: ' + background + ';' : ''}${padding ? 'padding: ' + padding + ';' : ''}${borderRadius ? 'border-radius: ' + borderRadius + ';' : ''}${margin ? 'margin: ' + margin + ';' : ''}${style ? ' ' + style : ''}`;
    return `<div style="${containerStyle}">${content}</div>`;
}

/**
 * Creates an info box with common styling
 * @param {string} content - HTML content
 * @param {string} variant - info, success, warning, error
 * @param {string} style - additional styles
 * @returns {string} HTML string for info box
 */
function createInfoBox(content, variant = 'info', style = '') {
    const variants = {
        info: { bg: '#e8f5e8', border: '#2e7d32' },
        success: { bg: '#f0fff4', border: '#38a169' },
        warning: { bg: '#fffbf0', border: '#d69e2e' },
        error: { bg: '#fff5f5', border: '#e53e3e' }
    };
    
    const colors = variants[variant] || variants.info;
    const boxStyle = `background: ${colors.bg}; padding: 15px; border-radius: 8px; border-left: 3px solid ${colors.border};${style ? ' ' + style : ''}`;
    
    return `<div style="${boxStyle}">${content}</div>`;
}

/**
 * Creates small text with common styling
 * @param {string} text - Text content
 * @param {string} color - Text color (default: #666)
 * @param {string} fontSize - Font size (default: 0.8em)
 * @param {string} style - additional styles
 * @returns {string} HTML string for small text
 */
function createSmallText(text, color = '#666', fontSize = '0.8em', style = '') {
    const textStyle = `font-size: ${fontSize}; color: ${color};${style ? ' ' + style : ''}`;
    return `<div style="${textStyle}">${text}</div>`;
}

// Export functions
/**
 * Toggle the expand/collapse state of a word card
 * @param {string} cardId - The ID of the word card to toggle
 */
function toggleWordCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const isExpanded = card.classList.contains('word-card--expanded');
    
    if (isExpanded) {
        card.classList.remove('word-card--expanded');
    } else {
        card.classList.add('word-card--expanded');
    }
    
    // Optional: scroll card into view when expanding
    if (!isExpanded) {
        setTimeout(() => {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 200);
    }
}

window.UIComponents = {
    createWordCard,
    createProgressComponent,
    createStatusBadge,
    createWordDetailSections,
    createTranslationBlock,
    createLearningAnswerContent,
    createWordMetadata,
    createDifficultyButtons,
    showDeleteConfirmation,
    toggleWordCard,
    createEmptyState,
    createSessionProgress,
    createButtonGroup,
    createButton,
    createFlexContainer,
    createStyledContainer,
    createInfoBox,
    createSmallText
};

// Make individual functions globally available for backwards compatibility
window.createWordCard = createWordCard;
window.createProgressComponent = createProgressComponent;
window.createStatusBadge = createStatusBadge;
window.createWordDetailSections = createWordDetailSections;
window.createTranslationBlock = createTranslationBlock;
window.createLearningAnswerContent = createLearningAnswerContent;
window.createWordMetadata = createWordMetadata;
window.createDifficultyButtons = createDifficultyButtons;
window.createEmptyState = createEmptyState;
window.createSessionProgress = createSessionProgress;
window.createButtonGroup = createButtonGroup;
window.createButton = createButton;
window.createFlexContainer = createFlexContainer;
window.createStyledContainer = createStyledContainer;
window.createInfoBox = createInfoBox;
window.createSmallText = createSmallText;
window.showDeleteConfirmation = showDeleteConfirmation;
window.toggleWordCard = toggleWordCard;