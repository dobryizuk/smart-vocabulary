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
        
        this.updateThemeControl();
    }

    updateThemeControl() {
        if (!this.doc) return;
        this.doc.querySelectorAll('[data-action="set-theme"]').forEach(option => {
            option.setAttribute('aria-pressed', String(option.getAttribute('data-arg') === this.currentTheme));
        });
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

// Export for both CommonJS and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}

