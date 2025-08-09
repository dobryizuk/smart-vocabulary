// ============================================================================
// THEME MANAGER - Light/Dark/System Theme Management
// ============================================================================

class ThemeManager {
    constructor() {
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
        
        // Create theme switcher UI
        this.createThemeSwitcher();
    }

    loadThemePreference() {
        try {
            const savedTheme = localStorage.getItem('smart-vocabulary-theme');
            if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
                this.currentTheme = savedTheme;
            }
        } catch (error) {
            console.warn('Failed to load theme preference:', error);
        }
    }

    saveThemePreference() {
        try {
            localStorage.setItem('smart-vocabulary-theme', this.currentTheme);
        } catch (error) {
            console.warn('Failed to save theme preference:', error);
        }
    }

    detectSystemTheme() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.systemTheme = mediaQuery.matches ? 'dark' : 'light';
        } else {
            // Fallback for test environments
            this.systemTheme = 'dark';
        }
    }

    setupSystemThemeListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
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
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        
        // Update theme color meta tag for PWA
        const themeColor = effectiveTheme === 'dark' ? '#0F0F0F' : '#FFFFFF';
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', themeColor);
        }
        
        // Update manifest theme color if it exists
        this.updateManifestThemeColor(themeColor);
        
        // Trigger custom event for other components
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: this.currentTheme, effectiveTheme }
        }));
    }

    updateManifestThemeColor(themeColor) {
        // Update manifest.json theme_color if it exists
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
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
        const dataManagement = document.getElementById('dataManagement');
        if (!dataManagement) return;

        // Check if theme switcher already exists
        if (document.getElementById('theme-switcher')) return;

        const themeSwitcher = document.createElement('button');
        themeSwitcher.id = 'theme-switcher';
        themeSwitcher.className = 'btn btn--secondary';
        themeSwitcher.setAttribute('aria-label', 'Toggle theme');
        themeSwitcher.innerHTML = this.getThemeIcon() + ' ' + this.getThemeText();
        
        themeSwitcher.addEventListener('click', () => {
            this.toggleTheme();
        });

        // Add theme switcher to data management section
        const themeSection = document.createElement('div');
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
        const themeSwitcher = document.getElementById('theme-switcher');
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
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    
    // Create theme switcher after a short delay to ensure other components are initialized
    setTimeout(() => {
        if (window.themeManager) {
            window.themeManager.createThemeSwitcher();
        }
    }, 100);
    
    // Also try to create theme switcher when stats tab is shown
    const originalShowTab = window.showTab;
    window.showTab = function(tabName) {
        if (originalShowTab) {
            originalShowTab(tabName);
        }
        
        // Create theme switcher when stats tab is shown
        if (tabName === 'stats' && window.themeManager) {
            setTimeout(() => {
                window.themeManager.createThemeSwitcher();
            }, 50);
        }
    };
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}

// Export to global scope for tests
window.ThemeManager = ThemeManager;
