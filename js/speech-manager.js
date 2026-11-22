// ============================================================================
// SPEECH SYNTHESIS MANAGEMENT with DI
// ============================================================================

function createSpeechManager(context) {
    const ctx = context ?? {};
    const g = (typeof window !== 'undefined') ? window : globalThis;

    // Unified dependencies (respect explicit nulls in DI)
    const hasOwn = Object.prototype.hasOwnProperty;
    const storage = hasOwn.call(ctx, 'storage') ? ctx.storage : (typeof localStorage !== 'undefined' ? localStorage : null);
    const doc = hasOwn.call(ctx, 'document') ? ctx.document : (typeof document !== 'undefined' ? document : null);
    const speech = hasOwn.call(ctx, 'speech') ? ctx.speech : (typeof g.speechSynthesis !== 'undefined' ? g.speechSynthesis : null);
    const createUtterance = (text) => {
        if (typeof ctx.createUtterance === 'function') return ctx.createUtterance(text);
        if (typeof g.SpeechSynthesisUtterance !== 'undefined') return new g.SpeechSynthesisUtterance(text);
        return null;
    };

    const SPEECH_LANG = 'en-US';
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
        return true;
    }

    // Speaks synchronously so iOS Safari sees the call inside the user gesture.
    // No explicit voice: iOS lists voices that are not installed and stays silent with them,
    // so the language is set and the system picks its installed default voice.
    function speakWord(text, options = {}) {
        if (!speechSettings.enabled || !text) return;
        if (!speech) {
            if (typeof console !== 'undefined') console.warn('⚠️ Speech synthesis not available');
            return;
        }

        const utterance = createUtterance(text);
        if (!utterance) return;
        utterance.lang = SPEECH_LANG;
        utterance.rate = options.rate || speechSettings.rate;
        utterance.pitch = options.pitch || speechSettings.pitch;
        utterance.volume = options.volume || speechSettings.volume;
        utterance.onerror = (event) => {
            if (typeof console !== 'undefined') console.error('❌ Speech error:', event.error, 'for text:', text);
        };

        try {
            if (speech.speaking || speech.pending) speech.cancel();
            speech.speak(utterance);
        } catch (error) {
            if (typeof console !== 'undefined') console.error('❌ Failed to speak:', error);
        }
    }

    function persistAndUpdate(btnId, isOn, onText, offText) {
        const el = doc ? doc.getElementById(btnId) : null;
        if (el) {
            el.textContent = isOn ? onText : offText;
            el.className = isOn ? 'btn btn-success' : 'btn btn-secondary';
        }
        if (storage) storage.setItem('speechSettings', JSON.stringify(speechSettings));
    }

    function toggleSpeech() {
        speechSettings.enabled = !speechSettings.enabled;
        persistAndUpdate('speechToggle', speechSettings.enabled, '🔊 Sound On', '🔇 Sound Off');
        return speechSettings.enabled;
    }

    function toggleAutoPlay() {
        speechSettings.autoPlay = !speechSettings.autoPlay;
        persistAndUpdate('autoPlayToggle', speechSettings.autoPlay, '🎵 Auto Play On', '🔇 Auto Play Off');
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