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

// Dictionary lookup: directly fill form fields without preview
async function lookupInDictionary() {
    const originalWord = document.getElementById('originalWord').value.trim();
    if (!originalWord) {
        showMessage('Please enter the Original word first!', 'error');
        return;
    }

    try {
        // First, clear all fields to prevent mixing data from different words
        clearFormFields();
        
        const data = await window.SV?.DictionaryService?.lookupWithTranslation(originalWord);
        
        // Ensure additional fields are visible
        const additionalFields = document.getElementById('additionalFields');
        if (additionalFields && (additionalFields.style.display === 'none' || !additionalFields.style.display)) {
            toggleAdditionalFields();
        }

        // Fill form fields from dictionary data
        document.getElementById('translation').value = data.translation || '';
        document.getElementById('wordDefinition').value = data.definition || '';
        document.getElementById('wordPhonetic').value = data.phonetic || '';

        if (Array.isArray(data.synonyms) && data.synonyms.length > 0) {
            document.getElementById('wordSynonyms').value = data.synonyms.join(', ');
        }
        if (Array.isArray(data.examples) && data.examples.length > 0) {
            const exampleTexts = data.examples.map(example =>
                typeof example === 'string' ? example : (example.text || String(example))
            );
            document.getElementById('wordExamples').value = exampleTexts.join('\n');
        }

        // Optional toast
        showMessage('Dictionary data inserted. Review and Save.', 'info');
    } catch (error) {
        console.error('Dictionary lookup failed:', error);
        showMessage(`Dictionary lookup failed: ${error.message}`, 'error');
    }
}

// Helper function to clear only form fields (not the original word)
function clearFormFields() {
    document.getElementById('translation').value = '';
    document.getElementById('wordDefinition').value = '';
    document.getElementById('wordPhonetic').value = '';
    document.getElementById('wordSynonyms').value = '';
    document.getElementById('wordExamples').value = '';
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

    // Add to vocabulary array
    if (window.SV?.DataManager) {
        window.SV.DataManager.vocabulary.push(newWord);
        window.SV?.debugLog?.('✅ Word added successfully! Total words:', window.SV.DataManager.vocabulary.length);
        window.SV.DataManager.save();
    }
    
    clearForm();
    showMessage('Word added successfully', 'success');
    
    // Nothing to reset for dictionary preview anymore
}

function clearForm() {
    document.getElementById('originalWord').value = '';
    document.getElementById('translation').value = '';
    document.getElementById('wordDefinition').value = '';
    document.getElementById('wordPhonetic').value = '';
    document.getElementById('wordSynonyms').value = '';
    document.getElementById('wordExamples').value = '';
}

function toggleAdditionalFields() {
    const additionalFields = document.getElementById('additionalFields');
    const toggleBtn = document.getElementById('toggleFieldsBtn');
    
    if (additionalFields.style.display === 'none' || !additionalFields.style.display) {
        additionalFields.style.display = 'block';
        toggleBtn.innerHTML = 'Hide Fields';
        toggleBtn.classList.remove('btn--secondary');
        toggleBtn.classList.add('btn--warning');
    } else {
        additionalFields.style.display = 'none';
        toggleBtn.innerHTML = 'More Fields';
        toggleBtn.classList.remove('btn--warning');  
        toggleBtn.classList.add('btn--secondary');
    }
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

    // Ensure additional fields are visible
    const additionalFields = document.getElementById('additionalFields');
    if (additionalFields && (additionalFields.style.display === 'none' || !additionalFields.style.display)) {
        toggleAdditionalFields();
    }

    // Prefill form fields
    document.getElementById('originalWord').value = word.original || '';
    document.getElementById('translation').value = word.translation || '';
    document.getElementById('wordDefinition').value = word.definition || '';
    document.getElementById('wordPhonetic').value = word.phonetic || '';
    document.getElementById('wordSynonyms').value = Array.isArray(word.synonyms) ? word.synonyms.join(', ') : (word.synonyms || '');
    document.getElementById('wordExamples').value = Array.isArray(word.examples) ? word.examples.join('\n') : (word.examples || '');

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
    clearForm,
    toggleAdditionalFields,
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
