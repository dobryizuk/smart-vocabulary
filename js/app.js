// ============================================================================
// DATA STRUCTURES & GLOBAL VARIABLES
// ============================================================================

let wordDatabase = null; // Will be loaded from Resources files
let userProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
let vocabulary = []; // Combined word data + user progress
let currentLearningWord = null;
let learningSession = [];
let sessionStats = { correct: 0, total: 0, streak: 0 };

// Speech synthesis configuration
let speechSettings = {
    enabled: true,
    rate: 0.8,
    pitch: 1.0,
    volume: 0.9,
    voice: null,
    autoPlay: true
};


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getTranslationSuggestion(englishWord) {
    if (!wordDatabase || !wordDatabase.words) return null;
    
    const word = wordDatabase.words.find(w => 
        w.english.toLowerCase() === englishWord.toLowerCase().trim()
    );
    
    return word ? word.russian : null;
}

// ============================================================================
// DICTIONARY API INTEGRATION
// ============================================================================

// Dictionary API service for fetching definitions and translations
class DictionaryService {
    static async lookupWord(word) {
        const cleanWord = word.toLowerCase().trim();
        
        try {
            // Try Free Dictionary API first
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
            
            if (!response.ok) {
                throw new Error(`Dictionary API error: ${response.status}`);
            }
            
            const data = await response.json();
            return this.parseApiResponse(data, cleanWord);
            
        } catch (error) {
            console.warn('Dictionary API failed:', error.message);
            return this.getFallbackDefinition(cleanWord);
        }
    }

    static parseApiResponse(data, word) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return this.getFallbackDefinition(word);
        }

        const entry = data[0];
        const meanings = entry.meanings || [];
        
        // Extract phonetic
        const phonetic = entry.phonetic || 
            entry.phonetics?.find(p => p.text)?.text || 
            '';

        // Extract definition (first noun, verb, or adjective meaning)
        let definition = '';
        let partOfSpeech = '';
        
        for (const meaning of meanings) {
            if (['noun', 'verb', 'adjective', 'adverb'].includes(meaning.partOfSpeech)) {
                partOfSpeech = meaning.partOfSpeech;
                definition = meaning.definitions?.[0]?.definition || '';
                break;
            }
        }

        // Extract examples from all meanings
        const examples = [];
        for (const meaning of meanings) {
            if (meaning.definitions && Array.isArray(meaning.definitions)) {
                for (const def of meaning.definitions) {
                    if (def.example) {
                        examples.push({
                            text: def.example,
                            partOfSpeech: meaning.partOfSpeech,
                            definition: def.definition
                        });
                    }
                }
            }
        }

        // Extract synonyms
        const synonyms = meanings[0]?.synonyms || [];

        return {
            word: entry.word,
            phonetic: phonetic,
            definition: definition || `A ${partOfSpeech || 'word'} in English.`,
            partOfSpeech: partOfSpeech,
            example: examples[0]?.text || '', // Keep legacy example field
            examples: examples.slice(0, 5), // New examples array
            synonyms: synonyms.slice(0, 5), // Limit to 5 synonyms
            source: 'dictionary-api',
            translation: null // Will be filled by translation service
        };
    }

    static getFallbackDefinition(word) {
        return {
            word: word,
            phonetic: '',
            definition: `English word: ${word}`,
            partOfSpeech: 'unknown',
            example: '',
            synonyms: [],
            source: 'fallback',
            translation: null
        };
    }

    // Translation service with Google Translate API
    static async translateWord(englishWord) {
        // First check local database
        const localTranslation = getTranslationSuggestion(englishWord);
        if (localTranslation) {
            return localTranslation;
        }

        // Try Google Translate API (free tier)
        try {
            const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=' + encodeURIComponent(englishWord));
            const data = await response.json();
            
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                return data[0][0][0];
            }
        } catch (error) {
            console.warn('Google Translate failed:', error.message);
        }

        // Fallback to MyMemory API
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(englishWord)}&langpair=en|ru`);
            const data = await response.json();
            
            if (data && data.responseData && data.responseData.translatedText) {
                return data.responseData.translatedText;
            }
        } catch (error) {
            console.warn('MyMemory API failed:', error.message);
        }

        // Final fallback
        return `перевод слова "${englishWord}"`;
    }

    static async lookupWithTranslation(word) {
        const [definition, translation] = await Promise.all([
            this.lookupWord(word),
            this.translateWord(word)
        ]);

        return {
            ...definition,
            translation: translation
        };
    }
}

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

        // Adjust based on difficulty - all buttons now add positive progress
        switch(difficulty) {
            case 'hard':
                easeFactor = Math.min(3.5, easeFactor + 0.05); // Small progress increase
                interval = Math.max(1, Math.round(interval * 0.8));
                break;
            case 'medium':
                easeFactor = Math.min(3.5, easeFactor + 0.1); // Medium progress increase
                break;
            case 'easy':
                easeFactor = Math.min(3.5, easeFactor + 0.2); // Good progress increase
                break;
            case 'perfect':
                easeFactor = Math.min(3.5, easeFactor + 0.3); // Best progress increase
                interval = Math.round(interval * 1.3);
                break;
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);

        return {
            nextReview: nextReview.toISOString(),
            interval,
            easeFactor,
            repetition: repetition + 1
        };
    }

    static getWordsForReview() {
        const now = new Date();
        console.log('🔍 Checking words for review at:', now.toISOString());
        
        const wordsForReview = vocabulary.filter(word => {
            // Always include new words (no nextReview date)
            if (!word.nextReview) {
                console.log('✅ New word ready:', word.english);
                return true;
            }
            
            const reviewDate = new Date(word.nextReview);
            const isReady = reviewDate <= now;
            
            console.log(`${isReady ? '✅' : '⏰'} ${word.english}: review ${reviewDate.toISOString()} vs now ${now.toISOString()}`);
            
            return isReady;
        });
        
        console.log(`📚 Found ${wordsForReview.length} words ready for review out of ${vocabulary.length} total`);
        return wordsForReview;
    }
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
        updateStats();
    } else if (tabName === 'learn') {
        prepareLearningSession();
    }
}

// Dictionary lookup functions
let currentDictionaryData = null;

async function lookupInDictionary() {
    const englishWord = document.getElementById('englishWord').value.trim();
    
    if (!englishWord) {
        alert('Please enter an English word first!');
        return;
    }

    // Show loading state
    const dictionaryContent = document.getElementById('dictionaryContent');
    dictionaryContent.innerHTML = '<div style="text-align: center; padding: 20px;">🔍 Looking up word...</div>';
    document.getElementById('dictionaryResults').style.display = 'block';

    try {
        currentDictionaryData = await DictionaryService.lookupWithTranslation(englishWord);
        displayDictionaryResults(currentDictionaryData);
    } catch (error) {
        console.error('Dictionary lookup failed:', error);
        dictionaryContent.innerHTML = `
            <div style="color: #dc3545; text-align: center; padding: 20px;">
                ❌ Dictionary lookup failed: ${error.message}
                <br><small>Try checking your internet connection or use manual entry.</small>
            </div>
        `;
    }
}

function displayDictionaryResults(data) {
    const content = document.getElementById('dictionaryContent');
    
    content.innerHTML = `
        <div style="line-height: 1.6;">
            <div style="margin-bottom: 15px;">
                <strong style="font-size: 1.2em; color: #2e7d32;">${data.word}</strong>
                ${data.phonetic ? `<span style="color: #666; margin-left: 10px;">${data.phonetic}</span>` : ''}
                ${data.partOfSpeech ? `<span style="background: #e3f2fd; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; margin-left: 10px;">${data.partOfSpeech}</span>` : ''}
            </div>
            
            ${data.definition ? `
                <div style="margin-bottom: 10px;">
                    <strong>Definition:</strong> ${data.definition}
                </div>
            ` : ''}
            
            ${data.translation ? `
                <div style="margin-bottom: 10px; background: #f0f8ff; padding: 10px; border-radius: 6px;">
                    <strong>🇷🇺 Translation:</strong> ${data.translation}
                </div>
            ` : ''}
            
            ${data.examples && data.examples.length > 0 ? `
                <div style="margin-bottom: 15px;">
                    <strong>📚 Usage Examples:</strong>
                    ${data.examples.map(example => `
                        <div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #2e7d32;">
                            <div style="font-style: italic; margin-bottom: 4px;">"${example.text}"</div>
                            <div style="font-size: 0.8em; color: #666;">
                                <span style="background: #e8f5e8; padding: 1px 6px; border-radius: 8px;">${example.partOfSpeech}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : data.example ? `
                <div style="margin-bottom: 10px;">
                    <strong>Example:</strong> <em>"${data.example}"</em>
                </div>
            ` : ''}
            
            ${data.synonyms && data.synonyms.length > 0 ? `
                <div style="margin-bottom: 10px;">
                    <strong>Synonyms:</strong> ${data.synonyms.join(', ')}
                </div>
            ` : ''}
            
            <div style="font-size: 0.8em; color: #666; margin-top: 10px;">
                Source: ${data.source === 'dictionary-api' ? '📚 Dictionary API' : '💾 Local Database'}
                ${data.examples && data.examples.length > 0 ? ` • ${data.examples.length} example${data.examples.length !== 1 ? 's' : ''}` : ''}
            </div>
        </div>
    `;
}

function acceptDictionaryResults() {
    if (!currentDictionaryData) return;
    
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
    alert('✅ Dictionary data applied!');
}

function hideDictionaryResults() {
    document.getElementById('dictionaryResults').style.display = 'none';
    currentDictionaryData = null;
}

async function addWord() {
    const english = document.getElementById('englishWord').value.trim();
    const russian = document.getElementById('russianTranslation').value.trim();
    const notes = document.getElementById('wordNotes').value.trim();
    const definition = document.getElementById('wordDefinition').value.trim();
    const phonetic = document.getElementById('wordPhonetic').value.trim();
    const synonymsText = document.getElementById('wordSynonyms').value.trim();
    const examplesText = document.getElementById('wordExamples').value.trim();

    if (!english || !russian) {
        alert('Please fill in both English and Russian fields!');
        return;
    }

    // Check for duplicates
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
        notes,
        definition,
        phonetic,
        partOfSpeech: currentDictionaryData?.partOfSpeech || '',
        example: examples[0] || '',
        examples,
        synonyms,
        category: 'user-added',
        difficulty: 'beginner',
        createdAt: new Date().toISOString(),
        repetition: 0,
        easeFactor: 1.3,
        nextReview: null,
        reviewHistory: [],
        lastExerciseType: null,
        lastExerciseDate: null
    };

    // Add to vocabulary array
    vocabulary.push(newWord);
    
    console.log('✅ Word added successfully!');
    console.log('📝 Word details:', {
        english: newWord.english,
        russian: newWord.russian,
        definition: newWord.definition || '(empty)',
        phonetic: newWord.phonetic || '(empty)',
        synonyms: newWord.synonyms.length > 0 ? newWord.synonyms : '(empty)',
        examples: newWord.examples.length > 0 ? newWord.examples : '(empty)',
        notes: newWord.notes || '(empty)'
    });
    console.log('📊 Total vocabulary size:', vocabulary.length);
    
    // Save all data (simplified approach)
    saveUserProgress();
    saveAllVocabulary();
    
    clearForm();
    alert('Word added successfully! 🎉');
    
    // Reset dictionary data
    currentDictionaryData = null;
    hideDictionaryResults();
}

function clearForm() {
    document.getElementById('englishWord').value = '';
    document.getElementById('russianTranslation').value = '';
    document.getElementById('wordNotes').value = '';
    document.getElementById('wordDefinition').value = '';
    document.getElementById('wordPhonetic').value = '';
    document.getElementById('wordSynonyms').value = '';
    document.getElementById('wordExamples').value = '';
    hideDictionaryResults();
    currentDictionaryData = null;
}

function calculateLearningProgress(easeFactor) {
    const MIN_EASE = 1.3;
    const MAX_EASE = 3.5;
    
    if (easeFactor <= MIN_EASE) return 0;
    if (easeFactor >= MAX_EASE) return 100;
    
    return Math.round(((easeFactor - MIN_EASE) / (MAX_EASE - MIN_EASE)) * 100);
}

function renderWordList() {
    const wordList = document.getElementById('wordList');
    const wordCount = document.getElementById('wordCount');
    
    wordCount.textContent = vocabulary.length;

    if (vocabulary.length === 0) {
        wordList.innerHTML = `
            <div class="empty-state">
                <h3>No words yet!</h3>
                <p>Add your first word in the "Add Words" tab</p>
            </div>
        `;
        return;
    }

    const sortedWords = [...vocabulary].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    wordList.innerHTML = sortedWords.map(word => {
        const nextReview = word.nextReview ? new Date(word.nextReview) : null;
        const isReady = !nextReview || nextReview <= new Date();
        const reviewText = nextReview ? 
            (isReady ? 'Ready for review' : `Review: ${nextReview.toLocaleDateString()}`) :
            'New word';

        const progressPercentage = calculateLearningProgress(word.easeFactor || 1.3);
        const progressColor = progressPercentage >= 70 ? '#4caf50' : 
                            progressPercentage >= 40 ? '#ff9800' : 
                            progressPercentage >= 15 ? '#ffc107' : '#f44336';

        // Determine word status for enhanced display
        let status = 'new';
        let statusText = 'New word';
        if (word.repetition > 0) {
            if (word.repetition < 3) {
                status = 'learning';
                statusText = 'Learning';
            } else if (word.repetition < 8) {
                status = 'familiar';
                statusText = 'Familiar';
            } else {
                status = 'mastered';
                statusText = 'Mastered';
            }
        }
        
        return `
            <div class="word-item" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 15px; box-shadow: 0 6px 16px rgba(102, 126, 234, 0.08); transition: all 0.3s ease; position: relative; overflow: hidden; padding: 16px;">
                <!-- Header with word and buttons -->
                <div style="position: relative; margin-bottom: 8px;">
                    <div style="padding-right: 100px;">
                        <div class="word-english" style="font-size: 1.2em; font-weight: 600; color: #2d3748; margin-bottom: 6px;">
                            ${word.english}
                            ${word.phonetic ? `<span style="color: #718096; font-weight: 400; font-size: 0.9em; margin-left: 8px;">${word.phonetic}</span>` : ''}
                        </div>
                        <div class="word-russian" style="font-size: 1.05em; color: #4a5568; font-weight: 500; margin-bottom: 0;">${word.russian}</div>
                    </div>
                    <div class="word-actions" style="position: absolute; top: 0; right: 0; display: flex; gap: 6px; z-index: 10;">
                        <button class="btn btn-secondary" onclick="speakWord('${word.english}')" 
                                style="background: rgba(102, 126, 234, 0.1); color: #667eea; border: 1px solid #667eea; padding: 8px 12px; border-radius: 20px; font-size: 0.85em; min-width: auto; font-weight: 500; cursor: pointer;">🔊</button>
                        <button class="btn btn-danger" onclick="deleteWord('${word.id}'); console.log('Delete button clicked for: ${word.id}');" 
                                style="background: rgba(229, 62, 62, 0.1); color: #e53e3e; border: 1px solid #e53e3e; padding: 8px 12px; border-radius: 20px; font-size: 0.85em; min-width: auto; font-weight: 500; cursor: pointer;">🗑️</button>
                    </div>
                </div>
                
                <!-- Progress section -->
                <div class="word-progress-display" style="background: rgba(255,255,255,0.7); border-radius: 8px; margin: 0 -16px 12px -16px; padding: 8px 16px;">
                    <div class="progress-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span class="progress-label">Learning Progress</span>
                        <span class="progress-percentage" style="background: ${progressColor};">${progressPercentage}%</span>
                    </div>
                    <div class="progress-bar-container" style="height: 8px; margin: 4px 0;">
                        <div class="progress-bar-fill" style="width: ${Math.max(5, progressPercentage)}%; background: linear-gradient(90deg, ${progressColor}, ${progressColor}dd);"></div>
                    </div>
                    <div class="word-metadata" style="margin-top: 6px; font-size: 0.8em; display: flex; flex-direction: column; gap: 2px;">
                        <div class="metadata-item" style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.6); padding: 4px 8px; border-radius: 6px;">
                            <span class="metadata-icon">🔄</span>
                            <span>${word.repetition} repetitions</span>
                        </div>
                        <div class="metadata-item" style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.6); padding: 4px 8px; border-radius: 6px;">
                            <span class="metadata-icon">${isReady ? '✅' : '📅'}</span>
                            <span>${reviewText}</span>
                        </div>
                        <div class="metadata-item" style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.6); padding: 4px 8px; border-radius: 6px;">
                            <span class="metadata-icon">📅</span>
                            <span>Added ${new Date(word.createdAt || word.addedDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                
                ${word.definition ? `
                    <!-- Definition section -->
                    <div style="background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%); padding: 10px 16px; margin: 0 -16px 12px -16px; border-left: 4px solid #4299e1; border-radius: 0;">
                        <div style="font-size: 0.9em; font-weight: 600; color: #2b6cb0; margin-bottom: 4px;">📖 Definition</div>
                        <div style="font-size: 1em; color: #2d3748; line-height: 1.3; font-weight: 400;">${word.definition}</div>
                    </div>
                ` : ''}
                
                ${word.synonyms && word.synonyms.length > 0 ? `
                    <!-- Synonyms section -->
                    <div style="background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%); padding: 10px 16px; margin: 0 -16px 12px -16px; border-left: 4px solid #38a169; border-radius: 0;">
                        <div style="font-size: 0.9em; font-weight: 600; color: #2f855a; margin-bottom: 4px;">🔄 Synonyms</div>
                        <div style="font-size: 1em; color: #2d3748; line-height: 1.3; font-weight: 400;">${word.synonyms.join(', ')}</div>
                    </div>
                ` : ''}
                
                ${word.examples && word.examples.length > 0 ? `
                    <!-- Examples section -->
                    <div style="background: linear-gradient(135deg, #fffbf0 0%, #fef5e7 100%); padding: 10px 16px; margin: 0 -16px 12px -16px; border-left: 4px solid #d69e2e; border-radius: 0;">
                        <div style="font-size: 0.9em; font-weight: 600; color: #b7791f; margin-bottom: 4px;">💡 Examples</div>
                        <div style="font-size: 1em; color: #2d3748; line-height: 1.3; font-weight: 400;">
                            ${word.examples.map(example => {
                                const text = typeof example === 'string' ? example : example.text || example.toString();
                                return `• ${text}`;
                            }).join('<br>')}
                        </div>
                    </div>
                ` : ''}
                
                ${word.notes ? `
                    <!-- Notes section -->
                    <div style="background: #fef5e7; padding: 6px 16px; margin: 0 -16px 0 -16px; border-left: 3px solid #d69e2e;">
                        <div style="font-size: 0.8em; color: #d69e2e; font-weight: 600;">📝 Notes: ${word.notes}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function deleteWord(id) {
    console.log('🗑️ deleteWord called with ID:', id);
    console.log('🗑️ Current vocabulary length:', vocabulary.length);
    
    const wordToDelete = vocabulary.find(word => word.id === id);
    
    if (!wordToDelete) {
        console.error('❌ Word not found with ID:', id);
        alert('Error: Word not found!');
        return;
    }
    
    // Show custom confirmation dialog
    showDeleteConfirmation(wordToDelete, () => {
        // User confirmed deletion
        console.log('🗑️ User confirmed deletion');
        
        // Remove from vocabulary array
        vocabulary = vocabulary.filter(word => word.id !== id);
        
        // Remove from user progress
        delete userProgress[id];
        
        // Save all data
        saveUserProgress();
        saveAllVocabulary();
        renderWordList();
        updateStats();
        
        console.log('🗑️ Word deleted successfully:', wordToDelete.english);
        console.log('🗑️ New vocabulary length:', vocabulary.length);
    });
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

// Make sure deleteWord is globally accessible
window.deleteWord = deleteWord;

// ============================================================================
// LEARNING SESSION FUNCTIONS  
// ============================================================================

function prepareLearningSession() {
    const wordsForReview = SpacedRepetition.getWordsForReview();
    const learningContent = document.getElementById('learningContent');

    if (wordsForReview.length === 0) {
        // Check if we have any words at all
        const hasWords = vocabulary.length > 0;
        
        learningContent.innerHTML = `
            <div class="empty-state">
                <h3>Great job! 🎉</h3>
                <p>No words need review right now. Come back later or add more words!</p>
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="showTab('add')">➕ Add More Words</button>
                    ${hasWords ? `
                        <button class="btn btn-secondary" onclick="forceStartLearning()" 
                                style="background: #ff9500; color: white; border: none;">
                            🔄 Practice All Words
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        return;
    }

    learningSession = [...wordsForReview].sort(() => Math.random() - 0.5);
    startLearning();
}

function startLearning() {
    const wordsForReview = SpacedRepetition.getWordsForReview();
    
    if (wordsForReview.length === 0) {
        prepareLearningSession();
        return;
    }

    learningSession = [...wordsForReview].sort(() => Math.random() - 0.5);
    currentLearningWord = learningSession[0];
    showLearningCard();
}

function forceStartLearning() {
    // Practice all words regardless of schedule - useful for debugging and extra practice
    if (vocabulary.length === 0) {
        alert('No words available to practice!');
        return;
    }

    console.log('🚀 Force starting learning session with all words');
    learningSession = [...vocabulary].sort(() => Math.random() - 0.5);
    currentLearningWord = learningSession[0];
    showLearningCard();
}

function showLearningCard() {
    if (!currentLearningWord) {
        endLearningSession();
        return;
    }

    // Determine exercise type for this word
    const exerciseType = determineExerciseType(currentLearningWord);
    currentLearningWord.currentExerciseType = exerciseType;
    currentLearningWord.lastExerciseDate = new Date().toISOString();
    currentLearningWord.lastExerciseType = exerciseType;

    // Show appropriate exercise type
    if (exerciseType === 'reverse') {
        showReverseTranslationCard();
        return;
    }

    // Continue with regular exercise (existing code)

    const learningContent = document.getElementById('learningContent');
    
    // Calculate progress data for enhanced display
    const progressPercentage = Math.round(((currentLearningWord.easeFactor - 1.3) / (3.5 - 1.3)) * 100);
    const progressColor = progressPercentage < 20 ? '#e53e3e' : 
                         progressPercentage < 50 ? '#d69e2e' : 
                         progressPercentage < 75 ? '#38a169' : '#2b6cb0';
    
    // Determine word status
    let status = 'new';
    let statusText = 'New word';
    if (currentLearningWord.repetition > 0) {
        if (currentLearningWord.repetition < 3) {
            status = 'learning';
            statusText = 'Learning';
        } else if (currentLearningWord.repetition < 8) {
            status = 'familiar';
            statusText = 'Familiar';
        } else {
            status = 'mastered';
            statusText = 'Mastered';
        }
    }
    
    learningContent.innerHTML = `
        <div class="learning-card">
            <!-- Word Header -->
            <div style="text-align: center; position: relative;">
                <div class="card-word">${currentLearningWord.english}</div>
                ${currentLearningWord.phonetic ? `<div class="card-phonetic">${currentLearningWord.phonetic}</div>` : ''}
                <button onclick="speakWord('${currentLearningWord.english}')" 
                        style="background: #007aff; color: white; border: none; width: 44px; height: 44px; border-radius: 22px; font-size: 18px; display: flex; align-items: center; justify-content: center; position: absolute; right: 0; top: 50%; transform: translateY(-50%);">
                    🔊
                </button>
            </div>
            
            <!-- Progress Section -->
            <div class="word-progress-display">
                <div class="progress-header">
                    <span class="progress-label">Progress</span>
                    <span class="progress-percentage">${Math.max(0, progressPercentage)}%</span>
                </div>
                <div class="progress-bar-container" style="height: 6px; border-radius: 3px; background: #e5e5ea;">
                    <div class="progress-bar-fill" style="width: ${Math.max(5, progressPercentage)}%; background: #007aff; border-radius: 3px; height: 100%;"></div>
                </div>
                <div class="word-metadata">
                    <div class="metadata-item">
                        <span>🔄</span>
                        <span>${currentLearningWord.repetition} repetitions</span>
                    </div>
                    <div class="metadata-item">
                        <span>📅</span>
                        <span>Added ${new Date(currentLearningWord.addedDate || currentLearningWord.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            
            <!-- Translation Card -->
            <div id="cardTranslation" style="background: transparent; margin: 0; border-radius: 0; padding: 0; text-align: center;">
                <div style="color: #8e8e93; font-size: 0.9em; margin-bottom: 12px;">💭 Tap to reveal answer</div>
            </div>
            
            <!-- Action Button -->
            <div id="showAnswerButton" style="margin-bottom: 12px;">
                <button onclick="showTranslation()" 
                        style="width: 100%; background: #007aff; color: white; border: none; padding: 10px; border-radius: 10px; font-size: 0.9em; font-weight: 600;">
                    Show Answer
                </button>
            </div>
            
            <!-- Difficulty Buttons (hidden initially) -->
            <div id="difficultyButtons" style="display: none; margin-bottom: 8px; text-align: center;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; max-width: 400px; margin: 0 auto;">
                    <button onclick="markDifficulty('hard')" 
                            style="background: #ff3b30; color: white; border: none; padding: 8px 4px; border-radius: 8px; font-weight: 600; font-size: 0.7em; line-height: 1.2; display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 1.2em;">😰</div>
                        <div>Hard</div>
                    </button>
                    <button onclick="markDifficulty('medium')" 
                            style="background: #ff9500; color: white; border: none; padding: 8px 4px; border-radius: 8px; font-weight: 600; font-size: 0.7em; line-height: 1.2; display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 1.2em;">🤔</div>
                        <div>Medium</div>
                    </button>
                    <button onclick="markDifficulty('easy')" 
                            style="background: #34c759; color: white; border: none; padding: 8px 4px; border-radius: 8px; font-weight: 600; font-size: 0.7em; line-height: 1.2; display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 1.2em;">😊</div>
                        <div>OK</div>
                    </button>
                    <button onclick="markDifficulty('perfect')" 
                            style="background: #007aff; color: white; border: none; padding: 8px 4px; border-radius: 8px; font-weight: 600; font-size: 0.7em; line-height: 1.2; display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 1.2em;">🎯</div>
                        <div>Easy</div>
                    </button>
                </div>
            </div>
            
            <!-- Session Progress -->
            <div style="margin-top: 12px; padding: 8px; background: rgba(0,122,255,0.1); text-align: center; color: #007aff; font-weight: 500; font-size: 0.85em; border-radius: 12px;">
                ${learningSession.length - learningSession.indexOf(currentLearningWord)} of ${learningSession.length} words
            </div>
        </div>
    `;
    
    // Auto-play pronunciation when showing new word
    if (speechSettings.enabled && speechSettings.autoPlay) {
        setTimeout(() => {
            speakWord(currentLearningWord.english);
        }, 500); // Delay for DOM initialization
    }
}

async function showTranslation() {
    const card = document.getElementById('cardTranslation');
    
    // Show enhanced translation with better styling
    let content = `
        <div style="background: #f2f2f7; padding: 16px 20px; margin-bottom: 8px; text-align: center; border-radius: 12px;">
            <div style="color: #8e8e93; font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Translation</div>
            <div style="font-size: 1.3em; font-weight: 700; color: #1d1d1f;">
                ${currentLearningWord.russian}
            </div>
        </div>
        ${currentLearningWord.definition ? `
            <div style="background: rgba(0,122,255,0.1); padding: 16px 20px; margin-bottom: 8px; text-align: center; border-radius: 12px;">
                <div style="font-weight: 600; color: #007aff; margin-bottom: 6px; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px;">Definition</div>
                <div style="color: #1d1d1f; line-height: 1.3; font-size: 0.95em; font-weight: 500;">${currentLearningWord.definition}</div>
            </div>
        ` : ''}
        ${currentLearningWord.examples && currentLearningWord.examples.length > 0 ? `
            <div style="background: rgba(52, 199, 89, 0.1); padding: 16px 20px; margin-bottom: 8px; text-align: center; border-radius: 12px;">
                <div style="font-weight: 600; color: #34c759; margin-bottom: 6px; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px;">Examples</div>
                <div>
                    ${currentLearningWord.examples.slice(0, 2).map(example => {
                        const text = typeof example === 'string' ? example : example.text || example.toString();
                        return `<div style="color: #1d1d1f; line-height: 1.2; font-size: 0.85em; margin-bottom: 4px; font-style: italic;">
                            "${text}"
                        </div>`;
                    }).join('')}
                </div>
            </div>
        ` : ''}
    `;
    
    // Try to get dictionary definition and examples if not available
    if (!currentLearningWord.definition && currentLearningWord.english) {
        content += '<br><div style="color: #666; font-style: italic;">🔍 Loading definition and examples...</div>';
        card.innerHTML = content;
        card.style.opacity = '1';
        
        try {
            const dictionaryData = await DictionaryService.lookupWord(currentLearningWord.english);
            if (dictionaryData) {
                content = content.replace('🔍 Loading definition and examples...', '');
                
                // Add definition
                if (dictionaryData.definition) {
                    content += `<div style="background: #f0f8ff; padding: 10px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #2196F3;">
                        <strong>📖 Definition:</strong> ${dictionaryData.definition}
                    </div>`;
                }
                
                // Add examples
                if (dictionaryData.examples && dictionaryData.examples.length > 0) {
                    content += `<div style="background: #f8f9fa; padding: 12px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #28a745;">
                        <strong>📚 Usage Examples:</strong>
                        ${dictionaryData.examples.slice(0, 2).map(example => `
                            <div style="margin: 6px 0 8px 0; font-style: italic; color: #333;">
                                "${example.text}"
                                <span style="font-size: 0.8em; color: #666; font-style: normal; margin-left: 8px;">
                                    (${example.partOfSpeech})
                                </span>
                            </div>
                        `).join('')}
                    </div>`;
                } else if (dictionaryData.example) {
                    content += `<div style="background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #28a745;">
                        <strong>📚 Example:</strong> <em>"${dictionaryData.example}"</em>
                    </div>`;
                }
            }
        } catch (error) {
            console.warn('Failed to load definition and examples:', error);
            content = content.replace('🔍 Loading definition and examples...', '');
        }
    } else if (currentLearningWord.example) {
        // Show existing example if available
        content += `<br><div style="background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #28a745;">
            <strong>📚 Example:</strong> <em>"${currentLearningWord.example}"</em>
        </div>`;
    }
    
    // Add notes if available
    if (currentLearningWord.notes) {
        const notesWithoutExamples = currentLearningWord.notes
            .replace(/--- Usage Examples ---[\s\S]*?(?=\n\n---|$)/g, '')
            .replace(/--- Dictionary Data ---[\s\S]*?(?=\n\n---|$)/g, '')
            .trim();
        
        if (notesWithoutExamples) {
            content += `<br><div style="background: #fff8e1; padding: 8px; margin: 8px 0; border-radius: 4px; font-size: 0.9em;">
                <strong>📝 Notes:</strong> ${notesWithoutExamples.replace(/\n/g, '<br>')}
            </div>`;
        }
    }
    
    card.innerHTML = content;
    card.style.opacity = '1';
    
    // Hide Show Answer button and show difficulty buttons
    document.getElementById('showAnswerButton').style.display = 'none';
    document.getElementById('difficultyButtons').style.display = 'flex';
}

function markDifficulty(difficulty) {
    const word = currentLearningWord;
    const reviewData = SpacedRepetition.calculateNextReview(
        difficulty, 
        word.repetition, 
        word.easeFactor
    );

    // Update word data
    Object.assign(word, reviewData);
    word.reviewHistory.push({
        date: new Date().toISOString(),
        difficulty,
        exerciseType: word.currentExerciseType || 'regular'
    });

    // Update session stats
    sessionStats.total++;
    if (difficulty === 'easy' || difficulty === 'perfect') {
        sessionStats.correct++;
        sessionStats.streak++;
    } else {
        sessionStats.streak = 0;
    }

    // Move to next word
    learningSession.shift();
    currentLearningWord = learningSession[0];

    saveUserProgress();
    showLearningCard();
}

function endLearningSession() {
    const learningContent = document.getElementById('learningContent');
    
    learningContent.innerHTML = `
        <div class="empty-state">
            <h3>Session Complete! 🎉</h3>
            <p>Great work! You reviewed ${sessionStats.total} words.</p>
            <p>Accuracy: ${sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}%</p>
            <p>Best streak: ${sessionStats.streak}</p>
            <button class="btn btn-primary" onclick="startLearning()">🔄 Start New Session</button>
            <button class="btn btn-secondary" onclick="showTab('stats')">📊 View Statistics</button>
        </div>
    `;

    sessionStats = { correct: 0, total: 0, streak: 0 };
}

// ============================================================================
// REVERSE TRANSLATION SYSTEM
// ============================================================================

function isEligibleForReverseTranslation(word) {
    // Word must have at least one "easy" or "perfect" review
    return word.reviewHistory.some(review => 
        review.difficulty === 'easy' || review.difficulty === 'perfect'
    );
}

function canShowReverseExercise(word) {
    // Check if enough time has passed since last exercise of same type
    const now = new Date();
    const lastExerciseDate = word.lastExerciseDate ? new Date(word.lastExerciseDate) : null;
    const timeSinceLastExercise = lastExerciseDate ? now - lastExerciseDate : Infinity;
    const minInterval = 10 * 60 * 1000; // 10 minutes
    
    // Allow if different exercise type or enough time has passed
    return !lastExerciseDate || 
           word.lastExerciseType !== 'reverse' || 
           timeSinceLastExercise >= minInterval;
}

function determineExerciseType(word) {
    if (!isEligibleForReverseTranslation(word)) {
        return 'regular';
    }
    
    if (!canShowReverseExercise(word)) {
        return 'regular';
    }
    
    // Randomly choose between regular and reverse (50/50 chance)
    return Math.random() < 0.5 ? 'regular' : 'reverse';
}

function normalizeText(text) {
    return text.toLowerCase()
        .trim()
        .replace(/[.,!?;:]/g, '') // Remove punctuation
        .replace(/\s+/g, ' '); // Normalize whitespace
}

function calculateTypingAccuracy(userInput, correctAnswer) {
    const normalizedInput = normalizeText(userInput);
    const normalizedAnswer = normalizeText(correctAnswer);
    
    if (normalizedInput === normalizedAnswer) {
        return { accuracy: 100, difficulty: 'perfect' };
    }
    
    // Calculate Levenshtein distance for similarity
    const distance = levenshteinDistance(normalizedInput, normalizedAnswer);
    const maxLength = Math.max(normalizedInput.length, normalizedAnswer.length);
    const accuracy = Math.max(0, Math.round((1 - distance / maxLength) * 100));
    
    // Determine difficulty based on accuracy
    if (accuracy >= 90) return { accuracy, difficulty: 'easy' };
    if (accuracy >= 70) return { accuracy, difficulty: 'medium' };
    return { accuracy, difficulty: 'hard' };
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

function showReverseTranslationCard() {
    const learningContent = document.getElementById('learningContent');
    const card = learningContent.querySelector('.learning-card');
    
    if (!card) return;
    
    const content = `
        <div class="word-metadata" style="margin: 0 0 16px 0;">
            <div class="metadata-item">
                <span class="metadata-icon">🔄</span>
                <span>Reverse Translation Exercise</span>
            </div>
        </div>
        
        <div class="card-word">${currentLearningWord.russian}</div>
        
        <div style="margin: 20px 0;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">
                Type the English translation:
            </label>
            <input type="text" 
                   id="reverseTranslationInput" 
                   placeholder="Enter English word or phrase..."
                   style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1em; transition: border-color 0.3s ease;"
                   onkeypress="handleReverseInputKeyPress(event)"
                   oninput="validateReverseInput()">
            <div id="typingFeedback" style="margin-top: 8px; font-size: 0.9em; min-height: 20px;"></div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
            <button class="btn btn-primary" 
                    id="checkAnswerButton" 
                    onclick="checkReverseTranslation()"
                    disabled
                    style="padding: 12px 24px; font-size: 1em; opacity: 0.5;">
                ✓ Check Answer
            </button>
            <button class="btn btn-secondary" 
                    onclick="showAnswerForReverse()"
                    style="padding: 12px 24px; font-size: 1em; margin-left: 12px;">
                👁️ Show Answer
            </button>
        </div>
        
        <div id="difficultyButtons" class="difficulty-buttons" style="display: none; margin-top: 20px;">
            <button class="btn btn-danger" onclick="markDifficulty('hard')">😫 Hard</button>
            <button class="btn btn-warning" onclick="markDifficulty('medium')">🤔 Medium</button>
            <button class="btn btn-success" onclick="markDifficulty('easy')">😊 Easy</button>
            <button class="btn btn-success" onclick="markDifficulty('perfect')" style="background: #28a745;">🎯 Perfect</button>
        </div>
    `;
    
    card.innerHTML = content;
    card.style.opacity = '1';
    
    // Focus on input
    setTimeout(() => {
        const input = document.getElementById('reverseTranslationInput');
        if (input) input.focus();
    }, 100);
}

function validateReverseInput() {
    const input = document.getElementById('reverseTranslationInput');
    const checkButton = document.getElementById('checkAnswerButton');
    const feedback = document.getElementById('typingFeedback');
    
    const userInput = input.value.trim();
    const hasContent = userInput.length > 0;
    
    // Enable/disable check button
    checkButton.disabled = !hasContent;
    checkButton.style.opacity = hasContent ? '1' : '0.5';
    
    // Provide real-time feedback
    if (hasContent) {
        const result = calculateTypingAccuracy(userInput, currentLearningWord.english);
        if (result.accuracy === 100) {
            feedback.innerHTML = '<span style="color: #28a745;">✓ Perfect match!</span>';
            input.style.borderColor = '#28a745';
        } else if (result.accuracy >= 70) {
            feedback.innerHTML = '<span style="color: #ffc107;">⚠ Close, but check your spelling</span>';
            input.style.borderColor = '#ffc107';
        } else {
            feedback.innerHTML = '<span style="color: #666;">Keep typing...</span>';
            input.style.borderColor = '#e9ecef';
        }
    } else {
        feedback.innerHTML = '';
        input.style.borderColor = '#e9ecef';
    }
}

function handleReverseInputKeyPress(event) {
    if (event.key === 'Enter' && !document.getElementById('checkAnswerButton').disabled) {
        checkReverseTranslation();
    }
}

function checkReverseTranslation() {
    const input = document.getElementById('reverseTranslationInput');
    const userInput = input.value.trim();
    
    if (!userInput) return;
    
    const result = calculateTypingAccuracy(userInput, currentLearningWord.english);
    
    // Show result
    const feedback = document.getElementById('typingFeedback');
    feedback.innerHTML = `
        <div style="padding: 12px; border-radius: 8px; background: ${result.accuracy >= 90 ? '#d4edda' : result.accuracy >= 70 ? '#fff3cd' : '#f8d7da'}; 
                    color: ${result.accuracy >= 90 ? '#155724' : result.accuracy >= 70 ? '#856404' : '#721c24'}; border: 1px solid ${result.accuracy >= 90 ? '#c3e6cb' : result.accuracy >= 70 ? '#ffeaa7' : '#f5c6cb'};">
            <strong>Accuracy: ${result.accuracy}%</strong><br>
            Correct answer: <strong>${currentLearningWord.english}</strong><br>
            Your answer: <strong>${userInput}</strong>
        </div>
    `;
    
    // Automatically mark difficulty based on accuracy
    setTimeout(() => {
        markDifficulty(result.difficulty);
    }, 2000); // Give user time to see the result
}

function showAnswerForReverse() {
    const input = document.getElementById('reverseTranslationInput');
    const feedback = document.getElementById('typingFeedback');
    
    input.value = currentLearningWord.english;
    input.style.borderColor = '#28a745';
    feedback.innerHTML = '<span style="color: #28a745;">✓ Answer revealed</span>';
    
    // Hide input controls and show difficulty buttons
    document.getElementById('checkAnswerButton').style.display = 'none';
    document.querySelector('button[onclick="showAnswerForReverse()"]').style.display = 'none';
    document.getElementById('difficultyButtons').style.display = 'flex';
}

// ============================================================================
// STATISTICS AND ANALYTICS
// ============================================================================

function updateStats() {
    const totalWords = vocabulary.length;
    
    // Calculate progress-based statistics
    const wellKnownWords = vocabulary.filter(word => {
        const progress = calculateLearningProgress(word.easeFactor || 1.3);
        return progress >= 70; // Green progress bar (well known)
    }).length;
    
    const inProgressWords = vocabulary.filter(word => {
        const progress = calculateLearningProgress(word.easeFactor || 1.3);
        return progress >= 40 && progress < 70; // Yellow/Orange progress bar (in progress)
    }).length;
    
    const difficultWords = vocabulary.filter(word => {
        const progress = calculateLearningProgress(word.easeFactor || 1.3);
        return progress < 40; // Red progress bar (difficult)
    }).length;
    
    const reviewWords = SpacedRepetition.getWordsForReview().length;
    const streak = Math.max(...vocabulary.map(word => 
        word.reviewHistory.filter((review, index, arr) => 
            index === arr.length - 1 || 
            arr[index + 1] && (review.difficulty === 'easy' || review.difficulty === 'perfect')
        ).length
    ), 0);

    document.getElementById('totalWordsCount').textContent = totalWords;
    document.getElementById('learnedWordsCount').textContent = wellKnownWords;
    document.getElementById('inProgressWordsCount').textContent = inProgressWords;
    document.getElementById('difficultWordsCount').textContent = difficultWords;
    document.getElementById('reviewWordsCount').textContent = reviewWords;
    document.getElementById('streakCount').textContent = streak;
    
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
            const now = new Date();
            console.log(`${word.english}: next review ${nextReview ? nextReview.toLocaleString() : 'never'} (repetition: ${word.repetition})`);
        });
    }
}

// ============================================================================
// DATABASE LOADING FUNCTIONS
// ============================================================================

async function loadWordDatabase() {
    try {
        // iOS WebView doesn't allow fetch() to local files, so start with empty database
        // Users will import their vocabulary via the import button
        console.log('📱 iOS WebView detected - starting with empty database');
        console.log('💡 Use the Import button to load your vocabulary');
        
        wordDatabase = {
            metadata: {
                description: "Empty database - use Import to load vocabulary",
                totalWords: 0,
                version: "1.0"
            },
            words: []
        };
        
        await initializeVocabulary();
    } catch (error) {
        console.error('❌ Failed to initialize word database:', error.message);
        showDatabaseError();
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
    document.getElementById('wordList').innerHTML = errorMessage;
    document.getElementById('learningContent').innerHTML = errorMessage;
}

// Initialize vocabulary from local files only
async function initializeVocabulary() {
    try {
        // Use already loaded wordDatabase or load from local file
        let allWords = [];
        
        if (wordDatabase) {
            // Extract words from database object structure
            if (Array.isArray(wordDatabase)) {
                allWords = wordDatabase;
            } else if (wordDatabase.words && Array.isArray(wordDatabase.words)) {
                allWords = wordDatabase.words;
            } else {
                console.warn('⚠️ Invalid wordDatabase structure:', Object.keys(wordDatabase));
            }
        } else {
            // No database loaded - this should not happen after loadWordDatabase() is called
            console.warn('⚠️ No word database available. Please import vocabulary data.');
        }
        
        // Load complete vocabulary from storage if available
        try {
            const savedVocabularyStr = localStorage.getItem('allVocabulary');
            const savedVocabulary = JSON.parse(savedVocabularyStr || '[]');
            
            if (savedVocabulary.length > 0) {
                // Always use saved vocabulary if it exists (may contain custom words or deletions)
                allWords = savedVocabulary;
                console.log(`💾 Loaded ${savedVocabulary.length} words from storage`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load saved vocabulary:', error.message);
        }
        
        // Ensure proper date fields
        allWords = allWords.map(word => ({
            ...word,
            createdAt: word.created_date || word.createdAt || new Date().toISOString(),
            addedDate: word.created_date || word.addedDate || new Date().toISOString()
        }));
        
        // Merge with user progress
        vocabulary = allWords.map(word => {
            const progress = userProgress[word.id] || {
                repetition: 0,
                easeFactor: 1.3,
                nextReview: null,
                reviewHistory: []
            };
            
            return {
                ...word,
                ...progress
            };
        });
        
        console.log(`✅ Vocabulary initialized with ${vocabulary.length} words`);
        
    } catch (error) {
        console.error('❌ Failed to initialize vocabulary:', error);
        vocabulary = [];
    }
}

// ============================================================================
// SPEECH SYNTHESIS FUNCTIONS
// ============================================================================

function initializeSpeech() {
    if ('speechSynthesis' in window) {
        // Wait for voices to load with timeout
        const waitForVoices = (timeout = 2000) => {
            return new Promise((resolve) => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    resolve(voices);
                    return;
                }
                
                const timer = setTimeout(() => {
                    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                    resolve(window.speechSynthesis.getVoices());
                }, timeout);
                
                const onVoicesChanged = () => {
                    clearTimeout(timer);
                    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                    resolve(window.speechSynthesis.getVoices());
                };
                
                window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
            });
        };

        // Load available voices
        const loadVoices = async () => {
            const voices = await waitForVoices();
            
            // Prefer English voices, especially macOS/iOS native ones
            const preferredVoices = [
                'Alex', 'Samantha', 'Victoria', // macOS voices
                'Karen', 'Daniel (Enhanced)', 'Moira', // macOS enhanced
                'Google US English', 'Microsoft English', // Cross-platform
            ];
            
            // Find best available English voice
            let bestVoice = voices.find(voice => 
                voice.lang.startsWith('en') && 
                preferredVoices.some(pv => voice.name.includes(pv))
            );
            
            // Fallback to any English voice
            if (!bestVoice) {
                bestVoice = voices.find(voice => voice.lang.startsWith('en'));
            }
            
            speechSettings.voice = bestVoice;
            
            // Update UI if voice is unavailable
            if (!bestVoice && voices.length === 0) {
                console.warn('⚠️ No speech voices available');
                speechSettings.enabled = false;
            }
        };

        // Load voices
        loadVoices();
        
        return true;
    } else {
        console.warn('⚠️ Speech synthesis not supported');
        speechSettings.enabled = false;
        return false;
    }
}

function speakWord(text, options = {}) {
    if (!speechSettings.enabled || !text) return;
    
    // Check if speechSynthesis is available
    if (!window.speechSynthesis) {
        console.warn('⚠️ Speech synthesis not available');
        return;
    }

    // Stop any ongoing speech
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
    }

    // Add slight delay for Chrome compatibility
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply settings
        utterance.rate = options.rate || speechSettings.rate;
        utterance.pitch = options.pitch || speechSettings.pitch;
        utterance.volume = options.volume || speechSettings.volume;
        
        if (speechSettings.voice) {
            utterance.voice = speechSettings.voice;
        }

        utterance.onerror = (event) => {
            console.error('❌ Speech error:', event.error, 'for text:', text);
            
            // Try to recover from common errors
            if (event.error === 'network') {
                setTimeout(() => speakWord(text, options), 1000);
            }
        };

        try {
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('❌ Failed to speak:', error);
        }
    }, 100);
}

// Make sure speakWord is globally accessible  
window.speakWord = speakWord;

function toggleSpeech() {
    speechSettings.enabled = !speechSettings.enabled;
    const speechBtn = document.getElementById('speechToggle');
    if (speechBtn) {
        speechBtn.textContent = speechSettings.enabled ? '🔊 Sound On' : '🔇 Sound Off';
        speechBtn.className = speechSettings.enabled ? 'btn btn-success' : 'btn btn-secondary';
    }
    
    // Save preference
    localStorage.setItem('speechSettings', JSON.stringify(speechSettings));
    
    return speechSettings.enabled;
}

function toggleAutoPlay() {
    speechSettings.autoPlay = !speechSettings.autoPlay;
    const autoPlayBtn = document.getElementById('autoPlayToggle');
    if (autoPlayBtn) {
        autoPlayBtn.textContent = speechSettings.autoPlay ? '🎵 Auto Play On' : '🔇 Auto Play Off';
        autoPlayBtn.className = speechSettings.autoPlay ? 'btn btn-success' : 'btn btn-secondary';
    }
    
    // Save preference
    localStorage.setItem('speechSettings', JSON.stringify(speechSettings));
    
    return speechSettings.autoPlay;
}

// ============================================================================
// DATA PERSISTENCE FUNCTIONS
// ============================================================================

async function saveUserProgress() {
    // Save only user progress data, not the entire word database
    const progressData = {};
    vocabulary.forEach(word => {
        progressData[word.id] = {
            repetition: word.repetition,
            easeFactor: word.easeFactor,
            nextReview: word.nextReview,
            reviewHistory: word.reviewHistory,
            addedDate: word.addedDate
        };
    });
    
    userProgress = progressData;
    
    try {
        localStorage.setItem('userProgress', JSON.stringify(userProgress));
        console.log('💾 User progress saved:', Object.keys(userProgress).length, 'entries');
    } catch (error) {
        console.error('❌ Failed to save progress:', error.message);
    }
}

function saveAllVocabulary() {
    // Save entire vocabulary array to localStorage (simplified approach)
    try {
        const vocabularyStr = JSON.stringify(vocabulary);
        localStorage.setItem('allVocabulary', vocabularyStr);
        console.log('💾 All vocabulary saved:', vocabulary.length, 'words');
    } catch (error) {
        console.error('❌ Failed to save vocabulary:', error.message);
    }
}

async function loadUserProgress() {
    try {
        const localProgress = localStorage.getItem('userProgress');
        const progress = localProgress ? JSON.parse(localProgress) : {};
        console.log('📊 User progress loaded:', Object.keys(progress).length, 'entries');
        return progress;
    } catch (error) {
        console.error('❌ Failed to load progress:', error.message);
        return {};
    }
}

async function resetUserProgress() {
    if (confirm('This will reset all your learning progress but keep your words. Are you sure?')) {
        try {
            userProgress = {};
            localStorage.removeItem('userProgress');
            console.log('🗑️ User progress reset successfully');
            
            await initializeVocabulary();
            renderWordList();
            updateStats();
            alert('Learning progress reset!');
        } catch (error) {
            console.error('❌ Failed to reset progress:', error.message);
            alert('Failed to reset progress. Please try again.');
        }
    }
}

// ============================================================================
// DATA EXPORT/IMPORT FUNCTIONS
// ============================================================================

// Testable export data creation function
function createExportData(vocabularyData = null) {
    // Get vocabulary data from parameter, localStorage, or global vocabulary
    let vocabularyToExport;
    if (vocabularyData) {
        vocabularyToExport = vocabularyData;
    } else {
        const allVocabulary = JSON.parse(localStorage.getItem('allVocabulary') || '[]');
        vocabularyToExport = allVocabulary.length > 0 ? allVocabulary : vocabulary;
    }
    
    // Ensure all words have complete progress data
    const vocabularyWithProgress = vocabularyToExport.map(word => ({
        id: word.id,
        english: word.english,
        russian: word.russian,
        definition: word.definition,
        examples: word.examples,
        phonetic: word.phonetic,
        synonyms: word.synonyms,
        partOfSpeech: word.partOfSpeech,
        difficulty: word.difficulty,
        tags: word.tags,
        // Learning progress data
        easeFactor: word.easeFactor,
        repetition: word.repetition,
        consecutiveCorrect: word.consecutiveCorrect,
        timesReviewed: word.timesReviewed,
        lastReviewed: word.lastReviewed,
        nextReview: word.nextReview,
        reviewHistory: word.reviewHistory,
        addedDate: word.addedDate
    }));
    
    return {
        vocabulary: vocabularyWithProgress,  // Single source of truth - words with current progress
        exportDate: new Date().toISOString(),
        appVersion: "1.0",
        totalWords: vocabularyWithProgress.length
    };
}

async function exportData() {
    try {
        // Get vocabulary data directly from localStorage for most accurate export
        const allVocabulary = JSON.parse(localStorage.getItem('allVocabulary') || '[]');
        
        console.log('📦 Exporting data...');
        console.log(`📚 Vocabulary from localStorage: ${allVocabulary.length} words`);
        
        // Create export data using testable function
        const exportData = createExportData();
        
        // Use native iOS export if available, otherwise web download
        if (window.exportDataNative && window.webkit) {
            console.log(`📤 Exporting via native iOS share sheet: ${exportData.totalWords} words`);
            console.log(`📤 Export size reduced: vocabulary-only format (no userProgress duplication)`);
            window.exportDataNative(exportData);
        } else {
            // Web browser fallback
            const jsonString = JSON.stringify(exportData, null, 2);
            const fileName = `vocabulary-backup-${new Date().toISOString().slice(0,16).replace(/:/g, '-')}.json`;
            
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('📤 Data exported via web download');
            alert(`Data exported! Check Downloads folder for ${fileName}`);
        }
        
    } catch (error) {
        console.error('❌ Export failed:', error);
        alert('Export failed. Please try again.');
    }
}

// Testable import validation and processing function
function validateAndProcessImportData(importData) {
    // Validate import data structure
    if (!importData.vocabulary || !Array.isArray(importData.vocabulary)) {
        throw new Error('Invalid backup file format. Missing vocabulary data.');
    }
    
    const totalWords = importData.totalWords || 0;
    const importedVocabulary = importData.vocabulary;
    
    // Validate each word structure
    importedVocabulary.forEach((word, index) => {
        if (!word.id || typeof word.id !== 'string') {
            throw new Error(`Word ${index + 1}: Missing or invalid id`);
        }
        if (!word.english || typeof word.english !== 'string') {
            throw new Error(`Word ${index + 1}: Missing or invalid english field`);
        }
        if (!word.russian || typeof word.russian !== 'string') {
            throw new Error(`Word ${index + 1}: Missing or invalid russian field`);
        }
        if (typeof word.easeFactor !== 'number') {
            throw new Error(`Word ${index + 1}: Missing or invalid easeFactor`);
        }
        if (typeof word.repetition !== 'number') {
            throw new Error(`Word ${index + 1}: Missing or invalid repetition`);
        }
        if (!Array.isArray(word.reviewHistory)) {
            throw new Error(`Word ${index + 1}: Missing or invalid reviewHistory`);
        }
    });
    
    return {
        vocabulary: importedVocabulary,
        totalWords: totalWords,
        exportDate: importData.exportDate,
        appVersion: importData.appVersion,
        valid: true
    };
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            // Validate and process import data using testable function
            const processedData = validateAndProcessImportData(importData);
            
            console.log(`📥 Importing ${processedData.totalWords} words from ${processedData.exportDate || 'unknown date'}`);
            
            // Clear existing data first to ensure clean import
            console.log('🗑️ Clearing existing data...');
            vocabulary = [];
            userProgress = {};
            localStorage.removeItem('allVocabulary');
            localStorage.removeItem('userProgress');
            
            // Import complete vocabulary
            if (processedData.vocabulary && processedData.vocabulary.length > 0) {
                vocabulary = processedData.vocabulary;
                console.log(`✅ Vocabulary imported: ${vocabulary.length} words`);
            }
            
            // Note: userProgress is no longer exported separately - all data is in vocabulary
            
            // Save the updated vocabulary state
            saveUserProgress();
            saveAllVocabulary();
            
            // Verify data integrity after import
            console.log('🔍 Verifying data integrity...');
            const savedVocab = JSON.parse(localStorage.getItem('allVocabulary') || '[]');
            const savedProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
            console.log(`✅ Verification: ${savedVocab.length} words, ${Object.keys(savedProgress).length} progress entries`);
            
            // Update UI to reflect imported data
            renderWordList();
            updateStats();
            
            console.log('📥 Data imported successfully');
            alert(`Data imported successfully!\n${processedData.totalWords} words loaded\nReloading app...`);
            
            // Reload app to reflect changes
            location.reload();
            
        } catch (error) {
            console.error('❌ Import failed:', error);
            alert('Import failed. Please check the file format.');
        }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

// ============================================================================
// PWA SERVICE WORKER REGISTRATION
// ============================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('✅ Service Worker registered:', registration.scope);
        } catch (error) {
            console.log('❌ Service Worker registration failed:', error);
        }
    });
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Starting Smart Vocabulary App initialization...');
    
    // Initialize speech synthesis
    initializeSpeech();
    
    // Load saved speech settings
    const savedSpeechSettings = localStorage.getItem('speechSettings');
    if (savedSpeechSettings) {
        Object.assign(speechSettings, JSON.parse(savedSpeechSettings));
    }
    
    try {
        // Load user progress from localStorage
        console.log('📊 Loading user progress...');
        userProgress = await loadUserProgress();
        console.log('✅ User progress loaded:', Object.keys(userProgress).length, 'entries');
        
        // Load word database
        console.log('📚 Loading word database...');
        await loadWordDatabase();
        
        // Update UI
        updateStats();
        console.log('✅ App initialization complete!');
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        // Show error to user
        const errorMessage = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <h3>❌ Initialization Error</h3>
                <p>Failed to load application data. Please refresh the page.</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <button class="btn btn-primary" onclick="location.reload()">🔄 Refresh Page</button>
            </div>
        `;
        document.getElementById('wordList').innerHTML = errorMessage;
        document.getElementById('learningContent').innerHTML = errorMessage;
    }
    
    // Update speech toggle button state
    const speechBtn = document.getElementById('speechToggle');
    if (speechBtn) {
        speechBtn.textContent = speechSettings.enabled ? '🔊 Sound On' : '🔇 Sound Off';
        speechBtn.className = speechSettings.enabled ? 'btn btn-success' : 'btn btn-secondary';
    }
    
    // Update auto play toggle button state
    const autoPlayBtn = document.getElementById('autoPlayToggle');
    if (autoPlayBtn) {
        autoPlayBtn.textContent = speechSettings.autoPlay ? '🎵 Auto Play On' : '🔇 Auto Play Off';
        autoPlayBtn.className = speechSettings.autoPlay ? 'btn btn-success' : 'btn btn-secondary';
    }
    
    // Set up enter key for word input
    document.getElementById('englishWord').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('russianTranslation').focus();
        }
    });

    document.getElementById('russianTranslation').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addWord();
        }
    });
});
