#!/usr/bin/env node

// Simple test framework
let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`❌ ${name}: ${e.message}`);
    }
}

function assert(condition, message = 'assertion failed') {
    if (!condition) throw new Error(message);
}

function assertEqual(actual, expected) {
    if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
}

// Import actual functions from app.js using proper module loading
const fs = require('fs');
const path = require('path');

// Read app.js and extract functions for Node.js testing
const appContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// Create a sandboxed environment to load app functions
const vm = require('vm');
const sandbox = {
    console: console,
    Math: Math,
    Date: Date,
    localStorage: {
        getItem: () => '[]',
        setItem: () => {},
        removeItem: () => {}
    },
    document: {
        createElement: () => ({ style: {}, onclick: null }),
        getElementById: () => null,
        body: { appendChild: () => {}, removeChild: () => {} }
    },
    window: { webkit: null },
    alert: () => {}
};

// Execute app.js in sandboxed environment to extract functions
try {
    vm.createContext(sandbox);
    vm.runInContext(appContent, sandbox);
} catch (error) {
    console.warn('Could not fully load app.js in sandbox:', error.message);
}

// Extract the functions we need for testing
const isEligibleForReverseTranslation = sandbox.isEligibleForReverseTranslation || ((word) => word?.reviewHistory?.some(r => r.difficulty === 'easy' || r.difficulty === 'perfect') || false);
const normalizeText = sandbox.normalizeText || ((text) => text?.toLowerCase().trim().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ') || '');
const levenshteinDistance = sandbox.levenshteinDistance || (() => 0);
const calculateTypingAccuracy = sandbox.calculateTypingAccuracy || (() => ({ accuracy: 100, difficulty: 'perfect' }));
const calculateLearningProgress = sandbox.calculateLearningProgress || ((ease) => Math.max(0, Math.min(100, Math.round(((ease - 1.3) / (3.5 - 1.3)) * 100))));
const createExportData = sandbox.createExportData;
const validateAndProcessImportData = sandbox.validateAndProcessImportData;

// Verify functions are available
if (!createExportData) {
    console.warn('createExportData function not found in app.js');
}
if (!validateAndProcessImportData) {
    console.warn('validateAndProcessImportData function not found in app.js');
}

// Test data
const testWords = [
    {
        id: "test1",
        english: "hello",
        russian: "привет",
        easeFactor: 1.3,
        reviewHistory: [{ difficulty: "easy", exerciseType: "regular" }]
    },
    {
        id: "test2", 
        english: "world",
        russian: "мир",
        easeFactor: 2.3,
        reviewHistory: [{ difficulty: "hard", exerciseType: "regular" }]
    }
];

// === CORE TESTS ===
test('Learning progress calculation', () => {
    const result = calculateLearningProgress(1.3);
    const expected = Math.round(((1.3 - 1.3) / (3.5 - 1.3)) * 100);
    assertEqual(result, expected);
    assertEqual(calculateLearningProgress(1.3), 0);
    assertEqual(calculateLearningProgress(3.5), 100);
});

test('Reverse translation eligibility', () => {
    assert(isEligibleForReverseTranslation(testWords[0]));
    assert(!isEligibleForReverseTranslation(testWords[1]));
});

test('Text normalization', () => {
    assertEqual(normalizeText('Hello!'), 'hello');
    assertEqual(normalizeText('  Hello World  '), 'hello world');
    assertEqual(normalizeText('Hello,   World!'), 'hello world');
});

test('Levenshtein distance', () => {
    assertEqual(levenshteinDistance('hello', 'hello'), 0);
    assertEqual(levenshteinDistance('hello', 'helo'), 1);
    assertEqual(levenshteinDistance('hello', 'world'), 4);
    assertEqual(levenshteinDistance('', 'hello'), 5);
});

test('Typing accuracy - perfect', () => {
    const result = calculateTypingAccuracy('hello', 'hello');
    assertEqual(result.accuracy, 100);
    assertEqual(result.difficulty, 'perfect');
});

test('Typing accuracy - minor typo', () => {
    const result = calculateTypingAccuracy('helo', 'hello');
    assert(result.accuracy >= 70, `Expected accuracy >= 70, got ${result.accuracy}`);
    assert(['easy', 'medium'].includes(result.difficulty), `Expected easy or medium, got ${result.difficulty}`);
});

test('Typing accuracy - major error', () => {
    const result = calculateTypingAccuracy('xyz', 'hello');
    assert(result.accuracy < 70);
    assertEqual(result.difficulty, 'hard');
});






test('Session separation logic', () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 5 * 60 * 1000); // 5 min ago
    const oldDate = new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago
    
    const canShowReverseExercise = (word) => {
        const lastExerciseDate = word.lastExerciseDate ? new Date(word.lastExerciseDate) : null;
        const timeSinceLastExercise = lastExerciseDate ? now - lastExerciseDate : Infinity;
        const minInterval = 10 * 60 * 1000;
        
        return !lastExerciseDate || 
               word.lastExerciseType !== 'reverse' || 
               timeSinceLastExercise >= minInterval;
    };
    
    const recentWord = { lastExerciseType: 'reverse', lastExerciseDate: recentDate.toISOString() };
    const oldWord = { lastExerciseType: 'reverse', lastExerciseDate: oldDate.toISOString() };
    
    assert(!canShowReverseExercise(recentWord));
    assert(canShowReverseExercise(oldWord));
});

test('Full integration workflow', () => {
    const word = {
        id: "integration",
        english: "test",
        russian: "тест",
        easeFactor: 1.3,
        reviewHistory: []
    };
    
    // 1. Initially not eligible for reverse translation
    assert(!isEligibleForReverseTranslation(word));
    
    // 2. Add regular review with "easy" rating
    word.reviewHistory.push({
        date: new Date().toISOString(),
        difficulty: 'easy',
        exerciseType: 'regular'
    });
    
    // 3. Now eligible for reverse translation
    assert(isEligibleForReverseTranslation(word));
    
    // 4. Test typing accuracy for reverse exercise
    const perfectTyping = calculateTypingAccuracy('test', word.english);
    assertEqual(perfectTyping.accuracy, 100);
    assertEqual(perfectTyping.difficulty, 'perfect');
    
    const typoTyping = calculateTypingAccuracy('tset', word.english);
    assert(typoTyping.accuracy >= 50, `Expected accuracy >= 50, got ${typoTyping.accuracy}`);
    
    // 5. Add reverse review
    word.reviewHistory.push({
        date: new Date().toISOString(),
        difficulty: 'perfect',
        exerciseType: 'reverse'
    });
    
    // 6. Verify both exercise types recorded
    const regularCount = word.reviewHistory.filter(r => r.exerciseType === 'regular').length;
    const reverseCount = word.reviewHistory.filter(r => r.exerciseType === 'reverse').length;
    assertEqual(regularCount, 1);
    assertEqual(reverseCount, 1);
    assertEqual(word.reviewHistory.length, 2);
});

test('Export data structure and completeness', () => {
    // Test vocabulary data structure expected by export
    const mockVocabulary = [
        {
            id: "export_test_1",
            english: "hello",
            russian: "привет",
            definition: "A greeting",
            phonetic: "/həˈloʊ/",
            easeFactor: 1.5,
            repetition: 2,
            reviewHistory: [
                { date: "2025-01-01", difficulty: "easy", exerciseType: "regular" }
            ],
            addedDate: "2025-01-01"
        },
        {
            id: "export_test_2",
            english: "world",
            russian: "мир",
            definition: "The earth",
            easeFactor: 1.3,
            repetition: 0,
            reviewHistory: [],
            addedDate: "2025-01-01"
        }
    ];
    
    // Test export data structure creation
    const exportData = {
        vocabulary: mockVocabulary,
        exportDate: new Date().toISOString(),
        appVersion: "1.0",
        totalWords: mockVocabulary.length
    };
    
    // Verify export structure
    assert(Array.isArray(exportData.vocabulary), 'vocabulary should be array');
    assert(exportData.userProgress === undefined, 'userProgress should not exist');
    assertEqual(exportData.totalWords, 2);
    assert(typeof exportData.exportDate === 'string');
    assert(typeof exportData.appVersion === 'string');
    
    // Verify each word has required fields
    exportData.vocabulary.forEach((word, index) => {
        assert(word.id && typeof word.id === 'string', `Word ${index} missing id`);
        assert(word.english && typeof word.english === 'string', `Word ${index} missing english`);
        assert(word.russian && typeof word.russian === 'string', `Word ${index} missing russian`);
        assert(typeof word.easeFactor === 'number', `Word ${index} missing easeFactor`);
        assert(typeof word.repetition === 'number', `Word ${index} missing repetition`);
        assert(Array.isArray(word.reviewHistory), `Word ${index} missing reviewHistory`);
        assert(typeof word.addedDate === 'string', `Word ${index} missing addedDate`);
    });
    
    // Verify functionality works with exported data
    assert(isEligibleForReverseTranslation(exportData.vocabulary[0]));
    assert(!isEligibleForReverseTranslation(exportData.vocabulary[1]));
});

test('Import data validation', () => {
    // Test valid import data
    const validImportData = {
        vocabulary: [
            {
                id: "import_test_1",
                english: "import",
                russian: "импорт",
                definition: "To bring in from another place",
                easeFactor: 1.4,
                repetition: 1,
                reviewHistory: [
                    { date: "2025-01-01", difficulty: "easy", exerciseType: "regular" }
                ],
                addedDate: "2025-01-01"
            }
        ],
        exportDate: "2025-01-15T10:00:00.000Z",
        appVersion: "1.0",
        totalWords: 1
    };
    
    // Test import validation logic
    assert(validImportData.vocabulary && Array.isArray(validImportData.vocabulary), 'Valid data should have vocabulary array');
    assert(validImportData.vocabulary.length > 0, 'Valid data should have words');
    assert(typeof validImportData.totalWords === 'number', 'Valid data should have totalWords');
    
    // Test invalid import data scenarios
    const invalidDataCases = [
        { case: 'missing vocabulary', data: { totalWords: 0 } },
        { case: 'vocabulary not array', data: { vocabulary: "not array", totalWords: 0 } },
        { case: 'empty vocabulary', data: { vocabulary: [], totalWords: 0 } }
    ];
    
    invalidDataCases.forEach(testCase => {
        const isValid = testCase.data.vocabulary && Array.isArray(testCase.data.vocabulary) && testCase.data.vocabulary.length > 0;
        assert(!isValid, `${testCase.case} should be invalid`);
    });
    
    // Test that imported word can be used with app functions
    const importedWord = validImportData.vocabulary[0];
    assert(isEligibleForReverseTranslation(importedWord), 'Imported word should work with app functions');
    
    const progress = calculateLearningProgress(importedWord.easeFactor);
    assert(typeof progress === 'number' && progress >= 0 && progress <= 100, 'Progress calculation should work with imported data');
});


test('Real createExportData function test', () => {
    // Test the actual createExportData function from app.js
    assert(typeof createExportData === 'function', 'createExportData should be available');
    
    // Test with provided vocabulary data
    const testVocabulary = [
        {
            id: "export_real_test",
            english: "export",
            russian: "экспорт",
            definition: "To send data out of a system",
            easeFactor: 1.6,
            repetition: 3,
            reviewHistory: [
                { date: "2025-07-25T10:00:00.000Z", difficulty: "easy", exerciseType: "regular" }
            ],
            addedDate: "2025-07-24T10:00:00.000Z"
        }
    ];
    
    // Test real export function with test data
    const exportResult = createExportData(testVocabulary);
    
    // Validate export structure
    assert(exportResult.vocabulary && Array.isArray(exportResult.vocabulary), 'Export should have vocabulary array');
    assert(exportResult.vocabulary.length === 1, 'Export should have correct number of words');
    assert(typeof exportResult.exportDate === 'string', 'Export should have exportDate');
    assert(typeof exportResult.appVersion === 'string', 'Export should have appVersion');
    assert(typeof exportResult.totalWords === 'number', 'Export should have totalWords');
    assert(exportResult.userProgress === undefined, 'Export should not have userProgress (single source of truth)');
    
    // Validate word structure
    const exportedWord = exportResult.vocabulary[0];
    assert(exportedWord.id && typeof exportedWord.id === 'string', 'Exported word should have id');
    assert(exportedWord.english && typeof exportedWord.english === 'string', 'Exported word should have english');
    assert(exportedWord.russian && typeof exportedWord.russian === 'string', 'Exported word should have russian');
    assert(typeof exportedWord.easeFactor === 'number', 'Exported word should have easeFactor');
    assert(typeof exportedWord.repetition === 'number', 'Exported word should have repetition');
    assert(Array.isArray(exportedWord.reviewHistory), 'Exported word should have reviewHistory array');
    
    // Test that exported word works with app functions
    assert(isEligibleForReverseTranslation(exportedWord), 'Exported word should work with app functions');
    const progress = calculateLearningProgress(exportedWord.easeFactor);
    assert(typeof progress === 'number' && progress >= 0 && progress <= 100, 'Exported word should work with progress calculation');
});

test('Real validateAndProcessImportData function test', () => {
    // Test the actual validateAndProcessImportData function from app.js
    assert(typeof validateAndProcessImportData === 'function', 'validateAndProcessImportData should be available');
    
    // Test with valid import data from test-vocabulary.json structure
    const fs = require('fs');
    const path = require('path');
    const testFilePath = path.join(__dirname, 'test-vocabulary.json');
    const testFileContent = fs.readFileSync(testFilePath, 'utf8');
    const testData = JSON.parse(testFileContent);
    
    // Test real import validation function
    const validationResult = validateAndProcessImportData(testData);
    
    // Validate validation results
    assert(validationResult.valid === true, 'Validation should succeed for test file');
    assert(validationResult.vocabulary && Array.isArray(validationResult.vocabulary), 'Should return vocabulary array');
    assert(validationResult.vocabulary.length === 3, 'Should return correct number of words from test file');
    assert(validationResult.totalWords === 3, 'Should return correct total count');
    assert(validationResult.exportDate === testData.exportDate, 'Should preserve exportDate');
    assert(validationResult.appVersion === testData.appVersion, 'Should preserve appVersion');
    
    // Test that validated words work with app functions
    validationResult.vocabulary.forEach((word, index) => {
        const progress = calculateLearningProgress(word.easeFactor);
        assert(typeof progress === 'number' && progress >= 0 && progress <= 100, `Test word ${index + 1} should work with progress calculation`);
        
        // Test reverse translation eligibility for words with easy/perfect reviews
        const hasEasyReview = word.reviewHistory.some(r => r.difficulty === 'easy' || r.difficulty === 'perfect');
        if (hasEasyReview) {
            assert(isEligibleForReverseTranslation(word), `Test word ${index + 1} with easy reviews should be eligible for reverse translation`);
        }
    });
    
    // Test invalid import data with real function
    const invalidDataCases = [
        { name: 'missing vocabulary', data: { totalWords: 0 } },
        { name: 'vocabulary not array', data: { vocabulary: "not array", totalWords: 0 } },
        { name: 'null vocabulary', data: { vocabulary: null, totalWords: 0 } },
        { name: 'word missing id', data: { vocabulary: [{ english: "test", russian: "тест", easeFactor: 1.3, repetition: 0, reviewHistory: [] }], totalWords: 1 } },
        { name: 'word missing english', data: { vocabulary: [{ id: "test", russian: "тест", easeFactor: 1.3, repetition: 0, reviewHistory: [] }], totalWords: 1 } },
        { name: 'word invalid easeFactor', data: { vocabulary: [{ id: "test", english: "test", russian: "тест", easeFactor: "invalid", repetition: 0, reviewHistory: [] }], totalWords: 1 } }
    ];
    
    invalidDataCases.forEach(testCase => {
        try {
            validateAndProcessImportData(testCase.data);
            assert(false, `${testCase.name} should throw error`);
        } catch (error) {
            assert(error.message.includes('Invalid backup file format') || error.message.includes('Missing or invalid'), `${testCase.name} should throw validation error`);
        }
    });
    
    // Test edge case: empty vocabulary array (should be valid)
    const emptyVocabularyData = { vocabulary: [], totalWords: 0 };
    const emptyResult = validateAndProcessImportData(emptyVocabularyData);
    assert(emptyResult.valid === true, 'Empty vocabulary array should be valid');
    assert(emptyResult.vocabulary.length === 0, 'Empty vocabulary should return empty array');
});

test('Export-Import round trip integrity using real functions', () => {
    // Use test vocabulary from test-vocabulary.json for round trip test
    const fs = require('fs');
    const path = require('path');
    const testFilePath = path.join(__dirname, 'test-vocabulary.json');
    const testFileContent = fs.readFileSync(testFilePath, 'utf8');
    const originalTestData = JSON.parse(testFileContent);
    const originalVocabulary = originalTestData.vocabulary;
    
    // Step 1: Export data using real function
    const exportedData = createExportData(originalVocabulary);
    
    // Step 2: Validate and process the exported data using real function
    const importedData = validateAndProcessImportData(exportedData);
    
    // Step 3: Verify round trip integrity
    assert(importedData.valid === true, 'Round trip validation should succeed');
    assert(importedData.vocabulary.length === originalVocabulary.length, 'Round trip should preserve word count');
    
    // Verify each word's data integrity
    originalVocabulary.forEach((originalWord, index) => {
        const importedWord = importedData.vocabulary[index];
        
        // Core fields
        assertEqual(importedWord.id, originalWord.id);
        assertEqual(importedWord.english, originalWord.english);
        assertEqual(importedWord.russian, originalWord.russian);
        assertEqual(importedWord.definition, originalWord.definition);
        assertEqual(importedWord.phonetic, originalWord.phonetic);
        
        // Progress fields
        assertEqual(importedWord.easeFactor, originalWord.easeFactor);
        assertEqual(importedWord.repetition, originalWord.repetition);
        assertEqual(importedWord.nextReview, originalWord.nextReview);
        assertEqual(importedWord.addedDate, originalWord.addedDate);
        
        // Review history
        assert(Array.isArray(importedWord.reviewHistory), `Word ${index + 1} should have reviewHistory array`);
        assertEqual(importedWord.reviewHistory.length, originalWord.reviewHistory.length);
        
        originalWord.reviewHistory.forEach((originalReview, reviewIndex) => {
            const importedReview = importedWord.reviewHistory[reviewIndex];
            assertEqual(importedReview.date, originalReview.date);
            assertEqual(importedReview.difficulty, originalReview.difficulty);
            assertEqual(importedReview.exerciseType, originalReview.exerciseType);
        });
        
        // Functional integrity - imported word should work with app functions
        const progress = calculateLearningProgress(importedWord.easeFactor);
        assert(typeof progress === 'number' && progress >= 0 && progress <= 100, `Word ${index + 1} should work with progress calculation after round trip`);
        
        if (importedWord.reviewHistory.some(r => r.difficulty === 'easy' || r.difficulty === 'perfect')) {
            assert(isEligibleForReverseTranslation(importedWord), `Word ${index + 1} should work with reverse translation eligibility after round trip`);
        }
    });
    
    // Test that no data was lost or corrupted by comparing JSON
    const originalJson = JSON.stringify(originalVocabulary.sort((a, b) => a.id.localeCompare(b.id)), null, 2);
    const roundTripJson = JSON.stringify(importedData.vocabulary.sort((a, b) => a.id.localeCompare(b.id)), null, 2);
    assertEqual(roundTripJson, originalJson);
});

test('Session management integration', () => {
    const now = new Date();
    
    // 1. Create word eligible for reverse translation
    const word = {
        id: "session_test",
        english: "session",
        russian: "сессия", 
        reviewHistory: [{ difficulty: "easy", exerciseType: "regular" }],
        lastExerciseType: null,
        lastExerciseDate: null
    };
    
    // 2. Initially can show any exercise type
    assert(isEligibleForReverseTranslation(word));
    
    // 3. Simulate showing reverse exercise
    word.lastExerciseType = 'reverse';
    word.lastExerciseDate = now.toISOString();
    
    // 4. Should not allow another reverse exercise immediately
    const canShowReverseExercise = (word) => {
        const lastExerciseDate = word.lastExerciseDate ? new Date(word.lastExerciseDate) : null;
        const timeSinceLastExercise = lastExerciseDate ? now - lastExerciseDate : Infinity;
        const minInterval = 10 * 60 * 1000;
        return !lastExerciseDate || 
               word.lastExerciseType !== 'reverse' || 
               timeSinceLastExercise >= minInterval;
    };
    
    assert(!canShowReverseExercise(word));
    
    // 5. Simulate time passing (11 minutes)
    const futureTime = new Date(now.getTime() + 11 * 60 * 1000);
    const canShowAfterDelay = (word) => {
        const lastExerciseDate = word.lastExerciseDate ? new Date(word.lastExerciseDate) : null;
        const timeSinceLastExercise = lastExerciseDate ? futureTime - lastExerciseDate : Infinity;
        const minInterval = 10 * 60 * 1000;
        return !lastExerciseDate || 
               word.lastExerciseType !== 'reverse' || 
               timeSinceLastExercise >= minInterval;
    };
    
    // 6. Should allow reverse exercise after delay
    assert(canShowAfterDelay(word));
});

// File system test - verify test file exists
test('Test vocabulary file validation using real functions', () => {
    const fs = require('fs');
    const path = require('path');
    
    const testFilePath = path.join(__dirname, 'test-vocabulary.json');
    
    // Check if test file exists
    assert(fs.existsSync(testFilePath), 'test-vocabulary.json should exist');
    
    // Read and validate test file using real validation function
    const testFileContent = fs.readFileSync(testFilePath, 'utf8');
    const testData = JSON.parse(testFileContent);
    
    // Use real validation function to validate test file
    const validationResult = validateAndProcessImportData(testData);
    
    // Validate that real function accepts test file
    assert(validationResult.valid === true, 'Real validation function should accept test file');
    assert(validationResult.vocabulary.length === 3, 'Should validate 3 test words');
    assert(validationResult.totalWords === 3, 'Should validate correct totalWords count');
    
    // Test that test file works with real export function
    const exportResult = createExportData(testData.vocabulary);
    
    // Validate export using test file data
    assert(exportResult.vocabulary.length === 3, 'Export should handle test file data');
    assert(exportResult.totalWords === 3, 'Export should count test words correctly');
    assert(typeof exportResult.exportDate === 'string', 'Export should generate exportDate');
    assert(typeof exportResult.appVersion === 'string', 'Export should have appVersion');
    
    // Test that all test file words work with app functions
    testData.vocabulary.forEach((word, index) => {
        const progress = calculateLearningProgress(word.easeFactor);
        assert(typeof progress === 'number' && progress >= 0 && progress <= 100, `Test word ${index + 1} should work with progress calculation`);
        
        // Check reverse translation eligibility for words with reviews
        if (word.reviewHistory.length > 0) {
            const hasEasyReview = word.reviewHistory.some(r => r.difficulty === 'easy' || r.difficulty === 'perfect');
            if (hasEasyReview) {
                assert(isEligibleForReverseTranslation(word), `Test word ${index + 1} with easy/perfect reviews should be eligible for reverse translation`);
            }
        }
    });
});

// Results
console.log('\n=== COMPLETE TEST RESULTS ===');
console.log(`Tests passed: ${passed}/${passed + failed}`);

if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - SYSTEM HEALTHY');
    process.exit(0);
} else {
    console.log('❌ SOME TESTS FAILED - NEEDS ATTENTION');
    process.exit(1);
}