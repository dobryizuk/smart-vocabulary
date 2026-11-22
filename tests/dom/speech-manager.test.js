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
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mgr = makeManager();

    expect(() => mgr.speakWord('word')).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
