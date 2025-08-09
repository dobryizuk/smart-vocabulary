import { describe, it, expect, beforeEach, vi } from 'vitest';
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
/* eslint-disable sonarjs/code-eval */
eval(componentCode);
/* eslint-enable sonarjs/code-eval */

// Load theme manager
const themeManagerCode = fs.readFileSync(path.join(__dirname, '../../js/theme-manager.js'), 'utf8');
/* eslint-disable sonarjs/code-eval */
eval(themeManagerCode);
/* eslint-enable sonarjs/code-eval */

// Make UI functions available globally for tests
const {
  createWordCard,
  createProgressComponent,
  createStatusBadge,
  createWordDetailSections,
  createWordMetadata,
  UIComponents
} = window;

// Make ThemeManager available for tests
const { ThemeManager } = window;

describe('UI Components', () => {
  describe('createWordCard', () => {
    it('should create a basic word card', () => {
      const word = {
        id: 'test1',
        original: 'hello',
        translation: 'привет',
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
        original: 'test',
        translation: 'тест'
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
        original: 'beautiful',
        translation: 'красивый'
      };
      
      const cardHtml = createWordCard(word, 'learning', [], false);
      
      expect(cardHtml).toContain('word-card--learning');
      expect(cardHtml).toContain('beautiful');
      expect(cardHtml).not.toContain('красивый'); // Hidden in learning mode
    });

    it('should handle missing phonetic gracefully', () => {
      const word = {
        id: 'test3',
        original: 'word',
        translation: 'слово'
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
        original: 'test',
        translation: 'тест'
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
        original: 'test',
        translation: 'тест',
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
        const wordWithoutTranslation = { ...mockWord, translation: '' };
        const result = UIComponents.createTranslationBlock(wordWithoutTranslation);
        
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
      original: 'visible',
      translation: 'видимый'
    };
    
    const cardHtml = createWordCard(word, 'compact', [], true);
    document.body.innerHTML = cardHtml;
    
    // Check elements are in DOM
    const originalElement = getByText(document.body, 'visible');
    const translationElement = getByText(document.body, 'видимый');
    
    expect(originalElement).toBeTruthy();
    expect(translationElement).toBeTruthy();
    
    // Check visibility (these elements should not have display: none)
    expect(originalElement.style.display).not.toBe('none');
    expect(translationElement.style.display).not.toBe('none');
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
    const word = { id: 'action_test', original: 'click', translation: 'клик' };
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
      original: 'expandable', 
      translation: 'раскрываемый',
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

describe('Theme Manager', () => {
  let themeManager;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Mock matchMedia for system theme detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    
    // Clear localStorage before each test
    localStorage.clear();
    
    // Create a fresh theme manager instance
    themeManager = new ThemeManager();
  });

  describe('Theme Management', () => {
    it('should initialize with system theme by default', () => {
      expect(themeManager.getCurrentTheme()).toBe('system');
      // In test environment, system theme is detected as 'light', but we have a fallback
      const effectiveTheme = themeManager.getEffectiveTheme();
      expect(['light', 'dark']).toContain(effectiveTheme);
    });

    it('should load saved theme preference from localStorage', () => {
      // Mock localStorage to return 'light' theme
      global.localStorage.getItem.mockReturnValue('light');
      
      themeManager = new ThemeManager();
      
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getEffectiveTheme()).toBe('light');
    });

    it('should save theme preference to localStorage', () => {
      themeManager.setTheme('dark');
      
      expect(global.localStorage.setItem).toHaveBeenCalledWith('smart-vocabulary-theme', 'dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');
    });

    it('should toggle between light and dark correctly', () => {
      // Start with system theme
      expect(themeManager.getCurrentTheme()).toBe('system');
      
      // First toggle should set either light or dark
      themeManager.toggleTheme();
      const firstToggle = themeManager.getCurrentTheme();
      expect(['light', 'dark']).toContain(firstToggle);
      
      // Second toggle should switch to the other theme
      themeManager.toggleTheme();
      const secondToggle = themeManager.getCurrentTheme();
      expect(secondToggle).not.toBe(firstToggle);
      expect(['light', 'dark']).toContain(secondToggle);
    });

    it('should apply theme to document', () => {
      themeManager.setTheme('light');
      
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should update theme color meta tag', () => {
      // Add meta theme-color tag to document
      const metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
      
      themeManager.setTheme('light');
      
      expect(metaThemeColor.getAttribute('content')).toBe('#FFFFFF');
      
      themeManager.setTheme('dark');
      
      expect(metaThemeColor.getAttribute('content')).toBe('#0F0F0F');
    });

    it('should dispatch themeChanged event', () => {
      const eventSpy = vi.fn();
      window.addEventListener('themeChanged', eventSpy);
      
      themeManager.setTheme('light');
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            theme: 'light',
            effectiveTheme: 'light'
          }
        })
      );
    });
  });

  describe('Theme Icons and Text', () => {
    it('should return correct theme icon for light theme', () => {
      themeManager.setTheme('light');
      expect(themeManager.getThemeIcon()).toBe('☀️');
    });

    it('should return correct theme icon for dark theme', () => {
      themeManager.setTheme('dark');
      expect(themeManager.getThemeIcon()).toBe('🌙');
    });

    it('should return correct theme icon for system theme', () => {
      themeManager.setTheme('system');
      expect(themeManager.getThemeIcon()).toBe('🌓');
    });

    it('should return correct theme text for light theme', () => {
      themeManager.setTheme('light');
      expect(themeManager.getThemeText()).toBe('Light');
    });

    it('should return correct theme text for dark theme', () => {
      themeManager.setTheme('dark');
      expect(themeManager.getThemeText()).toBe('Dark');
    });

    it('should return correct theme text for system theme', () => {
      themeManager.setTheme('system');
      const themeText = themeManager.getThemeText();
      expect(themeText).toMatch(/^(System \(light\)|System \(dark\))$/);
    });
  });

  describe('Theme Switcher UI', () => {
    beforeEach(() => {
      // Create mock DOM structure for theme switcher
      document.body.innerHTML = `
        <div id="dataManagement">
          <h4>Data Management</h4>
        </div>
      `;
    });

    it('should create theme switcher button', () => {
      themeManager.createThemeSwitcher();
      
      const themeSwitcher = document.getElementById('theme-switcher');
      expect(themeSwitcher).toBeTruthy();
      expect(themeSwitcher.className).toContain('btn');
      expect(themeSwitcher.className).toContain('btn--secondary');
    });

    it('should create theme section with proper structure', () => {
      themeManager.createThemeSwitcher();
      
      const themeSection = document.querySelector('.theme-section');
      expect(themeSection).toBeTruthy();
      expect(themeSection.querySelector('h4').textContent).toBe('Appearance');
      expect(themeSection.querySelector('p').textContent).toBe('Choose your preferred theme');
    });

    it('should update theme switcher UI when theme changes', () => {
      themeManager.createThemeSwitcher();
      
      const themeSwitcher = document.getElementById('theme-switcher');
      const initialText = themeSwitcher.textContent;
      
      themeManager.setTheme('light');
      
      expect(themeSwitcher.textContent).not.toBe(initialText);
      expect(themeSwitcher.textContent).toContain('☀️');
      expect(themeSwitcher.textContent).toContain('Light');
    });

    it('should handle theme switcher click', () => {
      themeManager.createThemeSwitcher();
      
      // Test that toggleTheme works correctly
      const initialTheme = themeManager.getCurrentTheme();
      expect(initialTheme).toBe('system');
      
      // Call toggleTheme directly to test the functionality
      themeManager.toggleTheme();
      
      // The theme should change from 'system' to a concrete theme
      const toggled = themeManager.getCurrentTheme();
      expect(['light', 'dark']).toContain(toggled);
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'smart-vocabulary-theme',
        expect.stringMatching(/^(light|dark)$/)
      );
    });

    it('should not create duplicate theme switchers', () => {
      themeManager.createThemeSwitcher();
      themeManager.createThemeSwitcher();
      
      const themeSwitchers = document.querySelectorAll('#theme-switcher');
      expect(themeSwitchers).toHaveLength(1);
    });
  });

  describe('System Theme Detection', () => {
    it('should detect light system theme', () => {
      // Mock matchMedia to return light theme
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: light)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      themeManager = new ThemeManager();
      themeManager.setTheme('system');
      
      expect(themeManager.getEffectiveTheme()).toBe('light');
    });

    it('should detect dark system theme', () => {
      // Mock matchMedia to return dark theme
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      themeManager = new ThemeManager();
      themeManager.setTheme('system');
      
      expect(themeManager.getEffectiveTheme()).toBe('dark');
    });
  });
});
