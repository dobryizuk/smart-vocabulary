import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SpeechManager', () => {
  let createSpeechManager;
  let speechMock;
  let storageMock;

  beforeEach(() => {
    // jsdom base
    global.window = global;
    global.document = window.document;
    document.body.innerHTML = `
      <button id="speechToggle"></button>
      <button id="autoPlayToggle"></button>
    `;

    // speech synthesis mock
    speechMock = {
      speaking: false,
      pending: false,
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    storageMock = {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };

     
    const mod = require('../../js/speech-manager.js');
    createSpeechManager = mod.createSpeechManager;
  });

  it('toggles speech enabled and updates UI + persists', () => {
    const mgr = createSpeechManager({
      document,
      storage: storageMock,
      speech: speechMock,
      createUtterance: (t) => ({ text: t })
    });
    // default enabled = true, toggle -> false
    const state = mgr.toggleSpeech();
    expect(state).toBe(false);
    expect(document.getElementById('speechToggle').textContent).toMatch(/Off/);
    expect(storageMock.setItem).toHaveBeenCalled();
  });

  it('toggles autoPlay and updates UI + persists', () => {
    const mgr = createSpeechManager({ document, storage: storageMock, speech: speechMock });
    const state = mgr.toggleAutoPlay();
    expect(state).toBe(false);
    expect(document.getElementById('autoPlayToggle').textContent).toMatch(/Off/);
    expect(storageMock.setItem).toHaveBeenCalled();
  });

  it('initializeSpeech disables when speech missing', () => {
    const mgr = createSpeechManager({ document, storage: storageMock, speech: null });
    const ok = mgr.initializeSpeech();
    expect(ok).toBe(false);
    expect(mgr.speechSettings.enabled).toBe(false);
  });
});



describe('SpeechManager speakWord and settings (iOS compatibility)', () => {
  let createSpeechManager;
  let speechMock;
  let saved;
  let storageMock;
  const createUtterance = (text) => ({ text });

  beforeEach(() => {
    speechMock = { speaking: false, pending: false, cancel: vi.fn(), speak: vi.fn() };
    saved = {};
    storageMock = {
      getItem: vi.fn((key) => (key in saved ? saved[key] : null)),
      setItem: vi.fn((key, value) => { saved[key] = value; })
    };
    createSpeechManager = require('../../js/speech-manager.js').createSpeechManager;
  });

  const makeManager = () => createSpeechManager({ storage: storageMock, speech: speechMock, createUtterance });

  it('speaks synchronously with en-US language and no explicit voice', () => {
    const mgr = makeManager();
    mgr.initializeSpeech();
    mgr.speakWord('devolve');

    expect(speechMock.speak).toHaveBeenCalledTimes(1);
    const utterance = speechMock.speak.mock.calls[0][0];
    expect(utterance.text).toBe('devolve');
    expect(utterance.lang).toBe('en-US');
    expect(utterance).not.toHaveProperty('voice');
    expect(speechMock.cancel).not.toHaveBeenCalled();
  });

  it('cancels ongoing speech before speaking a new word', () => {
    speechMock.speaking = true;
    const mgr = makeManager();
    mgr.speakWord('forthright');

    expect(speechMock.cancel).toHaveBeenCalledTimes(1);
    expect(speechMock.speak).toHaveBeenCalledTimes(1);
  });

  it('does not speak when disabled or text is empty', () => {
    const mgr = makeManager();
    mgr.speakWord('');
    mgr.toggleSpeech();
    mgr.speakWord('word');

    expect(speechMock.speak).not.toHaveBeenCalled();
  });

  it('restores saved settings and ignores a legacy serialized voice', () => {
    saved.speechSettings = JSON.stringify({ enabled: true, autoPlay: false, rate: 1.1, voice: {} });
    const mgr = makeManager();
    mgr.initializeSpeech();

    expect(mgr.speechSettings.autoPlay).toBe(false);
    expect(mgr.speechSettings.rate).toBe(1.1);
    expect(mgr.speechSettings).not.toHaveProperty('voice');
    mgr.speakWord('understatement');
    expect(speechMock.speak.mock.calls[0][0]).not.toHaveProperty('voice');
  });

  it('keeps defaults when saved settings are corrupted', () => {
    saved.speechSettings = '{not json';
    const mgr = makeManager();

    expect(mgr.initializeSpeech()).toBe(true);
    expect(mgr.speechSettings.enabled).toBe(true);
    expect(mgr.speechSettings.autoPlay).toBe(true);
  });

  it('stays disabled when speech is unsupported even if saved as enabled', () => {
    saved.speechSettings = JSON.stringify({ enabled: true });
    const mgr = createSpeechManager({ storage: storageMock, speech: null, createUtterance });

    expect(mgr.initializeSpeech()).toBe(false);
    expect(mgr.speechSettings.enabled).toBe(false);
  });

  it('does not throw when speak fails', () => {
    speechMock.speak.mockImplementation(() => { throw new Error('boom'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const mgr = makeManager();

    expect(() => mgr.speakWord('word')).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('SpeechManager diagnostics logging', () => {
  let createSpeechManager;
  let speechMock;
  let log;
  let timers;

  beforeEach(() => {
    speechMock = {
      speaking: false, pending: false, paused: false,
      cancel: vi.fn(), speak: vi.fn(),
      getVoices: vi.fn(() => [
        { name: 'Samantha', lang: 'en-US', localService: true, default: true },
        { name: 'Milena', lang: 'ru-RU', localService: true, default: false }
      ])
    };
    log = vi.fn();
    timers = [];
    createSpeechManager = require('../../js/speech-manager.js').createSpeechManager;
  });

  const makeManager = () => createSpeechManager({
    storage: null,
    speech: speechMock,
    createUtterance: (text) => ({ text }),
    log,
    setTimeout: (fn) => timers.push(fn)
  });
  const messages = () => log.mock.calls.map(c => c[0]);

  it('logs why speech was skipped when sound is off', () => {
    const mgr = makeManager();
    mgr.speechSettings.enabled = false;
    mgr.speakWord('devolve');

    expect(messages()).toContain('🔇 Speak skipped, sound is off:');
    expect(speechMock.speak).not.toHaveBeenCalled();
  });

  it('logs english voices once and the engine state for each speak', () => {
    const mgr = makeManager();
    mgr.speakWord('one');
    mgr.speakWord('two');

    const voiceLogs = log.mock.calls.filter(c => c[0] === '🔊 Voices available:');
    expect(voiceLogs).toEqual([['🔊 Voices available:', 2, 'english:', ['Samantha (en-US, local, default)']]]);
    expect(messages().filter(m => m === '🔊 Speak requested:')).toHaveLength(2);
  });

  it('warns when the engine never starts speaking', () => {
    const mgr = makeManager();
    mgr.speakWord('silent');
    timers.forEach(fn => fn());

    expect(log).toHaveBeenCalledWith('⚠️ Speech did not start within', 2000, 'ms:', 'silent', { speaking: false, pending: false, paused: false });
  });

  it('logs start and end events and no warning when speech plays', () => {
    const mgr = makeManager();
    mgr.speakWord('audible');
    const utterance = speechMock.speak.mock.calls[0][0];
    utterance.onstart();
    utterance.onend();
    timers.forEach(fn => fn());

    expect(messages()).toEqual(expect.arrayContaining(['🔊 Speech started:', '🔊 Speech ended:']));
    expect(messages()).not.toContain('⚠️ Speech did not start within');
  });
});

describe('SpeechManager audio session (iOS Silent mode)', () => {
  let createSpeechManager;
  const speech = { speak: vi.fn(), cancel: vi.fn() };

  beforeEach(() => {
    createSpeechManager = require('../../js/speech-manager.js').createSpeechManager;
  });

  it('switches the audio session to playback so Silent mode does not mute speech', () => {
    const audioSession = { type: 'auto' };
    const log = vi.fn();
    createSpeechManager({ storage: null, speech, audioSession, log }).initializeSpeech();

    expect(audioSession.type).toBe('playback');
    expect(log).toHaveBeenCalledWith('🔈 Audio session type:', 'playback');
  });

  it('logs and keeps speech enabled when the Audio Session API is missing', () => {
    const log = vi.fn();
    const mgr = createSpeechManager({ storage: null, speech, audioSession: null, log });

    expect(mgr.initializeSpeech()).toBe(true);
    expect(mgr.speechSettings.enabled).toBe(true);
    expect(log).toHaveBeenCalledWith('🔈 Audio Session API unavailable, Silent mode may mute speech');
  });

  it('does not break initialization when setting the session type throws', () => {
    const audioSession = { set type(_value) { throw new Error('NotAllowedError'); } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mgr = createSpeechManager({ storage: null, speech, audioSession, log: vi.fn() });

    expect(mgr.initializeSpeech()).toBe(true);
    expect(warn).toHaveBeenCalledWith('⚠️ Failed to set audio session type:', expect.any(Error));
    warn.mockRestore();
  });

  it('does not touch the audio session when speech is unsupported', () => {
    const audioSession = { type: 'auto' };
    createSpeechManager({ storage: null, speech: null, audioSession }).initializeSpeech();

    expect(audioSession.type).toBe('auto');
  });
});
