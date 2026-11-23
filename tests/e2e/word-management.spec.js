const { test, expect } = require('@playwright/test');

test.describe('Word Management Tests', () => {
  
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
    await page.getByTestId('add-tab-btn').click();
  });

  test('should add a new word successfully', async ({ page }) => {
    // Fill in word form
    await page.getByTestId('original-word-input').fill('beautiful');
    
    // Expand additional fields
    await page.getByTestId('toggle-fields-btn').click();
    
    // Fill translation (required)
    await page.getByRole('textbox', { name: /translation/i }).fill('красивый');
    
    // Fill optional fields
    await page.getByRole('textbox', { name: /definition/i }).fill('Pleasing to look at');
    await page.getByRole('textbox', { name: /phonetic/i }).fill('/ˈbjuːtɪfəl/');
    
    // Save the word
    await page.getByTestId('save-word-btn').click();
    
    // Should show success message
    await expect(page.locator('text=Word added successfully')).toBeVisible();
    
    // Switch to word list tab
    await page.getByTestId('list-tab-btn').click();
    
    // Verify word appears in list
    const wordList = page.getByTestId('word-list');
    await expect(wordList).toContainText('beautiful');
    await expect(wordList).toContainText('красивый');
    
    // Verify word count is updated
    const wordCount = page.locator('[data-testid="word-count"], #wordCount');
    await expect(wordCount).toContainText('1');
  });

  test('should edit an existing word successfully', async ({ page }) => {
    // Add initial word
    await page.getByTestId('original-word-input').fill('pencil');
    await page.getByTestId('toggle-fields-btn').click();
    await page.getByRole('textbox', { name: /translation/i }).fill('карандаш');
    await page.getByTestId('save-word-btn').click();
    await expect(page.locator('text=Word added successfully')).toBeVisible();

    // Go to list and expand the card
    await page.getByTestId('list-tab-btn').click();
    const wordCard = page.locator('[id^="word-card-"]').first();
    await expect(wordCard).toBeVisible();
    const toggleButton = wordCard.locator('.word-card__toggle');
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    await page.waitForTimeout(300);

    // Click the edit icon, which is visible when expanded
    const editBtn = wordCard.locator('.action-btn--warning');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // We should be navigated to Add tab with prefilled fields
    await expect(page.locator('#add-tab')).toBeVisible();
    await expect(page.getByTestId('add-tab-btn')).toHaveClass(/active/);
    await expect(page.getByRole('textbox', { name: /word or phrase/i })).toHaveValue('pencil');
    await expect(page.getByRole('textbox', { name: /translation/i })).toHaveValue('карандаш');

    // Change fields
    await page.getByRole('textbox', { name: /translation/i }).fill('простoй карандаш');
    await page.getByRole('textbox', { name: /definition/i }).fill('A writing instrument');

    // Save updates
    await page.getByTestId('save-word-btn').click();

    // Confirmation and redirect to list
    await expect(page.locator('text=Word updated successfully')).toBeVisible();
    await expect(page.locator('#list-tab')).toBeVisible();

    // Verify updated content in the list
    const list = page.getByTestId('word-list');
    await expect(list).toContainText('pencil');
    await expect(list).toContainText('простoй карандаш');
  });

  test('should validate required fields', async ({ page }) => {
    // Try to save without filling required fields
    await page.getByTestId('toggle-fields-btn').click();
    await page.getByTestId('save-word-btn').click();
    
    // Should show validation error
    await expect(page.locator('text=Please fill in both Original and Translation fields')).toBeVisible();
    
    // Fill only Original word
    await page.getByTestId('original-word-input').fill('test');
    await page.getByTestId('save-word-btn').click();
    
    // Should still show validation error
    await expect(page.locator('text=Please fill in both Original and Translation fields')).toBeVisible();
  });
});
