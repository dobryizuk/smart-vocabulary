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
function buildActionsHtml(actions, expandable) {
    return actions.map(action => {
        const clickHandler = expandable ? `event.stopPropagation(); ${action.onclick}` : action.onclick;
        return `<button class="action-btn action-btn--${action.type}" onclick="${clickHandler}" title="${action.title || ''}">${action.icon}</button>`;
    }).join('');
}

function computeProgressVariant(variant) {
    return variant === 'compact' ? 'inline' : 'default';
}

function computeReview(nextReview) {
    const date = nextReview ? new Date(nextReview) : null;
    const invalid = !date || isNaN(date.getTime());
    if (invalid) {
        return { isReady: true, reviewText: 'New word' };
    }
    const isReady = date <= new Date();
    if (isReady) {
        return { isReady, reviewText: 'Ready for review' };
    }
    const formatted = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return { isReady, reviewText: `Review: ${formatted}` };
}

function buildVariantClasses(variant, expandable) {
    const cardClasses = ['word-card'];
    const headerClasses = ['word-card__header'];
    const englishClasses = ['word-card__english'];
    const russianClasses = ['word-card__russian'];
    const actionsClasses = ['word-card__actions'];
    switch (variant) {
        case 'compact':
            cardClasses.push('word-card--compact');
            headerClasses.push('word-card__header--compact');
            actionsClasses.push('word-card__actions--compact');
            break;
        case 'learning':
            cardClasses.push('word-card--learning');
            englishClasses.push('word-card__english--learning');
            russianClasses.push('word-card__russian--learning');
            break;
        default:
            break;
    }
    if (expandable) cardClasses.push('word-card--expandable');
    return { cardClasses, headerClasses, englishClasses, russianClasses, actionsClasses };
}

function buildNonExpandableDetails(word, variant) {
    const showDetails = variant !== 'compact' && variant !== 'learning';
    const definitionHtml = showDetails && word.definition ? `<div class="word-card__definition">${word.definition}</div>` : '';
    const examplesHtml = showDetails && word.examples ? `<div class="word-card__examples">${word.examples}</div>` : '';
    return { definitionHtml, examplesHtml };
}

function buildToggleButtonHTML(expandable, hasExtra, uniqueId) {
    if (!(expandable && hasExtra)) return '';
    return `<div class="word-card__toggle" onclick="toggleWordCard('${uniqueId}')" title="Show/hide details">⌄</div>`;
}

function buildPhoneticHtml(word, variant) {
    if (variant === 'learning' || !word.phonetic) return '';
    return `<span class="word-card__phonetic">${word.phonetic}</span>`;
}

function buildEnglishHtml(word, englishClasses, variant) {
    const phoneticHtml = buildPhoneticHtml(word, variant);
    return `
        <div class="${englishClasses.join(' ')}">
            ${word.english}
            ${phoneticHtml}
        </div>
    `;
}

function buildRussianHtml(word, russianClasses, variant) {
    if (variant === 'learning') return '';
    return `<div class="${russianClasses.join(' ')}">${word.russian}</div>`;
}

function buildHeaderSection(word, variant, englishClasses, russianClasses, headerClasses) {
    const englishHtml = buildEnglishHtml(word, englishClasses, variant);
    const russianHtml = buildRussianHtml(word, russianClasses, variant);
    return `
        <div class="${headerClasses.join(' ')}" style="flex: 1;">
            ${englishHtml}
            ${russianHtml}
        </div>
    `;
}

function createWordCard(word, variant = 'default', actions = [], showProgress = false, expandable = false) {
    const userProgress = window.DataManager?.userProgress || {};
    const baseProgress = userProgress[word.id] || { correctCount: 0, totalAttempts: 0, lastSeen: null };
    const uniqueId = `word-card-${word.id}`;
    
    // Create extended progress with all metadata fields
    const { isReady, reviewText } = computeReview(word.nextReview);
        
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
    const { cardClasses, headerClasses, englishClasses, russianClasses, actionsClasses } = buildVariantClasses(variant, expandable);
    
    // Build actions HTML (with event stopping for expandable cards)
    const actionsHtml = buildActionsHtml(actions, expandable);
    
    // Build progress component if requested
    const progressVariant = computeProgressVariant(variant);
    const progressHtml = showProgress ? createProgressComponent(progressPercentage, progressVariant, '') : '';
    
    // Create metadata and details
    const metadata = createWordMetadata(word, progress);
    const detailSections = createWordDetailSections(word, variant);
    
    // Expandable content (details + metadata)
    const expandableContent = (expandable && (metadata || detailSections))
        ? `<div class="word-card__expandable-content">${detailSections}${metadata}</div>`
        : '';
    
    // Toggle button for expandable cards
    const toggleButton = buildToggleButtonHTML(expandable, (metadata || detailSections), uniqueId);
    
    const headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            ${buildHeaderSection(word, variant, englishClasses, russianClasses, headerClasses)}
            ${actionsHtml ? `<div class="${actionsClasses.join(' ')}">${actionsHtml}</div>` : ''}
        </div>
    `;

    const { definitionHtml, examplesHtml } = buildNonExpandableDetails(word, variant);

    return `
        <div class="${cardClasses.join(' ')}" id="${uniqueId}">
            ${headerHtml}
            ${progressHtml}
            ${definitionHtml}
            ${examplesHtml}
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
            <div class="${barClasses.join(' ')}" style="height: ${barHeight};">
                <div class="progress-component__fill" style="width: ${percentage}%;"></div>
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

// Build single detail sections with explicit order control
function createDefinitionSection(word, isLearning = false) {
    if (!word.definition) return '';
    const baseClass = `detail-block detail-block--definition${isLearning ? ' detail-block--learning' : ''}`;
    const title = `<div class="detail-title">${isLearning ? 'Definition' : '📖 Definition'}</div>`;
    return `<div class="${baseClass}">${title}<div class="detail-text">${word.definition}</div></div>`;
}

function createExamplesSection(word, isLearning = false) {
    if (!(word.examples && word.examples.length > 0)) return '';
    const baseClass = `detail-block detail-block--examples${isLearning ? ' detail-block--learning' : ''}`;
    const title = `<div class="detail-title">${isLearning ? 'Examples' : '💡 Examples'}</div>`;
    const examplesHtml = word.examples
        .slice(0, isLearning ? 2 : word.examples.length)
        .map(example => {
            const text = typeof example === 'string' ? example : example.text || example.toString();
            return isLearning
                ? `<div class="detail-text" style="font-size: 0.85em; font-style: italic; margin-bottom: 4px;">"${text}"</div>`
                : `• ${text}`;
        }).join(isLearning ? '' : '<br>');
    return `<div class="${baseClass}">${title}<div class="detail-text">${examplesHtml}</div></div>`;
}

function createSynonymsSection(word, isLearning = false) {
    if (!(word.synonyms && word.synonyms.length > 0)) return '';
    const baseClass = `detail-block detail-block--synonyms${isLearning ? ' detail-block--learning' : ''}`;
    const title = `<div class="detail-title">Synonyms</div>`;
    const synonymChips = word.synonyms.map(synonym => `<span class="synonym-chip">${synonym}</span>`).join('');
    return `<div class="${baseClass}">${title}<div class="detail-text">${synonymChips}</div></div>`;
}

/**
 * Creates answer layout with fixed order:
 * 1) specificHtml (exercise-specific block)
 * 2) difficulty buttons
 * 3) definition
 * 4) examples
 * 5) synonyms
 */
function createAnswerLayout({ specificHtml = '', word, variant = 'learning' }) {
    const isLearning = variant === 'learning';
    const buttons = createDifficultyButtons();
    const definition = createDefinitionSection(word, isLearning);
    const examples = createExamplesSection(word, isLearning);
    const synonyms = createSynonymsSection(word, isLearning);
    return [specificHtml, buttons, definition, examples, synonyms].join('');
}

/**
 * Creates a primary answer block used above details (unified style)
 * @param {string} label - Title of the block (e.g., 'Translation', 'Correct answer')
 * @param {string} value - Main text value
 * @returns {string} HTML string
 */
function createPrimaryAnswerBlock(label, value) {
    if (!value) return '';
    return `
        <div class="card-translation">
            <div class="section-subtitle">${label}</div>
            <div style="font-size: 1.3em; font-weight: 700;">${value}</div>
        </div>
    `;
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
    
    return createPrimaryAnswerBlock(isCompact ? 'Translation' : '🔤 Translation', word.russian);
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
    
    // Add word detail sections styled like expanded list cards
    content += createWordDetailSections(word, 'default');
    
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
function shouldAddItem(condition) {
    return Boolean(condition);
}

function createWordMetadata(word, progress) {
    const items = [];

    const formatEuropeanDate = (date) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const pushItem = (icon, text, type) => items.push({ icon, text, type });

    const addAddedDateItem = () => {
        if (!shouldAddItem(progress.addedDate)) return;
        const addedDate = progress.addedDate instanceof Date ? progress.addedDate : new Date(progress.addedDate);
        if (isNaN(addedDate.getTime())) return;
        pushItem('📅', `Added ${formatEuropeanDate(addedDate)}`, 'added');
    };

    const addRepetitionsItem = () => {
        if (!shouldAddItem(progress.repetitions !== undefined)) return;
        pushItem('🔄', `${progress.repetitions} repetitions`, 'repetitions');
    };

    const addReviewItem = () => {
        if (shouldAddItem(word.nextReview)) {
            const nextReviewDate = new Date(word.nextReview);
            if (isNaN(nextReviewDate.getTime())) return;
            const isReady = nextReviewDate <= new Date();
            const reviewDate = formatEuropeanDate(nextReviewDate);
            const text = isReady ? `Ready for review (${reviewDate})` : `Next review: ${reviewDate}`;
            pushItem(isReady ? '✅' : '📅', text, 'review');
            return;
        }
        if (shouldAddItem(progress.reviewStatus)) {
            const isReady = progress.isReady;
            pushItem(isReady ? '✅' : '📅', progress.reviewStatus, 'review');
        }
    };

    const addAccuracyItem = () => {
        if (!shouldAddItem(progress.totalAttempts > 0)) return;
        pushItem('📊', `${progress.correctCount}/${progress.totalAttempts} correct`, 'accuracy');
    };

    const addLastSeenItem = () => {
        if (!shouldAddItem(progress.lastSeen && progress.totalAttempts > 0)) return;
        const daysAgo = Math.floor((Date.now() - new Date(progress.lastSeen)) / (1000 * 60 * 60 * 24));
        pushItem('⏰', daysAgo === 0 ? 'Today' : `${daysAgo} days ago`, 'lastSeen');
    };

    addAddedDateItem();
    addRepetitionsItem();
    addReviewItem();
    addAccuracyItem();
    addLastSeenItem();

    if (items.length === 0) return '';

    const getChipClass = (type) => {
        switch (type) {
            case 'added': return 'metadata-chip metadata-chip--added';
            case 'review':
            case 'lastSeen': return 'metadata-chip metadata-chip--review';
            case 'repetitions': return 'metadata-chip metadata-chip--repetitions';
            case 'accuracy': return 'metadata-chip metadata-chip--accuracy';
            default: return 'metadata-chip';
        }
    };

    const chipsHtml = items.map((item) => `<span class="${getChipClass(item.type)}">${item.icon} ${item.text}</span>`).join('');
    return `<div class="word-metadata">${chipsHtml}</div>`;
}

/**
 * Creates difficulty buttons component
 * @param {string} variant - Optional variant for styling
 * @returns {string} HTML string for difficulty buttons
 */
function createDifficultyButtons() {
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
// Removed unused createStyledContainer to reduce bundle size

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
    createAnswerLayout,
    createPrimaryAnswerBlock,
    createWordMetadata,
    createDifficultyButtons,
    showDeleteConfirmation,
    toggleWordCard,
    createEmptyState,
    createSessionProgress,
    createButtonGroup,
    createButton,
    createFlexContainer,
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
window.createAnswerLayout = createAnswerLayout;
window.createPrimaryAnswerBlock = createPrimaryAnswerBlock;
window.createWordMetadata = createWordMetadata;
window.createDifficultyButtons = createDifficultyButtons;
window.createEmptyState = createEmptyState;
window.createSessionProgress = createSessionProgress;
window.createButtonGroup = createButtonGroup;
window.createButton = createButton;
window.createFlexContainer = createFlexContainer;
window.createInfoBox = createInfoBox;
window.createSmallText = createSmallText;
window.showDeleteConfirmation = showDeleteConfirmation;
window.toggleWordCard = toggleWordCard;