import { describe, it, expect, beforeEach, vi } from 'vitest';

const AppMain = require('../../js/app-main.js');

describe('AppMain.showTab', () => {
  beforeEach(() => {
    global.window = global;
    document.body.innerHTML = `
      <button class="tab-btn" data-testid="learn-tab-btn"></button>
      <button class="tab-btn" data-testid="stats-tab-btn"></button>
      <div class="tab-content" id="learn-tab"></div>
      <div class="tab-content" id="stats-tab"></div>
    `;
    window.SV = {
      LearningSession: { prepareLearningSession: vi.fn() },
      Statistics: { updateStats: vi.fn() }
    };
  });

  it('prepares the learning session when opening the learn tab', () => {
    AppMain.showTab('learn');

    expect(window.SV.LearningSession.prepareLearningSession).toHaveBeenCalledTimes(1);
    expect(window.SV.Statistics.updateStats).not.toHaveBeenCalled();
    expect(document.getElementById('learn-tab').classList.contains('active')).toBe(true);
  });

  it('refreshes statistics when opening the stats tab', () => {
    AppMain.showTab('stats');

    expect(window.SV.Statistics.updateStats).toHaveBeenCalledTimes(1);
    expect(window.SV.LearningSession.prepareLearningSession).not.toHaveBeenCalled();
    expect(document.getElementById('stats-tab').classList.contains('active')).toBe(true);
  });

  it('does not throw when the modules are not attached', () => {
    window.SV = {};
    expect(() => AppMain.showTab('learn')).not.toThrow();
    expect(() => AppMain.showTab('stats')).not.toThrow();
  });
});
