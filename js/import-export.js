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
        const vocabulary = window.DataManager?.vocabulary || [];
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
        // Learning progress data
        easeFactor: word.easeFactor,
        repetition: word.repetition,
        nextReview: word.nextReview,
        reviewHistory: word.reviewHistory,
        createdAt: word.createdAt,
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
        const exportDataObj = createExportData();
        
        // Web export
        const jsonString = JSON.stringify(exportDataObj, null, 2);
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
        
    } catch (error) {
        console.error('❌ Export failed:', error);
        window.showMessage?.('Export failed. Please try again.', 'error');
    }
}

// Testable import validation and processing function
function validateAndProcessImportData(dataToImport) {
    // Validate import data structure
    if (!dataToImport.vocabulary || !Array.isArray(dataToImport.vocabulary)) {
        throw new Error('Invalid backup file format. Missing vocabulary data.');
    }
    
    const totalWords = dataToImport.totalWords || 0;
    const importedVocabulary = dataToImport.vocabulary;
    
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
        exportDate: dataToImport.exportDate,
        appVersion: dataToImport.appVersion,
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
            const importDataObj = JSON.parse(text);
            
            // Validate and process import data using testable function
            const processedData = validateAndProcessImportData(importDataObj);
            
            console.log(`📥 Importing ${processedData.totalWords} words from ${processedData.exportDate || 'unknown date'}`);
            
            // Clear existing data first to ensure clean import
            console.log('🗑️ Clearing existing data...');
            if (window.DataManager) {
                window.DataManager.vocabulary = [];
                window.DataManager.userProgress = {};
            }
            localStorage.removeItem('allVocabulary');
            localStorage.removeItem('userProgress');
            
            // Import complete vocabulary
            if (processedData.vocabulary && processedData.vocabulary.length > 0) {
                if (window.DataManager) {
                    window.DataManager.vocabulary = processedData.vocabulary;
                }
                console.log(`✅ Vocabulary imported: ${processedData.vocabulary.length} words`);
            }
            
            // Note: userProgress is no longer exported separately - all data is in vocabulary
            
            // Save the updated vocabulary state
            if (window.DataManager) {
                window.DataManager.saveUserProgress();
                window.DataManager.saveAllVocabulary();
            }
            
            // Verify data integrity after import
            console.log('🔍 Verifying data integrity...');
            const savedVocab = JSON.parse(localStorage.getItem('allVocabulary') || '[]');
            const savedProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
            console.log(`✅ Verification: ${savedVocab.length} words, ${Object.keys(savedProgress).length} progress entries`);
            
            // Update UI to reflect imported data
            if (window.renderWordList) window.renderWordList();
            if (window.updateStats) window.updateStats();
            
            console.log('📥 Data imported successfully');
            window.showMessage?.(`Data imported successfully! ${processedData.totalWords} words loaded. Reloading...`, 'success');
            
            // Reload app to reflect changes
            location.reload();
            
        } catch (error) {
            console.error('❌ Import failed:', error);
            window.showMessage?.('Import failed. Please check the file format.', 'error');
        }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

// Export functions
window.ImportExport = {
    createExportData,
    exportData,
    validateAndProcessImportData,
    importData
};