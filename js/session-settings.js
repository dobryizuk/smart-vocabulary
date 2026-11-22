// ============================================================================
// SESSION SETTINGS - how many words one learning session holds
// ============================================================================

const SESSION_SIZE_KEY = 'sessionSize';
const MIN_SESSION_SIZE = 10;
const MAX_SESSION_SIZE = 20;
const DEFAULT_SESSION_SIZE = 15;

function createSessionSettings({ storage } = {}) {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);

    function getSessionSize() {
        let raw = null;
        try {
            raw = store ? store.getItem(SESSION_SIZE_KEY) : null;
        } catch {
            return DEFAULT_SESSION_SIZE;
        }
        const size = Number(raw);
        if (raw === null || raw === '' || !Number.isFinite(size)) return DEFAULT_SESSION_SIZE;
        return Math.min(MAX_SESSION_SIZE, Math.max(MIN_SESSION_SIZE, Math.round(size)));
    }

    function setSessionSize(value) {
        const size = Number(value);
        if (!Number.isFinite(size)) return;
        const clamped = Math.min(MAX_SESSION_SIZE, Math.max(MIN_SESSION_SIZE, Math.round(size)));
        try {
            if (store) store.setItem(SESSION_SIZE_KEY, String(clamped));
        } catch (error) {
            console.warn('Failed to save session size:', error);
        }
    }

    return { getSessionSize, setSessionSize };
}

const defaultSettings = createSessionSettings();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultSettings;
    module.exports.createSessionSettings = createSessionSettings;
    module.exports.SESSION_SIZE_KEY = SESSION_SIZE_KEY;
    module.exports.DEFAULT_SESSION_SIZE = DEFAULT_SESSION_SIZE;
}
