// ============================================================================
// APPLICATION INITIALIZATION & BOOTSTRAP (attach namespace/globals)
// ============================================================================

const { downloadFile } = require('./file-download.js');
const { renderSyncPanel } = require('./sync-panel.js');
const { renderSettingsHtml, updateSessionSizeControl } = require('./settings-view.js');
const { icon } = require('./icons.js');
const sessionSettings = require('./session-settings.js');
const { stepSessionSize } = sessionSettings;

;(function bootstrap(global) {
    // Create namespaced container
    global.SV = global.SV || {};
    // Debug configuration and helper
    global.SV.config = global.SV.config || { debug: false };
    global.SV.LogRecorder = require('./log-recorder.js');
    global.SV.LogRecorder.install(global);
    global.SV.debugLog = function debugLog(...args) {
        global.SV.LogRecorder.record('debug', args);
        if (global.SV.config.debug && typeof console !== 'undefined') console.log(...args);
    };

    // Helper to attach module under SV namespace (bundled environment)
    function attach(name, getter) {
        try {
            global.SV[name] = getter();
        } catch (err) {
            global.SV?.debugLog?.('attach failed for', name, err);
        }
    }

    // Attach commonly used modules (bundled requires)
    attach('UIComponents', () => require('./ui-components.js'));
    attach('VocabularyStore', () => require('./vocabulary-store.js'));
    attach('DataManager', () => require('./data-manager.js'));
    attach('SpeechManager', () => require('./speech-manager.js'));
    attach('ImportExport', () => require('./import-export.js'));
    attach('Statistics', () => require('./statistics.js'));
    attach('SpacedRepetition', () => require('./spaced-repetition.js'));
    attach('SessionSettings', () => require('./session-settings.js'));
    attach('Today', () => require('./today-view.js'));
    attach('LearningSession', () => require('./learning-session.js'));
    attach('DictionaryService', () => require('./dictionary-service.js'));
    attach('SoundTest', () => require('./sound-test.js').createSoundTest());
    attach('AppMain', () => require('./app-main.js'));
    attach('Sync', () => require('./sync.js').createDefaultSync({ onStatus: onSyncStatus, onChange: refreshAfterSync }));
    // Ensure AppState is initialized and available on SV
    attach('AppState', () => {
        require('./app-state.js');
        return (global.SV && global.SV.AppState) ? global.SV.AppState : null;
    });
    // ThemeManager (class); attach via centralized helper
    attach('ThemeManager', () => require('./theme-manager.js'));
    // Create single ThemeManager instance and on-demand theme switcher
    document.addEventListener('DOMContentLoaded', () => {
        try {
            if (!global.SV.themeManager && global.SV.ThemeManager) {
                global.SV.themeManager = new global.SV.ThemeManager();
            }
        } catch (err) {
            global.SV?.debugLog?.('theme switcher init failed:', err);
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);

// PWA SERVICE WORKER REGISTRATION
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            window.SV?.debugLog?.('🔍 Registering service worker from:', window.location.href);
            const registration = await navigator.serviceWorker.register('./sw.js');
            window.SV?.debugLog?.('✅ Service Worker registered:', registration.scope);
            window.SV?.debugLog?.('📍 Current location:', window.location.href);
            window.SV?.debugLog?.('📂 Base URL:', new URL('./', window.location.href).href);
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    });
}

/**
 * Initialize UI components using UIComponents library
 */
function initializeComponents() {
    // Initialize form buttons
    const formButtons = document.getElementById('formButtons');
    if (formButtons) {
        formButtons.innerHTML = window.SV?.UIComponents?.createFlexContainer?.(
            window.SV?.UIComponents?.createButton?.('Lookup', 'lookup-in-dictionary', 'primary', false, '', '', '', 'dictionary-lookup-btn'),
            'row',
            'flex-start',
            'center',
            '8px'
        ) || '';
    }
    
    // Initialize save buttons
    const saveButtons = document.getElementById('saveButtons');
    if (saveButtons) {
        saveButtons.innerHTML = window.SV?.UIComponents?.createButton?.('Save word', 'add-word', 'primary', false, '', '', '', 'save-word-btn') || '';
    }
    
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, 24); });
    initializeSettings();
}

function initializeSettings() {
    const settingsView = document.getElementById('settingsView');
    if (!settingsView) return;
    const sessionSize = sessionSettings.getSessionSize();
    settingsView.innerHTML = renderSettingsHtml({
        sessionSize,
        theme: window.SV?.themeManager?.getCurrentTheme?.() ?? 'system',
        snapshotDate: window.SV?.VocabularyStore?.getSnapshotDate?.()
    });
    updateSessionSizeControl(settingsView, sessionSize);
    setSwitch('showDefinitionToggle', sessionSettings.getShowDefinition());
    updateSyncPanel();
}

function toggleShowDefinition() {
    const show = !sessionSettings.getShowDefinition();
    sessionSettings.setShowDefinition(show);
    setSwitch('showDefinitionToggle', show);
}

function changeSessionSize(delta) {
    const size = stepSessionSize(sessionSettings.getSessionSize(), delta);
    sessionSettings.setSessionSize(size);
    updateSessionSizeControl(document.getElementById('settingsView'), size);
}

function updateSyncPanel() {
    const container = document.getElementById('cloudBackup');
    const sync = window.SV?.Sync;
    if (container && sync) renderSyncPanel(container, sync.getStatus(), sync);
}

function onSyncStatus() {
    updateSyncPanel();
    window.SV?.Statistics?.updateStats?.();
}

// Words changed by a sync: refresh what shows them; a running learning session picks them up as it goes
function refreshAfterSync() {
    window.SV?.Today?.update?.();
    window.SV?.AppMain?.renderWordList?.();
    window.SV?.Statistics?.updateStats?.();
}

function setSwitch(id, isOn) {
    document.getElementById(id)?.setAttribute('aria-checked', String(Boolean(isOn)));
}

function updateLogToggleButton() {
    setSwitch('logToggle', window.SV?.LogRecorder?.enabled);
}

function toggleLogging() {
    window.SV?.LogRecorder?.toggle();
    updateLogToggleButton();
}

function collectEnvironment() {
    const nav = window.navigator || {};
    return {
        savedAt: new Date().toISOString(),
        userAgent: nav.userAgent,
        standalone: Boolean(nav.standalone) || Boolean(window.matchMedia?.('(display-mode: standalone)').matches),
        speechSynthesis: typeof window.speechSynthesis !== 'undefined',
        speechUtterance: typeof window.SpeechSynthesisUtterance !== 'undefined',
        speechSettings: window.SV?.SpeechManager?.speechSettings,
        audioSession: nav.audioSession?.type ?? 'unsupported',
        serviceWorkerControlled: Boolean(nav.serviceWorker?.controller),
        loggingEnabled: window.SV?.LogRecorder?.enabled
    };
}

function saveLogs() {
    const recorder = window.SV?.LogRecorder;
    if (!recorder || recorder.entries.length === 0) {
        window.SV?.AppMain?.showMessage?.('No logs yet. Turn logging on and reproduce the problem first.', 'info');
        return;
    }
    const fileName = `vocabulary-logs-${new Date().toISOString().slice(0, 16).replace(/:/g, '-')}.txt`;
    downloadFile(document, URL, fileName, recorder.toText(collectEnvironment()), 'text/plain');
}

// Incremental step: attach event listeners to key UI controls (avoid inline reliance)
function wireEventHandlers() {
    const markBound = (el) => {
        try {
            Object.defineProperty(el, '__svBound', { value: true, configurable: false });
        } catch (err) {
            window.SV?.debugLog?.('markBound failed:', err);
        }
    };
    const isBound = (el) => el && el.__svBound;
    const bind = (el, handler) => {
        if (!el || isBound(el)) return;
        // Remove any inline handler to avoid global string calls
        try { el.removeAttribute('onclick'); el.onclick = null; } catch (err) { window.SV?.debugLog?.('cleanup inline handler failed:', err); }
        el.addEventListener('click', handler);
        markBound(el);
    };

    // Delegated data-action handler (generic)
    const container = document.body;
    if (container && !isBound(container)) {
        container.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.getAttribute('data-action');
            const arg = el.getAttribute('data-arg');
            // optional stop for word card actions
            if (el.hasAttribute('data-stop-prop')) {
                e.stopPropagation();
            }
            switch (action) {
                case 'edit-word':
                    window.SV?.AppMain?.editWord?.(arg);
                    break;
                case 'delete-word':
                    window.SV?.AppMain?.deleteWord?.(arg);
                    break;
                case 'set-word-filter':
                    window.SV?.AppMain?.setWordListFilter?.(arg);
                    break;
                case 'show-words':
                    window.SV?.AppMain?.showWords?.(arg);
                    break;
                case 'speak-word':
                    window.SV?.SpeechManager?.speakWord?.(arg);
                    break;
                case 'speak-original-word':
                    window.SV?.AppMain?.speakOriginalWord?.();
                    break;
                case 'clear-form':
                    window.SV?.AppMain?.resetForm?.();
                    break;
                case 'open-settings':
                    window.SV?.AppMain?.showStatsView?.('settings');
                    break;
                case 'close-settings':
                    window.SV?.AppMain?.showStatsView?.('progress');
                    break;
                case 'session-size-step':
                    changeSessionSize(Number(arg));
                    break;
                case 'toggle-show-definition':
                    toggleShowDefinition();
                    break;
                case 'set-theme':
                    window.SV?.themeManager?.setTheme?.(arg);
                    break;
                case 'undo-restore':
                    window.SV?.ImportExport?.restoreSnapshot?.();
                    break;
                case 'toggle-logging':
                    toggleLogging();
                    break;
                case 'save-logs':
                    saveLogs();
                    break;
                case 'sound-test':
                    window.SV?.SoundTest?.run?.(arg);
                    break;
                case 'sound-test-clear':
                    window.SV?.SoundTest?.clearModels?.();
                    break;
                case 'toggle-card': {
                    const id = el.getAttribute('data-target-id');
                    window.SV?.UIComponents?.toggleWordCard?.(id);
                    break;
                }
                case 'force-start-learning':
                    window.SV?.LearningSession?.forceStartLearning?.();
                    break;
                case 'start-learning':
                    window.SV?.LearningSession?.startLearning?.();
                    break;
                case 'stop-session':
                    window.SV?.LearningSession?.stopLearningSession?.();
                    break;
                case 'show-translation':
                    window.SV?.LearningSession?.showTranslation?.();
                    break;
                case 'show-hint-reverse':
                    window.SV?.LearningSession?.showHintForReverse?.();
                    break;
                case 'check-reverse':
                    window.SV?.LearningSession?.checkReverseTranslation?.();
                    break;
                case 'build-place':
                    window.SV?.LearningSession?.placeBuildLetter?.(arg);
                    break;
                case 'build-undo':
                    window.SV?.LearningSession?.undoBuildLetter?.();
                    break;
                case 'build-check':
                    window.SV?.LearningSession?.checkBuildAnswer?.();
                    break;
                case 'show-tab':
                    if (arg) window.SV?.AppMain?.showTab?.(arg);
                    break;
                default:
                    break;
            }
        });
        container.addEventListener('input', (e) => {
            if (e.target.closest?.('#add-tab')) window.SV?.AppMain?.updateFormControls?.();
        });
        // Enter in a field presses the button the field names in data-enter-button
        container.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.isComposing) return;
            const buttonId = e.target.getAttribute?.('data-enter-button');
            if (buttonId) document.getElementById(buttonId)?.click();
        });
        markBound(container);
    }

    // Lookup button
    const lookupBtn = document.querySelector('[data-testid="dictionary-lookup-btn"]');
    bind(lookupBtn, () => window.SV?.AppMain?.lookupInDictionary?.());

    // Save word
    const saveBtn = document.querySelector('[data-testid="save-word-btn"]');
    bind(saveBtn, () => window.SV?.AppMain?.addWord?.());

    // Import/Export (kept as direct binds for safety if data-action missing)
    const backupBtn = document.querySelector('[data-testid="backup-btn"]');
    bind(backupBtn, () => window.SV?.ImportExport?.exportData?.());
    const restoreBtn = document.querySelector('[data-testid="restore-btn"]');
    bind(restoreBtn, () => window.SV?.ImportExport?.importData?.());

    // Speech toggles (redundant bindings kept for compatibility)
    const speechToggle = document.getElementById('speechToggle');
    bind(speechToggle, () => window.SV?.SpeechManager?.toggleSpeech?.());
    const autoPlayToggle = document.getElementById('autoPlayToggle');
    bind(autoPlayToggle, () => window.SV?.SpeechManager?.toggleAutoPlay?.());

    // Tabs
    const todayTabBtn = document.querySelector('[data-testid="today-tab-btn"]');
    bind(todayTabBtn, () => window.SV?.AppMain?.showTab?.('today'));
    const listTabBtn = document.querySelector('[data-testid="list-tab-btn"]');
    bind(listTabBtn, () => window.SV?.AppMain?.showTab?.('list'));
    const addTabBtn = document.querySelector('[data-testid="add-tab-btn"]');
    bind(addTabBtn, () => window.SV?.AppMain?.showTab?.('add'));
    const statsTabBtn = document.querySelector('[data-testid="stats-tab-btn"]');
    bind(statsTabBtn, () => window.SV?.AppMain?.showTab?.('stats'));

    // Difficulty buttons delegation
    const learningContent = document.getElementById('learningContent');
    if (learningContent && !isBound(learningContent)) {
        learningContent.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('.difficulty-btn');
            if (!btn) return;
            const difficulty = btn.getAttribute('data-difficulty');
            if (difficulty) {
                e.preventDefault();
                window.SV?.LearningSession?.markDifficulty?.(difficulty);
            }
        });
        markBound(learningContent);
    }
}

function loadUserDataAndStats() {
    try {
        window.SV?.debugLog?.('📚 Loading word database...');
        window.SV?.DataManager?.initializeVocabulary?.();
        window.SV?.Statistics?.updateStats?.();
        window.SV?.Today?.showOverview?.();
        window.SV?.debugLog?.('✅ App initialization complete!');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        // Show a global toast only; no inline fallback blocks
        window.SV?.AppMain?.showMessage?.(`Initialization failed: ${error.message}`, 'error');
    }
}

function updateSpeechToggleButtons() {
    const speechSettings = window.SV?.SpeechManager?.speechSettings;
    if (!speechSettings) return;
    setSwitch('speechToggle', speechSettings.enabled);
    setSwitch('autoPlayToggle', speechSettings.autoPlay);
}

function setupEnterKeyBindings() {
    const originalWordInput = document.getElementById('originalWord');
    const translationInput = document.getElementById('translation');
    if (originalWordInput) {
        originalWordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const translationInputEl = document.getElementById('translation');
                if (translationInputEl) translationInputEl.focus();
            }
        });
    }
    if (translationInput) {
        translationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                window.SV?.AppMain?.addWord?.();
            }
        });
    }
}

function requestPersistentStorage() {
    try {
        navigator.storage?.persist?.()?.catch?.(() => undefined);
    } catch (err) {
        window.SV?.debugLog?.('persist request failed:', err);
    }
}

function bootApp() {
    window.SV?.debugLog?.('🚀 Starting Smart Vocabulary App initialization...');
    requestPersistentStorage();
    initializeComponents();
    wireEventHandlers();
    window.SV?.SpeechManager?.initializeSpeech?.();
    loadUserDataAndStats();
    window.SV?.Sync?.start?.();
    updateSpeechToggleButtons();
    updateLogToggleButton();
    setupEnterKeyBindings();
}

// APPLICATION INITIALIZATION
document.addEventListener('DOMContentLoaded', bootApp);

// Expose helpers for tests and non-inline bootstraps
try {
    window.initializeComponents = initializeComponents;
    window.wireEventHandlers = wireEventHandlers;
    window.bootApp = bootApp;
} catch (err) {
    window.SV?.debugLog?.('Expose helpers failed:', err);
}