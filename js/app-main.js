// ============================================================================
// MAIN APPLICATION CONTROLLER
// ============================================================================

// Global state is provided by AppState (see js/app-state.js)

const WordList = require('./word-list.js');

// ============================================================================
// UI MANAGEMENT FUNCTIONS
// ============================================================================

function showTab(tabName) {
    // Safely toggle active classes if elements exist
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));

    // After removing inline onclick, select tab button by data-testid
    const currentBtn = document.querySelector(`[data-testid="${tabName}-tab-btn"]`);
    if (currentBtn) currentBtn.classList.add('active');
    const currentTab = document.getElementById(`${tabName}-tab`);
    if (currentTab) currentTab.classList.add('active');

    // Execute tab-specific logic only when required DOM hooks are present
    if (tabName === 'list') {
        const hasList = document.getElementById('wordList');
        const hasCount = document.getElementById('wordCount');
        if (hasList && hasCount && typeof renderWordList === 'function') {
            renderWordList();
        }
    } else if (tabName === 'stats') {
        showStatsView('progress');
        window.SV?.Statistics?.updateStats?.();
    } else if (tabName === 'today') {
        window.SV?.LearningSession?.prepareLearningSession?.();
    }
}

// The Stats tab holds two views: Progress and, behind it, Settings
function showStatsView(view) {
    const progressView = document.getElementById('progressView');
    const settingsView = document.getElementById('settingsView');
    if (progressView) progressView.hidden = view !== 'progress';
    if (settingsView) settingsView.hidden = view !== 'settings';
    const statsTab = document.getElementById('stats-tab');
    if (statsTab) statsTab.scrollTop = 0;
}

const FORM_FIELD_IDS = ['originalWord', 'translation', 'wordDefinition', 'wordPhonetic', 'wordSynonyms', 'wordExamples'];
const HIGHLIGHT_CLASS = 'word-card--new';

function setFormValues(values = {}) {
    FORM_FIELD_IDS.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = values[id] ?? '';
    });
    updateFormControls();
}

// The clear button shows while any field has content, the speaker while there is a word to pronounce
function updateFormControls() {
    const hasContent = FORM_FIELD_IDS.some(id => document.getElementById(id)?.value.trim());
    const hasWord = Boolean(document.getElementById('originalWord')?.value.trim());
    const clearButton = document.querySelector('[data-testid="clear-form-btn"]');
    const speakButton = document.querySelector('[data-testid="speak-original-btn"]');
    if (clearButton) clearButton.hidden = !hasContent;
    if (speakButton) speakButton.hidden = !hasWord;
}

function setLookupPending(pending) {
    const lookupButton = document.querySelector('[data-testid="dictionary-lookup-btn"]');
    if (lookupButton) {
        if (pending) lookupButton.dataset.idleHtml = lookupButton.innerHTML;
        lookupButton.innerHTML = pending ? '<span class="spinner" aria-hidden="true"></span>Looking up…' : lookupButton.dataset.idleHtml;
        lookupButton.disabled = pending;
        lookupButton.setAttribute('aria-busy', String(pending));
    }
    FORM_FIELD_IDS.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.readOnly = pending;
    });
    ['clear-form-btn', 'save-word-btn'].forEach(testId => {
        const button = document.querySelector(`[data-testid="${testId}"]`);
        if (button) button.disabled = pending;
    });
}

function joinExamples(examples) {
    return examples.map(example => typeof example === 'string' ? example : (example.text || String(example))).join('\n');
}

// Dictionary lookup: directly fill form fields without preview
async function lookupInDictionary() {
    const originalWord = document.getElementById('originalWord').value.trim();
    if (!originalWord) {
        showMessage('Please enter the Original word first!', 'error');
        return;
    }

    // Clear the other fields first to prevent mixing data from different words
    setFormValues({ originalWord });
    setLookupPending(true);
    try {
        const data = await window.SV?.DictionaryService?.lookupWithTranslation(originalWord);
        setFormValues({
            originalWord,
            translation: data.translation,
            wordDefinition: data.definition,
            wordPhonetic: data.phonetic,
            wordSynonyms: Array.isArray(data.synonyms) ? data.synonyms.join(', ') : '',
            wordExamples: Array.isArray(data.examples) ? joinExamples(data.examples) : ''
        });
        showMessage('Dictionary data inserted. Review and Save.', 'info');
    } catch (error) {
        console.error('Dictionary lookup failed:', error);
        showMessage(`Dictionary lookup failed: ${error.message}`, 'error');
    } finally {
        setLookupPending(false);
    }
}

async function addWord() {
    const original = document.getElementById('originalWord').value.trim();
    const translation = document.getElementById('translation').value.trim();
    const definition = document.getElementById('wordDefinition').value.trim();
    const phonetic = document.getElementById('wordPhonetic').value.trim();
    const synonymsText = document.getElementById('wordSynonyms').value.trim();
    const examplesText = document.getElementById('wordExamples').value.trim();

    if (!original || !translation) {
        showMessage('Please fill in both Original and Translation fields', 'error');
        return;
    }

    const vocabulary = window.SV?.DataManager?.vocabulary || [];

    // If we are editing an existing word, update it in place
    const editingId = window.SV?.AppState?.editingWordId || null;
    if (editingId) {
        // Prevent changing to a duplicate of another entry
        const duplicateOther = vocabulary.some(w => w.id !== editingId && w.original.toLowerCase() === original.toLowerCase());
        if (duplicateOther) {
            showMessage('Another word with this Original already exists!', 'error');
            return;
        }

        const synonyms = synonymsText ? synonymsText.split(',').map(s => s.trim()).filter(s => s) : [];
        const examples = examplesText ? examplesText.split('\n').map(e => e.trim()).filter(e => e) : [];

        const index = vocabulary.findIndex(w => w.id === editingId);
        if (index === -1) {
            showMessage('Error: Word not found for editing!', 'error');
            return;
        }

        const existing = vocabulary[index];
        vocabulary[index] = {
            ...existing,
            original,
            translation,
            definition,
            phonetic,
            examples,
            synonyms,
            updatedAt: new Date().toISOString()
        };

        const DM = window.SV?.DataManager;
        DM.vocabulary = vocabulary;
        DM.save();

        window.SV.AppState.editingWordId = null;
        clearForm();
        showMessage('Word updated successfully', 'success');
        showTab('list');
        return;
    }

    // Add flow: Check for duplicates
    if (vocabulary.some(word => word.original.toLowerCase() === original.toLowerCase())) {
        showMessage('This word already exists in your vocabulary!', 'error');
        return;
    }

    // Process synonyms and examples
    const synonyms = synonymsText ? synonymsText.split(',').map(s => s.trim()).filter(s => s) : [];
    const examples = examplesText ? examplesText.split('\n').map(e => e.trim()).filter(e => e) : [];

    const createdAt = new Date().toISOString();
    const newWord = {
        id: `custom_${Date.now()}`,
        original,
        translation,
        definition,
        phonetic,
        examples,
        synonyms,
        createdAt,
        updatedAt: createdAt,
        repetition: 0,
        easeFactor: 1.3,
        nextReview: null,
        reviewHistory: []
    };

    const DM = window.SV.DataManager;
    DM.vocabulary.push(newWord);
    window.SV?.debugLog?.('✅ Word added successfully! Total words:', DM.vocabulary.length);
    if (DM.save() === false) {
        DM.vocabulary.pop();
        return;
    }

    window.SV?.NaturalVoice?.wordAdded?.(original);
    clearForm();
    showMessage('Word added successfully', 'success');
    showNewWord(newWord.id);
}

function clearForm() {
    setFormValues();
}

// The clear button: empties every field, leaves edit mode and returns to the word field
function resetForm() {
    window.SV.AppState.editingWordId = null;
    clearForm();
    document.getElementById('originalWord')?.focus();
}

function speakOriginalWord() {
    const word = document.getElementById('originalWord')?.value.trim();
    if (word) window.SV?.SpeechManager?.speakWord?.(word, document.querySelector('[data-testid="speak-original-btn"]'));
}

// Words screen with everything listed, scrolled to the top, and the new word marked until its highlight fades
function showNewWord(id) {
    window.SV.AppState.wordListFilter = 'all';
    showTab('list');
    const listTab = document.getElementById('list-tab');
    if (listTab) listTab.scrollTop = 0;
    const card = document.getElementById(`word-card-${id}`);
    if (!card) return;
    card.classList.add(HIGHLIGHT_CLASS);
    card.addEventListener('animationend', () => card.classList.remove(HIGHLIGHT_CLASS), { once: true });
}

function renderWordList() {
    const wordList = document.getElementById('wordList');
    const wordCount = document.getElementById('wordCount');
    const wordFilters = document.getElementById('wordFilters');
    
    const vocabulary = window.SV?.DataManager?.vocabulary || [];
    wordCount.textContent = vocabulary.length;

    if (vocabulary.length === 0) {
        const UI = window.SV?.UIComponents;
        const emptyStateHtml = UI?.createEmptyState?.(
            'No words yet!',
            'Add your first word in the "Add Words" tab'
        ) || '';
        wordFilters.innerHTML = '';
        wordList.innerHTML = emptyStateHtml;
        return;
    }

    const now = new Date();
    const activeFilter = window.SV.AppState.wordListFilter;
    wordFilters.innerHTML = WordList.renderFilters(vocabulary, activeFilter, now);

    const visibleWords = WordList.filterWords(vocabulary, activeFilter, now);
    wordList.innerHTML = visibleWords.length > 0
        ? WordList.renderGroups(visibleWords, now)
        : window.SV?.UIComponents?.createEmptyState?.('Nothing here', 'No words match this filter') || '';
}

function setWordListFilter(filterKey) {
    window.SV.AppState.wordListFilter = filterKey;
    renderWordList();
}

function showWords(filterKey) {
    window.SV.AppState.wordListFilter = filterKey;
    showTab('list');
}

// Prefill Add form for editing and navigate to Add tab
function editWord(id) {
    const vocabulary = window.SV?.DataManager?.vocabulary || [];
    const word = vocabulary.find(w => w.id === id);
    if (!word) {
        showMessage('Error: Word not found!', 'error');
        return;
    }

    window.SV.AppState.editingWordId = id;

    showTab('add');

    setFormValues({
        originalWord: word.original,
        translation: word.translation,
        wordDefinition: word.definition,
        wordPhonetic: word.phonetic,
        wordSynonyms: Array.isArray(word.synonyms) ? word.synonyms.join(', ') : word.synonyms,
        wordExamples: Array.isArray(word.examples) ? word.examples.join('\n') : word.examples
    });

    showMessage('Edit mode: update fields and click Save', 'info');
}

function deleteWord(id) {
    window.SV?.debugLog?.('🗑️ deleteWord called with ID:', id);
    
    const dm = window.SV?.DataManager;
    const dmVocabulary = dm?.vocabulary || [];
    window.SV?.debugLog?.('🗑️ Current vocabulary length:', dmVocabulary.length);
    
    const wordToDelete = dmVocabulary.find(word => word.id === id);
    
    if (!wordToDelete) {
        console.error('❌ Word not found with ID:', id);
        showMessage('Error: Word not found!', 'error');
        return;
    }
    
    // Show custom confirmation dialog
    // Prefer test override if provided, else use UIComponents dialog
    const showConfirm = window.SV?.UIComponents?.showDeleteConfirmation;
    if (showConfirm) {
        showConfirm(wordToDelete, () => {
            // User confirmed deletion
            window.SV?.debugLog?.('🗑️ User confirmed deletion');
            
            dm.deleteWord(id);

            // Update UI
            window.SV?.AppMain?.renderWordList?.();
            window.SV?.Statistics?.updateStats?.();

            window.SV?.debugLog?.('🗑️ Word deleted successfully:', wordToDelete.original);
            window.SV?.debugLog?.('🗑️ New vocabulary length:', dm.vocabulary.length);
        });
    }
}

// ============================================================================
// MESSAGE SYSTEM
// ============================================================================

function showMessage(text, type = 'info') {
    // Remove any existing messages
    const existingMessage = document.querySelector('.app-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `app-message app-message--${type}`;
    messageDiv.setAttribute('role', 'alert');
    messageDiv.setAttribute('aria-live', 'polite');
    messageDiv.textContent = text;
    
    // Insert at the top of the page
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 4000);
}

// Export for both CommonJS and browser
const AppMainExports = {
    showTab,
    showStatsView,
    lookupInDictionary,
    addWord,
    resetForm,
    updateFormControls,
    speakOriginalWord,
    renderWordList,
    setWordListFilter,
    showWords,
    showMessage,
    editWord,
    deleteWord
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppMainExports;
}

// Export only via CommonJS; app-init attaches to SV for browser
