// ============================================================================
// THEME MANAGER - Light/Dark/System Theme Management
// ============================================================================

class ThemeManager {
    constructor(context) {
        const ctx = context ?? {};
        this.doc = ctx.document ?? (typeof document !== 'undefined' ? document : null);
        this.win = ctx.window ?? (typeof window !== 'undefined' ? window : null);
        this.storage = ctx.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
        this.matchMedia = ctx.matchMedia ?? (this.win && this.win.matchMedia ? this.win.matchMedia.bind(this.win) : null);
        this.navigator = ctx.navigator ?? (typeof navigator !== 'undefined' ? navigator : null);
        this.debugLog = ctx.debugLog ?? (() => undefined);
        this.currentTheme = 'system';
        this.systemTheme = 'dark'; // Default fallback
        this.init();
    }

    init() {
        // Load saved theme preference
        this.loadThemePreference();
        
        // Detect system theme preference
        this.detectSystemTheme();
        
        // Apply initial theme
        this.applyTheme();
        
        // Listen for system theme changes
        this.setupSystemThemeListener();
        
        // Do not create theme switcher here. It will be created centrally
        // by app-init when the stats tab is shown.
    }

    loadThemePreference() {
        try {
            const savedTheme = this.storage ? this.storage.getItem('smart-vocabulary-theme') : null;
            if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
                this.currentTheme = savedTheme;
            }
        } catch (error) {
            console.warn('Failed to load theme preference:', error);
        }
    }

    saveThemePreference() {
        try {
            if (this.storage) this.storage.setItem('smart-vocabulary-theme', this.currentTheme);
        } catch (error) {
            console.warn('Failed to save theme preference:', error);
        }
    }

    detectSystemTheme() {
        if (this.matchMedia) {
            const mediaQuery = this.matchMedia('(prefers-color-scheme: dark)');
            this.systemTheme = mediaQuery.matches ? 'dark' : 'light';
        } else {
            // Fallback for test environments
            this.systemTheme = 'dark';
        }
    }

    setupSystemThemeListener() {
        if (this.matchMedia) {
            const mediaQuery = this.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                this.systemTheme = e.matches ? 'dark' : 'light';
                if (this.currentTheme === 'system') {
                    this.applyTheme();
                }
            });
        }
    }

    getEffectiveTheme() {
        if (this.currentTheme === 'system') {
            return this.systemTheme;
        }
        return this.currentTheme;
    }

    applyTheme() {
        const effectiveTheme = this.getEffectiveTheme();
        if (this.doc && this.doc.documentElement) {
            this.doc.documentElement.setAttribute('data-theme', effectiveTheme);
        }
        
        // Update theme color meta tag for PWA
        const themeColor = effectiveTheme === 'dark' ? '#0F0F0F' : '#FFFFFF';
        if (this.doc) {
            const metaThemeColor = this.doc.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                metaThemeColor.setAttribute('content', themeColor);
            }
        }
        
        // Update manifest theme color if it exists
        this.updateManifestThemeColor(themeColor);
        
        // Trigger custom event for other components
        try {
            if (this.win && typeof this.win.CustomEvent !== 'undefined' && this.win.dispatchEvent) {
                this.win.dispatchEvent(new CustomEvent('themeChanged', {
                    detail: { theme: this.currentTheme, effectiveTheme }
                }));
            }
        } catch (err) {
            this.debugLog('themeChanged dispatch failed:', err);
        }
    }

    updateManifestThemeColor(themeColor) {
        // Update manifest.json theme_color if it exists
        const nav = this.navigator;
        if (nav && 'serviceWorker' in nav && nav.serviceWorker && nav.serviceWorker.controller) {
            nav.serviceWorker.controller.postMessage({
                type: 'UPDATE_THEME_COLOR',
                themeColor
            });
        }
    }

    setTheme(theme) {
        if (!['light', 'dark', 'system'].includes(theme)) {
            console.error('Invalid theme:', theme);
            return;
        }
        
        this.currentTheme = theme;
        this.saveThemePreference();
        this.applyTheme();
        
        // Update UI
        this.updateThemeSwitcherUI();
    }

    toggleTheme() {
        // Toggle strictly between light and dark based on current effective theme
        const nextTheme = this.getEffectiveTheme() === 'light' ? 'dark' : 'light';
        this.setTheme(nextTheme);
    }

    createThemeSwitcher() {
        // Create theme switcher in statistics settings section
        const dataManagement = this.doc ? this.doc.getElementById('dataManagement') : null;
        if (!dataManagement) return;

        // Check if theme switcher already exists
        if (document.getElementById('theme-switcher')) return;

        const themeSwitcher = this.doc ? this.doc.createElement('button') : null;
        themeSwitcher.id = 'theme-switcher';
        themeSwitcher.className = 'btn btn--secondary';
        themeSwitcher.setAttribute('aria-label', 'Toggle theme');
        themeSwitcher.innerHTML = this.getThemeIcon() + ' ' + this.getThemeText();
        
        themeSwitcher.addEventListener('click', () => {
            this.toggleTheme();
        });

        // Add theme switcher to data management section
        const themeSection = this.doc ? this.doc.createElement('div') : null;
        themeSection.className = 'theme-section';
        
        // Create the HTML structure
        themeSection.innerHTML = `
            <h4 style="margin-bottom: 8px; font-size: 1.1em;">Appearance</h4>
            <div style="text-align: center;" id="theme-switcher-container">
            </div>
            <p style="margin: 8px 0 0 0; font-size: 0.75em; color: var(--color-text-secondary);">Choose your preferred theme</p>
        `;

        // Insert theme section before data management
        dataManagement.parentNode.insertBefore(themeSection, dataManagement);
        
        // Add the button with event listener to the container
        const container = themeSection.querySelector('#theme-switcher-container');
        container.appendChild(themeSwitcher);

        this.updateThemeSwitcherUI();
    }

    getThemeIcon() {
        const effectiveTheme = this.getEffectiveTheme();
        const isSystem = this.currentTheme === 'system';
        
        if (isSystem) {
            return '🌓'; // System theme icon
        } else if (effectiveTheme === 'dark') {
            return '🌙'; // Dark theme icon
        } else {
            return '☀️'; // Light theme icon
        }
    }

    getThemeText() {
        const effectiveTheme = this.getEffectiveTheme();
        const isSystem = this.currentTheme === 'system';
        
        if (isSystem) {
            return `System (${effectiveTheme})`;
        } else {
            return effectiveTheme.charAt(0).toUpperCase() + effectiveTheme.slice(1);
        }
    }

    updateThemeSwitcherUI() {
        const themeSwitcher = this.doc ? this.doc.getElementById('theme-switcher') : null;
        if (themeSwitcher) {
            themeSwitcher.innerHTML = this.getThemeIcon() + ' ' + this.getThemeText();
            
            // Update tooltip
            const effectiveTheme = this.getEffectiveTheme();
            const isSystem = this.currentTheme === 'system';
            
            let tooltip = '';
            if (isSystem) {
                tooltip = `System theme (${effectiveTheme})`;
            } else {
                tooltip = `${effectiveTheme.charAt(0).toUpperCase() + effectiveTheme.slice(1)} theme`;
            }
            
            themeSwitcher.setAttribute('title', tooltip);
        }
    }

    // Public API methods
    getCurrentTheme() {
        return this.currentTheme;
    }

    isDarkMode() {
        return this.getEffectiveTheme() === 'dark';
    }

    isLightMode() {
        return this.getEffectiveTheme() === 'light';
    }
}

// Initialize theme manager when DOM is ready
// No self-instantiation here; app-init will create SV.themeManager and hook showTab

// Export for both CommonJS and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}

