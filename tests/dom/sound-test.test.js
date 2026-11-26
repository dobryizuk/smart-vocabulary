import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  SOUND_TESTS,
  soundTestBodyHtml,
  toneWavDataUri,
  firstPhoneticAudioUrl,
  createSoundTest
} = require('../../js/sound-test.js');

const DICTIONARY_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/hello';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) };
}

function fetchReturning(response) {
  return vi.fn(() => Promise.resolve(response));
}

function decodeWav(dataUri) {
  const [prefix, base64] = dataUri.split(',');
  const bytes = Uint8Array.from(window.atob(base64), char => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const ascii = (offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));
  const dataSize = view.getUint32(40, true);
  const samples = [];
  for (let offset = 44; offset < 44 + dataSize; offset += 2) samples.push(view.getInt16(offset, true));
  return {
    prefix,
    riff: ascii(0, 4),
    wave: ascii(8, 4),
    format: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    totalSize: bytes.length,
    samples
  };
}

describe('Sound test', () => {
  let audioSession;
  let speechManager;
  let synth;
  let audios;
  let playResult;
  let audioContext;
  let oscillator;
  let fetchFn;
  let timers;
  let soundTest;

  const status = (key) => document.querySelector(`[data-testid="sound-test-status-${key}"]`).textContent;

  const make = (overrides = {}) => createSoundTest({
    document,
    speechManager,
    speechSynthesis: synth,
    createUtterance: text => ({ text }),
    audioSession,
    createAudio: vi.fn(src => {
      const audio = { src, play: vi.fn(() => playResult()) };
      audios.push(audio);
      return audio;
    }),
    createAudioContext: () => audioContext,
    fetch: fetchFn,
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    ...overrides
  });

  const lastUtterance = () => synth.speak.mock.calls.at(-1)[0];

  beforeEach(() => {
    document.body.innerHTML = soundTestBodyHtml();
    audioSession = { type: 'playback' };
    speechManager = { speakWord: vi.fn(), speechSettings: { enabled: true } };
    synth = { speaking: false, pending: false, speak: vi.fn(), cancel: vi.fn() };
    audios = [];
    playResult = () => Promise.resolve();
    oscillator = { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    audioContext = {
      state: 'suspended',
      currentTime: 2,
      destination: { name: 'speakers' },
      resume: vi.fn(() => { audioContext.state = 'running'; return Promise.resolve(); }),
      createOscillator: vi.fn(() => oscillator),
      close: vi.fn()
    };
    fetchFn = fetchReturning(jsonResponse([{ phonetics: [{ text: '/həˈləʊ/' }, { audio: '' }, { audio: 'https://cdn.example/hello-uk.mp3' }] }]));
    timers = [];
    soundTest = make();
  });

  describe('section markup', () => {
    it('renders the note and one button with a status line per sound test', () => {
      const buttons = [...document.querySelectorAll('.settings-list .settings-action')];

      expect(document.querySelector('.settings-note').textContent).toBe('Temporary: turn on silent mode and tell which buttons you hear.');
      expect(buttons).toHaveLength(7);
      expect(buttons.map(button => button.textContent)).toEqual(SOUND_TESTS.map(test => test.label));
      buttons.forEach((button, i) => {
        expect(button.dataset.action).toBe('sound-test');
        expect(button.dataset.arg).toBe(SOUND_TESTS[i].key);
        expect(status(SOUND_TESTS[i].key)).toBe('');
      });
    });
  });

  describe('Speech (as now)', () => {
    it('goes through the app speech manager and reports the Sound setting and session type', () => {
      soundTest.run('speech');

      expect(speechManager.speakWord).toHaveBeenCalledWith('hello');
      expect(synth.speak).not.toHaveBeenCalled();
      expect(status('speech')).toBe('speakWord called, Sound setting on · audioSession: playback');
    });

    it('tells when the Sound setting is off, since then nothing is spoken', () => {
      speechManager.speechSettings.enabled = false;

      soundTest.run('speech');

      expect(status('speech')).toContain('Sound setting off');
    });

    it('reports an error the speech manager throws', () => {
      speechManager.speakWord.mockImplementation(() => { throw new TypeError('boom'); });

      soundTest.run('speech');

      expect(status('speech')).toBe('TypeError: boom · audioSession: playback');
    });
  });

  describe('Speech, audio session auto', () => {
    it('speaks with the session set to auto and restores playback when speech ends', () => {
      let typeWhileSpeaking;
      synth.speak.mockImplementation(() => { typeWhileSpeaking = audioSession.type; });

      soundTest.run('speech-session-auto');

      expect(typeWhileSpeaking).toBe('auto');
      expect(lastUtterance()).toMatchObject({ text: 'hello', lang: 'en-US' });
      expect(status('speech-session-auto')).toBe('speak() called · audioSession: auto');

      lastUtterance().onstart();
      expect(status('speech-session-auto')).toBe('speaking · audioSession: auto');

      lastUtterance().onend();
      expect(audioSession.type).toBe('playback');
      expect(status('speech-session-auto')).toBe('speech ended · audioSession: playback');
    });

    it('restores playback after a timeout when speech never ends', () => {
      soundTest.run('speech-session-auto');
      expect(audioSession.type).toBe('auto');

      timers[0].fn();

      expect(timers[0].ms).toBeGreaterThan(0);
      expect(audioSession.type).toBe('playback');
    });

    it('restores playback and reports a speech error', () => {
      soundTest.run('speech-session-auto');

      lastUtterance().onerror({ error: 'not-allowed' });

      expect(audioSession.type).toBe('playback');
      expect(status('speech-session-auto')).toBe('speech error: not-allowed · audioSession: playback');
    });

    it('restores playback when speak() throws', () => {
      synth.speak.mockImplementation(() => { throw new Error('engine down'); });

      soundTest.run('speech-session-auto');

      expect(audioSession.type).toBe('playback');
      expect(status('speech-session-auto')).toBe('Error: engine down · audioSession: playback');
    });

    it('still speaks without the Audio Session API and says the API is missing', () => {
      soundTest = make({ audioSession: null });

      soundTest.run('speech-session-auto');

      expect(synth.speak).toHaveBeenCalledTimes(1);
      expect(status('speech-session-auto')).toBe('speak() called · audioSession: no audioSession API');
    });

    it('reports missing speech synthesis', () => {
      soundTest = make({ speechSynthesis: null });

      soundTest.run('speech-session-auto');

      expect(status('speech-session-auto')).toBe('Error: speechSynthesis unavailable · audioSession: playback');
      expect(audioSession.type).toBe('playback');
    });
  });

  describe('Silent audio, then speech', () => {
    it('starts a silent WAV inside the click and speaks once it plays', async () => {
      const done = soundTest.run('silent-audio-speech');

      expect(audios).toHaveLength(1);
      expect(audios[0].play).toHaveBeenCalledTimes(1);
      expect(synth.speak).not.toHaveBeenCalled();
      const wav = decodeWav(audios[0].src);
      expect(wav.prefix).toBe('data:audio/wav;base64');
      expect(wav.samples.every(sample => sample === 0)).toBe(true);

      await done;

      expect(lastUtterance()).toMatchObject({ text: 'hello', lang: 'en-US' });
      expect(status('silent-audio-speech')).toBe('speak() called · audioSession: playback');
    });

    it('reports a blocked silent clip and does not speak', async () => {
      playResult = () => Promise.reject(new window.DOMException('play() denied', 'NotAllowedError'));

      await soundTest.run('silent-audio-speech');

      expect(synth.speak).not.toHaveBeenCalled();
      expect(status('silent-audio-speech')).toBe('NotAllowedError: play() denied · audioSession: playback');
    });
  });

  describe('Audio element: beep', () => {
    it('plays a generated 440 Hz WAV inside the click and reports the start', async () => {
      const done = soundTest.run('audio-beep');

      expect(audios[0].play).toHaveBeenCalledTimes(1);
      const wav = decodeWav(audios[0].src);
      expect(wav.samples.length / wav.sampleRate).toBeCloseTo(0.4, 3);
      expect(wav.samples.some(sample => sample !== 0)).toBe(true);

      await done;

      expect(status('audio-beep')).toBe('started · audioSession: playback');
    });

    it('reports a play() rejection', async () => {
      playResult = () => Promise.reject(new window.DOMException('unsupported source', 'NotSupportedError'));

      await soundTest.run('audio-beep');

      expect(status('audio-beep')).toBe('NotSupportedError: unsupported source · audioSession: playback');
    });
  });

  describe('Web Audio: beep', () => {
    it('resumes the context inside the click, then plays a 0.4 s 440 Hz oscillator', async () => {
      const done = soundTest.run('web-audio-beep');

      expect(audioContext.resume).toHaveBeenCalledTimes(1);
      expect(status('web-audio-beep')).toBe('resuming audio context · audioSession: playback');

      await done;

      expect(oscillator.frequency.value).toBe(440);
      expect(oscillator.connect).toHaveBeenCalledWith(audioContext.destination);
      expect(oscillator.start).toHaveBeenCalledWith(2);
      expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(2.4, 5);
      expect(status('web-audio-beep')).toBe('started, context running · audioSession: playback');

      oscillator.onended();
      expect(audioContext.close).toHaveBeenCalledTimes(1);
    });

    it('does not touch the audio session', async () => {
      audioSession.type = 'auto';

      await soundTest.run('web-audio-beep');

      expect(audioSession.type).toBe('auto');
    });

    it('reports a missing AudioContext', () => {
      soundTest = make({ createAudioContext: () => { throw new TypeError('AudioContext is not a constructor'); } });

      soundTest.run('web-audio-beep');

      expect(status('web-audio-beep')).toBe('TypeError: AudioContext is not a constructor · audioSession: playback');
    });

    it('reports a failed resume', async () => {
      audioContext.resume = vi.fn(() => Promise.reject(new window.DOMException('no gesture', 'NotAllowedError')));

      await soundTest.run('web-audio-beep');

      expect(oscillator.start).not.toHaveBeenCalled();
      expect(status('web-audio-beep')).toBe('NotAllowedError: no gesture · audioSession: playback');
    });
  });

  describe('Audio session playback + Web Audio beep', () => {
    it('sets the session to playback before the Web Audio beep', async () => {
      audioSession.type = 'auto';
      let typeOnResume;
      audioContext.resume = vi.fn(() => { typeOnResume = audioSession.type; return Promise.resolve(); });

      await soundTest.run('playback-web-audio-beep');

      expect(typeOnResume).toBe('playback');
      expect(oscillator.start).toHaveBeenCalledTimes(1);
      expect(status('playback-web-audio-beep')).toMatch(/^started, context .* · audioSession: playback$/);
    });

    it('still beeps without the Audio Session API', async () => {
      soundTest = make({ audioSession: null });

      await soundTest.run('playback-web-audio-beep');

      expect(oscillator.start).toHaveBeenCalledTimes(1);
      expect(status('playback-web-audio-beep')).toContain('audioSession: no audioSession API');
    });
  });

  describe('Dictionary mp3', () => {
    it('fetches "hello" and plays its first non-empty phonetic audio', async () => {
      const done = soundTest.run('dictionary-mp3');
      expect(status('dictionary-mp3')).toBe('fetching · audioSession: playback');

      await done;

      expect(fetchFn).toHaveBeenCalledWith(DICTIONARY_URL);
      expect(audios.map(audio => audio.src)).toEqual(['https://cdn.example/hello-uk.mp3']);
      expect(audios[0].play).toHaveBeenCalledTimes(1);
      expect(status('dictionary-mp3')).toBe('started https://cdn.example/hello-uk.mp3 · audioSession: playback');
    });

    it('reports a network failure', async () => {
      fetchFn = vi.fn(() => Promise.reject(new TypeError('Load failed')));
      soundTest = make();

      await soundTest.run('dictionary-mp3');

      expect(audios).toHaveLength(0);
      expect(status('dictionary-mp3')).toBe('Error: fetch failed: TypeError: Load failed · audioSession: playback');
    });

    it('reports an HTTP error', async () => {
      fetchFn = fetchReturning(jsonResponse({}, { ok: false, status: 404 }));
      soundTest = make();

      await soundTest.run('dictionary-mp3');

      expect(status('dictionary-mp3')).toBe('Error: fetch failed: HTTP 404 · audioSession: playback');
    });

    it('reports an entry without audio', async () => {
      fetchFn = fetchReturning(jsonResponse([{ phonetics: [{ audio: '' }] }]));
      soundTest = make();

      await soundTest.run('dictionary-mp3');

      expect(audios).toHaveLength(0);
      expect(status('dictionary-mp3')).toBe('Error: no audio in the dictionary entry · audioSession: playback');
    });

    it('reports a play() rejection after the fetch', async () => {
      playResult = () => Promise.reject(new window.DOMException('no gesture', 'NotAllowedError'));

      await soundTest.run('dictionary-mp3');

      expect(status('dictionary-mp3')).toBe('NotAllowedError: no gesture · audioSession: playback');
    });
  });

  it('ignores an unknown sound test', async () => {
    await soundTest.run('nope');

    expect(speechManager.speakWord).not.toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
    expect(audios).toHaveLength(0);
  });

  describe('toneWavDataUri', () => {
    it('builds a 16-bit mono PCM WAV of the requested length', () => {
      const wav = decodeWav(toneWavDataUri(440, 0.4, window.btoa));

      expect(wav).toMatchObject({ riff: 'RIFF', wave: 'WAVE', format: 1, channels: 1, bitsPerSample: 16 });
      expect(wav.totalSize).toBe(44 + wav.samples.length * 2);
      expect(wav.samples.length).toBe(Math.round(wav.sampleRate * 0.4));
      expect(Math.max(...wav.samples)).toBeGreaterThan(0);
      expect(Math.min(...wav.samples)).toBeLessThan(0);
    });

    it('gives pure silence for frequency 0', () => {
      const wav = decodeWav(toneWavDataUri(0, 0.5, window.btoa));

      expect(wav.samples.length).toBe(Math.round(wav.sampleRate * 0.5));
      expect(wav.samples.every(sample => sample === 0)).toBe(true);
    });
  });

  describe('firstPhoneticAudioUrl', () => {
    it('takes the first non-empty audio across entries and fixes protocol-relative links', () => {
      expect(firstPhoneticAudioUrl([{ phonetics: [{ audio: '' }] }, { phonetics: [{ audio: '//ssl.example/hello.mp3' }] }]))
        .toBe('https://ssl.example/hello.mp3');
    });

    it('returns null for missing or malformed data', () => {
      expect(firstPhoneticAudioUrl([])).toBeNull();
      expect(firstPhoneticAudioUrl({ title: 'No Definitions Found' })).toBeNull();
      expect(firstPhoneticAudioUrl([{}, null, { phonetics: [{ text: '/x/' }] }])).toBeNull();
    });
  });
});
