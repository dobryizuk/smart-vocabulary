// ============================================================================
// DICTIONARY API INTEGRATION
// ============================================================================

// Dictionary API service for fetching definitions and translations (with DI)
function createDictionaryService(context) {
    const ctx = context || {};
    const fetchImpl = ctx.fetch || (typeof fetch !== 'undefined' ? fetch.bind(window) : null);
    const getTranslationSuggestion = ctx.getTranslationSuggestion || (() => null);
    const warn = ctx.warn || ((...args) => console.warn(...args));

    async function lookupWord(word) {
        const cleanWord = word.toLowerCase().trim();
        
        try {
            // Try Free Dictionary API first
            const response = await fetchImpl(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
            
            if (!response.ok) {
                throw new Error(`Dictionary API error: ${response.status}`);
            }
            
            const data = await response.json();
            let result = parseApiResponse(data, cleanWord);
            
            // Try to enhance missing data with additional sources
            result = await enhanceWithAdditionalSources(result, cleanWord);
            
            return result;
            
        } catch (error) {
            warn('Dictionary API failed:', error.message);
            return getFallbackDefinition(cleanWord);
        }
    }

    async function enhanceWithAdditionalSources(result, word) {
        // Only enhance with real data from another API (no fabricated values)
        // If phonetic is missing, try to get it from Wiktionary
        if (!result.phonetic) {
            try {
                const phonetic = await getPhoneticFromPronunciationAPI(word);
                if (phonetic) {
                    result.phonetic = phonetic;
                }
            } catch (error) {
                warn('Phonetic enhancement failed:', error.message);
            }
        }

        return result;
    }

    async function getPhoneticFromPronunciationAPI(word) {
        try {
            // Try Wiktionary API for phonetic (alternative source)
            const response = await fetchImpl(`https://en.wiktionary.org/api/rest_v1/page/definition/${word}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.english && data.english.length > 0) {
                    // Look for phonetic in Wiktionary data
                    const englishEntry = data.english[0];
                    if (englishEntry.pronunciations && englishEntry.pronunciations.audio) {
                        // Extract IPA from pronunciation
                        const ipa = englishEntry.pronunciations.audio.find(p => p.audio && p.audio.includes('IPA'));
                        if (ipa) {
                            return ipa.audio.replace('IPA', '').trim();
                        }
                    }
                }
            }
        } catch (error) {
            warn('Wiktionary API failed:', error.message);
        }

        return null;
    }

    function parseApiResponse(data, word) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return getFallbackDefinition(word);
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

    function getFallbackDefinition(word) {
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
    async function translateWord(originalWord) {
        // First check local database
        const localTranslation = getTranslationSuggestion(originalWord);
        if (localTranslation) {
            return localTranslation;
        }

        // Try Google Translate API (free tier)
        try {
            const response = await fetchImpl('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=' + encodeURIComponent(originalWord));
            const data = await response.json();
            
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                return data[0][0][0];
            }
        } catch (error) {
            warn('Google Translate failed:', error.message);
        }

        // Fallback to MyMemory API
        try {
            const response = await fetchImpl(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalWord)}&langpair=en|ru`);
            const data = await response.json();
            
            if (data && data.responseData && data.responseData.translatedText) {
                return data.responseData.translatedText;
            }
        } catch (error) {
            warn('MyMemory API failed:', error.message);
        }

        // Final fallback
        return `перевод слова "${originalWord}"`;
    }

    async function lookupWithTranslation(word) {
        const [definition, translation] = await Promise.all([
            lookupWord(word),
            translateWord(word)
        ]);

        return {
            ...definition,
            translation: translation
        };
    }

    return { lookupWord, translateWord, lookupWithTranslation };
}

function createDefaultDictionaryService() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createDictionaryService({
        fetch: (typeof fetch !== 'undefined' ? fetch.bind(window) : null),
        getTranslationSuggestion: (word) => g.SV?.DataManager?.getTranslationSuggestion?.(word),
        warn: (...args) => console.warn(...args)
    });
}

const defaultDictionaryService = createDefaultDictionaryService();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultDictionaryService;
    module.exports.createDictionaryService = createDictionaryService;
}