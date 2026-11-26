import { describe, it, expect, beforeEach, vi } from 'vitest';

const { ENGINES, TEST_PHRASE, soundTestBodyHtml, addStreamIteration, createSoundTest } = require('../../js/sound-test.js');

const MB = 1024 * 1024;
const urlOf = (key) => ENGINES.find(engine => engine.key === key).url;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const namedError = (name, message) => Object.assign(new Error(message), { name });

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Sound test', () => {
  let clock;
  let audioContext;
  let source;
  let channel;
  let kokoroTts;
  let kokoroLib;
  let piperSession;
  let piperProgress;
  let piperLib;
  let importModule;
  let createAudioContext;

  const status = (key) => document.querySelector(`[data-testid="sound-test-status-${key}"]`).textContent;
  const textField = () => document.querySelector('[data-testid="sound-test-text"]');

  const make = (overrides = {}) => createSoundTest({
    document,
    importModule,
    createAudioContext,
    now: () => clock,
    caches: null,
    storage: null,
    ...overrides
  });

  beforeEach(() => {
    document.body.innerHTML = soundTestBodyHtml();
    clock = 0;
    source = { connect: vi.fn(), start: vi.fn() };
    channel = new Float32Array(48000);
    audioContext = {
      destination: { name: 'speakers' },
      resume: vi.fn(() => Promise.resolve()),
      createBuffer: vi.fn((channels, length, sampleRate) => ({ duration: length / sampleRate, getChannelData: () => channel })),
      decodeAudioData: vi.fn(() => Promise.resolve({ duration: 1.44 })),
      createBufferSource: vi.fn(() => source)
    };
    createAudioContext = vi.fn(() => audioContext);
    kokoroTts = {
      generate: vi.fn(() => {
        clock += 850;
        return Promise.resolve({ audio: new Float32Array(48000).fill(0.25), sampling_rate: 24000 });
      })
    };
    kokoroLib = {
      KokoroTTS: {
        from_pretrained: vi.fn((model, { progress_callback }) => {
          progress_callback({ status: 'initiate', file: 'config.json' });
          progress_callback({ status: 'progress', file: 'onnx/model_quantized.onnx', loaded: 60 * MB });
          progress_callback({ status: 'progress', file: 'onnx/model_quantized.onnx', loaded: 88 * MB });
          progress_callback({ status: 'progress', file: 'tokenizer.json', loaded: 2 * MB });
          clock += 12300;
          return Promise.resolve(kokoroTts);
        })
      }
    };
    piperSession = {
      predict: vi.fn(() => {
        clock += 240;
        return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
      })
    };
    piperLib = {
      TtsSession: {
        create: vi.fn(({ progress }) => {
          piperProgress = progress;
          progress({ url: 'https://huggingface.co/lessac.onnx', loaded: 60 * MB, total: 60 * MB });
          clock += 7400;
          return Promise.resolve(piperSession);
        })
      }
    };
    importModule = vi.fn(url => Promise.resolve(url === urlOf('kokoro') ? kokoroLib : piperLib));
  });

  describe('section markup', () => {
    it('renders the note, the prefilled text field, one button with a status line per engine and the clear button', () => {
      const buttons = [...document.querySelectorAll('[data-action="sound-test"]')];

      expect(document.querySelector('.settings-note').textContent)
        .toBe('Temporary: turn on silent mode, press each engine, tell if you hear it, how long it took and how it sounds.');
      expect(textField().value).toBe('take something for granted');
      expect(buttons.map(button => button.dataset.arg)).toEqual(['kokoro', 'piper']);
      expect(buttons.map(button => button.textContent)).toEqual(ENGINES.map(engine => engine.label));
      ENGINES.forEach(({ key }) => expect(status(key)).toBe(''));
      expect(document.querySelector('[data-testid="sound-test-clear"]').dataset.action).toBe('sound-test-clear');
      expect(status('clear')).toBe('');
    });

    it('loads every engine from a CDN build pinned to an exact version', () => {
      ENGINES.forEach(({ url }) => {
        expect(url).toMatch(/^https:\/\/(cdn\.jsdelivr\.net|esm\.sh)\//);
        expect(url).toMatch(/@\d+\.\d+\.\d+/);
      });
      expect(urlOf('piper')).toContain('deps=onnxruntime-web@1.18.0');
    });
  });

  describe('run', () => {
    it('creates and resumes the AudioContext synchronously, before any library loads', () => {
      make().run('kokoro');

      expect(createAudioContext).toHaveBeenCalledTimes(1);
      expect(audioContext.resume).toHaveBeenCalledTimes(1);
      expect(status('kokoro')).toBe('loading library…');
      expect(importModule).toHaveBeenCalledWith(urlOf('kokoro'));
    });

    it('loads Kokoro q8 on wasm, speaks the phrase with an American voice and plays its PCM through Web Audio', async () => {
      await make().run('kokoro');

      expect(kokoroLib.KokoroTTS.from_pretrained).toHaveBeenCalledWith('onnx-community/Kokoro-82M-v1.0-ONNX', expect.objectContaining({ dtype: 'q8', device: 'wasm' }));
      expect(kokoroTts.generate).toHaveBeenCalledWith(TEST_PHRASE, { voice: 'af_heart' });
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 48000, 24000);
      expect(channel[0]).toBe(0.25);
      expect(source.buffer.duration).toBe(2);
      expect(source.connect).toHaveBeenCalledWith(audioContext.destination);
      expect(source.start).toHaveBeenCalled();
      expect(status('kokoro')).toBe('loaded in 12.3 s, model 90 MB · generated in 850 ms, 2.0 s of audio · playing');
    });

    it('loads the Piper lessac voice and plays its decoded WAV', async () => {
      await make().run('piper');

      expect(piperLib.TtsSession.create).toHaveBeenCalledWith(expect.objectContaining({ voiceId: 'en_US-lessac-medium' }));
      expect(piperSession.predict).toHaveBeenCalledWith(TEST_PHRASE);
      expect(audioContext.decodeAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer));
      expect(source.start).toHaveBeenCalled();
      expect(status('piper')).toBe('loaded in 7.4 s, model 60 MB · generated in 240 ms, 1.4 s of audio · playing');
    });

    it('shows the downloaded megabytes while the model is loading', async () => {
      const loading = deferred();
      kokoroLib.KokoroTTS.from_pretrained.mockImplementation((model, { progress_callback }) => {
        progress_callback({ status: 'progress', file: 'onnx/model_quantized.onnx', loaded: 30 * MB });
        progress_callback({ status: 'progress', file: 'voices/af_heart.bin', loaded: 0.6 * MB });
        return loading.promise;
      });
      const running = make().run('kokoro');
      await flush();

      expect(status('kokoro')).toBe('downloading model… 31 MB');

      loading.resolve(kokoroTts);
      await running;
      expect(status('kokoro')).toMatch(/^loaded in .+, model 31 MB · generated in/);
    });

    it('says loading model when the library reports no download, as with a model cached earlier', async () => {
      const loading = deferred();
      kokoroLib.KokoroTTS.from_pretrained.mockImplementation(() => loading.promise);
      const running = make().run('kokoro');
      await flush();

      expect(status('kokoro')).toBe('loading model…');

      loading.resolve(kokoroTts);
      await running;
      expect(status('kokoro')).toMatch(/^loaded in 0\.0 s · generated in/);
    });

    it('ignores progress the library reports after loading, such as Piper inference progress', async () => {
      const soundTest = make();
      await soundTest.run('piper');
      const finished = status('piper');

      piperProgress({ url: 'tts://inference-progress', loaded: 1, total: 2 });

      expect(status('piper')).toBe(finished);
    });

    it('reuses the loaded engine and the one AudioContext on the next press and shows the warm timing', async () => {
      const soundTest = make();
      await soundTest.run('kokoro');
      await soundTest.run('kokoro');

      expect(importModule).toHaveBeenCalledTimes(1);
      expect(kokoroLib.KokoroTTS.from_pretrained).toHaveBeenCalledTimes(1);
      expect(createAudioContext).toHaveBeenCalledTimes(1);
      expect(audioContext.resume).toHaveBeenCalledTimes(2);
      expect(source.start).toHaveBeenCalledTimes(2);
      expect(status('kokoro')).toBe('already loaded · generated in 850 ms, 2.0 s of audio · playing');
    });

    it('speaks the text typed in the field and falls back to the phrase when it is empty', async () => {
      const soundTest = make();
      textField().value = '  break the ice ';
      await soundTest.run('kokoro');
      textField().value = '   ';
      await soundTest.run('kokoro');

      expect(kokoroTts.generate.mock.calls.map(call => call[0])).toEqual(['break the ice', TEST_PHRASE]);
    });

    it('waits for the AudioContext to resume before playing and reports a failed resume', async () => {
      audioContext.resume.mockReturnValue(Promise.reject(namedError('NotAllowedError', 'not allowed')));

      await make().run('kokoro');

      expect(source.start).not.toHaveBeenCalled();
      expect(status('kokoro')).toBe('loaded in 12.3 s, model 90 MB · generated in 850 ms, 2.0 s of audio · NotAllowedError: not allowed');
    });

    it('reports a library that fails to load and loads it again on the next press', async () => {
      importModule.mockReturnValueOnce(Promise.reject(new TypeError('Importing a module script failed.')));
      const soundTest = make();

      await soundTest.run('piper');
      expect(status('piper')).toBe('TypeError: Importing a module script failed.');
      expect(source.start).not.toHaveBeenCalled();

      await soundTest.run('piper');
      expect(importModule).toHaveBeenCalledTimes(2);
      expect(status('piper')).toMatch(/^loaded in .+ · playing$/);
    });

    it('reports a model that fails to load', async () => {
      kokoroLib.KokoroTTS.from_pretrained.mockReturnValue(Promise.reject(new Error('Could not locate file')));

      await make().run('kokoro');

      expect(status('kokoro')).toBe('Error: Could not locate file');
    });

    it('keeps the load timing and reports a generation error after it', async () => {
      kokoroTts.generate.mockReturnValue(Promise.reject(new RangeError('Out of memory')));

      await make().run('kokoro');

      expect(status('kokoro')).toBe('loaded in 12.3 s, model 90 MB · RangeError: Out of memory');
      expect(source.start).not.toHaveBeenCalled();
    });

    it('reports an AudioContext that cannot be created and loads nothing', async () => {
      createAudioContext.mockImplementation(() => { throw new TypeError('AudioContext is not a constructor'); });

      await make().run('piper');

      expect(status('piper')).toBe('TypeError: AudioContext is not a constructor');
      expect(importModule).not.toHaveBeenCalled();
    });

    it('ignores an unknown engine', async () => {
      await make().run('nope');

      expect(createAudioContext).not.toHaveBeenCalled();
      expect(importModule).not.toHaveBeenCalled();
    });
  });

  describe('addStreamIteration', () => {
    function fakeStreamClass(chunks) {
      const reader = {
        read: vi.fn(() => Promise.resolve(chunks.length ? { done: false, value: chunks.shift() } : { done: true })),
        releaseLock: vi.fn()
      };
      return { StreamClass: class { getReader() { return reader; } }, reader };
    }

    it('lets for await read a stream chunk by chunk where the browser cannot, then releases the reader', async () => {
      const { StreamClass, reader } = fakeStreamClass(['a', 'b']);
      addStreamIteration(StreamClass);

      const read = [];
      for await (const chunk of new StreamClass()) read.push(chunk);

      expect(read).toEqual(['a', 'b']);
      expect(reader.releaseLock).toHaveBeenCalledTimes(1);
    });

    it('keeps the native iterator and tolerates a browser without streams', () => {
      const native = async function* native() { yield 'x'; };
      const { StreamClass } = fakeStreamClass([]);
      StreamClass.prototype[Symbol.asyncIterator] = native;

      addStreamIteration(StreamClass);
      addStreamIteration(undefined);

      expect(StreamClass.prototype[Symbol.asyncIterator]).toBe(native);
    });

    it('is added before an engine library loads', () => {
      const { StreamClass } = fakeStreamClass([]);

      make({ ReadableStream: StreamClass }).run('kokoro');

      expect(StreamClass.prototype[Symbol.asyncIterator]).toEqual(expect.any(Function));
    });
  });

  describe('clearModels', () => {
    let caches;
    let root;

    beforeEach(() => {
      caches = { delete: vi.fn(name => Promise.resolve(name === 'transformers-cache')) };
      root = { removeEntry: vi.fn(() => Promise.resolve()) };
    });

    const storage = () => ({ getDirectory: () => Promise.resolve(root) });

    it('deletes the model caches and folders the engines created and reports how many were removed', async () => {
      await make({ caches, storage: storage() }).clearModels();

      expect(caches.delete.mock.calls.map(call => call[0])).toEqual(['transformers-cache', 'kokoro-voices']);
      expect(root.removeEntry).toHaveBeenCalledWith('piper', { recursive: true });
      expect(status('clear')).toBe('removed 1 caches · removed 1 model folders');
    });

    it('does not count a model folder that is not there', async () => {
      root.removeEntry.mockReturnValue(Promise.reject(namedError('NotFoundError', 'missing')));

      await make({ caches, storage: storage() }).clearModels();

      expect(status('clear')).toBe('removed 1 caches · removed 0 model folders');
    });

    it('reports any other storage error after the caches it removed', async () => {
      root.removeEntry.mockReturnValue(Promise.reject(namedError('NoModificationAllowedError', 'busy')));

      await make({ caches, storage: storage() }).clearModels();

      expect(status('clear')).toBe('removed 1 caches · NoModificationAllowedError: busy');
    });

    it('reports a file system that cannot be opened after the caches it removed', async () => {
      const broken = { getDirectory: () => Promise.reject(namedError('UnknownError', 'The operation failed')) };

      await make({ caches, storage: broken }).clearModels();

      expect(status('clear')).toBe('removed 1 caches · UnknownError: The operation failed');
    });

    it('removes nothing where the browser has no Cache Storage or file system access', async () => {
      await make({ caches: null, storage: {} }).clearModels();

      expect(status('clear')).toBe('removed 0 caches · removed 0 model folders');
    });
  });
});
