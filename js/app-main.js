// ============================================================================
// MAIN APPLICATION CONTROLLER
// ============================================================================

// Global state is provided by AppState (see js/app-state.js)

// ============================================================================
// UI MANAGEMENT FUNCTIONS
// ============================================================================

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'list') {
        renderWordList();
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
    const englishWord = document.getElementById('englishWord').value.trim();
    if (!englishWord) {
        showMessage('Please enter an English word first!', 'error');
        return;
    }

    try {
        const data = await window.DictionaryService.lookupWithTranslation(englishWord);
        // Ensure additional fields are visible
        const additionalFields = document.getElementById('additionalFields');
        if (additionalFields && (additionalFields.style.display === 'none' || !additionalFields.style.display)) {
            toggleAdditionalFields();
        }

        // Fill form fields from dictionary data
        document.getElementById('russianTranslation').value = data.translation || '';
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

async function addWord() {
    const english = document.getElementById('englishWord').value.trim();
    const russian = document.getElementById('russianTranslation').value.trim();
    const definition = document.getElementById('wordDefinition').value.trim();
    const phonetic = document.getElementById('wordPhonetic').value.trim();
    const synonymsText = document.getElementById('wordSynonyms').value.trim();
    const examplesText = document.getElementById('wordExamples').value.trim();

    if (!english || !russian) {
        showMessage('Please fill in both English and Russian fields', 'error');
        return;
    }

    // Check for duplicates
    const vocabulary = window.DataManager?.vocabulary || [];
    if (vocabulary.some(word => word.english.toLowerCase() === english.toLowerCase())) {
        showMessage('This word already exists in your vocabulary!', 'error');
        return;
    }

    // Process synonyms and examples
    const synonyms = synonymsText ? synonymsText.split(',').map(s => s.trim()).filter(s => s) : [];
    const examples = examplesText ? examplesText.split('\n').map(e => e.trim()).filter(e => e) : [];

    const newWord = {
        id: `custom_${Date.now()}`,
        english,
        russian,
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
    if (window.DataManager) {
        window.DataManager.vocabulary.push(newWord);
        
        console.log('✅ Word added successfully! Total words:', window.DataManager.vocabulary.length);
        
        // Save all data
        window.DataManager.saveUserProgress();
        window.DataManager.saveAllVocabulary();
    }
    
    clearForm();
    showMessage('Word added successfully', 'success');
    
    // Nothing to reset for dictionary preview anymore
}

function clearForm() {
    document.getElementById('englishWord').value = '';
    document.getElementById('russianTranslation').value = '';
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
        toggleBtn.classList.remove('btn-secondary');
        toggleBtn.classList.add('btn-warning');
    } else {
        additionalFields.style.display = 'none';
        toggleBtn.innerHTML = '➕ More Fields';
        toggleBtn.classList.remove('btn-warning');  
        toggleBtn.classList.add('btn-secondary');
    }
}

function renderWordList() {
    const wordList = document.getElementById('wordList');
    const wordCount = document.getElementById('wordCount');
    
    const vocabulary = window.DataManager?.vocabulary || [];
    wordCount.textContent = vocabulary.length;

    if (vocabulary.length === 0) {
        const emptyStateHtml = window.UIComponents?.createEmptyState?.(
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
                type: 'danger',
                icon: '🗑️',
                onclick: `deleteWord('${word.id}')`,
                title: 'Delete word'
            },
            {
                type: 'primary',
                icon: '🔊',
                onclick: `speakWord('${word.english}')`,
                title: 'Pronounce word'
            }
        ];
        
        // Metadata is computed within UI components if needed

        // Use unified word card component with expandable functionality
        const cardHtml = window.UIComponents?.createWordCard?.(word, 'compact', actions, true, true) || '';
        
        // All metadata and sections are now included in the expandable card
        return cardHtml;

    }).join('');
}

function deleteWord(id) {
    console.log('🗑️ deleteWord called with ID:', id);
    
    // Resolve sources: DataManager store and global fallback store
    const dm = window.DataManager;
    const dmVocabulary = dm?.vocabulary || [];
    const globalVocabulary = Array.isArray(window.vocabulary) ? window.vocabulary : [];
    const combined = dmVocabulary.length ? dmVocabulary : globalVocabulary;
    console.log('🗑️ Current vocabulary length:', combined.length);
    
    const wordToDelete = combined.find(word => word.id === id);
    
    if (!wordToDelete) {
        console.error('❌ Word not found with ID:', id);
        showMessage('Error: Word not found!', 'error');
        return;
    }
    
    // Show custom confirmation dialog
    // Prefer test override if provided, else use UIComponents dialog
    const showConfirm = window.showDeleteConfirmation || window.UIComponents?.showDeleteConfirmation;
    if (showConfirm) {
        showConfirm(wordToDelete, () => {
            // User confirmed deletion
            console.log('🗑️ User confirmed deletion');
            
            // Remove from DataManager vocabulary if present
            if (dm && Array.isArray(dm.vocabulary)) {
                dm.vocabulary = dm.vocabulary.filter(word => word.id !== id);
            }

            // Also remove from global vocabulary array if present (browser tests/backwards-compat)
            if (Array.isArray(window.vocabulary)) {
                window.vocabulary = window.vocabulary.filter(word => word.id !== id);
            }

            if (dm) {
                // Remove from user progress
                delete dm.userProgress[id];
                // Persist
                dm.saveUserProgress();
                dm.saveAllVocabulary();
            }
            
            // Update UI
            if (window.renderWordList) window.renderWordList();
            if (window.updateStats) window.updateStats();
            
            const newLength = (dm?.vocabulary?.length ?? 0) || (Array.isArray(window.vocabulary) ? window.vocabulary.length : 0);
            console.log('🗑️ Word deleted successfully:', wordToDelete.english);
            console.log('🗑️ New vocabulary length:', newLength);
        });
    }
}

// Make sure deleteWord is globally accessible
window.deleteWord = deleteWord;

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

// Export key functions for global access
window.showTab = showTab;
window.lookupInDictionary = lookupInDictionary;
window.addWord = addWord;
window.clearForm = clearForm;
window.toggleAdditionalFields = toggleAdditionalFields;
window.renderWordList = renderWordList;
window.showMessage = showMessage;