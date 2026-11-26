// ============================================================================
// SOUND TEST - temporary Settings section (card C21): each button plays "hello"
// one specific way, so we learn which way the iPhone silent switch does not mute
// ============================================================================

const speechManager = require('./speech-manager.js');

const TEST_WORD = 'hello';
const SPEECH_LANG = 'en-US';
const SAMPLE_RATE = 22050;
const AMPLITUDE = 0.5;
const BEEP_HZ = 440;
const BEEP_SECONDS = 0.4;
const SILENCE_SECONDS = 0.5;
const RESTORE_SESSION_MS = 5000;
const DICTIONARY_URL = `https://api.dictionaryapi.dev/api/v2/entries/en/${TEST_WORD}`;

const SOUND_TESTS = [
    { key: 'speech', label: '1. Speech (as now)' },
    { key: 'speech-session-auto', label: '2. Speech, audio session auto' },
    { key: 'silent-audio-speech', label: '3. Silent audio, then speech' },
    { key: 'audio-beep', label: '4. Audio element: beep' },
    { key: 'web-audio-beep', label: '5. Web Audio: beep' },
    { key: 'playback-web-audio-beep', label: '6. Audio session playback + Web Audio beep' },
    { key: 'dictionary-mp3', label: '7. Dictionary mp3' }
];

function soundTestBodyHtml() {
    const rows = SOUND_TESTS.map(({ key, label }) => `
        <li>
            <button type="button" class="settings-action" data-action="sound-test" data-arg="${key}" data-testid="sound-test-${key}">${label}</button>
            <p class="settings-note" aria-live="polite" data-sound-test-status="${key}" data-testid="sound-test-status-${key}"></p>
        </li>
    `).join('');
    return `
        <p class="settings-note">Temporary: turn on silent mode and tell which buttons you hear.</p>
        <ul class="settings-list">${rows}</ul>
    `;
}

// 16-bit mono PCM WAV of a sine tone as a data URI; frequency 0 gives silence
function toneWavDataUri(frequency, seconds, encodeBase64) {
    const samples = Math.round(SAMPLE_RATE * seconds);
    const dataSize = samples * 2;
    const view = new DataView(new ArrayBuffer(44 + dataSize));
    const writeAscii = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, dataSize, true);
    for (let i = 0; i < samples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / SAMPLE_RATE) * AMPLITUDE * 0x7fff;
        view.setInt16(44 + i * 2, Math.round(sample), true);
    }
    let binary = '';
    new Uint8Array(view.buffer).forEach(byte => { binary += String.fromCharCode(byte); });
    return `data:audio/wav;base64,${encodeBase64(binary)}`;
}

function firstPhoneticAudioUrl(entries) {
    const url = (Array.isArray(entries) ? entries : [])
        .flatMap(entry => entry?.phonetics || [])
        .map(phonetic => phonetic?.audio)
        .find(Boolean);
    if (!url) return null;
    return url.startsWith('//') ? `https:${url}` : url;
}

function errorText(error) {
    return error?.name ? `${error.name}: ${error.message}` : String(error);
}

function createSoundTest(deps = {}) {
    const g = (typeof window !== 'undefined') ? window : globalThis;
    const hasOwn = Object.prototype.hasOwnProperty;
    const pick = (key, fallback) => (hasOwn.call(deps, key) ? deps[key] : fallback);

    const doc = pick('document', g.document ?? null);
    const speech = pick('speechManager', speechManager);
    const synth = pick('speechSynthesis', g.speechSynthesis ?? null);
    const audioSession = pick('audioSession', g.navigator?.audioSession ?? null);
    const createUtterance = pick('createUtterance', text => new g.SpeechSynthesisUtterance(text));
    const createAudio = pick('createAudio', src => new g.Audio(src));
    const createAudioContext = pick('createAudioContext', () => new (g.AudioContext || g.webkitAudioContext)());
    const fetchFn = pick('fetch', (...args) => g.fetch(...args));
    const setTimer = pick('setTimeout', (fn, ms) => setTimeout(fn, ms));
    const encodeBase64 = pick('btoa', text => g.btoa(text));

    const sessionType = () => (audioSession ? String(audioSession.type) : 'no audioSession API');

    function setSessionType(type) {
        if (audioSession) audioSession.type = type;
    }

    function playAudio(src) {
        return Promise.resolve(createAudio(src).play());
    }

    function speakDirect(report, onDone = () => undefined) {
        if (!synth) throw new Error('speechSynthesis unavailable');
        const utterance = createUtterance(TEST_WORD);
        utterance.lang = SPEECH_LANG;
        utterance.onstart = () => report('speaking');
        utterance.onend = () => { onDone(); report('speech ended'); };
        utterance.onerror = (event) => { onDone(); report(`speech error: ${event.error}`); };
        if (synth.speaking || synth.pending) synth.cancel();
        synth.speak(utterance);
        report('speak() called');
    }

    function speakAsNow(report) {
        speech.speakWord(TEST_WORD);
        report(`speakWord called, Sound setting ${speech.speechSettings?.enabled ? 'on' : 'off'}`);
    }

    function speakWithAutoSession(report) {
        let restored = false;
        const restore = () => {
            if (restored) return;
            restored = true;
            setSessionType('playback');
        };
        setSessionType('auto');
        setTimer(restore, RESTORE_SESSION_MS);
        try {
            speakDirect(report, restore);
        } catch (error) {
            restore();
            throw error;
        }
    }

    function silentAudioThenSpeech(report) {
        return playAudio(toneWavDataUri(0, SILENCE_SECONDS, encodeBase64)).then(() => {
            report('silent audio started');
            speakDirect(report);
        });
    }

    function audioElementBeep(report) {
        return playAudio(toneWavDataUri(BEEP_HZ, BEEP_SECONDS, encodeBase64)).then(() => report('started'));
    }

    function webAudioBeep(report) {
        const context = createAudioContext();
        report('resuming audio context');
        return Promise.resolve(context.resume()).then(() => {
            const oscillator = context.createOscillator();
            oscillator.frequency.value = BEEP_HZ;
            oscillator.connect(context.destination);
            oscillator.onended = () => context.close?.();
            oscillator.start(context.currentTime);
            oscillator.stop(context.currentTime + BEEP_SECONDS);
            report(`started, context ${context.state}`);
        });
    }

    function playbackSessionWebAudioBeep(report) {
        setSessionType('playback');
        return webAudioBeep(report);
    }

    async function dictionaryMp3(report) {
        report('fetching');
        let response;
        try {
            response = await fetchFn(DICTIONARY_URL);
        } catch (error) {
            throw new Error(`fetch failed: ${errorText(error)}`);
        }
        if (!response.ok) throw new Error(`fetch failed: HTTP ${response.status}`);
        const url = firstPhoneticAudioUrl(await response.json());
        if (!url) throw new Error('no audio in the dictionary entry');
        await playAudio(url);
        report(`started ${url}`);
    }

    const VARIANTS = {
        'speech': speakAsNow,
        'speech-session-auto': speakWithAutoSession,
        'silent-audio-speech': silentAudioThenSpeech,
        'audio-beep': audioElementBeep,
        'web-audio-beep': webAudioBeep,
        'playback-web-audio-beep': playbackSessionWebAudioBeep,
        'dictionary-mp3': dictionaryMp3
    };

    // Called straight from the click handler: each variant starts its sound synchronously
    // where it can, so iOS sees the user gesture
    function run(key) {
        const variant = VARIANTS[key];
        if (!variant) return Promise.resolve();
        const status = doc?.querySelector(`[data-sound-test-status="${key}"]`);
        const report = (message) => {
            if (status) status.textContent = `${message} · audioSession: ${sessionType()}`;
        };
        try {
            return Promise.resolve(variant(report)).catch(error => report(errorText(error)));
        } catch (error) {
            report(errorText(error));
            return Promise.resolve();
        }
    }

    return { run };
}

module.exports = { SOUND_TESTS, soundTestBodyHtml, toneWavDataUri, firstPhoneticAudioUrl, createSoundTest };
