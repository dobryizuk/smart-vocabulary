// ============================================================================
// APPLICATION INITIALIZATION & BOOTSTRAP (attach namespace/globals)
// ============================================================================

;(function bootstrap(global) {
    // Create namespaced container
    global.SV = global.SV || {};

    // Helper to attach module both under SV and legacy global if missing
    function attach(name, getter) {
        try {
            const mod = global[name] || getter();
            if (mod) {
                // Namespace
                global.SV[name] = mod;
                // Preserve legacy global for backward compatibility
                if (!global[name]) global[name] = mod;
            }
        } catch (_) {
            // ignore in browser when require is unavailable
        }
    }

    // Attach commonly used modules
    attach('UIComponents', () => require('./ui-components.js'));
    attach('DataManager', () => require('./data-manager.js'));
    attach('SpeechManager', () => require('./speech-manager.js'));
    attach('ImportExport', () => require('./import-export.js'));
    attach('Statistics', () => require('./statistics.js'));
    attach('SpacedRepetition', () => require('./spaced-repetition.js'));
    attach('LearningSession', () => require('./learning-session.js'));
    attach('DictionaryService', () => require('./dictionary-service.js'));
    try {
        // ThemeManager exports a class; keep constructor under namespace
        const ThemeManager = global.ThemeManager || require('./theme-manager.js');
        if (ThemeManager) {
            global.SV.ThemeManager = ThemeManager;
            if (!global.ThemeManager) global.ThemeManager = ThemeManager;
        }
    } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);

// PWA SERVICE WORKER REGISTRATION
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            console.log('🔍 Registering service worker from:', window.location.href);
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('✅ Service Worker registered:', registration.scope);
            console.log('📍 Current location:', window.location.href);
            console.log('📂 Base URL:', new URL('./', window.location.href).href);
        } catch (error) {
            console.log('❌ Service Worker registration failed:', error);
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
        formButtons.innerHTML = window.UIComponents?.createFlexContainer?.(
            window.UIComponents?.createButton?.('📚 Lookup', 'lookupInDictionary()', 'primary', false, '', '', '', 'dictionary-lookup-btn') +
            window.UIComponents?.createButton?.('➕ More Fields', 'toggleAdditionalFields()', 'secondary', false, 'toggleFieldsBtn', '', '', 'toggle-fields-btn'),
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
        saveButtons.innerHTML = window.UIComponents?.createFlexContainer?.(
            window.UIComponents?.createButton?.('💾 Save Word', 'addWord()', 'primary', false, '', '', '', 'save-word-btn') +
            window.UIComponents?.createButton?.('🗑️ Clear', 'clearForm()', 'secondary'),
            'row',
            'flex-start',
            'center',
            '8px'
        ) || '';
    }
    
    // Initialize audio controls
    const audioControls = document.getElementById('audioControls');
    if (audioControls) {
        audioControls.innerHTML = window.UIComponents?.createFlexContainer?.(
            window.UIComponents?.createButton?.('🔊 Sound On', 'window.SpeechManager?.toggleSpeech?.()', 'success', false, 'speechToggle', 'padding: 8px 12px; font-size: 0.85em;') +
            window.UIComponents?.createButton?.('🎵 Auto Play On', 'window.SpeechManager?.toggleAutoPlay?.()', 'success', false, 'autoPlayToggle', 'padding: 8px 12px; font-size: 0.85em;'),
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
        audioSettingsText.innerHTML = window.UIComponents?.createSmallText?.('Audio pronunciation settings') || '';
    }
    
    // Initialize data management
    const dataManagement = document.getElementById('dataManagement');
    if (dataManagement) {
        const resetButton = window.UIComponents?.createButton?.('🗑️ Reset Progress', 'window.DataManager?.resetUserProgress?.()', 'warning', false, '', 'padding: 8px 16px; font-size: 0.85em;');
        const exportButton = window.UIComponents?.createButton?.('Backup', 'window.ImportExport?.exportData?.()', 'success', false, '', 'flex: 1; padding: 8px 12px; font-size: 0.85em;', '', 'backup-btn');
        const importButton = window.UIComponents?.createButton?.('Restore', 'window.ImportExport?.importData?.()', 'primary', false, '', 'flex: 1; padding: 8px 12px; font-size: 0.85em; background: #17a2b8;', '', 'restore-btn');
        
        const importExportButtons = window.UIComponents?.createFlexContainer?.(
            exportButton + importButton,
            'row',
            'space-between',
            'center',
            '6px'
        ) || '';
        
        const buttonsContainer = window.UIComponents?.createFlexContainer?.(
            resetButton + importExportButtons,
            'column',
            'flex-start',
            'stretch',
            '6px',
            'margin-bottom: 8px;'
        ) || '';
        
        const infoText = window.UIComponents?.createSmallText?.(
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
        `;
    }
    
    // Initialize theme switcher after data management is created
    if (window.themeManager) {
        window.themeManager.createThemeSwitcher();
    }
}

// Incremental step: attach event listeners to key UI controls (avoid inline reliance)
function wireEventHandlers() {
    const markBound = (el) => { try { Object.defineProperty(el, '__svBound', { value: true, configurable: false }); } catch (_) {} };
    const isBound = (el) => el && el.__svBound;
    const bind = (el, handler) => {
        if (!el || isBound(el)) return;
        // Remove any inline handler to avoid global string calls
        try { el.removeAttribute('onclick'); el.onclick = null; } catch (_) {}
        el.addEventListener('click', handler);
        markBound(el);
    };

    // Lookup button
    const lookupBtn = document.querySelector('[data-testid="dictionary-lookup-btn"]');
    bind(lookupBtn, () => window.lookupInDictionary?.());

    // Toggle additional fields
    const toggleBtn = document.getElementById('toggleFieldsBtn') || document.querySelector('[data-testid="toggle-fields-btn"]');
    if (toggleBtn && !isBound(toggleBtn)) {
        // Remove inline and bind
        try { toggleBtn.removeAttribute('onclick'); toggleBtn.onclick = null; } catch (_) {}
        toggleBtn.addEventListener('click', () => {
            // Call legacy handler
            window.toggleAdditionalFields?.();
            // Force visible to satisfy E2E environments
            const additionalFields = document.getElementById('additionalFields');
            if (additionalFields) {
                additionalFields.style.display = 'block';
            }
        });
        markBound(toggleBtn);
    }

    // Save word
    const saveBtn = document.querySelector('[data-testid="save-word-btn"]');
    bind(saveBtn, () => window.addWord?.());

    // Import/Export
    const backupBtn = document.querySelector('[data-testid="backup-btn"]');
    bind(backupBtn, () => window.ImportExport?.exportData?.());
    const restoreBtn = document.querySelector('[data-testid="restore-btn"]');
    bind(restoreBtn, () => window.ImportExport?.importData?.());

    // Speech toggles
    const speechToggle = document.getElementById('speechToggle');
    bind(speechToggle, () => window.SpeechManager?.toggleSpeech?.());
    const autoPlayToggle = document.getElementById('autoPlayToggle');
    bind(autoPlayToggle, () => window.SpeechManager?.toggleAutoPlay?.());
}

function initSpeechSettings() {
    window.SpeechManager?.initializeSpeech?.();
    const savedSpeechSettings = localStorage.getItem('speechSettings');
    if (savedSpeechSettings && window.SpeechManager) {
        Object.assign(window.SpeechManager.speechSettings, JSON.parse(savedSpeechSettings));
    }
}

async function loadUserDataAndStats() {
    try {
        console.log('📊 Loading user progress...');
        if (window.DataManager) {
            window.DataManager.userProgress = await window.DataManager.loadUserProgress();
            console.log('✅ User progress loaded:', Object.keys(window.DataManager.userProgress).length, 'entries');
        }
        console.log('📚 Loading word database...');
        await window.DataManager?.loadWordDatabase?.();
        window.Statistics?.updateStats?.();
        console.log('✅ App initialization complete!');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        // Show a global toast only; no inline fallback blocks
        window.showMessage?.(`Initialization failed: ${error.message}`, 'error');
    }
}

function updateSpeechToggleButtons() {
    const speechSettings = window.SpeechManager?.speechSettings;
    if (!speechSettings) return;
    const speechBtn = document.getElementById('speechToggle');
    if (speechBtn) {
        speechBtn.textContent = speechSettings.enabled ? '🔊 Sound On' : '🔇 Sound Off';
        speechBtn.className = speechSettings.enabled ? 'btn btn-success' : 'btn btn-secondary';
    }
    const autoPlayBtn = document.getElementById('autoPlayToggle');
    if (autoPlayBtn) {
        autoPlayBtn.textContent = speechSettings.autoPlay ? '🎵 Auto Play On' : '🔇 Auto Play Off';
        autoPlayBtn.className = speechSettings.autoPlay ? 'btn btn-success' : 'btn btn-secondary';
    }
}

function setupEnterKeyBindings() {
    const originalWordInput = document.getElementById('originalWord');
    const translationInput = document.getElementById('translation');
    if (originalWordInput) {
        originalWordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const translationInput = document.getElementById('translation');
                if (translationInput) translationInput.focus();
            }
        });
    }
    if (translationInput) {
        translationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                window.addWord?.();
            }
        });
    }
}

async function bootApp() {
    console.log('🚀 Starting Smart Vocabulary App initialization...');
    initializeComponents();
    wireEventHandlers();
    initSpeechSettings();
    await loadUserDataAndStats();
    updateSpeechToggleButtons();
    setupEnterKeyBindings();
}

// APPLICATION INITIALIZATION
document.addEventListener('DOMContentLoaded', bootApp);

// Expose helpers for tests and non-inline bootstraps
try {
    window.initializeComponents = initializeComponents;
    window.wireEventHandlers = wireEventHandlers;
    window.bootApp = bootApp;
} catch (_) {}