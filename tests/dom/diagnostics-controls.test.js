import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Settings page diagnostics controls', () => {
  let anchorClick;

  beforeEach(() => {
    document.body.innerHTML = '<div class="container"><div id="dataManagement"></div></div>';
    global.window = global;
    window.SV = window.SV || {};
    require('../../js/app-state.js');
    require('../../js/ui-components.js');
    require('../../js/app-main.js');
    require('../../js/app-init.js');
    window.SV.LogRecorder.setEnabled(false);
    window.initializeComponents();
    window.wireEventHandlers();
    URL.createObjectURL = vi.fn(() => 'blob:logs');
    URL.revokeObjectURL = vi.fn();
    anchorClick = vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    anchorClick.mockRestore();
  });

  it('renders the logging toggle and save button', () => {
    expect(document.querySelector('[data-testid="log-toggle-btn"]').textContent).toBe('📝 Logging Off');
    expect(document.querySelector('[data-testid="save-logs-btn"]')).toBeTruthy();
  });

  it('toggles logging on and off from the button', () => {
    const toggle = document.querySelector('[data-testid="log-toggle-btn"]');
    toggle.click();
    expect(window.SV.LogRecorder.enabled).toBe(true);
    expect(toggle.textContent).toBe('📝 Logging On');

    toggle.click();
    expect(window.SV.LogRecorder.enabled).toBe(false);
    expect(toggle.textContent).toBe('📝 Logging Off');
  });

  it('saves recorded logs as a text file with environment info', async () => {
    document.querySelector('[data-testid="log-toggle-btn"]').click();
    window.SV.debugLog('🔊 Speak requested:', 'devolve');
    document.querySelector('[data-testid="save-logs-btn"]').click();

    expect(anchorClick).toHaveBeenCalledTimes(1);
    const anchor = anchorClick.mock.instances[0];
    expect(anchor.download).toMatch(/^vocabulary-logs-.*\.txt$/);
    const blob = URL.createObjectURL.mock.calls[0][0];
    const text = await new Promise((resolve) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
    expect(text).toContain('userAgent:');
    expect(text).toContain('[debug] 🔊 Speak requested: devolve');
  });

  it('shows a message instead of an empty file when nothing was recorded', () => {
    const { createLogRecorder } = require('../../js/log-recorder.js');
    window.SV.LogRecorder = createLogRecorder({ storage: null });
    document.querySelector('[data-testid="save-logs-btn"]').click();

    expect(anchorClick).not.toHaveBeenCalled();
    expect(document.querySelector('.app-message').textContent).toContain('No logs yet');
  });
});
