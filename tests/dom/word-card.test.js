import { describe, it, expect, beforeEach } from 'vitest';
import { setupDOM, createTestWord, renderToDOM, hasClass, getTextContent } from './test-helpers.js';

describe('Word Card Component', () => {
  let createWordCard;

  beforeEach(() => {
    setupDOM();
    const UI = require('../../js/ui-components.js');
    createWordCard = UI.createWordCard;
  });

  describe('Basic Word Card Creation', () => {
    it('should create a basic word card with required elements', () => {
      const word = createTestWord({
        original: 'hello',
        translation: 'привет',
        phonetic: '/həˈloʊ/',
        definition: 'A greeting'
      });
      
      const cardHtml = createWordCard(word, 'default', [], false);
      const container = renderToDOM(cardHtml);
      
      // Check structure exists
      const card = container.querySelector('.word-card');
      expect(card).toBeTruthy();
      
      // Check content is present
      expect(getTextContent(card)).toContain('hello');
      expect(getTextContent(card)).toContain('привет');
      expect(getTextContent(card)).toContain('/həˈloʊ/');
      expect(getTextContent(card)).toContain('A greeting');
    });

    it('should create compact variant correctly', () => {
      const word = createTestWord({
        original: 'test',
        translation: 'тест'
      });
      
      const actions = [
        { type: 'primary', icon: '🔊', onclick: 'speak()', title: 'Speak' }
      ];
      
      const cardHtml = createWordCard(word, 'compact', actions, true);
      const container = renderToDOM(cardHtml);
      
      const card = container.querySelector('.word-card');
      expect(hasClass(card, 'word-card--compact')).toBe(true);
      
      const actionBtn = container.querySelector('.action-btn--primary');
      expect(actionBtn).toBeTruthy();
      expect(getTextContent(actionBtn)).toContain('🔊');
      
      const progressComponent = container.querySelector('.progress-component');
      expect(progressComponent).toBeTruthy();
    });

    it('should create learning variant that hides translation', () => {
      const word = createTestWord({
        original: 'beautiful',
        translation: 'красивый'
      });
      
      const cardHtml = createWordCard(word, 'learning', [], false);
      const container = renderToDOM(cardHtml);
      
      const card = container.querySelector('.word-card');
      expect(hasClass(card, 'word-card--learning')).toBe(true);
      
      // Original should be visible
      expect(getTextContent(card)).toContain('beautiful');
      
      // Translation should be hidden in learning mode
      expect(getTextContent(card)).not.toContain('красивый');
    });
  });

  describe('Word Card Variants', () => {
    it('should handle missing optional fields gracefully', () => {
      const word = {
        id: 'test-minimal',
        original: 'word',
        translation: 'слово'
        // no phonetic, definition, etc.
      };
      
      const cardHtml = createWordCard(word, 'default', [], false);
      const container = renderToDOM(cardHtml);
      
      const card = container.querySelector('.word-card');
      expect(getTextContent(card)).toContain('word');
      expect(getTextContent(card)).toContain('слово');
      
      // Should not have phonetic content if phonetic is missing
      const phoneticElement = container.querySelector('.word-card__phonetic');
      if (phoneticElement) {
        expect(getTextContent(phoneticElement)).toBe('');
      }
    });

    it('should render action buttons with correct attributes', () => {
      const word = createTestWord();
      const actions = [
        { type: 'primary', icon: '🔊', action: 'test-action', title: 'Test Action' },
        { type: 'warning', icon: '✏️', action: 'edit-word', title: 'Edit' }
      ];
      
      const cardHtml = createWordCard(word, 'default', actions, false);
      const container = renderToDOM(cardHtml);
      
      const primaryBtn = container.querySelector('.action-btn--primary');
      expect(primaryBtn).toBeTruthy();
      expect(primaryBtn.getAttribute('data-action')).toBe('test-action');
      expect(primaryBtn.getAttribute('title')).toBe('Test Action');
      expect(getTextContent(primaryBtn)).toContain('🔊');
      
      const warningBtn = container.querySelector('.action-btn--warning');
      expect(warningBtn).toBeTruthy();
      expect(warningBtn.getAttribute('data-action')).toBe('edit-word');
      expect(warningBtn.getAttribute('title')).toBe('Edit');
      expect(getTextContent(warningBtn)).toContain('✏️');
    });
  });

  describe('Expandable Word Cards', () => {
    it('should create expandable card with metadata when requested', () => {
      const word = createTestWord({
        original: 'expandable',
        translation: 'раскрываемый',
        repetition: 5,
        nextReview: '2099-12-31T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z'
      });
      
      const cardHtml = createWordCard(word, 'compact', [], true, true); // expandable = true
      const container = renderToDOM(cardHtml);
      
      const card = container.querySelector('.word-card');
      expect(hasClass(card, 'word-card--expandable')).toBe(true);
      
      // Check expandable content exists
      const expandableContent = container.querySelector('.word-card__expandable-content');
      expect(expandableContent).toBeTruthy();
      
      // Check metadata is present
      const metadata = container.querySelector('.word-metadata');
      expect(metadata).toBeTruthy();
      
      // Check specific metadata content
      const metadataText = getTextContent(metadata);
      expect(metadataText).toContain('5 repetitions');
      expect(metadataText).toContain('Added 01/01/2024');
      expect(metadataText).toContain('Next review: 31/12/2099');
    });

    it('renders metadata as plain gray chips without emoji', () => {
      const word = createTestWord({ repetition: 7, nextReview: '2025-10-31T00:00:00.000Z', createdAt: '2025-09-11T00:00:00.000Z' });
      const container = renderToDOM(createWordCard(word, 'compact', [], true, true));
      const chips = Array.from(container.querySelectorAll('.word-metadata span'));

      expect(chips.map(c => c.textContent)).toEqual(['Added 11/09/2025', '7 repetitions', 'Ready for review (31/10/2025)']);
      expect(chips.every(c => c.className === 'metadata-chip')).toBe(true);
    });

    it('should have toggle button for expandable cards', () => {
      const word = createTestWord({
        definition: 'Test definition',
        synonyms: ['test1', 'test2']
      });
      
      const cardHtml = createWordCard(word, 'compact', [], false, true); // expandable = true
      const container = renderToDOM(cardHtml);
      
      const toggleButton = container.querySelector('.word-card__toggle');
      expect(toggleButton).toBeTruthy();

      const card = container.querySelector('.word-card');
      expect(card.classList.contains('word-card--expanded')).toBe(false);
      const id = card.getAttribute('id');
      global.SV.UIComponents.toggleWordCard(id);
      expect(card.classList.contains('word-card--expanded')).toBe(true);
      global.SV.UIComponents.toggleWordCard(id);
      expect(card.classList.contains('word-card--expanded')).toBe(false);
    });
  });

  describe('Word Card Behavior', () => {
    it('should properly structure DOM hierarchy', () => {
      const word = createTestWord({
        original: 'structure',
        translation: 'структура',
        definition: 'Organization of parts'
      });
      
      const cardHtml = createWordCard(word, 'default', [], false);
      const container = renderToDOM(cardHtml);
      
      const card = container.querySelector('.word-card');
      expect(card).toBeTruthy();
      
      // Check that card contains the expected content
      const cardText = getTextContent(card);
      expect(cardText).toContain('structure');
      expect(cardText).toContain('структура');
      expect(cardText).toContain('Organization of parts');
      
      // Check for header and content elements (they should exist in our mock)
      const header = card.querySelector('.word-card__header');
      const content = card.querySelector('.word-card__content');
      
      if (header) {
        expect(getTextContent(header)).toContain('structure');
      }
      
      if (content) {
        expect(getTextContent(content)).toContain('структура');
      }
    });

    it('should handle empty word gracefully', () => {
      const emptyWord = createTestWord({
        original: '',
        translation: ''
      });
      
      const cardHtml = createWordCard(emptyWord, 'default', [], false);
      const container = renderToDOM(cardHtml);
      
      const card = container.querySelector('.word-card');
      expect(card).toBeTruthy(); // Should still create card structure
    });
  });
});
