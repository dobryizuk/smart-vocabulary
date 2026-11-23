// ============================================================================
// UNIFIED COMPONENT TEMPLATES
// ============================================================================

const { getWordStatus } = require('./spaced-repetition.js');

const { icon } = require('./icons.js');

function createSpeakAction(text) {
    return { type: 'primary', icon: icon('speaker'), action: 'speak-word', arg: text, title: 'Pronounce word' };
}

/**
 * Creates a unified word card component
 * @param {Object} word - Word object with original, translation, phonetic, etc.
 * @param {string} variant - 'compact', 'learning', or 'default'
 * @param {Array} actions - Array of action button objects
 * @param {boolean} expandable - Whether the card toggles its details
 * @param {string} reviewLabel - Label of the next review shown in compact rows
 * @returns {string} HTML string for the word card
 */
function buildActionsHtml(actions, expandable) {
    return actions.map(action => {
        const dataAction = action.action || '';
        const dataArg = action.arg != null ? ` data-arg="${String(action.arg).replace(/"/g, '&quot;')}"` : '';
        const stopAttr = expandable ? ' data-stop-prop="true"' : '';
        return `<button class="action-btn action-btn--${action.type}" data-action="${dataAction}"${dataArg}${stopAttr} title="${action.title || ''}">${action.icon}</button>`;
    }).join('');
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
    const originalClasses = ['word-card__original'];
    const translationClasses = ['word-card__translation'];
    const actionsClasses = ['word-card__actions'];
    switch (variant) {
        case 'compact':
            cardClasses.push('word-card--compact');
            headerClasses.push('word-card__header--compact');
            actionsClasses.push('word-card__actions--compact');
            break;
        case 'learning':
            cardClasses.push('word-card--learning');
            originalClasses.push('word-card__original--learning');
            translationClasses.push('word-card__translation--learning');
            break;
        default:
            break;
    }
    if (expandable) cardClasses.push('word-card--expandable');
    return { cardClasses, headerClasses, originalClasses, translationClasses, actionsClasses };
}

function buildNonExpandableDetails(word, variant) {
    const showDetails = variant !== 'compact' && variant !== 'learning';
    const definitionHtml = showDetails && word.definition ? `<div class="word-card__definition">${word.definition}</div>` : '';
    const examplesHtml = showDetails && word.examples ? `<div class="word-card__examples">${word.examples}</div>` : '';
    return { definitionHtml, examplesHtml };
}

function buildToggleButtonHTML(expandable, hasExtra, uniqueId) {
    if (!(expandable && hasExtra)) return '';
    return `<div class="word-card__toggle" data-action="toggle-card" data-target-id="${uniqueId}" title="Show/hide details"></div>`;
}

function buildPhoneticHtml(word) {
    if (!word.phonetic) return '';
    return `<span class="word-card__phonetic">${word.phonetic}</span>`;
}

function buildOriginalHtml(word, originalClasses) {
    const phoneticHtml = buildPhoneticHtml(word);
    return `
        <div class="${originalClasses.join(' ')}">
            ${word.original}
            ${phoneticHtml}
        </div>
    `;
}

function buildTranslationHtml(word, translationClasses, variant) {
    if (variant === 'learning') return '';
    return `<div class="${translationClasses.join(' ')}">${word.translation}</div>`;
}

function buildHeaderSection(word, variant, originalClasses, translationClasses, headerClasses) {
    const originalHtml = buildOriginalHtml(word, originalClasses);
    const translationHtml = buildTranslationHtml(word, translationClasses, variant);
    return `
        <div class="${headerClasses.join(' ')}">
            ${originalHtml}
            ${translationHtml}
        </div>
    `;
}

function buildSideHtml(word, reviewLabel) {
    const reviewHtml = reviewLabel ? `<span class="word-card__review">${reviewLabel}</span>` : '';
    return `<div class="word-card__side">${createStatusBadge(word)}${reviewHtml}</div>`;
}

function createWordCard(word, variant = 'default', actions = [], expandable = false, reviewLabel = '') {
    const uniqueId = `word-card-${word.id}`;
    
    // Create extended progress with all metadata fields
    const { isReady, reviewText } = computeReview(word.nextReview);
        
    const progress = {
        repetitions: word.repetition || 0,
        reviewStatus: reviewText,
        isReady: isReady,
        addedDate: new Date(word.createdAt || word.addedDate)
    };
    
    // Determine card classes based on variant
    const { cardClasses, headerClasses, originalClasses, translationClasses, actionsClasses } = buildVariantClasses(variant, expandable);
    
    // Build actions HTML (with event stopping for expandable cards)
    const actionsHtml = buildActionsHtml(actions, expandable);
    
    // Create metadata and details
    const metadata = createWordMetadata(word, progress);
    const detailSections = createWordDetailSections(word, variant);
    
    // Expandable content (details + metadata)
    const expandableContent = (expandable && (metadata || detailSections))
        ? `<div class="word-card__expandable-content">${detailSections}${metadata}</div>`
        : '';
    
    // Toggle button for expandable cards
    const toggleButton = buildToggleButtonHTML(expandable, (metadata || detailSections), uniqueId);
    
    const sideHtml = variant === 'compact' ? buildSideHtml(word, reviewLabel) : '';
    const headerHtml = `
        <div class="word-card__top">
            ${buildHeaderSection(word, variant, originalClasses, translationClasses, headerClasses)}
            ${sideHtml}
            ${actionsHtml ? `<div class="${actionsClasses.join(' ')}">${actionsHtml}</div>` : ''}
            ${toggleButton}
        </div>
    `;

    const { definitionHtml, examplesHtml } = buildNonExpandableDetails(word, variant);
    const chipsHtml = variant === 'learning' ? `<div class="word-card__chips">${createStatusBadge(word)}</div>` : '';

    return `
        <div class="${cardClasses.join(' ')}" id="${uniqueId}">
            ${chipsHtml}
            ${headerHtml}
            ${definitionHtml}
            ${examplesHtml}
            ${expandableContent}
        </div>
    `;
}

/**
 * Creates status badge component
 * @param {Object} word - Word whose review history determines the status
 * @returns {string} HTML string for status badge
 */
function createStatusBadge(word) {
    const { key, label } = getWordStatus(word);
    return `<span class="status-badge status-badge--${key}" role="status" aria-label="${label}" title="${label}">${label}</span>`;
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
    const wrap = (type, content) => {
        let testId = '';
        if (type === 'definition') testId = 'detail-definition';
        else if (type === 'synonyms') testId = 'detail-synonyms';
        else if (type === 'examples') testId = 'detail-examples';
        const testAttr = testId ? ` data-testid="${testId}"` : '';
        return `<div class="${baseClass(type)}"${testAttr}>${content}</div>`;
    };

    // Definition
    if (word.definition) {
        sectionsHtml += wrap('definition', [
            title('Definition'),
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
            title('Examples'),
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
    const title = `<div class="detail-title">${'Definition'}</div>`;
    return `<div class="${baseClass}" data-testid="detail-definition">${title}<div class="detail-text">${word.definition}</div></div>`;
}

function createExamplesSection(word, isLearning = false) {
    if (!(word.examples && word.examples.length > 0)) return '';
    const baseClass = `detail-block detail-block--examples${isLearning ? ' detail-block--learning' : ''}`;
    const title = `<div class="detail-title">${'Examples'}</div>`;
    const examplesHtml = word.examples
        .slice(0, isLearning ? 2 : word.examples.length)
        .map(example => {
            const text = typeof example === 'string' ? example : example.text || example.toString();
            return isLearning
                ? `<div class="detail-text" style="font-size: 0.85em; font-style: italic; margin-bottom: 4px;">"${text}"</div>`
                : `• ${text}`;
        }).join(isLearning ? '' : '<br>');
    return `<div class="${baseClass}" data-testid="detail-examples">${title}<div class="detail-text">${examplesHtml}</div></div>`;
}

function createSynonymsSection(word, isLearning = false) {
    if (!(word.synonyms && word.synonyms.length > 0)) return '';
    const baseClass = `detail-block detail-block--synonyms${isLearning ? ' detail-block--learning' : ''}`;
    const title = `<div class="detail-title">Synonyms</div>`;
    const synonymChips = word.synonyms.map(synonym => `<span class="synonym-chip">${synonym}</span>`).join('');
    return `<div class="${baseClass}" data-testid="detail-synonyms">${title}<div class="detail-text">${synonymChips}</div></div>`;
}

/**
 * Creates answer layout with fixed order:
 * 1) specificHtml (exercise-specific block)
 * 2) definition (unless the exercise card above already shows it)
 * 3) examples
 * 4) synonyms
 * 5) difficulty buttons
 */
function createAnswerLayout({ specificHtml = '', word, showDefinition = true }) {
    const buttons = createDifficultyButtons();
    // Borrow list-view styles for detail blocks in learning
    const definition = showDefinition ? createDefinitionSection(word, false) : '';
    const examples = createExamplesSection(word, false);
    const synonyms = createSynonymsSection(word, false);
    return [specificHtml, definition, examples, synonyms, buttons].join('');
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
        <div class="card-translation detail-block detail-block--translation">
            <div class="detail-title">${label}</div>
            <div class="detail-text">${value}</div>
        </div>
    `;
}

/**
 * Creates translation block component for learning screen
 * @param {Object} word - Word object
 * @returns {string} HTML string for translation block
 */
function createTranslationBlock(word) {
    if (!word.translation) return '';
    return createPrimaryAnswerBlock('Translation', word.translation);
}

/**
 * Creates complete answer content for learning screen (translation + details + metadata)
 * @param {Object} word - Word object
 * @param {Object} progress - Progress object
 * @returns {string} HTML string for complete answer content
 */
function createLearningAnswerContent(word, progress) {
    let content = '';
    
    // Add translation block
    content += createTranslationBlock(word);
    
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

    const pushItem = (text) => items.push(text);

    const addAddedDateItem = () => {
        if (!shouldAddItem(progress.addedDate)) return;
        const addedDate = progress.addedDate instanceof Date ? progress.addedDate : new Date(progress.addedDate);
        if (isNaN(addedDate.getTime())) return;
        pushItem(`Added ${formatEuropeanDate(addedDate)}`);
    };

    const addRepetitionsItem = () => {
        if (!shouldAddItem(progress.repetitions !== undefined)) return;
        pushItem(`${progress.repetitions} repetitions`);
    };

    const addReviewItem = () => {
        if (shouldAddItem(word.nextReview)) {
            const nextReviewDate = new Date(word.nextReview);
            if (isNaN(nextReviewDate.getTime())) return;
            const isReady = nextReviewDate <= new Date();
            const reviewDate = formatEuropeanDate(nextReviewDate);
            const text = isReady ? `Ready for review (${reviewDate})` : `Next review: ${reviewDate}`;
            pushItem(text);
            return;
        }
        if (shouldAddItem(progress.reviewStatus)) {
            pushItem(progress.reviewStatus);
        }
    };

    addAddedDateItem();
    addRepetitionsItem();
    addReviewItem();

    if (items.length === 0) return '';

    const chipsHtml = items.map((text) => `<span class="metadata-chip">${text}</span>`).join('');
    return `<div class="word-metadata">${chipsHtml}</div>`;
}

/**
 * Creates difficulty buttons component
 * @param {string} variant - Optional variant for styling
 * @returns {string} HTML string for difficulty buttons
 */
function createDifficultyButtons() {
    return `
        <div class="difficulty-buttons">
            <p class="difficulty-buttons__prompt">How well did you know it?</p>
            <button class="difficulty-btn difficulty-btn--hard" data-difficulty="hard">Hard</button>
            <button class="difficulty-btn difficulty-btn--medium" data-difficulty="medium">Medium</button>
            <button class="difficulty-btn difficulty-btn--easy" data-difficulty="easy">OK</button>
            <button class="difficulty-btn difficulty-btn--perfect" data-difficulty="perfect">Easy</button>
        </div>
    `;
}

function showDeleteConfirmation(word, onConfirm, context) {
    const ctx = context ?? {};
    const doc = ctx.document ?? (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    const overlay = doc.createElement('div');
    overlay.className = 'confirm-overlay';

    const dialog = doc.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
        <h3 class="confirm-dialog__title">Delete Word</h3>
        <p class="confirm-dialog__text">
            Delete "<strong>${word.original}</strong>"?<br>
            <small class="confirm-dialog__note">This action cannot be undone.</small>
        </p>
        <div class="confirm-dialog__actions">
            <button id="cancelDelete" class="confirm-dialog__btn">Cancel</button>
            <button id="confirmDelete" class="confirm-dialog__btn confirm-dialog__btn--danger">Delete</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    doc.body.appendChild(overlay);
    
    // Handle buttons
    doc.getElementById('cancelDelete').onclick = () => {
        window.SV?.debugLog?.('🗑️ Deletion cancelled by user');
        doc.body.removeChild(overlay);
    };
    
    doc.getElementById('confirmDelete').onclick = () => {
        doc.body.removeChild(overlay);
        onConfirm();
    };
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            window.SV?.debugLog?.('🗑️ Deletion cancelled by user');
            doc.body.removeChild(overlay);
        }
    };
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
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
        const buttonClass = `btn btn--${button.type || 'primary'}`;
        const style = button.style ? ` style="${button.style}"` : '';
        const id = button.id ? ` id="${button.id}"` : '';
        const dataAction = button.action ? ` data-action="${button.action}"` : '';
        const dataArg = button.arg != null ? ` data-arg="${String(button.arg).replace(/"/g, '&quot;')}"` : '';
        return `<button class="${buttonClass}"${dataAction}${dataArg}${id}${style}>${button.text}</button>`;
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
    const percent = totalWords > 0 ? Math.round((currentIndex / totalWords) * 100) : 0;
    return `
        <div class="session-progress" data-testid="session-progress">
            <div class="session-progress__track" aria-hidden="true">
                <div class="session-progress__fill" style="width: ${percent}%;"></div>
            </div>
            <span class="session-progress__count">${currentIndex} / ${totalWords}</span>
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
        const buttonClass = `btn btn--${button.type || 'primary'}`;
        const disabled = button.disabled ? ' disabled' : '';
        const id = button.id ? ` id="${button.id}"` : '';
        const style = button.style ? ` style="${button.style}"` : '';
        const dataAction = button.action ? ` data-action="${button.action}"` : '';
        const dataArg = button.arg != null ? ` data-arg="${String(button.arg).replace(/"/g, '&quot;')}"` : '';
        return `<button class="${buttonClass}"${dataAction}${dataArg}${disabled}${id}${style}>${button.text}</button>`;
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
function createButton(text, action, type = 'primary', disabled = false, id = '', style = '', className = '', testId = '', arg = '') {
    const buttonClass = `btn btn--${type}${className ? ' ' + className : ''}`;
    const disabledAttr = disabled ? ' disabled' : '';
    const idAttr = id ? ` id="${id}"` : '';
    const styleAttr = style ? ` style="${style}"` : '';
    const testIdAttr = testId ? ` data-testid="${testId}"` : '';
    const actionAttr = action ? ` data-action="${action}"` : '';
    const argAttr = arg !== '' ? ` data-arg="${String(arg).replace(/"/g, '&quot;')}"` : '';
    return `<button class="${buttonClass}"${actionAttr}${argAttr}${disabledAttr}${idAttr}${styleAttr}${testIdAttr}>${text}</button>`;
}

/**
 * Creates a labeled text input block
 * @param {Object} options
 * @param {string} options.inputId - ID for the input element
 * @param {string} options.label - Label text
 * @param {string} options.placeholder - Placeholder text
 * @param {string} options.onKeyPress - onkeypress handler string
 * @param {string} options.onInput - oninput handler string
 * @returns {string} HTML string for labeled input
 */
function createLabeledTextInput({
    inputId,
    label,
    placeholder = '',
    onKeyPress = '',
    onInput = ''
}) {
    const keypressAttr = onKeyPress ? ` onkeypress="${onKeyPress}"` : '';
    const inputAttr = onInput ? ` oninput="${onInput}"` : '';
    return `
        <div class="learning-input-block">
            <label for="${inputId}">${label}</label>
            <input type="text" id="${inputId}" class="form-control" placeholder="${placeholder}"
                   autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" autofocus${keypressAttr}${inputAttr}>
            <div id="typingFeedback" class="typing-feedback"></div>
        </div>
    `;
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

// Export functions
/**
 * Toggle the expand/collapse state of a word card
 * @param {string} cardId - The ID of the word card to toggle
 */
function toggleWordCard(cardId) {
    const card = (typeof document !== 'undefined') ? document.getElementById(cardId) : null;
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

// Export functions (CommonJS consumers and app-init attach to SV)
// App-init will attach these under SV.UIComponents
const UIComponents = {
    createSpeakAction,
    createWordCard,
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
    escapeHtml,
    createEmptyState,
    createSessionProgress,
    createButtonGroup,
    createButton,
    createLabeledTextInput,
    createFlexContainer
};

// Functions are available through window.UIComponents namespace

// Export for CommonJS (Node/Vitest)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIComponents;
}
