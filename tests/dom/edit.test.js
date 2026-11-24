import { describe, it, expect, beforeEach, vi } from 'vitest';
const path = require('path');

describe('Edit flow (DOM)', () => {
  beforeEach(() => {
    // Basic form DOM structure similar to index.html
    document.body.innerHTML = `
      <div class="tab-nav" data-testid="tab-nav">
        <button class="tab-btn" data-action="show-tab" data-arg="today" data-testid="today-tab-btn"></button>
        <button class="tab-btn" data-action="show-tab" data-arg="list" data-testid="list-tab-btn"></button>
        <button class="tab-btn active" data-action="show-tab" data-arg="add" data-testid="add-tab-btn"></button>
        <button class="tab-btn" data-action="show-tab" data-arg="stats" data-testid="stats-tab-btn"></button>
      </div>
      <div id="add-tab" class="tab-content active"></div>
      <div id="list-tab" class="tab-content"></div>
      <input id="originalWord" />
      <input id="translation" />
      <textarea id="wordDefinition"></textarea>
      <input id="wordPhonetic" />
      <input id="wordSynonyms" />
      <textarea id="wordExamples"></textarea>
      <div class="container"></div>
    `;

    global.window = global;
    global.SV = global.SV || {};
    global.SV.DataManager = {
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
      save: vi.fn(),
    };

    // Load app-state and ensure SV.AppState
    require(path.join(__dirname, '../../js/app-state.js'));
    global.SV = global.SV || {};
    global.SV.AppState = global.SV.AppState || {};

    // Minimal UI helpers
    global.showMessage = vi.fn();

    // Load app-main
    global.AppMain = require(path.join(__dirname, '../../js/app-main.js'));
    // AppMain already on global
  });

  it('prefills form fields when editWord is called', () => {
    // Ensure fields are empty first
    document.getElementById('originalWord').value = '';
    document.getElementById('translation').value = '';

    // Call editWord
    global.AppMain.editWord('custom_1');

    expect(window.SV.AppState.editingWordId).toBe('custom_1');
    expect(document.getElementById('originalWord').value).toBe('editme');
    expect(document.getElementById('translation').value).toBe('редактируй');
    expect(document.getElementById('wordDefinition').value).toBe('to modify');
    expect(document.getElementById('wordPhonetic').value).toBe('/edɪt/');
    expect(document.getElementById('wordSynonyms').value).toBe('change, modify');
    expect(document.getElementById('wordExamples').value).toContain('Please edit the text.');
  });

  it('updates existing word on addWord when in edit mode', () => {
    // Enter edit mode
    global.AppMain.editWord('custom_1');

    // Change values
    document.getElementById('translation').value = 'исправлять';
    document.getElementById('wordDefinition').value = 'to correct';

    // Save
    return (async () => {
      await global.AppMain.addWord();
      const updated = window.SV.DataManager.vocabulary.find(w => w.id === 'custom_1');
      expect(updated.translation).toBe('исправлять');
      expect(updated.definition).toBe('to correct');
      expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.now() - 60000);
      expect(window.SV.AppState.editingWordId).toBe(null);
      expect(window.SV.DataManager.save).toHaveBeenCalled();
    })();
  });
});


