// ============================================================================
// LOG RECORDER: opt-in diagnostic log kept in storage so it survives reloads
// ============================================================================

const ENABLED_KEY = 'logRecordingEnabled';
const ENTRIES_KEY = 'logRecordingEntries';
const DEFAULT_MAX_ENTRIES = 1000;

function formatArg(arg) {
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    if (typeof arg === 'string') return arg;
    try {
        return JSON.stringify(arg);
    } catch {
        return String(arg);
    }
}

function createLogRecorder(context) {
    const ctx = context || {};
    const storage = ctx.storage || null;
    const now = ctx.now || (() => new Date());
    const maxEntries = ctx.maxEntries || DEFAULT_MAX_ENTRIES;

    let enabled = readItem(ENABLED_KEY) === 'true';
    let entries = loadEntries();

    function readItem(key) {
        try {
            return storage ? storage.getItem(key) : null;
        } catch {
            return null;
        }
    }

    function loadEntries() {
        try {
            const parsed = JSON.parse(readItem(ENTRIES_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveEntries() {
        try {
            storage?.setItem(ENTRIES_KEY, JSON.stringify(entries));
        } catch {
            // Storage full: drop the oldest half and keep recording in memory
            entries = entries.slice(Math.floor(entries.length / 2));
        }
    }

    function record(level, args) {
        if (!enabled) return;
        entries.push({ time: now().toISOString(), level, message: args.map(formatArg).join(' ') });
        if (entries.length > maxEntries) entries = entries.slice(entries.length - maxEntries);
        saveEntries();
    }

    function setEnabled(value) {
        enabled = Boolean(value);
        try {
            storage?.setItem(ENABLED_KEY, String(enabled));
        } catch {
            // Storage unavailable: the setting lasts for this session only
        }
        if (enabled) {
            entries = [];
            saveEntries();
            record('info', ['Logging started']);
        }
        return enabled;
    }

    function toggle() {
        return setEnabled(!enabled);
    }

    function toText(environment = {}) {
        const header = Object.entries(environment).map(([key, value]) => `${key}: ${formatArg(value)}`);
        const lines = entries.map(e => `${e.time} [${e.level}] ${e.message}`);
        return [...header, '', ...lines].join('\n');
    }

    // Mirrors console warnings/errors and uncaught errors into the log
    function install(target) {
        const cons = target.console;
        ['warn', 'error'].forEach(level => {
            const original = cons[level].bind(cons);
            cons[level] = (...args) => {
                record(level, args);
                original(...args);
            };
        });
        target.addEventListener?.('error', (event) => {
            record('error', ['Uncaught:', event.message, `${event.filename}:${event.lineno}`]);
        });
        target.addEventListener?.('unhandledrejection', (event) => {
            record('error', ['Unhandled rejection:', event.reason]);
        });
    }

    return {
        record,
        setEnabled,
        toggle,
        toText,
        install,
        get enabled() { return enabled; },
        get entries() { return entries.slice(); }
    };
}

const defaultLogRecorder = createLogRecorder({
    storage: (typeof localStorage !== 'undefined' ? localStorage : null)
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = defaultLogRecorder;
    module.exports.createLogRecorder = createLogRecorder;
}
