import { describe, it, expect, beforeEach } from 'vitest';
import { getByText } from '@testing-library/dom';

// Mock DOM environment for components
beforeEach(() => {
  document.body.innerHTML = '';
  // Reset global state
  global.window = global;
  global.DataManager = {
    vocabulary: [],
    userProgress: {}
  };
  global.SpacedRepetition = {
    calculateLearningProgress: (easeFactor) => Math.round(((easeFactor - 1.3) / (3.5 - 1.3)) * 100)
  };
});

// Load our UI components
const fs = require('fs');
const path = require('path');
const componentCode = fs.readFileSync(path.join(__dirname, '../../js/ui-components.js'), 'utf8');
eval(componentCode);

// Make UI functions available globally for tests
const {
  createWordCard,
  createProgressComponent,
  createStatusBadge,
  createWordDetailSections,
  createWordMetadata,
  UIComponents
} = window;

describe('UI Components', () => {
  describe('createWordCard', () => {
    it('should create a basic word card', () => {
      const word = {
        id: 'test1',
        english: 'hello',
        russian: 'привет',
        phonetic: '/həˈloʊ/',
        definition: 'A greeting'
      };
      
      const cardHtml = createWordCard(word, 'default', [], false);
      
      expect(cardHtml).toContain('word-card');
      expect(cardHtml).toContain('hello');
      expect(cardHtml).toContain('привет');
      expect(cardHtml).toContain('/həˈloʊ/');
      expect(cardHtml).toContain('definition'); // Shows definition in default mode
    });

    it('should create a compact word card', () => {
      const word = {
        id: 'test2',
        english: 'test',
        russian: 'тест'
      };
      
      const actions = [
        { type: 'primary', icon: '🔊', onclick: 'speak()', title: 'Speak' }
      ];
      
      const cardHtml = createWordCard(word, 'compact', actions, true);
      
      expect(cardHtml).toContain('word-card--compact');
      expect(cardHtml).toContain('action-btn--primary');
      expect(cardHtml).toContain('🔊');
      expect(cardHtml).toContain('progress-component'); // showProgress = true
    });

    it('should create a learning variant card', () => {
      const word = {
        id: 'learn1',
        english: 'beautiful',
        russian: 'красивый'
      };
      
      const cardHtml = createWordCard(word, 'learning', [], false);
      
      expect(cardHtml).toContain('word-card--learning');
      expect(cardHtml).toContain('beautiful');
      expect(cardHtml).not.toContain('красивый'); // Hidden in learning mode
    });

    it('should handle missing phonetic gracefully', () => {
      const word = {
        id: 'test3',
        english: 'word',
        russian: 'слово'
        // no phonetic
      };
      
      const cardHtml = createWordCard(word, 'default', [], false);
      
      expect(cardHtml).toContain('word');
      expect(cardHtml).toContain('слово');
      expect(cardHtml).not.toContain('word-card__phonetic');
    });
  });

  describe('createProgressComponent', () => {
    it('should create progress bar with correct percentage', () => {
      const progressHtml = createProgressComponent(75, 'default', 'Test Progress');
      
      expect(progressHtml).toContain('progress-component');
      expect(progressHtml).toContain('75%');
      expect(progressHtml).toContain('Test Progress');
      expect(progressHtml).toContain('width: 75%');
    });

    it('should handle compact variant', () => {
      const progressHtml = createProgressComponent(50, 'compact', 'Compact');
      
      expect(progressHtml).toContain('progress-component__bar--compact');
      expect(progressHtml).toContain('progress-component__percentage--compact');
    });

    it('should handle edge case percentages', () => {
      const zeroProgress = createProgressComponent(0, 'default', 'Zero');
      expect(zeroProgress).toContain('width: 0%');
      expect(zeroProgress).toContain('0%');
      
      const fullProgress = createProgressComponent(100, 'default', 'Full');
      expect(fullProgress).toContain('width: 100%');
      expect(fullProgress).toContain('100%');
    });
  });

  describe('createStatusBadge', () => {
    it('should create correct badge for different progress levels', () => {
      expect(createStatusBadge(0)).toContain('status-badge--new');
      expect(createStatusBadge(0)).toContain('New');
      
      expect(createStatusBadge(25)).toContain('status-badge--learning');
      expect(createStatusBadge(25)).toContain('Learning');
      
      expect(createStatusBadge(60)).toContain('status-badge--familiar');
      expect(createStatusBadge(60)).toContain('Familiar');
      
      expect(createStatusBadge(80)).toContain('status-badge--mastered');
      expect(createStatusBadge(80)).toContain('Mastered');
    });
  });

  describe('createWordDetailSections', () => {
    it('should create definition section', () => {
      const word = {
        definition: 'A test definition'
      };
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      
      expect(sectionsHtml).toContain('detail-block--definition');
      expect(sectionsHtml).toContain('📖 Definition');
      expect(sectionsHtml).toContain('A test definition');
    });

    it('should create synonyms section', () => {
      const word = {
        synonyms: ['beautiful', 'gorgeous', 'lovely']
      };
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      
      expect(sectionsHtml).toContain('detail-block--synonyms');
      expect(sectionsHtml).toContain('Synonyms');
      expect(sectionsHtml).toContain('beautiful');
      expect(sectionsHtml).toContain('gorgeous');
      expect(sectionsHtml).toContain('lovely');
    });

    it('should create examples section with multiple examples', () => {
      const word = {
        examples: [
          'This is example one.',
          'This is example two.',
          'This is example three.'
        ]
      };
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      
      expect(sectionsHtml).toContain('detail-block--examples');
      expect(sectionsHtml).toContain('💡 Examples');
      expect(sectionsHtml).toContain('This is example one.');
      expect(sectionsHtml).toContain('This is example two.');
    });

    it('should handle learning variant with limited examples', () => {
      const word = {
        examples: ['Example 1', 'Example 2', 'Example 3', 'Example 4']
      };
      
      const sectionsHtml = createWordDetailSections(word, 'learning');
      
      expect(sectionsHtml).toContain('detail-block--learning');
      expect(sectionsHtml).toContain('Example 1');
      expect(sectionsHtml).toContain('Example 2');
      expect(sectionsHtml).not.toContain('Example 3'); // Limited to 2 in learning mode
      expect(sectionsHtml).not.toContain('Example 4');
    });

    it('should return empty string when no details provided', () => {
      const word = {
        english: 'test',
        russian: 'тест'
        // no definition, synonyms, or examples
      };
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      
      expect(sectionsHtml).toBe('');
    });
  });

  describe('createWordMetadata', () => {
    it('should create metadata with all available data', () => {
      const word = { id: 'meta_test' };
      const progress = {
        repetitions: 3,
        reviewStatus: 'Ready for review',
        isReady: true,
        addedDate: new Date('2024-01-01'),
        correctCount: 5,
        totalAttempts: 7,
        lastSeen: Date.now() - (1000 * 60 * 60 * 24) // 1 day ago
      };
      
      const metadataHtml = createWordMetadata(word, progress);
      
      expect(metadataHtml).toContain('word-metadata');
      expect(metadataHtml).toContain('3 repetitions');
      expect(metadataHtml).toContain('Ready for review');
      expect(metadataHtml).toContain('5/7 correct');
      expect(metadataHtml).toContain('1 days ago');
    });

    it('should handle minimal metadata', () => {
      const word = { id: 'minimal' };
      const progress = { repetitions: 0 };
      
      const metadataHtml = createWordMetadata(word, progress);
      
      expect(metadataHtml).toContain('0 repetitions');
      expect(metadataHtml).not.toContain('correct');
      expect(metadataHtml).not.toContain('days ago');
    });

    it('should return empty string when no metadata', () => {
      const word = { id: 'empty' };
      const progress = {};
      
      const metadataHtml = createWordMetadata(word, progress);
      
      expect(metadataHtml).toBe('');
    });
  });
});

describe('Translation Components', () => {
    const mockWord = {
        id: 'test-word',
        english: 'test',
        russian: 'тест',
        definition: 'A trial or examination',
        synonyms: ['trial', 'exam'],
        examples: ['This is a test', 'Test your knowledge']
    };

    const mockProgress = {
        repetitions: 3,
        correctCount: 5,
        totalAttempts: 7,
        addedDate: new Date('2023-01-01')
    };

    test('createTranslationBlock should create translation section', () => {
        const result = UIComponents.createTranslationBlock(mockWord, 'learning');
        
        expect(result).toContain('card-translation');
        expect(result).toContain('Translation');
        expect(result).toContain('тест');
    });

    test('createTranslationBlock should handle missing translation', () => {
        const wordWithoutRussian = { ...mockWord, russian: '' };
        const result = UIComponents.createTranslationBlock(wordWithoutRussian);
        
        expect(result).toBe('');
    });

    test('createLearningAnswerContent should create complete content', () => {
        const result = UIComponents.createLearningAnswerContent(mockWord, mockProgress, 'learning');
        
        expect(result).toContain('card-translation');
        expect(result).toContain('тест');
        expect(result).toContain('A trial or examination');
        expect(result).toContain('trial');
        expect(result).toContain('This is a test');
    });

    test('createLearningAnswerContent should work without progress', () => {
        const result = UIComponents.createLearningAnswerContent(mockWord, null, 'learning');
        
        expect(result).toContain('card-translation');
        expect(result).toContain('тест');
        expect(result).toContain('A trial or examination');
    });
});

describe('DOM Integration Tests', () => {
  it('should render word card in DOM and be visible', () => {
    const word = {
      id: 'dom_test',
      english: 'visible',
      russian: 'видимый'
    };
    
    const cardHtml = createWordCard(word, 'compact', [], true);
    document.body.innerHTML = cardHtml;
    
    // Check elements are in DOM
    const englishElement = getByText(document.body, 'visible');
    const russianElement = getByText(document.body, 'видимый');
    
    expect(englishElement).toBeTruthy();
    expect(russianElement).toBeTruthy();
    
    // Check visibility (these elements should not have display: none)
    expect(englishElement.style.display).not.toBe('none');
    expect(russianElement.style.display).not.toBe('none');
  });

  it('should render progress component with proper attributes', () => {
    const progressHtml = createProgressComponent(60, 'default', 'DOM Progress');
    document.body.innerHTML = progressHtml;
    
    const progressBar = document.querySelector('.progress-component__bar');
    const progressFill = document.querySelector('.progress-component__fill');
    
    expect(progressBar).toBeTruthy();
    expect(progressFill).toBeTruthy();
    expect(progressFill.style.width).toBe('60%');
  });

  it('should handle action buttons with proper attributes', () => {
    const word = { id: 'action_test', english: 'click', russian: 'клик' };
    const actions = [
      { type: 'primary', icon: '🔊', onclick: 'testFunction()', title: 'Test Action' }
    ];
    
    const cardHtml = createWordCard(word, 'default', actions, false);
    document.body.innerHTML = cardHtml;
    
    const actionButton = document.querySelector('.action-btn--primary');
    expect(actionButton).toBeTruthy();
    expect(actionButton.getAttribute('onclick')).toBe('testFunction()');
    expect(actionButton.getAttribute('title')).toBe('Test Action');
    expect(actionButton.textContent.trim()).toContain('🔊');
  });

  it('should render expandable card with metadata', () => {
    const word = { 
      id: 'expandable_test', 
      english: 'expandable', 
      russian: 'раскрываемый',
      repetition: 5,
      nextReview: '2025-12-31T00:00:00.000Z', // Future date
      createdAt: '2024-01-01T00:00:00.000Z'
    };
    
    const cardHtml = createWordCard(word, 'compact', [], true, true); // expandable = true
    document.body.innerHTML = cardHtml;
    
    // Check expandable content exists
    const expandableContent = document.querySelector('.word-card__expandable-content');
    expect(expandableContent).toBeTruthy();
    
    // Check metadata is present
    const metadata = document.querySelector('.word-metadata');
    expect(metadata).toBeTruthy();
    
    // Check specific metadata items
    expect(metadata.textContent).toContain('5 repetitions');
    expect(metadata.textContent).toContain('Added 01/01/2024'); // European format
    expect(metadata.textContent).toContain('Next review: 31/12/2025'); // European format
  });
});
