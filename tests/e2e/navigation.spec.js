const { test, expect } = require('@playwright/test');

test.describe('Navigation Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear any existing data
    await page.evaluate(() => {
      localStorage.clear();
      const dm = window.SV?.DataManager;
      if (dm) {
        dm.vocabulary = [];
      }
    });
  });

  test('should display app title and navigation', async ({ page }) => {
    await expect(page).toHaveTitle(/Smart Vocabulary/);
    
    // Check tab navigation is visible
    const tabNav = page.getByTestId('tab-nav');
    await expect(tabNav).toBeVisible();
    
    // Check all tabs are present
    await expect(page.getByTestId('add-tab-btn')).toBeVisible();
    await expect(page.getByTestId('list-tab-btn')).toBeVisible();
    await expect(page.getByTestId('learn-tab-btn')).toBeVisible();
    await expect(page.getByTestId('stats-tab-btn')).toBeVisible();
    
    // Add tab should be active by default
    await expect(page.getByTestId('add-tab-btn')).toHaveClass(/active/);
  });

  test('should navigate between tabs correctly', async ({ page }) => {
    // Start on Add tab
    await expect(page.locator('#add-tab')).toBeVisible();
    
    // Click List tab
    await page.getByTestId('list-tab-btn').click();
    await expect(page.locator('#list-tab')).toBeVisible();
    await expect(page.locator('#add-tab')).not.toBeVisible();
    
    // Click Learn tab
    await page.getByTestId('learn-tab-btn').click();
    await expect(page.locator('#learn-tab')).toBeVisible();
    await expect(page.locator('#list-tab')).not.toBeVisible();
    
    // Click Stats tab
    await page.getByTestId('stats-tab-btn').click();
    await expect(page.locator('#stats-tab')).toBeVisible();
    await expect(page.locator('#learn-tab')).not.toBeVisible();
    
    // Click back to Add tab
    await page.getByTestId('add-tab-btn').click();
    await expect(page.locator('#add-tab')).toBeVisible();
    await expect(page.locator('#stats-tab')).not.toBeVisible();
  });
});
