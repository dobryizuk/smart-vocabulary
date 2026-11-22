import { describe, it, expect, beforeEach, vi } from 'vitest';

function memoryStorage() {
  const data = {};
  return {
    data,
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => { data[key] = String(value); })
  };
}

describe('LogRecorder', () => {
  let storage;
  let createLogRecorder;
  const now = () => new Date('2026-11-22T10:00:00.000Z');

  beforeEach(() => {
    storage = memoryStorage();
    createLogRecorder = require('../../js/log-recorder.js').createLogRecorder;
  });

  it('records nothing while disabled', () => {
    const recorder = createLogRecorder({ storage, now });
    recorder.record('debug', ['hidden']);

    expect(recorder.enabled).toBe(false);
    expect(recorder.entries).toEqual([]);
  });

  it('starts a fresh log when enabled and keeps it across reloads', () => {
    storage.data.logRecordingEntries = JSON.stringify([{ time: 't', level: 'debug', message: 'old session' }]);
    const recorder = createLogRecorder({ storage, now });

    recorder.toggle();
    recorder.record('debug', ['speak', { lang: 'en-US' }]);

    const reloaded = createLogRecorder({ storage, now });
    expect(reloaded.enabled).toBe(true);
    expect(reloaded.entries.map(e => e.message)).toEqual(['Logging started', 'speak {"lang":"en-US"}']);
  });

  it('keeps recorded entries after logging is turned off', () => {
    const recorder = createLogRecorder({ storage, now });
    recorder.setEnabled(true);
    recorder.record('debug', ['captured']);
    recorder.setEnabled(false);
    recorder.record('debug', ['ignored']);

    expect(recorder.entries.map(e => e.message)).toEqual(['Logging started', 'captured']);
  });

  it('caps the log at maxEntries, dropping the oldest', () => {
    const recorder = createLogRecorder({ storage, now, maxEntries: 3 });
    recorder.setEnabled(true);
    ['a', 'b', 'c', 'd'].forEach(m => recorder.record('debug', [m]));

    expect(recorder.entries.map(e => e.message)).toEqual(['b', 'c', 'd']);
  });

  it('formats errors and survives circular objects', () => {
    const recorder = createLogRecorder({ storage, now });
    recorder.setEnabled(true);
    const circular = {};
    circular.self = circular;
    recorder.record('error', [new TypeError('bad voice'), circular]);

    expect(recorder.entries[1].message).toBe('TypeError: bad voice [object Object]');
  });

  it('ignores corrupted stored entries', () => {
    storage.data.logRecordingEnabled = 'true';
    storage.data.logRecordingEntries = '{broken';

    expect(createLogRecorder({ storage, now }).entries).toEqual([]);
  });

  it('works when storage access throws (Safari private mode)', () => {
    const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); } };
    const recorder = createLogRecorder({ storage: blocked, now });

    expect(recorder.enabled).toBe(false);
    expect(recorder.setEnabled(true)).toBe(true);
    recorder.record('debug', ['kept in memory']);
    expect(recorder.entries.map(e => e.message)).toContain('kept in memory');
  });

  it('does not throw when storage is full', () => {
    const recorder = createLogRecorder({ storage, now });
    recorder.setEnabled(true);
    storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });

    expect(() => recorder.record('debug', ['x'])).not.toThrow();
    expect(recorder.entries.length).toBeGreaterThan(0);
  });

  it('renders environment header and entries as text', () => {
    const recorder = createLogRecorder({ storage, now });
    recorder.setEnabled(true);
    recorder.record('warn', ['careful']);

    const text = recorder.toText({ userAgent: 'iPhone', standalone: true });
    expect(text).toBe([
      'userAgent: iPhone',
      'standalone: true',
      '',
      '2026-11-22T10:00:00.000Z [info] Logging started',
      '2026-11-22T10:00:00.000Z [warn] careful'
    ].join('\n'));
  });

  it('install mirrors console errors and uncaught errors into the log', () => {
    const originalError = vi.fn();
    const listeners = {};
    const target = {
      console: { warn: vi.fn(), error: originalError },
      addEventListener: (type, fn) => { listeners[type] = fn; }
    };
    const recorder = createLogRecorder({ storage, now });
    recorder.install(target);
    recorder.setEnabled(true);

    target.console.error('❌ Speech error:', 'not-allowed');
    listeners.error({ message: 'boom', filename: 'app.js', lineno: 7 });
    listeners.unhandledrejection({ reason: new Error('rejected') });

    expect(originalError).toHaveBeenCalledWith('❌ Speech error:', 'not-allowed');
    expect(recorder.entries.slice(1).map(e => `${e.level} ${e.message}`)).toEqual([
      'error ❌ Speech error: not-allowed',
      'error Uncaught: boom app.js:7',
      'error Unhandled rejection: Error: rejected'
    ]);
  });
});
