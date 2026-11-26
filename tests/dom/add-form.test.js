import { describe, it, expect, beforeEach, vi } from 'vitest';

function mountApp() {
  document.body.innerHTML = `
    <div class="container">
      <div class="tab-content active" id="add-tab">
        <div class="field-with-action">
          <input type="text" id="originalWord" data-testid="original-word-input">
          <button type="button" data-action="clear-form" data-testid="clear-form-btn" hidden></button>
        </div>
        <div id="formButtons"></div>
        <div class="field-with-action">
          <input type="text" id="wordPhonetic">
          <button type="button" data-action="speak-original-word" data-testid="speak-original-btn" hidden></button>
        </div>
        <textarea id="wordDefinition"></textarea>
        <input type="text" id="translation">
        <input type="text" id="wordSynonyms">
        <textarea id="wordExamples"></textarea>
        <div id="saveButtons"></div>
      </div>
      <div class="tab-content" id="list-tab">
        <span id="wordCount"></span>
        <div id="wordFilters"></div>
        <div id="wordList"></div>
      </div>
    </div>
    <button class="tab-btn active" data-testid="add-tab-btn"></button>
    <button class="tab-btn" data-testid="list-tab-btn"></button>`;
}

const savedWord = (id, createdAt) => ({
  id,
  original: id,
  translation: `${id}-tr`,
  createdAt,
  updatedAt: createdAt,
  nextReview: null,
  reviewHistory: []
});

const fields = {
  originalWord: 'beautiful',
  wordPhonetic: '/ˈbjuːtɪfʊl/',
  wordDefinition: 'Pleasing to look at',
  translation: 'красивый',
  wordSynonyms: 'lovely',
  wordExamples: 'A beautiful day'
};

const fillFields = (values) => {
  Object.entries(values).forEach(([id, value]) => {
    const field = document.getElementById(id);
    field.value = value;
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};

const byTestId = (testId) => document.querySelector(`[data-testid="${testId}"]`);
const rowOrder = () => [...document.querySelectorAll('#wordList .word-card__original')].map(row => row.firstChild.textContent.trim());

describe('Add form', () => {
  beforeEach(() => {
    mountApp();
    global.window = global;
    require('../../js/app-state.js');
    require('../../js/ui-components.js');
    require('../../js/app-main.js');
    require('../../js/app-init.js');
    window.initializeComponents();
    window.wireEventHandlers();
    window.SV.AppState.editingWordId = null;
    window.SV.AppState.wordListFilter = 'difficult';
    window.SV.DataManager = {
      vocabulary: [
        savedWord('older', '2026-01-01T00:00:00.000Z'),
        savedWord('oldest', '2025-06-01T00:00:00.000Z')
      ],
      save: vi.fn(() => true)
    };
    window.SV.SpeechManager = { speakWord: vi.fn() };
  });

  describe('clear button', () => {
    it('shows while any field has content and hides when all are empty', () => {
      const clearButton = byTestId('clear-form-btn');
      expect(clearButton.hidden).toBe(true);

      fillFields({ wordExamples: 'only an example' });
      expect(clearButton.hidden).toBe(false);

      fillFields({ wordExamples: '' });
      expect(clearButton.hidden).toBe(true);
    });

    it('empties every field, hides itself, leaves edit mode and focuses the word field', () => {
      fillFields(fields);
      window.SV.AppState.editingWordId = 'older';

      byTestId('clear-form-btn').click();

      Object.keys(fields).forEach(id => expect(document.getElementById(id).value).toBe(''));
      expect(byTestId('clear-form-btn').hidden).toBe(true);
      expect(byTestId('speak-original-btn').hidden).toBe(true);
      expect(window.SV.AppState.editingWordId).toBe(null);
      expect(document.activeElement).toBe(document.getElementById('originalWord'));
    });

    it('leaves only the Save button below the fields', () => {
      expect(document.querySelectorAll('#saveButtons button')).toHaveLength(1);
      expect(byTestId('toggle-fields-btn')).toBeNull();
    });
  });

  describe('phonetic speaker', () => {
    it('is hidden while the word field is empty, whatever the other fields hold', () => {
      fillFields({ wordPhonetic: '/x/' });
      expect(byTestId('speak-original-btn').hidden).toBe(true);

      fillFields({ originalWord: 'beautiful' });
      expect(byTestId('speak-original-btn').hidden).toBe(false);
    });

    it('pronounces the word of the word field, the speaker button showing the wait', () => {
      fillFields({ originalWord: ' break the ice ' });

      byTestId('speak-original-btn').click();

      expect(window.SV.SpeechManager.speakWord).toHaveBeenCalledWith('break the ice', byTestId('speak-original-btn'));
    });
  });

  describe('Save', () => {
    it('clears the form and opens Words on All with the new word first and highlighted', () => {
      fillFields(fields);

      byTestId('save-word-btn').click();

      Object.keys(fields).forEach(id => expect(document.getElementById(id).value).toBe(''));
      expect(document.querySelector('.app-message').textContent).toContain('Word added successfully');
      expect(document.getElementById('list-tab').classList.contains('active')).toBe(true);
      expect(document.getElementById('add-tab').classList.contains('active')).toBe(false);
      expect(window.SV.AppState.wordListFilter).toBe('all');
      expect(document.querySelector('[data-testid="word-group-due"]')).toBeTruthy();
      expect(rowOrder()).toEqual(['beautiful', 'older', 'oldest']);

      const highlighted = document.querySelectorAll('.word-card--new');
      expect(highlighted).toHaveLength(1);
      expect(highlighted[0].textContent).toContain('beautiful');
    });

    it('scrolls Words to the top', () => {
      document.getElementById('list-tab').scrollTop = 300;
      fillFields(fields);

      byTestId('save-word-btn').click();

      expect(document.getElementById('list-tab').scrollTop).toBe(0);
    });

    it('drops the highlight once its animation ends', () => {
      fillFields(fields);
      byTestId('save-word-btn').click();
      const card = document.querySelector('.word-card--new');

      card.dispatchEvent(new window.Event('animationend'));

      expect(card.classList.contains('word-card--new')).toBe(false);
    });

    it('stays on Add and keeps the form for a duplicate', () => {
      fillFields({ ...fields, originalWord: 'Older' });

      byTestId('save-word-btn').click();

      expect(document.querySelector('.app-message').textContent).toContain('already exists');
      expect(document.getElementById('add-tab').classList.contains('active')).toBe(true);
      expect(document.getElementById('originalWord').value).toBe('Older');
      expect(window.SV.DataManager.vocabulary).toHaveLength(2);
    });

    it('stays on Add, keeps the form and forgets the word when saving fails', () => {
      window.SV.DataManager.save = vi.fn(() => false);
      fillFields(fields);

      byTestId('save-word-btn').click();

      expect(document.getElementById('add-tab').classList.contains('active')).toBe(true);
      expect(document.getElementById('originalWord').value).toBe('beautiful');
      expect(document.querySelector('.app-message')?.textContent ?? '').not.toContain('Word added successfully');
      expect(window.SV.DataManager.vocabulary).toHaveLength(2);
    });
  });

  describe('Lookup', () => {
    const lookupButton = () => byTestId('dictionary-lookup-btn');
    let finishLookup;
    let failLookup;
    const rememberSettlers = (resolve, reject) => {
      finishLookup = resolve;
      failLookup = reject;
    };

    beforeEach(() => {
      window.SV.DictionaryService = { lookupWithTranslation: vi.fn(() => new Promise(rememberSettlers)) };
      fillFields({ originalWord: 'beautiful' });
    });

    it('shows a spinner, blocks a second lookup and locks the fields while pending', () => {
      lookupButton().click();
      lookupButton().click();

      expect(window.SV.DictionaryService.lookupWithTranslation).toHaveBeenCalledTimes(1);
      expect(lookupButton().disabled).toBe(true);
      expect(lookupButton().textContent).toBe('Looking up…');
      expect(lookupButton().querySelector('.spinner')).toBeTruthy();
      Object.keys(fields).forEach(id => expect(document.getElementById(id).readOnly).toBe(true));
      expect(byTestId('save-word-btn').disabled).toBe(true);
      expect(byTestId('clear-form-btn').disabled).toBe(true);
    });

    it('fills the fields and restores the button on success', async () => {
      lookupButton().click();
      finishLookup({ translation: 'красивый', definition: 'Pleasing', phonetic: '/b/', synonyms: ['lovely', 'pretty'], examples: ['A beautiful day', { text: 'Beautiful music' }] });
      await vi.waitFor(() => expect(lookupButton().disabled).toBe(false));

      expect(lookupButton().textContent).toBe('Lookup');
      expect(lookupButton().querySelector('.spinner')).toBeNull();
      expect(document.getElementById('translation').value).toBe('красивый');
      expect(document.getElementById('wordSynonyms').value).toBe('lovely, pretty');
      expect(document.getElementById('wordExamples').value).toBe('A beautiful day\nBeautiful music');
      expect(document.getElementById('originalWord').readOnly).toBe(false);
      expect(byTestId('save-word-btn').disabled).toBe(false);
      expect(byTestId('speak-original-btn').hidden).toBe(false);
    });

    it('restores the button and the fields on error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      lookupButton().click();
      failLookup(new Error('offline'));
      await vi.waitFor(() => expect(lookupButton().disabled).toBe(false));

      expect(lookupButton().textContent).toBe('Lookup');
      expect(document.getElementById('translation').readOnly).toBe(false);
      expect(document.getElementById('originalWord').value).toBe('beautiful');
      expect(document.querySelector('.app-message').textContent).toContain('offline');
    });
  });
});
