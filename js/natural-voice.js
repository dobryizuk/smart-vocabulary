// ============================================================================
// NATURAL VOICE - Kokoro neural speech, heard in iPhone silent mode through Web Audio.
// Generating a clip takes seconds on a phone, so a Web Worker prepares clips ahead,
// one at a time, and stores them on the device; a stored clip plays at once, offline too.
// ============================================================================

// The library loads from the CDN inside the worker and never goes into the app bundle
const KOKORO = {
    library: 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js',
    model: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    dtype: 'q8',
    device: 'wasm',
    voice: 'af_heart'
};
const WORKER_URL = 'js/voice-worker.js';
const CLIP_CACHE = 'voice-clips';
const CLIP_PATH = `voice-clips/${encodeURIComponent(KOKORO.model)}/${KOKORO.dtype}/${KOKORO.voice}/`;

// A hung or silently killed worker must not leave the speaker button spinning
const LOAD_TIMEOUT_MS = 180000;
const CLIP_TIMEOUT_MS = 60000;

const WAV_HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;
const MAX_SAMPLE = 0x7fff;

// 16-bit mono PCM WAV: a sixth of the raw float samples' size and decodable by every browser
function encodeWav(samples, sampleRate) {
    const dataBytes = samples.length * BYTES_PER_SAMPLE;
    const view = new DataView(new ArrayBuffer(WAV_HEADER_BYTES + dataBytes));
    const writeText = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    writeText(0, 'RIFF');
    view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true);
    writeText(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true);
    view.setUint16(32, BYTES_PER_SAMPLE, true);
    view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
    writeText(36, 'data');
    view.setUint32(40, dataBytes, true);
    samples.forEach((sample, i) => {
        view.setInt16(WAV_HEADER_BYTES + i * BYTES_PER_SAMPLE, Math.max(-1, Math.min(1, sample)) * MAX_SAMPLE, true);
    });
    return view.buffer;
}

// Texts in the order their clips are made: those asked for while missing (latest first),
// the current session, the word just added, then new words and the nearest reviews
function orderClipQueue({ words, requested = [], session = [], added = null }) {
    const byTime = (field) => (a, b) => new Date(a[field]) - new Date(b[field]);
    const fresh = words.filter(word => !word.nextReview).sort(byTime('createdAt'));
    const reviewed = words.filter(word => word.nextReview).sort(byTime('nextReview'));
    const known = new Set([...requested, ...words.map(word => word.original)]);
    const ordered = [...requested, ...session, added, ...fresh.map(w => w.original), ...reviewed.map(w => w.original)];
    return [...new Set(ordered.filter(text => known.has(text)))];
}

function withTimeout(promise, ms, what) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error(`${what} timed out after ${ms} ms`);
            error.name = 'TimeoutError';
            reject(error);
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function voiceStatusText({ downloading, unavailable, clips, words }) {
    if (downloading) return 'Natural voice: downloading…';
    if (unavailable && clips === 0) return 'Natural voice: unavailable';
    return `Natural voice: ready, ${clips} of ${words} words`;
}

// The worker loads the model, then answers each text with its samples
function openSynthesizer(worker) {
    let pending = null;
    let onFatal = null;
    const ready = new Promise((resolve, reject) => {
        const fail = (error) => {
            reject(error);
            pending?.reject(error);
            pending = null;
            onFatal?.(error);
        };
        worker.onmessage = ({ data }) => {
            if (data.type === 'ready') resolve();
            else if (data.type === 'failed') fail(new Error(data.message));
            else if (data.type === 'clip') pending?.resolve(data);
            else if (data.type === 'error') pending?.reject(new Error(data.message));
        };
        worker.onerror = (event) => fail(new Error(event?.message || 'Voice worker failed'));
    });
    worker.postMessage({ type: 'load', ...KOKORO });
    return {
        ready,
        onFatal: (handler) => { onFatal = handler; },
        synthesize: (text) => new Promise((resolve, reject) => {
            pending = { resolve, reject };
            worker.postMessage({ type: 'speak', text });
        }),
        close: () => worker.terminate()
    };
}

function createNaturalVoice(deps = {}) {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    const hasOwn = Object.prototype.hasOwnProperty;
    const pick = (key, fallback) => (hasOwn.call(deps, key) ? deps[key] : fallback);

    const cacheStorage = pick('caches', g.caches ?? null);
    const createWorker = pick('createWorker', typeof g.Worker === 'function' ? (url => new g.Worker(url, { type: 'module' })) : null);
    const AudioContextClass = g.AudioContext || g.webkitAudioContext;
    const createAudioContext = pick('createAudioContext', AudioContextClass ? (() => new AudioContextClass()) : null);
    const doc = pick('document', g.document ?? null);
    const baseUrl = pick('baseUrl', g.document?.baseURI ?? 'http://localhost/');
    const getWords = pick('getWords', () => (g.SV?.DataManager?.loadFailed ? null : g.SV?.DataManager?.vocabulary ?? null));
    const getSessionTexts = pick('getSessionTexts', () => (g.SV?.AppState?.learningSession ?? []).map(word => word.original));
    const isSoundEnabled = pick('isSoundEnabled', () => Boolean(g.SV?.SpeechManager?.speechSettings?.enabled));
    const isOnline = pick('isOnline', () => g.navigator?.onLine !== false);
    const onStatus = pick('onStatus', () => undefined);
    const loadTimeoutMs = pick('loadTimeoutMs', LOAD_TIMEOUT_MS);
    const clipTimeoutMs = pick('clipTimeoutMs', CLIP_TIMEOUT_MS);
    const log = pick('log', (...args) => g.SV?.debugLog?.(...args));

    const clipPrefix = new URL(CLIP_PATH, baseUrl).href;
    const clipKey = (text) => clipPrefix + encodeURIComponent(text);
    const textOfKey = (url) => (url.startsWith(clipPrefix) ? decodeURIComponent(url.slice(clipPrefix.length)) : null);

    const clips = new Set();
    const skipped = new Set();
    const waiters = new Map();
    let requested = [];
    let added = null;
    let cachePromise = null;
    let indexPromise = null;
    let synthesizer = null;
    let downloading = false;
    let broken = !cacheStorage || !createWorker || !createAudioContext;
    let pumping = false;
    let audioContext = null;
    let source = null;

    const openCache = () => {
        cachePromise = cachePromise || cacheStorage.open(CLIP_CACHE);
        return cachePromise;
    };

    function wantedTexts() {
        const words = getWords();
        return words && orderClipQueue({ words, requested, session: getSessionTexts(), added });
    }

    function canGenerate() {
        return !broken && (Boolean(synthesizer) || (isSoundEnabled() && isOnline()));
    }

    function statusText() {
        const words = new Set((getWords() || []).map(word => word.original));
        return voiceStatusText({
            downloading,
            unavailable: !canGenerate(),
            clips: [...words].filter(text => clips.has(text)).length,
            words: words.size
        });
    }

    const notify = () => onStatus(statusText());

    // Clips made with another model or voice are dropped right away
    async function loadIndex() {
        const cache = await openCache();
        const requests = await cache.keys();
        await Promise.all(requests.map(entry => {
            const text = textOfKey(entry.url);
            if (text === null) return cache.delete(entry);
            clips.add(text);
            return null;
        }));
    }

    function ensureIndex() {
        indexPromise = indexPromise || loadIndex().catch(error => {
            broken = true;
            log('🗣️ Natural voice clip store unavailable:', error);
        });
        return indexPromise;
    }

    async function removeOrphans() {
        const wanted = wantedTexts();
        if (!wanted) return;
        const keep = new Set(wanted);
        const orphans = [...clips].filter(text => !keep.has(text));
        if (orphans.length === 0) return;
        const cache = await openCache();
        await Promise.all(orphans.map(text => cache.delete(clipKey(text))));
        orphans.forEach(text => clips.delete(text));
        log('🗣️ Natural voice removed clips of deleted words:', orphans.length);
    }

    const nextText = () => wantedTexts()?.find(text => !clips.has(text) && !skipped.has(text)) ?? null;

    async function ensureSynthesizer() {
        if (synthesizer || !canGenerate()) return synthesizer;
        downloading = true;
        notify();
        const opened = openSynthesizer(createWorker(WORKER_URL));
        try {
            await withTimeout(opened.ready, loadTimeoutMs, 'Voice model load');
            opened.onFatal(stopForGood);
            synthesizer = opened;
            log('🗣️ Natural voice model loaded');
        } catch (error) {
            opened.close();
            stopForGood(error);
        } finally {
            downloading = false;
            notify();
        }
        return synthesizer;
    }

    function stopForGood(error) {
        broken = true;
        synthesizer?.close();
        synthesizer = null;
        log('🗣️ Natural voice unavailable until the next launch:', error);
    }

    function settle(text, error) {
        const waiter = waiters.get(text);
        if (!waiter) return;
        waiters.delete(text);
        if (error) waiter.reject(error);
        else waiter.resolve();
    }

    async function generate(text) {
        let clip;
        try {
            clip = await withTimeout(synthesizer.synthesize(text), clipTimeoutMs, 'Voice clip');
        } catch (error) {
            if (broken || error.name === 'TimeoutError') throw error;
            skipped.add(text);
            log('🗣️ Natural voice could not say:', text, error);
            settle(text, error);
            return;
        }
        const cache = await openCache();
        await cache.put(clipKey(text), new g.Response(encodeWav(clip.samples, clip.sampleRate), {
            headers: { 'Content-Type': 'audio/wav' }
        }));
        clips.add(text);
        settle(text);
        notify();
    }

    // One clip at a time; the order is recomputed after each, so new requests and a
    // started session go first. The model is loaded only when a clip is missing and
    // released when the queue is empty, so it does not hold the phone's memory.
    async function pump() {
        if (pumping) return;
        pumping = true;
        try {
            await ensureIndex();
            while (true) {
                await removeOrphans();
                if (!nextText() || !await ensureSynthesizer()) break;
                // Picked after the model loads, so a text asked for meanwhile goes first
                const text = nextText();
                if (text) await generate(text);
            }
        } catch (error) {
            stopForGood(error);
        } finally {
            synthesizer?.close();
            synthesizer = null;
            pumping = false;
            waiters.forEach((_, text) => settle(text, new Error('Natural voice stopped')));
            notify();
        }
    }

    // iOS lets an AudioContext start only inside a user gesture and suspends it again
    // when the app goes to the background, so every tap resumes it while sound is on
    function resumeAudio() {
        if (!createAudioContext || !isSoundEnabled()) return;
        try {
            audioContext = audioContext || createAudioContext();
            if (audioContext.state !== 'running') Promise.resolve(audioContext.resume()).catch(error => log('🗣️ Audio resume failed:', error));
        } catch (error) {
            log('🗣️ Audio context unavailable:', error);
        }
    }

    async function playClip(text) {
        const response = await (await openCache()).match(clipKey(text));
        if (!response) throw new Error('Clip is missing');
        const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
        source?.stop();
        source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
        log('🗣️ Natural voice played:', text);
    }

    const hasClip = (text) => clips.has(text);

    // Plays a stored clip; a clip that fails is dropped so it is made again, and the error
    // goes on to the caller. The context resumes before the first await, inside the tap.
    function play(text) {
        resumeAudio();
        return playClip(text).catch(error => {
            clips.delete(text);
            log('🗣️ Natural voice clip failed:', text, error);
            notify();
            throw error;
        });
    }

    // Puts a text first in the queue; settles when its clip is stored or the voice gives up
    function request(text) {
        if (clips.has(text)) return Promise.resolve();
        resumeAudio();
        requested = [text, ...requested.filter(other => other !== text)];
        if (!waiters.has(text)) {
            let resolve;
            let reject;
            const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
            waiters.set(text, { promise, resolve, reject });
        }
        const { promise } = waiters.get(text);
        pump();
        return promise;
    }

    function wordAdded(text) {
        added = text;
        pump();
    }

    function start() {
        doc?.addEventListener('touchend', resumeAudio, true);
        doc?.addEventListener('click', resumeAudio, true);
        return pump();
    }

    return {
        start,
        hasClip,
        play,
        request,
        wordAdded,
        isAvailable: canGenerate,
        getStatusText: statusText
    };
}

module.exports = { encodeWav, orderClipQueue, voiceStatusText, createNaturalVoice };
