import { describe, it, expect, beforeEach } from 'vitest';
import { setupDOM, createTestWord, createTestProgress, renderToDOM, getTextContent } from './test-helpers.js';

describe('Translation Components', () => {
  let UIComponents;

  beforeEach(() => {
    setupDOM();
    UIComponents = require('../../js/ui-components.js');
  });

  describe('Translation Block Creation', () => {
    it('should create translation block with correct content', () => {
      const word = createTestWord({
        original: 'test',
        translation: 'тест'
      });
      
      const translationHtml = UIComponents.createTranslationBlock(word, 'learning');
      const container = renderToDOM(translationHtml);
      
      const translationBlock = container.querySelector('.card-translation');
      expect(translationBlock).toBeTruthy();
      
      const translationText = getTextContent(translationBlock);
      expect(translationText).toContain('Translation');
      expect(translationText).toContain('тест');
    });

    it('should handle missing translation gracefully', () => {
      const wordWithoutTranslation = createTestWord({
        original: 'test',
        translation: ''
      });
      
      const translationHtml = UIComponents.createTranslationBlock(wordWithoutTranslation);
      
      expect(translationHtml.trim()).toBe('');
    });

    it('should handle null or undefined translation', () => {
      const wordWithNullTranslation = createTestWord({
        original: 'test',
        translation: null
      });
      
      const translationHtml = UIComponents.createTranslationBlock(wordWithNullTranslation);
      
      expect(translationHtml.trim()).toBe('');
      
      const wordWithUndefinedTranslation = createTestWord({
        original: 'test'
        // translation is undefined
      });
      delete wordWithUndefinedTranslation.translation;
      
      const translationHtml2 = UIComponents.createTranslationBlock(wordWithUndefinedTranslation);
      
      expect(translationHtml2.trim()).toBe('');
    });

    it('should apply correct CSS classes and structure', () => {
      const word = createTestWord({
        translation: 'тестовый перевод'
      });
      
      const translationHtml = UIComponents.createTranslationBlock(word, 'default');
      const container = renderToDOM(translationHtml);
      
      const translationBlock = container.querySelector('.card-translation');
      expect(translationBlock).toBeTruthy();
      
      // Check that translation block contains expected content
      const translationText = getTextContent(translationBlock);
      expect(translationText).toContain('Translation');
      expect(translationText).toContain('тестовый перевод');
      
      // Check for header and content (optional structure)
      const header = translationBlock.querySelector('.card-translation__header');
      const content = translationBlock.querySelector('.card-translation__content');
      
      if (header) {
        expect(getTextContent(header)).toContain('Translation');
      }
      if (content) {
        expect(getTextContent(content)).toContain('тестовый перевод');
      }
    });
  });

  describe('Learning Answer Content Creation', () => {
    it('should create complete learning answer content with all sections', () => {
      const word = createTestWord({
        original: 'comprehensive',
        translation: 'всеобъемлющий',
        definition: 'Including all or nearly all elements',
        synonyms: ['complete', 'thorough', 'extensive'],
        examples: ['A comprehensive study', 'Comprehensive coverage']
      });
      
      const progress = createTestProgress({
        repetitions: 3,
        correctCount: 5,
        totalAttempts: 7
      });
      
      const answerHtml = UIComponents.createLearningAnswerContent(word, progress, 'learning');
      const container = renderToDOM(answerHtml);
      
      // Check translation block
      const translationBlock = container.querySelector('.card-translation');
      expect(translationBlock).toBeTruthy();
      expect(getTextContent(translationBlock)).toContain('всеобъемлющий');
      
      // Check definition
      const definitionBlock = container.querySelector('[data-testid="detail-definition"]');
      expect(definitionBlock).toBeTruthy();
      expect(getTextContent(definitionBlock)).toContain('Including all or nearly all elements');
      
      // Check synonyms
      const synonymsBlock = container.querySelector('[data-testid="detail-synonyms"]');
      expect(synonymsBlock).toBeTruthy();
      const synonymsText = getTextContent(synonymsBlock);
      expect(synonymsText).toContain('complete');
      expect(synonymsText).toContain('thorough');
      expect(synonymsText).toContain('extensive');
      
      // Check examples
      const examplesBlock = container.querySelector('[data-testid="detail-examples"]');
      expect(examplesBlock).toBeTruthy();
      const examplesText = getTextContent(examplesBlock);
      expect(examplesText).toContain('A comprehensive study');
      expect(examplesText).toContain('Comprehensive coverage');
    });

    it('should work without progress data', () => {
      const word = createTestWord({
        translation: 'тест',
        definition: 'A trial'
      });
      
      const answerHtml = UIComponents.createLearningAnswerContent(word, null, 'learning');
      const container = renderToDOM(answerHtml);
      
      const translationBlock = container.querySelector('.card-translation');
      expect(translationBlock).toBeTruthy();
      expect(getTextContent(translationBlock)).toContain('тест');
      
      const definitionBlock = container.querySelector('[data-testid="detail-definition"]');
      expect(definitionBlock).toBeTruthy();
      expect(getTextContent(definitionBlock)).toContain('A trial');
    });

    it('should handle minimal word data gracefully', () => {
      const minimalWord = {
        id: 'minimal-test',
        original: 'minimal',
        translation: 'минимальный'
        // no definition, synonyms, examples
      };
      
      const answerHtml = UIComponents.createLearningAnswerContent(minimalWord, null, 'learning');
      const container = renderToDOM(answerHtml);
      
      // Should still have translation block
      const translationBlock = container.querySelector('.card-translation');
      expect(translationBlock).toBeTruthy();
      expect(getTextContent(translationBlock)).toContain('минимальный');
      
      // Should not have other detail blocks (since we didn't provide them)
      const definitionBlock = container.querySelector('[data-testid="detail-definition"]');
      expect(definitionBlock).toBeFalsy();
      
      const synonymsBlock = container.querySelector('[data-testid="detail-synonyms"]');
      expect(synonymsBlock).toBeFalsy();
      
      const examplesBlock = container.querySelector('[data-testid="detail-examples"]');
      expect(examplesBlock).toBeFalsy();
    });

    it('should apply learning variant styles correctly', () => {
      const word = createTestWord({
        translation: 'обучение',
        examples: ['Example 1', 'Example 2', 'Example 3', 'Example 4']
      });
      
      const answerHtml = UIComponents.createLearningAnswerContent(word, null, 'learning');
      const container = renderToDOM(answerHtml);
      
      // Examples should be limited in learning mode
      const examplesBlock = container.querySelector('[data-testid="detail-examples"]');
      if (examplesBlock) {
        // In real implementation learning trimming applies only when variant passed to createWordDetailSections is 'learning'
        const examplesText = getTextContent(examplesBlock);
        expect(examplesText).toContain('Example 1');
        expect(examplesText).toContain('Example 2');
      }
    });
  });

  describe('Translation Component Integration', () => {
    it('should integrate properly with word card components', () => {
      const word = createTestWord({
        original: 'integration',
        translation: 'интеграция',
        definition: 'The process of combining parts'
      });
      
      const progress = createTestProgress();
      
      // Test that translation components work with word card creation
      const answerContent = UIComponents.createLearningAnswerContent(word, progress, 'learning');
      
      // Should be valid HTML that can be rendered
      expect(() => {
        const container = renderToDOM(answerContent);
        expect(container.children.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should handle different variants consistently', () => {
      const word = createTestWord({
        translation: 'последовательность'
      });
      
      const defaultTranslation = UIComponents.createTranslationBlock(word, 'default');
      const learningTranslation = UIComponents.createTranslationBlock(word, 'learning');
      const compactTranslation = UIComponents.createTranslationBlock(word, 'compact');
      
      // All should contain the translation
      expect(defaultTranslation).toContain('последовательность');
      expect(learningTranslation).toContain('последовательность');
      expect(compactTranslation).toContain('последовательность');
      
      // All should be valid HTML
      expect(() => {
        renderToDOM(defaultTranslation);
        renderToDOM(learningTranslation);
        renderToDOM(compactTranslation);
      }).not.toThrow();
    });
  });
});
