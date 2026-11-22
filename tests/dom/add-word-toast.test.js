import { describe, it, expect, beforeEach, vi } from 'vitest';

function mountAddTab() {
  document.body.innerHTML = `
    <div class="container">
      <div class="tab-content active" id="add-tab">
        <div class="form-group">
          <label for="originalWord">Original Word/Phrase:</label>
          <input type="text" class="form-control" id="originalWord" data-testid="original-word-input">
          <div id="formButtons"></div>
        </div>
        <div id="additionalFields" style="display: block;">
          <div class="form-group">
            <label for="translation">Translation:</label>
            <input type="text" class="form-control" id="translation">
          </div>
          <div class="form-group">
            <label for="wordDefinition">Definition:</label>
            <textarea class="form-control" id="wordDefinition" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label for="wordPhonetic">Phonetic:</label>
            <input type="text" class="form-control" id="wordPhonetic">
          </div>
          <div class="form-group">
            <label for="wordSynonyms">Synonyms:</label>
            <input type="text" class="form-control" id="wordSynonyms">
          </div>
          <div class="form-group">
            <label for="wordExamples">Examples:</label>
            <textarea class="form-control" id="wordExamples" rows="2"></textarea>
          </div>
          <div id="saveButtons"></div>
        </div>
      </div>
    </div>`;
}

describe('Add word flow - success toast', () => {
  beforeEach(() => {
    mountAddTab();
    global.window = global;
    // DataManager minimal impl to avoid storage errors
    window.SV = window.SV || {};
    window.SV.DataManager = {
      vocabulary: [],
      saveUserProgress: vi.fn(),
      saveAllVocabulary: vi.fn()
    };
    require('../../js/app-state.js');
    require('../../js/ui-components.js');
    require('../../js/app-main.js');
    require('../../js/app-init.js');
    window.initializeComponents();
    window.wireEventHandlers();
  });

  it('shows success message after clicking Save', () => {
    // Fill required fields
    document.getElementById('originalWord').value = 'hello';
    document.getElementById('translation').value = 'привет';

    const saveBtn = document.querySelector('[data-testid="save-word-btn"]');
    expect(saveBtn).toBeTruthy();
    saveBtn.click();

    const message = document.querySelector('.app-message');
    expect(message).toBeTruthy();
    expect(message.textContent).toContain('Word added successfully');
  });
});


