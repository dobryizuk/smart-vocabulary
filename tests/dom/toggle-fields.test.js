import { describe, it, expect, beforeEach } from 'vitest';

// Minimal DOM similar to index.html for add tab
function mountAddTab() {
  document.body.innerHTML = `
    <div class="container">
      <div class="tab-content active" id="add-tab">
        <div class="form-group">
          <label for="originalWord">Original Word/Phrase:</label>
          <input type="text" class="form-control" id="originalWord" data-testid="original-word-input">
          <div id="formButtons"></div>
        </div>
        <div id="additionalFields" style="display: none;">
          <div class="form-group">
            <label for="translation">Translation:</label>
            <input type="text" class="form-control" id="translation">
          </div>
          <div id="saveButtons"></div>
        </div>
      </div>
    </div>`;
}

describe('Bootstrap wiring - toggle additional fields', () => {
  beforeEach(() => {
    // Setup DOM and globals
    mountAddTab();
    global.window = global;
    // Load state + ui + main + init to build buttons and handlers
    require('../../js/app-state.js');
    require('../../js/ui-components.js');
    require('../../js/app-main.js');
    require('../../js/app-init.js');
    // Initialize components and wire events
    window.initializeComponents();
    window.wireEventHandlers();
  });

  it('shows additionalFields after clicking toggle button', () => {
    const toggleBtn = document.querySelector('[data-testid="toggle-fields-btn"]') || document.getElementById('toggleFieldsBtn');
    expect(toggleBtn).toBeTruthy();
    // safety: was hidden initially
    const additional = document.getElementById('additionalFields');
    expect(additional.style.display === 'none' || additional.style.display === '').toBe(true);
    toggleBtn.click();
    // should be visible after click due to bootstrap wiring
    expect(additional.style.display).toBe('block');
    // translation input exists and is reachable
    const translation = document.getElementById('translation');
    expect(translation).toBeTruthy();
  });
});


