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

  it('clamps values below 5 and above 15', () => {
    expect(settingsWith('3').getSessionSize()).toBe(5);
    expect(settingsWith('99').getSessionSize()).toBe(15);
  });

  it('allows 5 and raises 4 to 5', () => {
    expect(settingsWith('5').getSessionSize()).toBe(5);
    expect(settingsWith('4').getSessionSize()).toBe(5);
  });

  it('brings a size stored under the old 10 to 20 range down to 15', () => {
    expect(settingsWith('20').getSessionSize()).toBe(15);
    expect(settingsWith('16').getSessionSize()).toBe(15);
  });

  it('falls back to 15 for invalid values', () => {
    expect(settingsWith('abc').getSessionSize()).toBe(15);
    expect(settingsWith('').getSessionSize()).toBe(15);
    expect(settingsWith('NaN').getSessionSize()).toBe(15);
  });

  it('persists the written value as a number string', () => {
    const s = settingsWith();
    s.setSessionSize(12);
    expect(s.storage.data[SESSION_SIZE_KEY]).toBe('12');
    expect(s.getSessionSize()).toBe(12);
  });

  it('clamps written values and ignores invalid ones', () => {
    const s = settingsWith();
    s.setSessionSize(20);
    expect(s.storage.data[SESSION_SIZE_KEY]).toBe('15');
    s.setSessionSize(4);
    expect(s.getSessionSize()).toBe(5);
    s.setSessionSize('oops');
    expect(s.getSessionSize()).toBe(5);
  });

  it('works without storage', () => {
    const s = createSessionSettings({ storage: null });
    s.setSessionSize(12);
    expect(s.getSessionSize()).toBe(15);
  });
});

describe('Session size stepper', () => {
  it('moves by the step inside the range', () => {
    expect(stepSessionSize(10, 1)).toBe(11);
    expect(stepSessionSize(10, -1)).toBe(9);
  });

  it('stops at the limits', () => {
    expect(stepSessionSize(5, -1)).toBe(5);
    expect(stepSessionSize(15, 1)).toBe(15);
  });

  it('reaches the limits from the inside', () => {
    expect(stepSessionSize(6, -1)).toBe(5);
    expect(stepSessionSize(14, 1)).toBe(15);
  });
});

describe('Show definition setting', () => {
  const storageWith = (value) => ({
    data: value === undefined ? {} : { showDefinition: value },
    getItem(key) { return key in this.data ? this.data[key] : null; },
    setItem(key, val) { this.data[key] = String(val); }
  });

  it('is off until it is switched on', () => {
    expect(createSessionSettings({ storage: storageWith() }).getShowDefinition()).toBe(false);
  });

  it('keeps the chosen value in storage', () => {
    const storage = storageWith();
    const settings = createSessionSettings({ storage });

    settings.setShowDefinition(true);
    expect(storage.data.showDefinition).toBe('true');
    expect(createSessionSettings({ storage }).getShowDefinition()).toBe(true);

    settings.setShowDefinition(false);
    expect(createSessionSettings({ storage }).getShowDefinition()).toBe(false);
  });

  it('treats anything but true as off and works without storage', () => {
    expect(createSessionSettings({ storage: storageWith('yes') }).getShowDefinition()).toBe(false);
    const settings = createSessionSettings({ storage: null });
    settings.setShowDefinition(true);
    expect(settings.getShowDefinition()).toBe(false);
  });
});
