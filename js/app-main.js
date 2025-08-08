// ============================================================================
// MAIN APPLICATION CONTROLLER
// ============================================================================

// Global state (only if not already declared)
if (typeof currentLearningWord === 'undefined') {
    var currentLearningWord = null;
}
if (typeof learningSession === 'undefined') {
    var learningSession = [];
}
if (typeof sessionStats === 'undefined') {
    var sessionStats = { correct: 0, total: 0, streak: 0 };
}
if (typeof currentDictionaryData === 'undefined') {
    var currentDictionaryData = null;
}

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

// Dictionary lookup functions
async function lookupInDictionary() {
    const englishWord = document.getElementById('englishWord').value.trim();
    
    if (!englishWord) {
        alert('Please enter an English word first!');
        return;
    }

    // Show loading state
    const dictionaryResults = document.getElementById('dictionaryResults');
    if (!dictionaryResults) {
        console.error('Dictionary results container not found');
        return;
    }

    const loadingContent = window.UIComponents?.createInfoBox?.(
        '<div style="text-align: center; padding: 20px;">🔍 Looking up word...</div>',
        'info',
        'margin: 10px 0;'
    ) || '<div style="text-align: center; padding: 20px;">🔍 Looking up word...</div>';
    
    dictionaryResults.innerHTML = loadingContent;
    dictionaryResults.style.display = 'block';

    try {
        currentDictionaryData = await window.DictionaryService.lookupWithTranslation(englishWord);
        displayDictionaryResults(currentDictionaryData);
    } catch (error) {
        console.error('Dictionary lookup failed:', error);
        const errorContent = window.UIComponents?.createInfoBox?.(
            `<div style="color: #dc3545; text-align: center; padding: 20px;">
                ❌ Dictionary lookup failed: ${error.message}
                <br><small>Try checking your internet connection or use manual entry.</small>
            </div>`,
            'error',
            'margin: 10px 0;'
        ) || `<div style="color: #dc3545; text-align: center; padding: 20px;">
                ❌ Dictionary lookup failed: ${error.message}
                <br><small>Try checking your internet connection or use manual entry.</small>
            </div>`;
        
        dictionaryResults.innerHTML = errorContent;
    }
}

function displayDictionaryResults(data) {
    const dictionaryResults = document.getElementById('dictionaryResults');
    if (!dictionaryResults) {
        console.error('Dictionary results container not found');
        return;
    }
    
    // Build content using components
    let content = `
        <div style="line-height: 1.6;">
            <div style="margin-bottom: 15px;">
                <strong style="font-size: 1.2em; color: #2e7d32;">${data.word}</strong>
                ${data.phonetic ? `<span style="color: #666; margin-left: 10px;">${data.phonetic}</span>` : ''}
                ${data.partOfSpeech ? `<span style="background: #e3f2fd; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; margin-left: 10px;">${data.partOfSpeech}</span>` : ''}
            </div>
    `;
    
    if (data.definition) {
        content += `<div style="margin-bottom: 10px;"><strong>Definition:</strong> ${data.definition}</div>`;
    }
    
    if (data.translation) {
        content += window.UIComponents?.createInfoBox?.(
            `<strong>🇷🇺 Translation:</strong> ${data.translation}`,
            'info',
            'margin-bottom: 10px;'
        ) || `<div style="margin-bottom: 10px; background: #f0f8ff; padding: 10px; border-radius: 6px;"><strong>🇷🇺 Translation:</strong> ${data.translation}</div>`;
    }
    
    if (data.examples && data.examples.length > 0) {
        const examplesHtml = data.examples.map(example => 
            window.UIComponents?.createInfoBox?.(
                `<div style="font-style: italic; margin-bottom: 4px;">"${example.text}"</div>
                 ${window.UIComponents?.createSmallText?.(
                     `<span style="background: #e8f5e8; padding: 1px 6px; border-radius: 8px;">${example.partOfSpeech}</span>`,
                     '#666',
                     '0.8em'
                 ) || ''}`,
                'success'
            ) || ''
        ).join('');
        
        content += `<div style="margin-bottom: 15px;"><strong>📚 Usage Examples:</strong>${examplesHtml}</div>`;
    } else if (data.example) {
        content += `<div style="margin-bottom: 10px;"><strong>Example:</strong> <em>"${data.example}"</em></div>`;
    }
    
    if (data.synonyms && data.synonyms.length > 0) {
        content += `<div style="margin-bottom: 10px;"><strong>Synonyms:</strong> ${data.synonyms.join(', ')}</div>`;
    }
    
    const sourceText = `Source: ${data.source === 'dictionary-api' ? '📚 Dictionary API' : '💾 Local Database'}`;
    const examplesCount = data.examples && data.examples.length > 0 ? ` • ${data.examples.length} example${data.examples.length !== 1 ? 's' : ''}` : '';
    
    content += window.UIComponents?.createSmallText?.(sourceText + examplesCount, '#666', '0.8em', 'margin-top: 10px;') || '';
    
    content += '</div>';
    
    // Create container with buttons
    const containerContent = window.UIComponents?.createInfoBox?.(
        `<h4 style="margin-top: 0; color: #2e7d32;">📖 Dictionary Results</h4>
         ${content}
         ${window.UIComponents?.createFlexContainer?.(
             window.UIComponents?.createButton?.('✅ Use Dictionary Data', 'acceptDictionaryResults()', 'success') +
             window.UIComponents?.createButton?.('❌ Cancel', 'hideDictionaryResults()', 'secondary'),
             'row',
             'flex-start',
             'center',
             '10px',
             'margin-top: 15px;'
         ) || ''}`,
        'info',
        'margin: 10px 0;'
    ) || '';
    
    dictionaryResults.innerHTML = containerContent;
}

function acceptDictionaryResults() {
    if (!currentDictionaryData) return;
    
    // Show additional fields if they're hidden
    const additionalFields = document.getElementById('additionalFields');
    if (additionalFields.style.display === 'none' || !additionalFields.style.display) {
        toggleAdditionalFields();
    }
    
    // Auto-fill form with dictionary data
    document.getElementById('russianTranslation').value = currentDictionaryData.translation || '';
    document.getElementById('wordDefinition').value = currentDictionaryData.definition || '';
    document.getElementById('wordPhonetic').value = currentDictionaryData.phonetic || '';
    
    // Fill synonyms if available
    if (currentDictionaryData.synonyms && currentDictionaryData.synonyms.length > 0) {
        document.getElementById('wordSynonyms').value = currentDictionaryData.synonyms.join(', ');
    }
    
    // Fill examples if available
    if (currentDictionaryData.examples && currentDictionaryData.examples.length > 0) {
        const exampleTexts = currentDictionaryData.examples.map(example => 
            typeof example === 'string' ? example : example.text || example.toString()
        );
        document.getElementById('wordExamples').value = exampleTexts.join('\n');
    }
    
    hideDictionaryResults();
}

function hideDictionaryResults() {
    document.getElementById('dictionaryResults').style.display = 'none';
    currentDictionaryData = null;
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
        alert('This word already exists in your vocabulary!');
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
    
    // Reset dictionary data
    currentDictionaryData = null;
    hideDictionaryResults();
}

function clearForm() {
    document.getElementById('englishWord').value = '';
    document.getElementById('russianTranslation').value = '';
    document.getElementById('wordDefinition').value = '';
    document.getElementById('wordPhonetic').value = '';
    document.getElementById('wordSynonyms').value = '';
    document.getElementById('wordExamples').value = '';
    hideDictionaryResults();
    currentDictionaryData = null;
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

    const sortedWords = [...vocabulary].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    wordList.innerHTML = sortedWords.map(word => {
        // Calculate progress data
        const userProgress = window.DataManager?.userProgress || {};
        const progress = userProgress[word.id] || { correctCount: 0, totalAttempts: 0, lastSeen: null };
        // Calculate progress data (unused but kept for potential future use)
        // const progressPercentage = window.SpacedRepetition?.calculateLearningProgress?.(word.easeFactor || 1.3) || 0;
        
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
        
        // Create metadata with review status
        const nextReview = word.nextReview ? new Date(word.nextReview) : null;
        const isReady = !nextReview || isNaN(nextReview.getTime()) || nextReview <= new Date();
        const reviewText = nextReview && !isNaN(nextReview.getTime()) ? 
            (isReady ? 'Ready for review' : `Review: ${nextReview.toLocaleDateString()}`) :
            'New word';
            
        // Extended progress data (unused but kept for potential future use)
        // const extendedProgress = {
        //     ...progress,
        //     repetitions: word.repetition || 0,
        //     reviewStatus: reviewText,
        //     isReady: isReady,
        //     addedDate: new Date(word.createdAt || word.addedDate)
        // };
        
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
        alert('Error: Word not found!');
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
window.acceptDictionaryResults = acceptDictionaryResults;
window.hideDictionaryResults = hideDictionaryResults;
window.addWord = addWord;
window.clearForm = clearForm;
window.toggleAdditionalFields = toggleAdditionalFields;
window.renderWordList = renderWordList;
window.showMessage = showMessage;