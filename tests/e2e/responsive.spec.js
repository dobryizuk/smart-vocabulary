const { test, expect } = require('@playwright/test');

test.describe('Responsive Design Tests', () => {
  
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

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that tab navigation is still visible and functional
    const tabNav = page.getByTestId('tab-nav');
    await expect(tabNav).toBeVisible();
    
    // Check tabs work on mobile
    await page.getByTestId('list-tab-btn').click();
    await expect(page.locator('#list-tab')).toBeVisible();
    
    // Check form is usable on mobile
    await page.getByTestId('add-tab-btn').click();
    const originalInput = page.getByTestId('original-word-input');
    await expect(originalInput).toBeVisible();
    await originalInput.fill('mobile test');
    
    // Font size should be 16px to prevent zoom on iOS
    const fontSize = await originalInput.evaluate(el => getComputedStyle(el).fontSize);
    expect(fontSize).toBe('16px');
  });
});
