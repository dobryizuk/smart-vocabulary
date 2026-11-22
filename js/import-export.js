// ============================================================================
// DATA EXPORT/IMPORT FUNCTIONS with DI
// ============================================================================

const { downloadFile } = require('./file-download.js');
const defaultVocabularyStore = require('./vocabulary-store.js');
const { pickWordFields } = defaultVocabularyStore;

function createImportExport(context) {
    const ctx = context || {};
    const getVocabulary = ctx.getVocabulary || (() => []);
    const setVocabulary = ctx.setVocabulary || (() => undefined);
    const store = ctx.store || defaultVocabularyStore;
    const doc = ctx.document || (typeof document !== 'undefined' ? document : null);
    const debugLog = ctx.debugLog || (() => undefined);
    const appMain = ctx.appMain || {};
    const stats = ctx.stats || {};
    const getNow = ctx.getNow || (() => new Date());
    const getURL = ctx.getURL || (() => (typeof URL !== 'undefined' ? URL : null));
    const confirmAction = ctx.confirm || (() => true);
    const reload = ctx.reload || (() => undefined);

    function createExportData(vocabularyData = null) {
        const vocabularyToExport = vocabularyData || getVocabulary();
        const vocabularyWithProgress = vocabularyToExport.map(pickWordFields);
        
        return {
            vocabulary: vocabularyWithProgress,
            exportDate: getNow().toISOString(),
            schemaVersion: 1,
            appVersion: "1.0",
            totalWords: vocabularyWithProgress.length
        };
    }

    async function exportData() {
        try {
            debugLog('📦 Exporting data...');
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
        if (dataToImport.vocabulary.length === 0) {
            throw new Error('The backup contains no words. Nothing was imported.');
        }
        
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
            totalWords: importedVocabulary.length,
            exportDate: dataToImport.exportDate,
            appVersion: dataToImport.appVersion,
            valid: true
        };
    }

    function restoreSnapshot() {
        const snapshotDate = store.getSnapshotDate();
        if (!snapshotDate) return;
        const question = `Go back to your data from before the restore on ${snapshotDate}? Progress made since then will be lost.`;
        if (!confirmAction(question)) return;
        store.restoreSnapshot();
        reload();
    }

    async function importFromText(text) {
        try {
            const processedData = validateAndProcessImportData(JSON.parse(text));
            const backupDate = processedData.exportDate?.slice(0, 10) || 'unknown date';
            const question = `Replace your ${getVocabulary().length} words with ${processedData.totalWords} words from the backup of ${backupDate}?`;
            if (!confirmAction(question)) return;

            store.saveSnapshot();
            store.save(processedData.vocabulary);
            setVocabulary(processedData.vocabulary);

            appMain.renderWordList?.();
            stats.updateStats?.();
            debugLog(`📥 Imported ${processedData.totalWords} words from ${backupDate}`);
            appMain.showMessage?.(`Data imported successfully! ${processedData.totalWords} words loaded. Reloading...`, 'success');
            reload();
        } catch (error) {
            console.error('❌ Import failed:', error);
            const reason = error instanceof SyntaxError ? 'Please check the file format.' : error.message;
            appMain.showMessage?.(`Import failed. ${reason}`, 'error');
        }
    }

    function importData() {
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.onchange = async function(e) {
            const file = e.target.files[0];
            if (file) await importFromText(await file.text());
        };
        
        doc.body.appendChild(input);
        input.click();
        doc.body.removeChild(input);
    }

    return { createExportData, exportData, validateAndProcessImportData, importFromText, importData, restoreSnapshot };
}

function createDefaultImportExport() {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    return createImportExport({
        getVocabulary: () => g.SV?.DataManager?.vocabulary || [],
        setVocabulary: (v) => { if (g.SV?.DataManager) g.SV.DataManager.vocabulary = v; },
        store: defaultVocabularyStore,
        document: (typeof document !== 'undefined' ? document : null),
        debugLog: (...args) => g.SV?.debugLog?.(...args),
        appMain: {
            showMessage: (...args) => g.SV?.AppMain?.showMessage?.(...args),
            renderWordList: () => g.SV?.AppMain?.renderWordList?.()
        },
        stats: { updateStats: () => g.SV?.Statistics?.updateStats?.() },
        confirm: (message) => g.confirm(message),
        reload: () => g.location.reload(),
        getNow: () => new Date(),
        getURL: () => (typeof URL !== 'undefined' ? URL : null)
    });
}

const defaultImportExport = createDefaultImportExport();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultImportExport;
    module.exports.createImportExport = createImportExport;
}