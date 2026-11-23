const { test, expect } = require('@playwright/test');

test.describe('Word Cards Tests', () => {
  
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

  test('should toggle word card expand/collapse functionality', async ({ page }) => {
    // First add a word with details to test toggle
    await page.getByTestId('add-tab-btn').click();
    await page.getByTestId('original-word-input').fill('expandable');
    await page.getByTestId('toggle-fields-btn').click();
    await page.getByRole('textbox', { name: /translation/i }).fill('раскрываемый');
    await page.getByRole('textbox', { name: /definition/i }).fill('Able to be expanded or extended');
    await page.getByRole('textbox', { name: /synonyms/i }).fill('extensible, expandible');
    await page.getByTestId('save-word-btn').click();
    
    // Go to word list
    await page.getByTestId('list-tab-btn').click();
    await page.waitForTimeout(500);
    
    // Find the word card - it should exist and be expandable
    const wordCard = page.locator('[id^="word-card-"]').first();
    await expect(wordCard).toBeVisible();
    
    // Check that it has expandable class
    await expect(wordCard).toHaveClass(/word-card--expandable/);
    
    // Check that toggle button exists
    const toggleButton = wordCard.locator('.word-card__toggle');
    await expect(toggleButton).toBeVisible();
    
    // Initially, expandable content should exist but be collapsed (height 0)
    const expandableContent = wordCard.locator('.word-card__expandable-content');
    await expect(expandableContent).toBeAttached();
    
    // Check that initially it's collapsed (max-height 0)
    const initialMaxHeight = await expandableContent.evaluate(el => getComputedStyle(el).maxHeight);
    expect(initialMaxHeight).toBe('0px');
    
    // Click toggle button to expand
    await toggleButton.click();
    await page.waitForTimeout(400); // Wait for animation
    
    // Check that card is now expanded
    await expect(wordCard).toHaveClass(/word-card--expanded/);
    
    // Check that content is now visible (max-height > 0)
    const expandedMaxHeight = await expandableContent.evaluate(el => getComputedStyle(el).maxHeight);
    expect(expandedMaxHeight).not.toBe('0px');
    
    // Check that details are visible
    await expect(wordCard.getByText('Able to be expanded')).toBeVisible();
    await expect(wordCard.getByText('extensible')).toBeVisible();
    
    // Click toggle button again to collapse
    await toggleButton.click();
    await page.waitForTimeout(400); // Wait for animation
    
    // Check that card is collapsed again
    await expect(wordCard).not.toHaveClass(/word-card--expanded/);
  });
});
