import { describe, it, expect, beforeEach, vi } from 'vitest';

const AppMain = require('../../js/app-main.js');

describe('AppMain.showTab', () => {
  beforeEach(() => {
    global.window = global;
    document.body.innerHTML = `
      <button class="tab-btn" data-testid="today-tab-btn"></button>
      <button class="tab-btn" data-testid="stats-tab-btn"></button>
      <div class="tab-content" id="today-tab"></div>
      <div class="tab-content" id="stats-tab">
        <div id="progressView" hidden></div>
        <div id="settingsView"></div>
      </div>
    `;
    window.SV = {
      LearningSession: { prepareLearningSession: vi.fn() },
      Statistics: { updateStats: vi.fn() }
    };
  });

  it('prepares the learning session when opening the Today tab', () => {
    AppMain.showTab('today');

    expect(window.SV.LearningSession.prepareLearningSession).toHaveBeenCalledTimes(1);
    expect(window.SV.Statistics.updateStats).not.toHaveBeenCalled();
    expect(document.getElementById('today-tab').classList.contains('active')).toBe(true);
  });

  it('refreshes statistics when opening the stats tab', () => {
    AppMain.showTab('stats');

    expect(window.SV.Statistics.updateStats).toHaveBeenCalledTimes(1);
    expect(window.SV.LearningSession.prepareLearningSession).not.toHaveBeenCalled();
    expect(document.getElementById('stats-tab').classList.contains('active')).toBe(true);
  });

  it('opens the stats tab on Progress even when Settings was left open', () => {
    AppMain.showStatsView('settings');

    AppMain.showTab('stats');

    expect(document.getElementById('progressView').hidden).toBe(false);
    expect(document.getElementById('settingsView').hidden).toBe(true);
  });

  it('switches between the Progress and Settings views', () => {
    AppMain.showStatsView('settings');
    expect(document.getElementById('progressView').hidden).toBe(true);
    expect(document.getElementById('settingsView').hidden).toBe(false);

    AppMain.showStatsView('progress');
    expect(document.getElementById('progressView').hidden).toBe(false);
    expect(document.getElementById('settingsView').hidden).toBe(true);
  });

  it('opens Words with the chosen filter', () => {
    document.body.innerHTML += '<div class="tab-content" id="list-tab"></div><div id="wordList"></div><span id="wordCount"></span><div id="wordFilters"></div>';
    window.SV.AppState = { wordListFilter: 'all' };

    AppMain.showWords('difficult');

    expect(window.SV.AppState.wordListFilter).toBe('difficult');
    expect(document.getElementById('list-tab').classList.contains('active')).toBe(true);
  });

  it('does not throw when the modules are not attached', () => {
    window.SV = {};
    expect(() => AppMain.showTab('today')).not.toThrow();
    expect(() => AppMain.showTab('stats')).not.toThrow();
  });
});
