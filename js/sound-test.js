// ============================================================================
// SOUND TEST - temporary Settings section: neural text-to-speech running in the
// browser, played through Web Audio, so we learn which engine is heard in iPhone
// silent mode, how long it takes and how it sounds. Engine libraries load from a
// CDN on press and never go into the app bundle; models come from Hugging Face.
// ============================================================================

const TEST_PHRASE = 'take something for granted';
const MS_PER_SECOND = 1000;
const BYTES_PER_MB = 1024 * 1024;

const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const KOKORO_VOICE = 'af_heart';
const PIPER_VOICE = 'en_US-lessac-medium';

async function loadKokoro(lib, onDownload) {
    const tts = await lib.KokoroTTS.from_pretrained(KOKORO_MODEL, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (event) => {
            if (event.status === 'progress') onDownload(event.file, event.loaded);
        }
    });
    return async (text, context) => {
        const audio = await tts.generate(text, { voice: KOKORO_VOICE });
        const buffer = context.createBuffer(1, audio.audio.length, audio.sampling_rate);
        buffer.getChannelData(0).set(audio.audio);
        return buffer;
    };
}

async function loadPiper(lib, onDownload) {
    const session = await lib.TtsSession.create({
        voiceId: PIPER_VOICE,
        progress: (event) => onDownload(event.url, event.loaded)
    });
    return async (text, context) => {
        const wav = await session.predict(text);
        return context.decodeAudioData(await wav.arrayBuffer());
    };
}

// url: pinned library build; caches/folders: Cache Storage and OPFS entries it fills with models
const ENGINES = [
    {
        key: 'kokoro',
        label: 'Kokoro 82M (q8, ~90 MB)',
        url: 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js',
        load: loadKokoro,
        caches: ['transformers-cache', 'kokoro-voices'],
        folders: []
    },
    {
        key: 'piper',
        label: 'Piper lessac medium (~60 MB)',
        url: 'https://esm.sh/@mintplex-labs/piper-tts-web@1.0.5?deps=onnxruntime-web@1.18.0',
        load: loadPiper,
        caches: [],
        folders: ['piper']
    }
];

function soundTestBodyHtml() {
    const rows = ENGINES.map(({ key, label }) => `
        <li>
            <button type="button" class="settings-action" data-action="sound-test" data-arg="${key}" data-testid="sound-test-${key}">${label}</button>
            <p class="settings-note" aria-live="polite" data-sound-test-status="${key}" data-testid="sound-test-status-${key}"></p>
        </li>
    `).join('');
    return `
        <p class="settings-note">Temporary: turn on silent mode, press each engine, tell if you hear it, how long it took and how it sounds.</p>
        <input type="text" class="form-control" aria-label="Text to speak" value="${TEST_PHRASE}" data-sound-test-text data-testid="sound-test-text">
        <ul class="settings-list">
            ${rows}
            <li>
                <button type="button" class="settings-action" data-action="sound-test-clear" data-testid="sound-test-clear">Clear downloaded models</button>
                <p class="settings-note" aria-live="polite" data-sound-test-status="clear" data-testid="sound-test-status-clear"></p>
            </li>
        </ul>
    `;
}

function errorText(error) {
    return error?.name ? `${error.name}: ${error.message}` : String(error);
}

// The phonemizer inside kokoro-js reads a ReadableStream with for await, which WebKit
// (Safari 26.0) cannot do yet; this adds the standard async iterator where it is missing
function addStreamIteration(StreamClass) {
    const proto = StreamClass?.prototype;
    if (!proto || proto[Symbol.asyncIterator]) return;
    proto[Symbol.asyncIterator] = async function* readChunks() {
        const reader = this.getReader();
        try {
            let chunk = await reader.read();
            while (!chunk.done) {
                yield chunk.value;
                chunk = await reader.read();
            }
        } finally {
            reader.releaseLock();
        }
    };
}

const toSeconds = (ms) => (ms / MS_PER_SECOND).toFixed(1);
const toMegabytes = (bytes) => Math.round(bytes / BYTES_PER_MB);

// A status line keeps finished stages and shows the current one after them
function createStatusLine(element) {
    const kept = [];
    const render = (current) => {
        if (element) element.textContent = [...kept, current].filter(Boolean).join(' · ');
    };
    return {
        show: render,
        keep(text) {
            kept.push(text);
            render();
        }
    };
}

function createSoundTest(deps = {}) {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    const hasOwn = Object.prototype.hasOwnProperty;
    const pick = (key, fallback) => (hasOwn.call(deps, key) ? deps[key] : fallback);

    const doc = pick('document', g.document ?? null);
    // The specifier is a variable, so esbuild leaves this import() as is and the library stays out of the bundle
    const importModule = pick('importModule', url => import(url));
    const createAudioContext = pick('createAudioContext', () => new (g.AudioContext || g.webkitAudioContext)());
    const cacheStorage = pick('caches', g.caches ?? null);
    const storage = pick('storage', g.navigator?.storage ?? null);
    const now = pick('now', () => g.performance.now());
    const StreamClass = pick('ReadableStream', g.ReadableStream);

    const loadedEngines = new Map();
    let audioContext = null;

    const statusLine = (key) => createStatusLine(doc?.querySelector(`[data-sound-test-status="${key}"]`));
    const textToSpeak = () => doc?.querySelector('[data-sound-test-text]')?.value.trim() || TEST_PHRASE;

    async function loadEngine(engine, line) {
        line.show('loading library…');
        addStreamIteration(StreamClass);
        const lib = await importModule(engine.url);
        line.show('loading model…');
        const downloaded = new Map();
        let loading = true;
        const onDownload = (file, bytes) => {
            if (!loading) return;
            downloaded.set(file, bytes);
            line.show(`downloading model… ${toMegabytes(totalBytes(downloaded))} MB`);
        };
        try {
            const synthesize = await engine.load(lib, onDownload);
            return { synthesize, downloadedBytes: totalBytes(downloaded) };
        } finally {
            loading = false;
        }
    }

    async function prepareEngine(engine, line) {
        if (loadedEngines.has(engine.key)) {
            const { synthesize } = await loadedEngines.get(engine.key);
            line.keep('already loaded');
            return synthesize;
        }
        const started = now();
        const loading = loadEngine(engine, line);
        loadedEngines.set(engine.key, loading);
        try {
            const { synthesize, downloadedBytes } = await loading;
            // Bytes the library reported: a download, or a read of the model it cached earlier
            const model = downloadedBytes ? `, model ${toMegabytes(downloadedBytes)} MB` : '';
            line.keep(`loaded in ${toSeconds(now() - started)} s${model}`);
            return synthesize;
        } catch (error) {
            loadedEngines.delete(engine.key);
            throw error;
        }
    }

    async function speak(engine, line, context, resumed) {
        const synthesize = await prepareEngine(engine, line);
        line.show('generating…');
        const started = now();
        const buffer = await synthesize(textToSpeak(), context);
        line.keep(`generated in ${Math.round(now() - started)} ms, ${buffer.duration.toFixed(1)} s of audio`);
        const resumeError = await resumed;
        if (resumeError) throw resumeError;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start();
        line.show('playing');
    }

    // Called straight from the click handler: the AudioContext is created and resumed
    // synchronously, so iOS sees the user gesture before the long async work starts
    function run(key) {
        const engine = ENGINES.find(candidate => candidate.key === key);
        if (!engine) return Promise.resolve();
        const line = statusLine(key);
        try {
            audioContext = audioContext || createAudioContext();
            // Settles to the error, if any, so a failed resume waits for playback instead of going unhandled
            const resumed = Promise.resolve(audioContext.resume()).then(() => null, error => error);
            return speak(engine, line, audioContext, resumed).catch(error => line.show(errorText(error)));
        } catch (error) {
            line.show(errorText(error));
            return Promise.resolve();
        }
    }

    async function removeCaches() {
        if (!cacheStorage) return 0;
        const names = ENGINES.flatMap(engine => engine.caches);
        const removed = await Promise.all(names.map(name => cacheStorage.delete(name)));
        return removed.filter(Boolean).length;
    }

    async function removeFolders() {
        if (!storage?.getDirectory) return 0;
        const root = await storage.getDirectory();
        const names = ENGINES.flatMap(engine => engine.folders);
        const removed = await Promise.all(names.map(name => root.removeEntry(name, { recursive: true }).then(
            () => true,
            (error) => {
                if (error?.name === 'NotFoundError') return false;
                throw error;
            }
        )));
        return removed.filter(Boolean).length;
    }

    async function clearModels() {
        const line = statusLine('clear');
        line.show('clearing…');
        try {
            line.keep(`removed ${await removeCaches()} caches`);
            line.show(`removed ${await removeFolders()} model folders`);
        } catch (error) {
            line.show(errorText(error));
        }
    }

    return { run, clearModels };
}

function totalBytes(downloaded) {
    let total = 0;
    downloaded.forEach(bytes => { total += bytes; });
    return total;
}

module.exports = { ENGINES, TEST_PHRASE, soundTestBodyHtml, addStreamIteration, createSoundTest };
