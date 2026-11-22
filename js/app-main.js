// ============================================================================
// MAIN APPLICATION CONTROLLER
// ============================================================================

// Global state is provided by AppState (see js/app-state.js)

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
        if (typeof updateStats === 'function') {
            updateStats();
        }
    } else if (tabName === 'learn') {
        if (typeof prepareLearningSession === 'function') {
            prepareLearningSession();
        }
    }
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
            synonyms
        };

        const DM = window.SV?.DataManager;
        DM.vocabulary = vocabulary;
        DM.saveUserProgress();
        DM.saveAllVocabulary();

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

    const newWord = {
        id: `custom_${Date.now()}`,
        original,
        translation,
        definition,
        phonetic,
        examples,
        synonyms,
        createdAt: new Date().toISOString(),
        repetition: 0,
        easeFactor: 1.3,
        nextReview: null,
        reviewHistory: [],
        lastExerciseType: null,
        lastExerciseDate: null
    };

    // Add to vocabulary array
    if (window.SV?.DataManager) {
        window.SV.DataManager.vocabulary.push(newWord);
        window.SV?.debugLog?.('✅ Word added successfully! Total words:', window.SV.DataManager.vocabulary.length);
        window.SV.DataManager.saveUserProgress();
        window.SV.DataManager.saveAllVocabulary();
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
        toggleBtn.innerHTML = '➖ Hide Fields';
        toggleBtn.classList.remove('btn--secondary');
        toggleBtn.classList.add('btn--warning');
    } else {
        additionalFields.style.display = 'none';
        toggleBtn.innerHTML = '➕ More Fields';
        toggleBtn.classList.remove('btn--warning');  
        toggleBtn.classList.add('btn--secondary');
    }
}

function renderWordList() {
    const wordList = document.getElementById('wordList');
    const wordCount = document.getElementById('wordCount');
    
    const vocabulary = window.SV?.DataManager?.vocabulary || [];
    wordCount.textContent = vocabulary.length;

    if (vocabulary.length === 0) {
        const UI = window.SV?.UIComponents;
        const emptyStateHtml = UI?.createEmptyState?.(
            'No words yet!',
            'Add your first word in the "Add Words" tab'
        ) || '';
        wordList.innerHTML = emptyStateHtml;
        return;
    }

    const sortedWords = [...vocabulary].sort((a, b) => {
        const aDate = new Date(a.createdAt);
        const bDate = new Date(b.createdAt);
        return bDate - aDate;
    });

    wordList.innerHTML = sortedWords.map(word => {
        // Define actions for this word (delete first, speak second - so speak is always in corner)
        const actions = [
            {
                type: 'warning',
                icon: '✏️',
                action: 'edit-word',
                arg: word.id,
                title: 'Edit word'
            },
            {
                type: 'danger',
                icon: '🗑️',
                action: 'delete-word',
                arg: word.id,
                title: 'Delete word'
            },
            {
                type: 'primary',
                icon: '🔊',
                action: 'speak-word',
                arg: word.original,
                title: 'Pronounce word'
            }
        ];
        
        // Metadata is computed within UI components if needed

        // Use unified word card component with expandable functionality
        const UI2 = window.SV?.UIComponents;
        const cardHtml = UI2?.createWordCard?.(word, 'compact', actions, true, true) || '';
        
        // All metadata and sections are now included in the expandable card
        return cardHtml;

    }).join('');
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
            
            // Remove from DataManager vocabulary if present
            if (dm && Array.isArray(dm.vocabulary)) {
                dm.vocabulary = dm.vocabulary.filter(word => word.id !== id);
            }

            if (dm) {
                // Remove from user progress
                delete dm.userProgress[id];
                // Persist
                dm.saveUserProgress();
                dm.saveAllVocabulary();
            }
            
            // Update UI
            window.SV?.AppMain?.renderWordList?.();
            window.SV?.Statistics?.updateStats?.();
            
            const newLength = dm?.vocabulary?.length ?? 0;
            window.SV?.debugLog?.('🗑️ Word deleted successfully:', wordToDelete.original);
            window.SV?.debugLog?.('🗑️ New vocabulary length:', newLength);
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
    lookupInDictionary,
    addWord,
    clearForm,
    toggleAdditionalFields,
    renderWordList,
    showMessage,
    editWord,
    deleteWord
};

function createDefaultAppMain() {
    return AppMainExports;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppMainExports;
}

// Provide factory for browser attach in app-init
if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-restricted-syntax
    window.createDefaultAppMain = createDefaultAppMain;
}

// Export only via CommonJS; app-init attaches to SV for browser