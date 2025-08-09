// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

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
    const englishWordInput = document.getElementById('englishWord');
    const russianTranslationInput = document.getElementById('russianTranslation');
    if (englishWordInput) {
        englishWordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const russianInput = document.getElementById('russianTranslation');
                if (russianInput) russianInput.focus();
            }
        });
    }
    if (russianTranslationInput) {
        russianTranslationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                window.addWord?.();
            }
        });
    }
}

async function bootApp() {
    console.log('🚀 Starting Smart Vocabulary App initialization...');
    initializeComponents();
    initSpeechSettings();
    await loadUserDataAndStats();
    updateSpeechToggleButtons();
    setupEnterKeyBindings();
}

// APPLICATION INITIALIZATION
document.addEventListener('DOMContentLoaded', bootApp);