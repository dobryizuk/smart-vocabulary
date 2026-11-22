import { describe, it, expect, beforeEach } from 'vitest';
import { setupDOM, createTestWord, renderToDOM, getTextContent } from './test-helpers.js';

describe('Word Detail Sections', () => {
  let createWordDetailSections; // createWordMetadata is used only in some tests below

  beforeEach(() => {
    setupDOM();
    const UI = require('../../js/ui-components.js');
    createWordDetailSections = UI.createWordDetailSections;
    // createWordMetadata is used within tests that reference it directly
  });

  describe('Definition Section', () => {
    it('should create definition section when definition exists', () => {
      const word = createTestWord({
        definition: 'A test definition for the word'
      });
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      const container = renderToDOM(sectionsHtml);
      
      const definitionBlock = container.querySelector('[data-testid="detail-definition"]');
      expect(definitionBlock).toBeTruthy();
      
      const definitionHeader = container.querySelector('.detail-title');
      expect(getTextContent(definitionHeader)).toContain('Definition');
      expect(getTextContent(definitionHeader)).toContain('📖');
      
      const definitionContent = container.querySelector('.detail-text');
      expect(getTextContent(definitionContent)).toContain('A test definition for the word');
    });

    it('should not create definition section when definition is empty', () => {
      const word = createTestWord({
        definition: ''
      });
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      const container = renderToDOM(sectionsHtml);
      
      const definitionBlock = container.querySelector('[data-testid="detail-definition"]');
      expect(definitionBlock).toBeFalsy();
    });
  });

  describe('Synonyms Section', () => {
    it('should create synonyms section with array of synonyms', () => {
      const word = createTestWord({
        synonyms: ['beautiful', 'gorgeous', 'lovely', 'stunning']
      });
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      const container = renderToDOM(sectionsHtml);
      
      const synonymsBlock = container.querySelector('[data-testid="detail-synonyms"]');
      expect(synonymsBlock).toBeTruthy();
      
      const synonymsHeader = synonymsBlock.querySelector('.detail-title');
      expect(getTextContent(synonymsHeader)).toContain('Synonyms');
      
      const synonymsContent = synonymsBlock.querySelector('.detail-text');
      const contentText = getTextContent(synonymsContent);
      expect(contentText).toContain('beautiful');
      expect(contentText).toContain('gorgeous');
      expect(contentText).toContain('lovely');
      expect(contentText).toContain('stunning');
    });

    it('should create synonyms section with provided synonyms', () => {
      const word = createTestWord({
        synonyms: ['beautiful', 'gorgeous', 'lovely']
      });
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      const container = renderToDOM(sectionsHtml);
      
      const synonymsBlock = container.querySelector('[data-testid="detail-synonyms"]');
      expect(synonymsBlock).toBeTruthy();
      
      const synonymsContent = synonymsBlock.querySelector('.detail-text');
      const contentText = getTextContent(synonymsContent);
      expect(contentText).toContain('beautiful');
      expect(contentText).toContain('gorgeous');
      expect(contentText).toContain('lovely');
    });

    it('should not create synonyms section when synonyms are empty', () => {
      const word = createTestWord({
        synonyms: []
      });
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      const container = renderToDOM(sectionsHtml);
      
      const synonymsBlock = container.querySelector('[data-testid="detail-synonyms"]');
      expect(synonymsBlock).toBeFalsy();
    });
  });

  describe('Examples Section', () => {
    it('should create examples section with multiple examples', () => {
      const word = createTestWord({
        examples: [
          'This is the first example sentence.',
          'Here is another example.',
          'And a third example for good measure.'
        ]
      });
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      const container = renderToDOM(sectionsHtml);
      
      const examplesBlock = container.querySelector('[data-testid="detail-examples"]');
      expect(examplesBlock).toBeTruthy();
      
      const examplesHeader = examplesBlock.querySelector('.detail-title');
      expect(getTextContent(examplesHeader)).toContain('Examples');
      expect(getTextContent(examplesHeader)).toContain('💡');
      
      const examplesContent = examplesBlock.querySelector('.detail-text');
      const contentText = getTextContent(examplesContent);
      expect(contentText).toContain('This is the first example sentence.');
      expect(contentText).toContain('Here is another example.');
      expect(contentText).toContain('And a third example for good measure.');
    });

    it('should limit examples in learning variant', () => {
      const word = createTestWord({
        examples: [
          'Example 1',
          'Example 2', 
          'Example 3',
          'Example 4',
          'Example 5'
        ]
      });
      
      const sectionsHtml = createWordDetailSections(word, 'learning');
      const container = renderToDOM(sectionsHtml);
      
      const examplesBlock = container.querySelector('[data-testid="detail-examples"]');
      expect(examplesBlock).toBeTruthy();
      
      // Should have learning class
      expect(examplesBlock.classList.contains('detail-block--learning')).toBe(true);
      
      const contentText = getTextContent(examplesBlock);
      expect(contentText).toContain('Example 1');
      expect(contentText).toContain('Example 2');
      // Should not contain examples beyond the limit (typically 2 in learning mode)
      expect(contentText).not.toContain('Example 3');
      expect(contentText).not.toContain('Example 4');
      expect(contentText).not.toContain('Example 5');
    });

    it('should handle single example in array', () => {
      const word = createTestWord({
        examples: ['This is a single example string.']
      });
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      const container = renderToDOM(sectionsHtml);
      
      const examplesBlock = container.querySelector('.detail-block--examples');
      expect(examplesBlock).toBeTruthy();
      
      const contentText = getTextContent(examplesBlock);
      expect(contentText).toContain('This is a single example string.');
    });
  });

  describe('Empty Details Handling', () => {
    it('should return empty string when no details are provided', () => {
      const word = {
        id: 'test-minimal',
        original: 'test',
        translation: 'тест'
        // no definition, synonyms, or examples
      };
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      
      expect(sectionsHtml.trim()).toBe('');
    });

    it('should only show sections with content', () => {
      const word = createTestWord({
        definition: 'Only has definition',
        synonyms: [], // empty
        examples: '' // empty
      });
      
      const sectionsHtml = createWordDetailSections(word, 'default');
      const container = renderToDOM(sectionsHtml);
      
      const definitionBlock = container.querySelector('[data-testid="detail-definition"]');
      expect(definitionBlock).toBeTruthy();
      
      const synonymsBlock = container.querySelector('[data-testid="detail-synonyms"]');
      expect(synonymsBlock).toBeFalsy();
      
      const examplesBlock = container.querySelector('[data-testid="detail-examples"]');
      expect(examplesBlock).toBeFalsy();
    });
  });
});

describe('Word Metadata Component', () => {
  let createWordMetadata;

  beforeEach(() => {
    setupDOM();
    const UI = require('../../js/ui-components.js');
    createWordMetadata = UI.createWordMetadata;
  });

  describe('Complete Metadata', () => {
    it('should create metadata with all available data', () => {
      const word = createTestWord({ id: 'meta_test' });
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
      const container = renderToDOM(metadataHtml);
      
      const metadata = container.querySelector('.word-metadata');
      expect(metadata).toBeTruthy();
      
      const metadataText = getTextContent(metadata);
      expect(metadataText).toContain('3 repetitions');
      expect(metadataText).toContain('Ready for review');
      expect(metadataText).toContain('5/7 correct');
      expect(metadataText).toContain('1 days ago');
    });

    it('should handle minimal metadata gracefully', () => {
      const word = createTestWord({ id: 'minimal' });
      const progress = { repetitions: 0 };
      
      const metadataHtml = createWordMetadata(word, progress);
      const container = renderToDOM(metadataHtml);
      
      const metadata = container.querySelector('.word-metadata');
      expect(metadata).toBeTruthy();
      
      const metadataText = getTextContent(metadata);
      expect(metadataText).toContain('0 repetitions');
      expect(metadataText).not.toContain('correct');
      expect(metadataText).not.toContain('days ago');
    });

    it('should return empty string when no metadata provided', () => {
      const word = createTestWord({ id: 'empty' });
      const progress = {};
      
      const metadataHtml = createWordMetadata(word, progress);
      
      expect(metadataHtml.trim()).toBe('');
    });
  });

  describe('Metadata Formatting', () => {
    it('should format dates correctly', () => {
      const word = createTestWord({ id: 'date_test' });
      const progress = {
        repetitions: 1,
        addedDate: new Date('2024-06-15'),
        lastSeen: new Date('2024-06-20').getTime()
      };
      
      const metadataHtml = createWordMetadata(word, progress);
      const container = renderToDOM(metadataHtml);
      
      const metadataText = getTextContent(container);
      expect(metadataText).toContain('Added 15/06/2024'); // European format
    });

    it('should handle different time intervals for lastSeen', () => {
      const word = createTestWord({ id: 'time_test' });
      
      // Test recent time (same day)
      const recentProgress = {
        repetitions: 1,
        totalAttempts: 1,
        lastSeen: Date.now() - (1000 * 60 * 60 * 2) // 2 hours ago
      };
      
      const recentHtml = createWordMetadata(word, recentProgress);
      const recentContainer = renderToDOM(recentHtml);
      const recentText = getTextContent(recentContainer);
      
      // Real implementation shows "Today" for same-day activity
      expect(recentText).toContain('Today');
    });
  });
});
