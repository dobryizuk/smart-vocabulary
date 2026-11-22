const { test, expect } = require('@playwright/test');

test.describe('Learning Tests', () => {
  
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

  test('should show empty state when no words added', async ({ page }) => {
    // Switch to word list
    await page.getByTestId('list-tab-btn').click();
    await page.waitForSelector('#list-tab.active', { timeout: 5000 });
    
    // Should show empty state
    await expect(page.getByText('No words yet!')).toBeVisible();
    await expect(page.getByText('Add your first word')).toBeVisible();
    
    // Switch to learn tab
    await page.getByTestId('learn-tab-btn').click();
    
    // Should show learning empty state
    await expect(page.getByText(/ready to learn/i)).toBeVisible();
    await expect(page.getByText(/add some words first/i)).toBeVisible();
  });

  test('should handle learning flow when words exist', async ({ page }) => {
    // First add a word
    await page.getByTestId('original-word-input').fill('hello');
    await page.waitForSelector('[data-testid="toggle-fields-btn"]', { timeout: 5000 });
    await page.getByTestId('toggle-fields-btn').click();
    await page.getByRole('textbox', { name: /translation/i }).fill('привет');
    await page.getByTestId('save-word-btn').click();
    
    // Go to learn tab
    await page.getByTestId('learn-tab-btn').click();
    
    // Should show learning interface with the word
    const learningContent = page.locator('#learningContent, [data-testid="learning-content"]');
    await expect(learningContent).toContainText('hello');
    
    // Should have difficulty buttons or show answer button
    const hasShowAnswer = await page.getByText('Show Answer').isVisible();
    const hasDifficultyButtons = await page.locator('.difficulty-btn').first().isVisible();
    
    expect(hasShowAnswer || hasDifficultyButtons).toBeTruthy();
  });
});
