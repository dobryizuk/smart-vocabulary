// ============================================================================
// DATA EXPORT/IMPORT FUNCTIONS with DI
// ============================================================================

const { downloadFile } = require('./file-download.js');

function createImportExport(context) {
    const ctx = context || {};
    const getVocabulary = ctx.getVocabulary || (() => []);
    const setVocabulary = ctx.setVocabulary || (() => undefined);
    const saveUserProgress = ctx.saveUserProgress || (() => undefined);
    const saveAllVocabulary = ctx.saveAllVocabulary || (() => undefined);
    const storage = ctx.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const doc = ctx.document || (typeof document !== 'undefined' ? document : null);
    const debugLog = ctx.debugLog || (() => undefined);
    const appMain = ctx.appMain || {};
    const stats = ctx.stats || {};
    const getNow = ctx.getNow || (() => new Date());
    const getURL = ctx.getURL || (() => (typeof URL !== 'undefined' ? URL : null));

    function createExportData(vocabularyData = null) {
        let vocabularyToExport;
        if (vocabularyData) {
            vocabularyToExport = vocabularyData;
        } else {
            const allVocabulary = storage ? JSON.parse(storage.getItem('allVocabulary') || '[]') : [];
            const current = getVocabulary();
            vocabularyToExport = allVocabulary.length > 0 ? allVocabulary : current;
        }
        
        const vocabularyWithProgress = vocabularyToExport.map(word => ({
            id: word.id,
            original: word.original,
            translation: word.translation,
            definition: word.definition,
            examples: word.examples,
            phonetic: word.phonetic,
            synonyms: word.synonyms,
            easeFactor: word.easeFactor,
            repetition: word.repetition,
            nextReview: word.nextReview,
            reviewHistory: word.reviewHistory,
            createdAt: word.createdAt,
            addedDate: word.addedDate
        }));
        
        return {
            vocabulary: vocabularyWithProgress,
            exportDate: getNow().toISOString(),
            appVersion: "1.0",
            totalWords: vocabularyWithProgress.length
        };
    }

    async function exportData() {
        try {
            const allVocabulary = storage ? JSON.parse(storage.getItem('allVocabulary') || '[]') : [];
            
            debugLog('📦 Exporting data...');
            debugLog(`📚 Vocabulary from localStorage: ${allVocabulary.length} words`);
            
            const exportDataObj = createExportData();
            
            const jsonString = JSON.stringify(exportDataObj, null, 2);
            const fileName = `vocabulary-backup-${getNow().toISOString().slice(0,16).replace(/:/g, '-')}.json`;
            
            downloadFile(doc, getURL(), fileName, jsonString, 'application/json');
            
            debugLog('📤 Data exported via web download');
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            appMain.showMessage?.('Export failed. Please try again.', 'error');
        }
    }

    function validateAndProcessImportData(dataToImport) {
        if (!dataToImport.vocabulary || !Array.isArray(dataToImport.vocabulary)) {
            throw new Error('Invalid backup file format. Missing vocabulary data.');
        }
        
        const totalWords = dataToImport.totalWords || 0;
        const importedVocabulary = dataToImport.vocabulary;
        
        importedVocabulary.forEach((word, index) => {
            if (!word.id || typeof word.id !== 'string') {
                throw new Error(`Word ${index + 1}: Missing or invalid id`);
            }
            if (!word.original || typeof word.original !== 'string') {
                throw new Error(`Word ${index + 1}: Missing or invalid original field`);
            }
            if (!word.translation || typeof word.translation !== 'string') {
                throw new Error(`Word ${index + 1}: Missing or invalid translation field`);
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
            exportDate: dataToImport.exportDate,
            appVersion: dataToImport.appVersion,
            valid: true
        };
    }

    function importData() {
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.onchange = async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const importDataObj = JSON.parse(text);
                
                const processedData = validateAndProcessImportData(importDataObj);
                
                debugLog(`📥 Importing ${processedData.totalWords} words from ${processedData.exportDate || 'unknown date'}`);
                
                debugLog('🗑️ Clearing existing data...');
                setVocabulary([]);
                if (storage) {
                    storage.removeItem('allVocabulary');
                    storage.removeItem('userProgress');
                }
                
                if (processedData.vocabulary && processedData.vocabulary.length > 0) {
                    setVocabulary(processedData.vocabulary);
                    debugLog(`✅ Vocabulary imported: ${processedData.vocabulary.length} words`);
                }
                
                saveUserProgress();
                saveAllVocabulary();
                
                debugLog('🔍 Verifying data integrity...');
                const savedVocab = storage ? JSON.parse(storage.getItem('allVocabulary') || '[]') : [];
                const savedProgress = storage ? JSON.parse(storage.getItem('userProgress') || '{}') : {};
                debugLog(`✅ Verification: ${savedVocab.length} words, ${Object.keys(savedProgress).length} progress entries`);
                
                appMain.renderWordList?.();
                stats.updateStats?.();
                
                debugLog('📥 Data imported successfully');
                appMain.showMessage?.(`Data imported successfully! ${processedData.totalWords} words loaded. Reloading...`, 'success');
                
                location.reload();
                
            } catch (error) {
                console.error('❌ Import failed:', error);
                appMain.showMessage?.('Import failed. Please check the file format.', 'error');
            }
        };
        
        doc.body.appendChild(input);
        input.click();
        doc.body.removeChild(input);
    }

    return { createExportData, exportData, validateAndProcessImportData, importData };
}

function createDefaultImportExport() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createImportExport({
        getVocabulary: () => g.SV?.DataManager?.vocabulary || [],
        setVocabulary: (v) => { if (g.SV?.DataManager) g.SV.DataManager.vocabulary = v; },
        saveUserProgress: () => g.SV?.DataManager?.saveUserProgress?.(),
        saveAllVocabulary: () => g.SV?.DataManager?.saveAllVocabulary?.(),
        storage: (typeof localStorage !== 'undefined' ? localStorage : null),
        document: (typeof document !== 'undefined' ? document : null),
        debugLog: (...args) => g.SV?.debugLog?.(...args),
        appMain: g.SV?.AppMain || {},
        stats: g.SV?.Statistics || {},
        getNow: () => new Date(),
        getURL: () => (typeof URL !== 'undefined' ? URL : null)
    });
}

const defaultImportExport = createDefaultImportExport();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultImportExport;
    module.exports.createImportExport = createImportExport;
}