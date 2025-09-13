import { describe, it, expect, beforeEach, vi } from 'vitest';
const path = require('path');

describe('Edit flow (DOM)', () => {
  beforeEach(() => {
    // Basic form DOM structure similar to index.html
    document.body.innerHTML = `
      <div class="tab-nav" data-testid="tab-nav">
        <button class="tab-btn active" onclick="showTab('add')" data-testid="add-tab-btn"></button>
        <button class="tab-btn" onclick="showTab('list')" data-testid="list-tab-btn"></button>
        <button class="tab-btn" onclick="showTab('learn')" data-testid="learn-tab-btn"></button>
        <button class="tab-btn" onclick="showTab('stats')" data-testid="stats-tab-btn"></button>
      </div>
      <div id="add-tab" class="tab-content active"></div>
      <div id="list-tab" class="tab-content"></div>
      <input id="originalWord" />
      <div id="additionalFields" style="display:none;"></div>
      <button id="toggleFieldsBtn"></button>
      <input id="translation" />
      <textarea id="wordDefinition"></textarea>
      <input id="wordPhonetic" />
      <input id="wordSynonyms" />
      <textarea id="wordExamples"></textarea>
      <div class="container"></div>
    `;

    global.window = global;
    global.DataManager = {
      vocabulary: [
        {
          id: 'custom_1',
          original: 'editme',
          translation: 'редактируй',
          definition: 'to modify',
          phonetic: '/edɪt/',
          synonyms: ['change', 'modify'],
          examples: ['Please edit the text.'],
          createdAt: new Date().toISOString(),
          repetition: 0,
          easeFactor: 1.3,
        }
      ],
      saveUserProgress: vi.fn(),
      saveAllVocabulary: vi.fn(),
    };

    // Load app-state (CommonJS export also sets globals)
    require(path.join(__dirname, '../../js/app-state.js'));

    // Minimal UI helpers
    global.showMessage = vi.fn();

    // Load app-main
    require(path.join(__dirname, '../../js/app-main.js'));
  });

  it('prefills form fields when editWord is called', () => {
    // Ensure fields are empty first
    document.getElementById('originalWord').value = '';
    document.getElementById('translation').value = '';

    // Call editWord
    window.editWord('custom_1');

    expect(window.AppState.editingWordId).toBe('custom_1');
    expect(document.getElementById('originalWord').value).toBe('editme');
    expect(document.getElementById('translation').value).toBe('редактируй');
    expect(document.getElementById('wordDefinition').value).toBe('to modify');
    expect(document.getElementById('wordPhonetic').value).toBe('/edɪt/');
    expect(document.getElementById('wordSynonyms').value).toBe('change, modify');
    expect(document.getElementById('wordExamples').value).toContain('Please edit the text.');
  });

  it('updates existing word on addWord when in edit mode', () => {
    // Enter edit mode
    window.editWord('custom_1');

    // Change values
    document.getElementById('translation').value = 'исправлять';
    document.getElementById('wordDefinition').value = 'to correct';

    // Save
    return (async () => {
      await window.addWord();
      const updated = window.DataManager.vocabulary.find(w => w.id === 'custom_1');
      expect(updated.translation).toBe('исправлять');
      expect(updated.definition).toBe('to correct');
      expect(window.AppState.editingWordId).toBe(null);
      expect(window.DataManager.saveAllVocabulary).toHaveBeenCalled();
    })();
  });
});


