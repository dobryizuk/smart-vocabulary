import { describe, it, expect, beforeEach } from 'vitest';

describe('Settings view', () => {
  const byTestId = (testId) => document.querySelector(`[data-testid="${testId}"]`);
  const stored = {};

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="container">
        <div class="tab-content" id="stats-tab">
          <div id="progressView"></div>
          <div id="settingsView" hidden></div>
        </div>
      </div>`;
    global.window = global;
    window.SV = window.SV || {};
    Object.keys(stored).forEach(key => delete stored[key]);
    localStorage.getItem.mockImplementation(key => (key in stored ? stored[key] : null));
    localStorage.setItem.mockImplementation((key, value) => { stored[key] = String(value); });
    require('../../js/app-state.js');
    require('../../js/ui-components.js');
    require('../../js/app-main.js');
    require('../../js/app-init.js');
    window.SV.themeManager = { getCurrentTheme: () => 'dark', setTheme: vi.fn() };
    window.SV.SessionSettings.getSessionSize = () => Number(stored.sessionSize ?? 15);
    window.SV.VocabularyStore = { getSnapshotDate: () => null };
    window.initializeComponents();
    window.wireEventHandlers();
  });

  it('has the five sections', () => {
    const titles = [...document.querySelectorAll('.settings-section__title')].map(title => title.textContent);

    expect(titles).toEqual(['Learning', 'Appearance', 'Cloud backup', 'Data on this device', 'Diagnostics']);
  });

  it('keeps the ids and test ids of the data and diagnostics controls', () => {
    ['backup-btn', 'restore-btn', 'log-toggle-btn', 'save-logs-btn', 'speech-toggle', 'autoplay-toggle'].forEach(testId => {
      expect(byTestId(testId), testId).toBeTruthy();
    });
    expect(document.getElementById('speechToggle')).toBe(byTestId('speech-toggle'));
    expect(document.getElementById('autoPlayToggle')).toBe(byTestId('autoplay-toggle'));
    expect(document.getElementById('logToggle')).toBe(byTestId('log-toggle-btn'));
    expect(document.getElementById('cloudBackup')).toBeTruthy();
  });

  it('offers Undo restore only after a restore', () => {
    expect(byTestId('undo-restore-btn')).toBeNull();

    window.SV.VocabularyStore = { getSnapshotDate: () => '2026-11-20' };
    window.initializeComponents();

    expect(byTestId('undo-restore-btn').textContent).toContain('Undo last restore (2026-11-20)');
    expect(byTestId('undo-restore-btn').dataset.action).toBe('undo-restore');
  });

  it('shows the stored session size and steps it within 10 to 20', () => {
    stored.sessionSize = '19';
    window.initializeComponents();
    expect(byTestId('session-size-value').textContent).toBe('19');

    byTestId('session-size-inc').click();
    expect(byTestId('session-size-value').textContent).toBe('20');
    expect(stored.sessionSize).toBe('20');
    expect(byTestId('session-size-inc').disabled).toBe(true);

    byTestId('session-size-dec').click();
    expect(stored.sessionSize).toBe('19');
    expect(byTestId('session-size-inc').disabled).toBe(false);
  });

  it('shows the app version at the bottom', () => {
    const version = byTestId('app-version');

    expect(version.textContent).toMatch(/^Version \d+\.\d+\.\d+ · dev$/);
    expect(document.getElementById('settingsView').lastElementChild).toBe(version);
  });

  it('switches showing definitions on and off and keeps the choice', () => {
    const toggle = byTestId('show-definition-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    toggle.click();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(stored.showDefinition).toBe('true');

    window.initializeComponents();
    expect(byTestId('show-definition-toggle').getAttribute('aria-checked')).toBe('true');

    byTestId('show-definition-toggle').click();
    expect(stored.showDefinition).toBe('false');
  });

  it('disables the minus button at 10', () => {
    stored.sessionSize = '11';
    window.initializeComponents();

    byTestId('session-size-dec').click();

    expect(byTestId('session-size-value').textContent).toBe('10');
    expect(byTestId('session-size-dec').disabled).toBe(true);
  });

  it('marks the current theme and hands a chosen theme to the theme manager', () => {
    expect(byTestId('theme-dark').getAttribute('aria-pressed')).toBe('true');
    expect(byTestId('theme-light').getAttribute('aria-pressed')).toBe('false');

    byTestId('theme-light').click();

    expect(window.SV.themeManager.setTheme).toHaveBeenCalledWith('light');
  });

  it('opens Settings from Progress and goes back', () => {
    document.getElementById('progressView').innerHTML = '<button data-action="open-settings" data-testid="open-settings-btn"></button>';

    byTestId('open-settings-btn').click();
    expect(document.getElementById('settingsView').hidden).toBe(false);
    expect(document.getElementById('progressView').hidden).toBe(true);

    byTestId('settings-back-btn').click();
    expect(document.getElementById('settingsView').hidden).toBe(true);
    expect(document.getElementById('progressView').hidden).toBe(false);
  });
});
