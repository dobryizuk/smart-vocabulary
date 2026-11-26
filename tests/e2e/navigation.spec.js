const { test, expect } = require('./fixtures');

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
    
    // Tabs are Today, Words, Add, Progress, in that order
    const tabs = page.getByTestId('tab-nav').getByRole('button');
    await expect(tabs).toHaveText(['Today', 'Words', 'Add', 'Progress']);
    await expect(page.getByTestId('today-tab-btn')).toBeVisible();
    await expect(page.getByTestId('list-tab-btn')).toBeVisible();
    await expect(page.getByTestId('add-tab-btn')).toBeVisible();
    await expect(page.getByTestId('stats-tab-btn')).toBeVisible();
    await expect(tabs.locator('svg')).toHaveCount(4);

    // The app opens on Today
    await expect(page.getByTestId('today-tab-btn')).toHaveClass(/active/);
    await expect(page.locator('#today-tab')).toBeVisible();
  });

  test('every tab target is at least 44px tall', async ({ page }) => {
    for (const button of await page.getByTestId('tab-nav').getByRole('button').all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  });

  test('should navigate between tabs correctly', async ({ page }) => {
    // Start on Today tab
    await expect(page.locator('#today-tab')).toBeVisible();

    // Click Words tab
    await page.getByTestId('list-tab-btn').click();
    await expect(page.locator('#list-tab')).toBeVisible();
    await expect(page.locator('#today-tab')).not.toBeVisible();

    // Click Add tab
    await page.getByTestId('add-tab-btn').click();
    await expect(page.locator('#add-tab')).toBeVisible();
    await expect(page.locator('#list-tab')).not.toBeVisible();

    // Click Progress tab
    await page.getByTestId('stats-tab-btn').click();
    await expect(page.locator('#stats-tab')).toBeVisible();
    await expect(page.locator('#add-tab')).not.toBeVisible();

    // Click back to Today tab
    await page.getByTestId('today-tab-btn').click();
    await expect(page.locator('#today-tab')).toBeVisible();
    await expect(page.locator('#stats-tab')).not.toBeVisible();
  });
});
