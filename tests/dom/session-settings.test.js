import { describe, it, expect } from 'vitest';

const { createSessionSettings, stepSessionSize, SESSION_SIZE_KEY } = require('../../js/session-settings.js');

function settingsWith(value) {
  const data = value === undefined ? {} : { [SESSION_SIZE_KEY]: value };
  const storage = {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, val) => { data[key] = String(val); }
  };
  return { storage, ...createSessionSettings({ storage }) };
}

describe('Session size setting', () => {
  it('defaults to 15 when nothing is stored', () => {
    expect(settingsWith().getSessionSize()).toBe(15);
  });

  it('returns a stored value inside the range', () => {
    expect(settingsWith('12').getSessionSize()).toBe(12);
  });

  it('clamps values below 10 and above 20', () => {
    expect(settingsWith('3').getSessionSize()).toBe(10);
    expect(settingsWith('99').getSessionSize()).toBe(20);
  });

  it('falls back to 15 for invalid values', () => {
    expect(settingsWith('abc').getSessionSize()).toBe(15);
    expect(settingsWith('').getSessionSize()).toBe(15);
    expect(settingsWith('NaN').getSessionSize()).toBe(15);
  });

  it('persists the written value as a number string', () => {
    const s = settingsWith();
    s.setSessionSize(18);
    expect(s.storage.data[SESSION_SIZE_KEY]).toBe('18');
    expect(s.getSessionSize()).toBe(18);
  });

  it('clamps written values and ignores invalid ones', () => {
    const s = settingsWith();
    s.setSessionSize(50);
    expect(s.getSessionSize()).toBe(20);
    s.setSessionSize('oops');
    expect(s.getSessionSize()).toBe(20);
  });

  it('works without storage', () => {
    const s = createSessionSettings({ storage: null });
    s.setSessionSize(12);
    expect(s.getSessionSize()).toBe(15);
  });
});

describe('Session size stepper', () => {
  it('moves by the step inside the range', () => {
    expect(stepSessionSize(15, 1)).toBe(16);
    expect(stepSessionSize(15, -1)).toBe(14);
  });

  it('stops at the limits', () => {
    expect(stepSessionSize(10, -1)).toBe(10);
    expect(stepSessionSize(20, 1)).toBe(20);
  });

  it('reaches the limits from the inside', () => {
    expect(stepSessionSize(11, -1)).toBe(10);
    expect(stepSessionSize(19, 1)).toBe(20);
  });
});
