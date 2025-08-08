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
            examples: examples.slice(0, 5),
            synonyms: synonyms.slice(0, 5),
            source: 'dictionary-api',
            translation: null
        };
    }

    static getFallbackDefinition(word) {
        return {
            word: word,
            phonetic: '',
            definition: `English word: ${word}`,
            examples: [],
            synonyms: [],
            source: 'fallback',
            translation: null
        };
    }

    // Translation service with Google Translate API
    static async translateWord(englishWord) {
        // First check local database
        const localTranslation = window.DataManager?.getTranslationSuggestion?.(englishWord);
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

// Export the service
window.DictionaryService = DictionaryService;