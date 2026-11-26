// ============================================================================
// DICTIONARY API INTEGRATION
// ============================================================================

// Dictionary API service for fetching definitions and translations (with DI)
function createDictionaryService(context) {
    const ctx = context || {};
    const fetchImpl = ctx.fetch || (typeof fetch !== 'undefined' ? fetch.bind(window) : null);
    const warn = ctx.warn || ((...args) => console.warn(...args));

    // dictionaryapi.dev: examples, synonyms, IPA; its first sense is often rare or archaic
    async function fetchDictionaryEntry(word) {
        try {
            const response = await fetchImpl(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            if (!response.ok) throw new Error(`status ${response.status}`);
            return await response.json();
        } catch (error) {
            warn('Dictionary API failed:', error.message);
            return null;
        }
    }

    // Datamuse lists the most common sense first, e.g. "adj\tRelating to particular persons"
    async function fetchCommonDefinition(word) {
        try {
            const response = await fetchImpl(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`);
            if (!response.ok) throw new Error(`status ${response.status}`);
            const [entry] = await response.json();
            if (!entry || entry.word?.toLowerCase() !== word || !entry.defs?.length) return null;
            return entry.defs[0].split('\t').pop().trim() || null;
        } catch (error) {
            warn('Datamuse API failed:', error.message);
            return null;
        }
    }

    // Wiktionary wikitext holds IPA as {{IPA|en|/ˌʌndəˈsteɪtmənt/|a=RP}}
    async function fetchWiktionaryIpa(word) {
        try {
            const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&formatversion=2&origin=*`;
            const response = await fetchImpl(url);
            if (!response.ok) throw new Error(`status ${response.status}`);
            const data = await response.json();
            const match = /\{\{IPA\|en\|([^|}]+)/.exec(data?.parse?.wikitext || '');
            return match ? match[1].trim() : null;
        } catch (error) {
            warn('Wiktionary API failed:', error.message);
            return null;
        }
    }

    async function lookupWord(word) {
        const cleanWord = word.toLowerCase().trim();
        const [entry, commonDefinition] = await Promise.all([
            fetchDictionaryEntry(cleanWord),
            fetchCommonDefinition(cleanWord)
        ]);

        const result = parseApiResponse(entry, cleanWord);
        if (commonDefinition) result.definition = commonDefinition;
        if (!result.phonetic) result.phonetic = (await fetchWiktionaryIpa(cleanWord)) || '';
        return result;
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
        const mainMeaning = meanings.find(m => ['noun', 'verb', 'adjective', 'adverb'].includes(m.partOfSpeech));
        const definition = mainMeaning?.definitions?.[0]?.definition || '';

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
            definition,
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
            definition: '',
            examples: [],
            synonyms: [],
            source: 'fallback',
            translation: null
        };
    }

    // Translation service with Google Translate API
    async function translateWord(originalWord) {
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

    return { lookupWord, lookupWithTranslation };
}

function createDefaultDictionaryService() {
    return createDictionaryService({
        fetch: (typeof fetch !== 'undefined' ? fetch.bind(window) : null),
        warn: (...args) => console.warn(...args)
    });
}

const defaultDictionaryService = createDefaultDictionaryService();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultDictionaryService;
    module.exports.createDictionaryService = createDictionaryService;
}