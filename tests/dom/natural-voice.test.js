import { describe, it, expect, beforeEach, vi } from 'vitest';

const { encodeWav, orderClipQueue, voiceStatusText, createNaturalVoice } = require('../../js/natural-voice.js');
const { createSpeechManager } = require('../../js/speech-manager.js');

const BASE_URL = 'https://app.test/smart-vocabulary/';
const CLIP_PREFIX = `${BASE_URL}voice-clips/onnx-community%2FKokoro-82M-v1.0-ONNX/q8/af_heart/`;
const clipUrl = (text) => CLIP_PREFIX + encodeURIComponent(text);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function createFakeCaches() {
  const stores = new Map();
  const urlOf = (key) => (typeof key === 'string' ? key : key.url);
  const open = vi.fn(async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      keys: async () => [...entries.keys()].map(url => ({ url })),
      match: async (key) => (entries.has(urlOf(key)) ? new globalThis.Response(entries.get(urlOf(key))) : undefined),
      put: async (key, response) => { entries.set(urlOf(key), await response.arrayBuffer()); },
      delete: async (key) => entries.delete(urlOf(key))
    };
  });
  return { open, entries: (name) => stores.get(name) ?? new Map(), seed: (name, url) => {
    if (!stores.has(name)) stores.set(name, new Map());
    stores.get(name).set(url, new ArrayBuffer(4));
  } };
}

// A worker that loads on load() and answers each text on answer(); everything it got is in messages
function createFakeWorker() {
  const worker = {
    messages: [],
    terminated: false,
    postMessage(message) { worker.messages.push(message); },
    terminate() { worker.terminated = true; },
    spoken: () => worker.messages.filter(m => m.type === 'speak').map(m => m.text),
    load: () => worker.onmessage({ data: { type: 'ready' } }),
    fail: (message) => worker.onmessage({ data: { type: 'failed', message } }),
    answer: (text) => worker.onmessage({ data: { type: 'clip', text, samples: new Float32Array([0, 0.5, -1]), sampleRate: 24000 } })
  };
  return worker;
}

function createFakeAudioContext() {
  const context = {
    state: 'suspended',
    destination: {},
    sources: [],
    resume: vi.fn(async () => { context.state = 'running'; }),
    decodeAudioData: vi.fn(async (data) => ({ bytes: data.byteLength })),
    createBufferSource: () => {
      const source = { connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      context.sources.push(source);
      return source;
    }
  };
  return context;
}

const word = (original, extra = {}) => ({ original, createdAt: '2026-11-01T00:00:00Z', nextReview: null, ...extra });

describe('orderClipQueue', () => {
  const words = [
    word('review later', { nextReview: '2026-12-10T00:00:00Z' }),
    word('new older', { createdAt: '2026-10-01T00:00:00Z' }),
    word('review soon', { nextReview: '2026-11-27T00:00:00Z' }),
    word('new newer', { createdAt: '2026-11-20T00:00:00Z' }),
    word('in session'),
    word('just added', { createdAt: '2026-11-25T00:00:00Z' })
  ];

  it('puts asked-for texts first, then the session, the word just added, new words oldest first and the nearest reviews', () => {
    expect(orderClipQueue({ words, requested: ['review later'], session: ['in session'], added: 'just added' })).toEqual([
      'review later', 'in session', 'just added', 'new older', 'new newer', 'review soon'
    ]);
  });

  it('lists each text once and keeps an asked-for text that is not in the vocabulary', () => {
    const order = orderClipQueue({ words, requested: ['typed in the form'], session: ['new older', 'gone from vocabulary'], added: 'new older' });

    expect(order[0]).toBe('typed in the form');
    expect(order[1]).toBe('new older');
    expect(order).not.toContain('gone from vocabulary');
    expect(order).toHaveLength(words.length + 1);
    expect(new Set(order).size).toBe(order.length);
  });
});

describe('voiceStatusText', () => {
  it('says downloading, ready with counts, or unavailable when nothing can play', () => {
    expect(voiceStatusText({ downloading: true, unavailable: false, clips: 0, words: 5 })).toBe('Natural voice: downloading…');
    expect(voiceStatusText({ downloading: false, unavailable: false, clips: 2, words: 5 })).toBe('Natural voice: ready, 2 of 5 words');
    expect(voiceStatusText({ downloading: false, unavailable: true, clips: 0, words: 5 })).toBe('Natural voice: unavailable');
  });

  it('stays ready when the model is unavailable but stored clips still play', () => {
    expect(voiceStatusText({ downloading: false, unavailable: true, clips: 3, words: 5 })).toBe('Natural voice: ready, 3 of 5 words');
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM WAV header and clamps samples', () => {
    const view = new DataView(encodeWav(new Float32Array([0, 0.5, -1, 2]), 24000));
    const text = (offset, length) => String.fromCharCode(...new Uint8Array(view.buffer, offset, length));

    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 8)).toBe('WAVEfmt ');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getUint32(4, true)).toBe(view.byteLength - 8);
    expect([0, 1, 2, 3].map(i => view.getInt16(44 + i * 2, true))).toEqual([0, 16383, -32767, 32767]);
  });
});

describe('Natural voice', () => {
  let caches;
  let workers;
  let audio;
  let words;
  let session;
  let soundOn;
  let statuses;

  const makeVoice = (overrides = {}) => createNaturalVoice({
    caches,
    createWorker: vi.fn(() => {
      const worker = createFakeWorker();
      workers.push(worker);
      return worker;
    }),
    createAudioContext: () => audio,
    document: null,
    baseUrl: BASE_URL,
    getWords: () => words,
    getSessionTexts: () => session,
    isSoundEnabled: () => soundOn,
    isOnline: () => true,
    onStatus: (text) => statuses.push(text),
    log: () => undefined,
    ...overrides
  });

  beforeEach(() => {
    caches = createFakeCaches();
    workers = [];
    audio = createFakeAudioContext();
    words = [word('alpha', { createdAt: '2026-11-01T00:00:00Z' }), word('beta', { createdAt: '2026-11-02T00:00:00Z' })];
    session = [];
    soundOn = true;
    statuses = [];
  });

  it('makes missing clips one at a time, stores them as WAV and releases the model when done', async () => {
    const voice = makeVoice();
    const started = voice.start();
    await flush();
    const worker = workers[0];
    expect(worker.messages[0]).toMatchObject({ type: 'load', model: 'onnx-community/Kokoro-82M-v1.0-ONNX', dtype: 'q8', device: 'wasm', voice: 'af_heart' });
    expect(voice.getStatusText()).toBe('Natural voice: downloading…');

    worker.load();
    await flush();
    expect(worker.spoken()).toEqual(['alpha']);
    worker.answer('alpha');
    await flush();
    expect(worker.spoken()).toEqual(['alpha', 'beta']);
    worker.answer('beta');
    await started;

    const stored = caches.entries('voice-clips');
    expect([...stored.keys()]).toEqual([clipUrl('alpha'), clipUrl('beta')]);
    expect(String.fromCharCode(...new Uint8Array(stored.get(clipUrl('alpha')), 0, 4))).toBe('RIFF');
    expect(worker.terminated).toBe(true);
    expect(statuses.at(-1)).toBe('Natural voice: ready, 2 of 2 words');
  });

  it('does not load the model when every word already has a clip, and deletes clips of words gone from the vocabulary', async () => {
    caches.seed('voice-clips', clipUrl('alpha'));
    caches.seed('voice-clips', clipUrl('beta'));
    caches.seed('voice-clips', clipUrl('deleted word'));
    caches.seed('voice-clips', `${BASE_URL}voice-clips/other-model/q8/af_bella/${encodeURIComponent('alpha')}`);

    const voice = makeVoice();
    await voice.start();

    expect(workers).toHaveLength(0);
    expect([...caches.entries('voice-clips').keys()]).toEqual([clipUrl('alpha'), clipUrl('beta')]);
    expect(voice.getStatusText()).toBe('Natural voice: ready, 2 of 2 words');
  });

  it('keeps every clip when the vocabulary failed to load', async () => {
    caches.seed('voice-clips', clipUrl('alpha'));
    words = null;

    await makeVoice().start();

    expect([...caches.entries('voice-clips').keys()]).toEqual([clipUrl('alpha')]);
    expect(workers).toHaveLength(0);
  });

  it('does not download the model while sound is off', async () => {
    soundOn = false;
    const voice = makeVoice();
    await voice.start();

    expect(workers).toHaveLength(0);
    expect(voice.isAvailable()).toBe(false);
    expect(voice.getStatusText()).toBe('Natural voice: unavailable');
  });

  it('becomes unavailable for this launch when the model fails to load', async () => {
    const voice = makeVoice();
    const started = voice.start();
    await flush();
    workers[0].fail('network error');
    await started;

    expect(workers[0].terminated).toBe(true);
    expect(voice.isAvailable()).toBe(false);
    expect(voice.getStatusText()).toBe('Natural voice: unavailable');
  });

  it('goes on with the next text when one text cannot be said', async () => {
    const voice = makeVoice();
    const started = voice.start();
    await flush();
    workers[0].load();
    await flush();
    workers[0].onmessage({ data: { type: 'error', text: 'alpha', message: 'phonemizer failed' } });
    await flush();
    workers[0].answer('beta');
    await started;

    expect([...caches.entries('voice-clips').keys()]).toEqual([clipUrl('beta')]);
    expect(voice.isAvailable()).toBe(true);
  });

  it('starts the current session words before the rest', async () => {
    words.push(word('gamma', { createdAt: '2026-11-03T00:00:00Z' }));
    session = ['gamma'];
    const voice = makeVoice();
    voice.start();
    await flush();
    workers[0].load();
    await flush();

    expect(workers[0].spoken()).toEqual(['gamma']);
  });
});

describe('speakWord with the natural voice', () => {
  let caches;
  let workers;
  let audio;
  let speech;
  let words;

  const makeVoice = (overrides = {}) => createNaturalVoice({
    caches,
    createWorker: () => {
      const worker = createFakeWorker();
      workers.push(worker);
      return worker;
    },
    createAudioContext: () => audio,
    document: null,
    baseUrl: BASE_URL,
    getWords: () => words,
    getSessionTexts: () => [],
    isSoundEnabled: () => true,
    isOnline: () => true,
    log: () => undefined,
    ...overrides
  });
  const makeManager = (naturalVoice) => createSpeechManager({
    storage: null,
    speech,
    createUtterance: (text) => ({ text }),
    naturalVoice,
    log: () => undefined,
    setTimeout: () => undefined
  });
  const addButton = () => {
    document.body.insertAdjacentHTML('beforeend', '<button data-action="speak-word"><svg data-icon="speaker"></svg></button>');
    return document.body.lastElementChild;
  };

  beforeEach(() => {
    caches = createFakeCaches();
    workers = [];
    audio = createFakeAudioContext();
    speech = { speaking: false, pending: false, cancel: vi.fn(), speak: vi.fn() };
    words = [word('alpha'), word('beta', { createdAt: '2026-11-05T00:00:00Z' })];
  });

  it('plays a stored clip through Web Audio and does not call speechSynthesis', async () => {
    caches.seed('voice-clips', clipUrl('alpha'));
    caches.seed('voice-clips', clipUrl('beta'));
    const voice = makeVoice();
    await voice.start();

    makeManager(voice).speakWord('alpha', addButton());
    await flush();

    expect(audio.resume).toHaveBeenCalled();
    expect(audio.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(audio.sources).toHaveLength(1);
    expect(audio.sources[0].connect).toHaveBeenCalledWith(audio.destination);
    expect(audio.sources[0].start).toHaveBeenCalledTimes(1);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('puts a missing clip first in the queue, spins the button, ignores repeated taps, then plays the clip', async () => {
    const voice = makeVoice();
    const manager = makeManager(voice);
    const button = addButton();
    const idleHtml = button.innerHTML;
    voice.start();
    await flush();

    manager.speakWord('beta', button);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.spinner')).toBeTruthy();
    manager.speakWord('beta', button);
    manager.speakWord('beta', button);

    workers[0].load();
    await flush();
    expect(workers[0].spoken()).toEqual(['beta']);
    workers[0].answer('beta');
    await flush();
    await flush();

    expect(audio.sources).toHaveLength(1);
    expect(audio.sources[0].start).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(button.innerHTML).toBe(idleHtml);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('does not play a clip that is ready after a newer speakWord call', async () => {
    caches.seed('voice-clips', clipUrl('alpha'));
    const voice = makeVoice();
    const manager = makeManager(voice);
    const button = addButton();
    voice.start();
    await flush();

    manager.speakWord('beta', button);
    manager.speakWord('alpha', addButton());
    await flush();
    expect(audio.sources).toHaveLength(1);

    workers[0].load();
    await flush();
    workers[0].answer('beta');
    await flush();
    await flush();

    expect(audio.sources).toHaveLength(1);
    expect(button.getAttribute('aria-busy')).toBe('false');
  });

  it('does not play a clip whose button left the screen', async () => {
    const voice = makeVoice();
    const button = addButton();
    voice.start();
    await flush();

    makeManager(voice).speakWord('beta', button);
    button.remove();
    workers[0].load();
    await flush();
    workers[0].answer('beta');
    await flush();
    await flush();

    expect(audio.sources).toHaveLength(0);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('uses speechSynthesis when the natural voice is unavailable', async () => {
    const voice = makeVoice({ createWorker: null });
    await voice.start();

    makeManager(voice).speakWord('alpha', addButton());

    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak.mock.calls[0][0].text).toBe('alpha');
  });

  it('falls back to speechSynthesis and stops for this launch when the model load times out', async () => {
    const voice = makeVoice({ loadTimeoutMs: 5 });
    const button = addButton();
    const started = voice.start();
    await flush();

    makeManager(voice).speakWord('beta', button);
    await started;
    await flush();

    expect(workers[0].terminated).toBe(true);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak.mock.calls[0][0].text).toBe('beta');
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(voice.isAvailable()).toBe(false);
    expect(voice.getStatusText()).toBe('Natural voice: unavailable');
  });

  it('falls back to speechSynthesis and stops for this launch when one clip times out', async () => {
    const voice = makeVoice({ clipTimeoutMs: 5 });
    const button = addButton();
    const started = voice.start();
    await flush();

    makeManager(voice).speakWord('beta', button);
    workers[0].load();
    await started;
    await flush();

    expect(workers[0].spoken()).toEqual(['beta']);
    expect(workers[0].terminated).toBe(true);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(voice.isAvailable()).toBe(false);
    expect(voice.getStatusText()).toBe('Natural voice: unavailable');
  });

  it('says the word with speechSynthesis when a stored clip fails to play, and drops the clip to make it again', async () => {
    caches.seed('voice-clips', clipUrl('alpha'));
    caches.seed('voice-clips', clipUrl('beta'));
    audio.decodeAudioData.mockRejectedValueOnce(new Error('EncodingError'));
    const voice = makeVoice();
    await voice.start();

    makeManager(voice).speakWord('alpha', addButton());
    await flush();

    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak.mock.calls[0][0].text).toBe('alpha');
    expect(voice.hasClip('alpha')).toBe(false);
    expect(voice.getStatusText()).toBe('Natural voice: ready, 1 of 2 words');
  });

  it('falls back to speechSynthesis when the model fails while the button spins', async () => {
    const voice = makeVoice();
    const button = addButton();
    voice.start();
    await flush();

    makeManager(voice).speakWord('beta', button);
    workers[0].fail('out of memory');
    await flush();
    await flush();

    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(voice.isAvailable()).toBe(false);
  });
});
