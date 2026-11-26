// ============================================================================
// SPEECH SYNTHESIS MANAGEMENT with DI
// ============================================================================

function createSpeechManager(context) {
    const ctx = context ?? {};
    const g = (typeof window !== 'undefined') ? window : globalThis;

    // Unified dependencies (respect explicit nulls in DI)
    const hasOwn = Object.prototype.hasOwnProperty;
    const pick = (key, fallback) => (hasOwn.call(ctx, key) ? ctx[key] : fallback);
    const defaultStorage = typeof localStorage !== 'undefined' ? localStorage : null;
    const defaultDoc = typeof document !== 'undefined' ? document : null;
    const defaultSpeech = typeof g.speechSynthesis !== 'undefined' ? g.speechSynthesis : null;
    const storage = pick('storage', defaultStorage);
    const doc = pick('document', defaultDoc);
    const speech = pick('speech', defaultSpeech);
    const createUtterance = (text) => {
        if (typeof ctx.createUtterance === 'function') return ctx.createUtterance(text);
        if (typeof g.SpeechSynthesisUtterance !== 'undefined') return new g.SpeechSynthesisUtterance(text);
        return null;
    };
    const audioSession = pick('audioSession', g.navigator?.audioSession ?? null);
    const naturalVoice = () => pick('naturalVoice', g.SV?.NaturalVoice ?? null);
    const log = ctx.log || ((...args) => g.SV?.debugLog?.(...args));
    const setTimer = ctx.setTimeout || ((fn, ms) => setTimeout(fn, ms));

    const SPEECH_LANG = 'en-US';
    const START_TIMEOUT_MS = 2000;
    let voicesLogged = false;
    let lastSpeakId = 0;
    const PERSISTED_KEYS = ['enabled', 'autoPlay', 'rate', 'pitch', 'volume'];

    let speechSettings = {
        enabled: true,
        rate: 0.8,
        pitch: 1.0,
        volume: 0.9,
        autoPlay: true
    };

    function loadSavedSettings() {
        if (!storage) return;
        try {
            const saved = JSON.parse(storage.getItem('speechSettings') || '{}');
            PERSISTED_KEYS.forEach(key => {
                if (hasOwn.call(saved, key)) speechSettings[key] = saved[key];
            });
        } catch {
            // Corrupted settings: keep defaults
        }
    }

    function initializeSpeech() {
        loadSavedSettings();
        if (!speech || typeof speech.speak !== 'function') {
            if (typeof console !== 'undefined') console.warn('⚠️ Speech synthesis not supported');
            speechSettings.enabled = false;
            return false;
        }
        usePlaybackAudioSession();
        log('🔊 Speech initialized, settings:', speechSettings);
        return true;
    }

    // "playback" makes iOS treat the page's sound as media, so Silent mode does not mute it
    // (Safari 16.4+ Audio Session API)
    function usePlaybackAudioSession() {
        if (!audioSession) {
            log('🔈 Audio Session API unavailable, Silent mode may mute speech');
            return;
        }
        try {
            audioSession.type = 'playback';
            log('🔈 Audio session type:', audioSession.type);
        } catch (error) {
            if (typeof console !== 'undefined') console.warn('⚠️ Failed to set audio session type:', error);
        }
    }

    function engineState() {
        return { speaking: speech.speaking, pending: speech.pending, paused: speech.paused };
    }

    function logVoicesOnce() {
        if (voicesLogged || typeof speech.getVoices !== 'function') return;
        voicesLogged = true;
        const voices = speech.getVoices() || [];
        const english = voices
            .filter(v => typeof v.lang === 'string' && v.lang.startsWith('en'))
            .map(v => `${v.name} (${v.lang}${v.localService ? ', local' : ''}${v.default ? ', default' : ''})`);
        log('🔊 Voices available:', voices.length, 'english:', english);
    }

    function watchStart(utterance, text) {
        let started = false;
        utterance.onstart = () => {
            started = true;
            log('🔊 Speech started:', text);
        };
        utterance.onend = () => log('🔊 Speech ended:', text);
        setTimer(() => {
            if (!started) log('⚠️ Speech did not start within', START_TIMEOUT_MS, 'ms:', text, engineState());
        }, START_TIMEOUT_MS);
    }

    // Speaks synchronously so iOS Safari sees the call inside the user gesture.
    // No explicit voice: iOS lists voices that are not installed and stays silent with them,
    // so the language is set and the system picks its installed default voice.
    function speakWithSynthesis(text) {
        if (!speech) {
            if (typeof console !== 'undefined') console.warn('⚠️ Speech synthesis not available');
            return;
        }

        const utterance = createUtterance(text);
        if (!utterance) {
            log('⚠️ Speak skipped, SpeechSynthesisUtterance is unavailable');
            return;
        }
        utterance.lang = SPEECH_LANG;
        utterance.rate = speechSettings.rate;
        utterance.pitch = speechSettings.pitch;
        utterance.volume = speechSettings.volume;
        utterance.onerror = (event) => {
            if (typeof console !== 'undefined') console.error('❌ Speech error:', event.error, 'for text:', text);
        };

        logVoicesOnce();
        log('🔊 Speak requested:', text, { lang: utterance.lang, rate: utterance.rate, volume: utterance.volume }, engineState());
        watchStart(utterance, text);

        try {
            if (speech.speaking || speech.pending) speech.cancel();
            speech.speak(utterance);
            log('🔊 speak() called, engine state:', engineState());
        } catch (error) {
            if (typeof console !== 'undefined') console.error('❌ Failed to speak:', error);
        }
    }

    function playClip(voice, text) {
        voice.play(text).catch(() => speakWithSynthesis(text));
    }

    function setSpinner(button, on) {
        if (!button) return;
        if (on) {
            button.dataset.idleHtml = button.innerHTML;
            button.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
        } else {
            button.innerHTML = button.dataset.idleHtml;
            delete button.dataset.idleHtml;
        }
        button.setAttribute('aria-busy', String(on));
    }

    // A missing clip goes first in the queue while the button spins; it plays when ready
    // unless the button is gone or another word was asked for meanwhile
    function waitForClip(voice, text, button) {
        const speakId = lastSpeakId;
        const isCurrent = () => speakId === lastSpeakId && (!button || button.isConnected);
        setSpinner(button, true);
        log('🗣️ Waiting for natural voice clip:', text);
        voice.request(text).then(
            () => { if (isCurrent()) playClip(voice, text); },
            () => { if (isCurrent()) speakWithSynthesis(text); }
        ).finally(() => setSpinner(button, false));
    }

    // Natural voice first: heard in iPhone silent mode; built-in speech only when it is unavailable
    function speakWord(text, button = null) {
        if (!text) return;
        if (!speechSettings.enabled) {
            log('🔇 Speak skipped, sound is off:', text);
            return;
        }
        if (button?.getAttribute('aria-busy') === 'true') return;
        lastSpeakId += 1;
        const voice = naturalVoice();
        if (voice?.hasClip(text)) {
            playClip(voice, text);
            return;
        }
        if (voice?.isAvailable()) {
            waitForClip(voice, text, button);
            return;
        }
        speakWithSynthesis(text);
    }

    function persistAndUpdate(switchId, isOn) {
        const el = doc ? doc.getElementById(switchId) : null;
        if (el) el.setAttribute('aria-checked', String(isOn));
        if (storage) storage.setItem('speechSettings', JSON.stringify(speechSettings));
    }

    function toggleSpeech() {
        speechSettings.enabled = !speechSettings.enabled;
        persistAndUpdate('speechToggle', speechSettings.enabled);
        return speechSettings.enabled;
    }

    function toggleAutoPlay() {
        speechSettings.autoPlay = !speechSettings.autoPlay;
        persistAndUpdate('autoPlayToggle', speechSettings.autoPlay);
        return speechSettings.autoPlay;
    }

    return {
        initializeSpeech,
        speakWord,
        toggleSpeech,
        toggleAutoPlay,
        get speechSettings() { return speechSettings; },
        set speechSettings(value) { speechSettings = value; }
    };
}

function createDefaultSpeechManager() {
    return createSpeechManager({});
}

const defaultSpeechManager = createDefaultSpeechManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultSpeechManager;
    module.exports.createSpeechManager = createSpeechManager;
}