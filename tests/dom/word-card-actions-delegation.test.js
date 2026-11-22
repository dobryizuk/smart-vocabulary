import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupDOM, createTestWord, renderToDOM } from './test-helpers.js';

describe('Word Card Action Delegation', () => {
  let UI;

  beforeEach(() => {
    setupDOM();
    UI = require('../../js/ui-components.js');
    // minimal app-init delegation mimic: attach handler similar to app-init.js
    document.body.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.getAttribute('data-action');
      const arg = el.getAttribute('data-arg');
      if (el.hasAttribute('data-stop-prop')) e.stopPropagation();
      switch (action) {
        case 'edit-word':
          global.SV = global.SV || {}; global.SV.AppMain = global.SV.AppMain || {}; global.SV.AppMain.editWord?.(arg);
          break;
        case 'delete-word':
          global.SV = global.SV || {}; global.SV.AppMain = global.SV.AppMain || {}; global.SV.AppMain.deleteWord?.(arg);
          break;
        case 'speak-word':
          global.SV = global.SV || {}; global.SV.SpeechManager = global.SV.SpeechManager || {}; global.SV.SpeechManager.speakWord?.(arg);
          break;
        default:
          break;
      }
    });
  });

  it('should call editWord with id when edit button is clicked', () => {
    const word = createTestWord({ id: 'abc123' });
    const actions = [
      { type: 'warning', icon: '✏️', action: 'edit-word', arg: word.id, title: 'Edit word' }
    ];

    const html = UI.createWordCard(word, 'compact', actions, false, true);
    const container = renderToDOM(html);

    const spy = vi.fn();
    global.SV = global.SV || {}; global.SV.AppMain = global.SV.AppMain || {}; global.SV.AppMain.editWord = spy;

    const btn = container.querySelector('.action-btn--warning');
    btn.click();

    expect(spy).toHaveBeenCalledWith('abc123');
  });

  it('should call deleteWord with id when delete button is clicked', () => {
    const word = createTestWord({ id: 'del1' });
    const actions = [
      { type: 'danger', icon: '🗑️', action: 'delete-word', arg: word.id, title: 'Delete word' }
    ];

    const html = UI.createWordCard(word, 'compact', actions, false, true);
    const container = renderToDOM(html);

    const spy = vi.fn();
    global.SV = global.SV || {}; global.SV.AppMain = global.SV.AppMain || {}; global.SV.AppMain.deleteWord = spy;

    const btn = container.querySelector('.action-btn--danger');
    btn.click();

    expect(spy).toHaveBeenCalledWith('del1');
  });

  it('should call speakWord with original when speak button is clicked', () => {
    const word = createTestWord({ original: 'alpha' });
    const actions = [
      { type: 'primary', icon: '🔊', action: 'speak-word', arg: word.original, title: 'Pronounce' }
    ];

    const html = UI.createWordCard(word, 'compact', actions, false, true);
    const container = renderToDOM(html);

    const spy = vi.fn();
    global.SV = global.SV || {}; global.SV.SpeechManager = global.SV.SpeechManager || {}; global.SV.SpeechManager.speakWord = spy;

    const btn = container.querySelector('.action-btn--primary');
    btn.click();

    expect(spy).toHaveBeenCalledWith('alpha');
  });
});
