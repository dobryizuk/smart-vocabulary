// ============================================================================
// APPLICATION INITIALIZATION & BOOTSTRAP (attach namespace/globals)
// ============================================================================

const { downloadFile } = require('./file-download.js');

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
            // 1) Prefer existing SV binding
            let mod = (global.SV && global.SV[name]) || null;
            // 2) Bundled require (esbuild provides module resolution)
            if (!mod && typeof getter === 'function') mod = getter();
            if (mod) global.SV[name] = mod;
        } catch (err) {
            global.SV?.debugLog?.('attach failed for', name, err);
        }
    }

    // Attach commonly used modules (bundled requires)
    attach('UIComponents', () => require('./ui-components.js'));
    attach('DataManager', () => require('./data-manager.js'));
    attach('SpeechManager', () => require('./speech-manager.js'));
    attach('ImportExport', () => require('./import-export.js'));
    attach('Statistics', () => require('./statistics.js'));
    attach('SpacedRepetition', () => require('./spaced-repetition.js'));
    attach('LearningSession', () => require('./learning-session.js'));
    attach('DictionaryService', () => require('./dictionary-service.js'));
    attach('AppMain', () => require('./app-main.js'));
    // Ensure AppState is initialized and available on SV
    attach('AppState', () => {
        require('./app-state.js');
        return (global.SV && global.SV.AppState) ? global.SV.AppState : null;
    });
    // ThemeManager (class); attach via centralized helper
    attach('ThemeManager', () => require('./theme-manager.js'));
    // In bundled environment, all modules are available immediately - no need for ensureCriticalModules
    function ensureCriticalModules() {
        // All modules already attached at bootstrap
    }

    // Create single ThemeManager instance and on-demand theme switcher
    document.addEventListener('DOMContentLoaded', () => {
        ensureCriticalModules();
        try {
            if (!global.SV.themeManager && global.SV.ThemeManager) {
                global.SV.themeManager = new global.SV.ThemeManager();
            }
            // Create theme switcher when stats tab is shown
            const originalShowTab = global.SV?.AppMain?.showTab;
            const patchedShowTab = function(tabName) {
                if (originalShowTab) originalShowTab(tabName);
                if (tabName === 'stats' && global.SV?.themeManager) {
                    global.SV.themeManager.createThemeSwitcher();
                }
            };
            if (global.SV && global.SV.AppMain) {
                global.SV.AppMain.showTab = patchedShowTab;
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
            window.SV?.UIComponents?.createButton?.('📚 Lookup', 'lookup-in-dictionary', 'primary', false, '', '', '', 'dictionary-lookup-btn') +
            window.SV?.UIComponents?.createButton?.('➕ More Fields', 'toggle-additional-fields', 'secondary', false, 'toggleFieldsBtn', '', '', 'toggle-fields-btn'),
            'row',
            'flex-start',
            'center',
            '8px',
            'flex-wrap: wrap;'
        ) || '';
    }
    
    // Initialize save buttons
    const saveButtons = document.getElementById('saveButtons');
    if (saveButtons) {
        saveButtons.innerHTML = window.SV?.UIComponents?.createFlexContainer?.(
            window.SV?.UIComponents?.createButton?.('💾 Save Word', 'add-word', 'primary', false, '', '', '', 'save-word-btn') +
            window.SV?.UIComponents?.createButton?.('🗑️ Clear', 'clear-form', 'secondary'),
            'row',
            'flex-start',
            'center',
            '8px'
        ) || '';
    }
    
    // Initialize audio controls
    const audioControls = document.getElementById('audioControls');
    if (audioControls) {
        audioControls.innerHTML = window.SV?.UIComponents?.createFlexContainer?.(
            window.SV?.UIComponents?.createButton?.('🔊 Sound On', 'toggle-speech', 'success', false, 'speechToggle', 'padding: 8px 12px; font-size: 0.85em;') +
            window.SV?.UIComponents?.createButton?.('🎵 Auto Play On', 'toggle-autoplay', 'success', false, 'autoPlayToggle', 'padding: 8px 12px; font-size: 0.85em;'),
            'row',
            'center',
            'center',
            '8px',
            'margin-bottom: 8px;'
        ) || '';
    }
    
    // Initialize audio settings text
    const audioSettingsText = document.getElementById('audioSettingsText');
    if (audioSettingsText) {
        audioSettingsText.innerHTML = window.SV?.UIComponents?.createSmallText?.('Audio pronunciation settings') || '';
    }
    
    // Initialize data management
    const dataManagement = document.getElementById('dataManagement');
    if (dataManagement) {
        const resetButton = window.SV?.UIComponents?.createButton?.('🗑️ Reset Progress', 'reset-progress', 'warning', false, '', 'padding: 8px 16px; font-size: 0.85em;');
        const exportButton = window.SV?.UIComponents?.createButton?.('Backup', 'backup', 'success', false, '', 'flex: 1; padding: 8px 12px; font-size: 0.85em;', '', 'backup-btn');
        const importButton = window.SV?.UIComponents?.createButton?.('Restore', 'restore', 'primary', false, '', 'flex: 1; padding: 8px 12px; font-size: 0.85em; background: #17a2b8;', '', 'restore-btn');
        
        const importExportButtons = window.SV?.UIComponents?.createFlexContainer?.(
            exportButton + importButton,
            'row',
            'space-between',
            'center',
            '6px'
        ) || '';
        
        const buttonsContainer = window.SV?.UIComponents?.createFlexContainer?.(
            resetButton + importExportButtons,
            'column',
            'flex-start',
            'stretch',
            '6px',
            'margin-bottom: 8px;'
        ) || '';
        
        const infoText = window.SV?.UIComponents?.createSmallText?.(
            'Words are stored locally on device. Progress can be reset if needed.',
            '#666',
            '0.75em',
            'margin: 0;'
        ) || '';
        
        dataManagement.innerHTML = `
            <div style="
                background: var(--color-surface);
                padding: 12px;
                border-radius: 8px;
                text-align: center;
                margin-bottom: 16px;
                border: 1px solid var(--color-border);
            ">
                <h4 style="margin-bottom: 8px; font-size: 1.1em;">Data Management</h4>
                ${buttonsContainer}
                ${infoText}
            </div>
            ${createDiagnosticsHtml()}
        `;
    }
    
    // Initialize theme switcher after data management is created
    if (window.SV?.themeManager) {
        window.SV.themeManager.createThemeSwitcher();
    }
}

function createDiagnosticsHtml() {
    const UI = window.SV?.UIComponents;
    const buttonStyle = 'flex: 1; padding: 8px 12px; font-size: 0.85em;';
    const buttons = UI?.createFlexContainer?.(
        UI.createButton('📝 Logging Off', 'toggle-logging', 'secondary', false, 'logToggle', buttonStyle, '', 'log-toggle-btn') +
        UI.createButton('💾 Save Logs', 'save-logs', 'primary', false, '', buttonStyle, '', 'save-logs-btn'),
        'row',
        'space-between',
        'center',
        '6px',
        'margin-bottom: 8px;'
    ) || '';
    const infoText = UI?.createSmallText?.(
        'Turn logging on, reproduce the problem, then save logs to a file.',
        '#666',
        '0.75em',
        'margin: 0;'
    ) || '';
    return `
        <div style="
            background: var(--color-surface);
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 16px;
            border: 1px solid var(--color-border);
        ">
            <h4 style="margin-bottom: 8px; font-size: 1.1em;">Diagnostics</h4>
            ${buttons}
            ${infoText}
        </div>
    `;
}

function updateLogToggleButton() {
    const btn = document.getElementById('logToggle');
    if (!btn) return;
    const enabled = window.SV?.LogRecorder?.enabled;
    btn.textContent = enabled ? '📝 Logging On' : '📝 Logging Off';
    btn.className = enabled ? 'btn btn--success' : 'btn btn--secondary';
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
                case 'speak-word':
                    window.SV?.SpeechManager?.speakWord?.(arg);
                    break;
                case 'toggle-logging':
                    toggleLogging();
                    break;
                case 'save-logs':
                    saveLogs();
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
                case 'show-translation':
                    window.SV?.LearningSession?.showTranslation?.();
                    break;
                case 'show-hint-reverse':
                    window.SV?.LearningSession?.showHintForReverse?.();
                    break;
                case 'show-answer-reverse':
                    window.SV?.LearningSession?.showAnswerForReverse?.();
                    break;
                case 'show-tab':
                    if (arg) window.SV?.AppMain?.showTab?.(arg);
                    break;
                default:
                    break;
            }
        });
        markBound(container);
    }

    // Lookup button
    const lookupBtn = document.querySelector('[data-testid="dictionary-lookup-btn"]');
    bind(lookupBtn, () => window.SV?.AppMain?.lookupInDictionary?.());

    // Toggle additional fields
    const toggleBtn = document.getElementById('toggleFieldsBtn') || document.querySelector('[data-testid="toggle-fields-btn"]');
    if (toggleBtn && !isBound(toggleBtn)) {
        try { toggleBtn.removeAttribute('onclick'); toggleBtn.onclick = null; } catch (err) { window.SV?.debugLog?.('cleanup inline handler failed:', err); }
        toggleBtn.addEventListener('click', () => {
            window.SV?.AppMain?.toggleAdditionalFields?.();
            const additionalFields = document.getElementById('additionalFields');
            if (additionalFields) {
                additionalFields.style.display = 'block';
            }
        });
        markBound(toggleBtn);
    }

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
    const addTabBtn = document.querySelector('[data-testid="add-tab-btn"]');
    bind(addTabBtn, () => window.SV?.AppMain?.showTab?.('add'));
    const listTabBtn = document.querySelector('[data-testid="list-tab-btn"]');
    bind(listTabBtn, async () => await window.SV?.AppMain?.showTab?.('list'));
    const learnTabBtn = document.querySelector('[data-testid="learn-tab-btn"]');
    bind(learnTabBtn, async () => await window.SV?.AppMain?.showTab?.('learn'));
    const statsTabBtn = document.querySelector('[data-testid="stats-tab-btn"]');
    bind(statsTabBtn, async () => await window.SV?.AppMain?.showTab?.('stats'));

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

async function loadUserDataAndStats() {
    try {
        window.SV?.debugLog?.('📊 Loading user progress...');
        if (window.SV?.DataManager) {
            window.SV.DataManager.userProgress = await window.SV.DataManager.loadUserProgress();
            window.SV?.debugLog?.('✅ User progress loaded:', Object.keys(window.SV.DataManager.userProgress).length, 'entries');
        }
        window.SV?.debugLog?.('📚 Loading word database...');
        await window.SV?.DataManager?.loadWordDatabase?.();
        window.SV?.Statistics?.updateStats?.();
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
    const speechBtn = document.getElementById('speechToggle');
    if (speechBtn) {
        speechBtn.textContent = speechSettings.enabled ? '🔊 Sound On' : '🔇 Sound Off';
        speechBtn.className = speechSettings.enabled ? 'btn btn--success' : 'btn btn--secondary';
    }
    const autoPlayBtn = document.getElementById('autoPlayToggle');
    if (autoPlayBtn) {
        autoPlayBtn.textContent = speechSettings.autoPlay ? '🎵 Auto Play On' : '🔇 Auto Play Off';
        autoPlayBtn.className = speechSettings.autoPlay ? 'btn btn--success' : 'btn btn--secondary';
    }
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

async function bootApp() {
    window.SV?.debugLog?.('🚀 Starting Smart Vocabulary App initialization...');
    initializeComponents();
    wireEventHandlers();
    window.SV?.SpeechManager?.initializeSpeech?.();
    await loadUserDataAndStats();
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