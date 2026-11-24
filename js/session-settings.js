// ============================================================================
// SESSION SETTINGS - how many words one learning session holds and what its prompts show
// ============================================================================

const SESSION_SIZE_KEY = 'sessionSize';
const SHOW_DEFINITION_KEY = 'showDefinition';
const MIN_SESSION_SIZE = 10;
const MAX_SESSION_SIZE = 20;
const DEFAULT_SESSION_SIZE = 15;

function clampSessionSize(value) {
    return Math.min(MAX_SESSION_SIZE, Math.max(MIN_SESSION_SIZE, Math.round(value)));
}

function stepSessionSize(current, delta) {
    return clampSessionSize(current + delta);
}

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
        return clampSessionSize(size);
    }

    function setSessionSize(value) {
        const size = Number(value);
        if (!Number.isFinite(size)) return;
        const clamped = clampSessionSize(size);
        try {
            if (store) store.setItem(SESSION_SIZE_KEY, String(clamped));
        } catch (error) {
            console.warn('Failed to save session size:', error);
        }
    }

    function getShowDefinition() {
        try {
            return store ? store.getItem(SHOW_DEFINITION_KEY) === 'true' : false;
        } catch {
            return false;
        }
    }

    function setShowDefinition(value) {
        try {
            if (store) store.setItem(SHOW_DEFINITION_KEY, String(Boolean(value)));
        } catch (error) {
            console.warn('Failed to save the definition preference:', error);
        }
    }

    return { getSessionSize, setSessionSize, getShowDefinition, setShowDefinition };
}

const defaultSettings = createSessionSettings();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultSettings;
    module.exports.createSessionSettings = createSessionSettings;
    module.exports.stepSessionSize = stepSessionSize;
    module.exports.SESSION_SIZE_KEY = SESSION_SIZE_KEY;
    module.exports.SHOW_DEFINITION_KEY = SHOW_DEFINITION_KEY;
    module.exports.MIN_SESSION_SIZE = MIN_SESSION_SIZE;
    module.exports.MAX_SESSION_SIZE = MAX_SESSION_SIZE;
    module.exports.DEFAULT_SESSION_SIZE = DEFAULT_SESSION_SIZE;
}
