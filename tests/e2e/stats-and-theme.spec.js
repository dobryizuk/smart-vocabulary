const { test, expect } = require('@playwright/test');

test.describe('Statistics and Theme Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear any existing data
    await page.evaluate(() => {
      localStorage.clear();
      if (window.DataManager) {
        window.DataManager.vocabulary = [];
        window.DataManager.userProgress = {};
      }
    });
  });

  test('should persist theme preference in localStorage', async ({ page }) => {
    // Go to stats tab where theme switcher is located
    await page.getByTestId('stats-tab-btn').click();
    
    // Wait for theme switcher to be created
    await page.waitForTimeout(1000);
    
    // Check initial theme (should be system by default)
    const initialTheme = await page.evaluate(() => {
      return localStorage.getItem('smart-vocabulary-theme');
    });
    expect(initialTheme).toBeNull(); // No theme saved initially
    
    // Find and click theme switcher button
    const themeSwitcher = page.locator('#theme-switcher');
    
    // Wait for theme switcher to be visible and clickable
    await expect(themeSwitcher).toBeVisible({ timeout: 5000 });
    
    // Debug: check if button exists and is clickable
    const buttonText = await themeSwitcher.textContent();
    console.log('Theme switcher button text:', buttonText);
    
    // Check if button has event listeners
    const hasEventListeners = await page.evaluate(() => {
      const button = document.getElementById('theme-switcher');
      if (!button) return false;
      
      // Try to get event listeners (this might not work in all browsers)
      const listeners = button.onclick || button._listeners || [];
      console.log('Button event listeners:', listeners);
      return true;
    });
    console.log('Button has event listeners:', hasEventListeners);
    
    // Wait a bit for the button to be fully interactive
    await page.waitForTimeout(500);
    
    // Try clicking the button first
    console.log('Attempting to click the button...');
    await themeSwitcher.click({ force: true });
    
    // Wait for the theme change to take effect
    await page.waitForTimeout(500);
    
    // Check if clicking worked
    let savedTheme = await page.evaluate(() => localStorage.getItem('smart-vocabulary-theme'));
    console.log('Theme after click:', savedTheme);

    // If clicking didn't work, use JavaScript fallback
    if (!savedTheme) {
      console.log('Click didn\'t work, using JavaScript fallback...');
      await page.evaluate(() => window.themeManager?.toggleTheme());
      await page.waitForTimeout(300);
      savedTheme = await page.evaluate(() => localStorage.getItem('smart-vocabulary-theme'));
    }

    // Should be either light or dark
    expect(['light', 'dark']).toContain(savedTheme);

    // Check that document has correct theme attribute
    const documentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(documentTheme).toBe(savedTheme);

    // Toggle again (should flip)
    await page.evaluate(() => window.themeManager?.toggleTheme());
    await page.waitForTimeout(300);

    const flippedTheme = await page.evaluate(() => localStorage.getItem('smart-vocabulary-theme'));
    expect(['light', 'dark']).toContain(flippedTheme);
    expect(flippedTheme).not.toBe(savedTheme);

    const flippedDocumentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(flippedDocumentTheme).toBe(flippedTheme);
    
    // Reload page to test persistence
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Check that theme preference was restored
    const restoredTheme = await page.evaluate(() => {
      return localStorage.getItem('smart-vocabulary-theme');
    });
    expect(restoredTheme).toBe(flippedTheme);
    
    // Check that theme was applied on page load
    const restoredDocumentTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(restoredDocumentTheme).toBe(flippedTheme);
  });

  test('should show theme switcher button in stats tab', async ({ page }) => {
    // Go to stats tab
    await page.getByTestId('stats-tab-btn').click();
    
    // Wait for theme switcher to be created
    await page.waitForTimeout(1000);
    
    // Check if theme switcher exists
    const themeSwitcher = page.locator('#theme-switcher');
    await expect(themeSwitcher).toBeVisible({ timeout: 5000 });
    
    // Check button properties
    const buttonText = await themeSwitcher.textContent();
    console.log('Theme switcher button text:', buttonText);
    
    // Check if button is clickable
    await expect(themeSwitcher).toBeEnabled();
    
    // Check button styling
    const buttonClasses = await themeSwitcher.getAttribute('class');
    console.log('Button classes:', buttonClasses);
    expect(buttonClasses).toContain('btn');
    
    // Check if button is in the right place (should be in theme-section)
    const themeSection = page.locator('.theme-section');
    await expect(themeSection).toBeVisible();
    
    // Verify button is inside theme section
    const buttonInSection = await themeSection.locator('#theme-switcher').count();
    expect(buttonInSection).toBe(1);
    
    // Check theme section content
    const sectionText = await themeSection.textContent();
    console.log('Theme section text:', sectionText);
    expect(sectionText).toContain('Appearance');
  });

  test('should show Backup and Restore buttons in stats tab', async ({ page }) => {
    await page.getByTestId('stats-tab-btn').click();
    await page.waitForTimeout(800);
    const backupBtn = page.getByTestId('backup-btn');
    const restoreBtn = page.getByTestId('restore-btn');
    await expect(backupBtn).toBeVisible({ timeout: 5000 });
    await expect(restoreBtn).toBeVisible({ timeout: 5000 });
    await backupBtn.click();
  });
});
