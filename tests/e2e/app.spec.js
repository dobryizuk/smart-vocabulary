const { test, expect } = require('@playwright/test');

test.describe('Smart Vocabulary App', () => {
  
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

  test('should add a new word successfully', async ({ page }) => {
    // Fill in word form
    await page.getByTestId('english-word-input').fill('beautiful');
    
    // Expand additional fields
    await page.getByTestId('toggle-fields-btn').click();
    
    // Fill Russian translation (required)
    await page.getByRole('textbox', { name: /russian translation/i }).fill('красивый');
    
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

  test('should show empty state when no words added', async ({ page }) => {
    // Switch to word list
    await page.getByTestId('list-tab-btn').click();
    
    // Should show empty state
    await expect(page.getByText('No words yet!')).toBeVisible();
    await expect(page.getByText('Add your first word')).toBeVisible();
    
    // Switch to learn tab
    await page.getByTestId('learn-tab-btn').click();
    
    // Should show learning empty state
    await expect(page.getByText(/ready to learn/i)).toBeVisible();
    await expect(page.getByText(/add some words first/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to save without filling required fields
    await page.getByTestId('toggle-fields-btn').click();
    await page.getByTestId('save-word-btn').click();
    
    // Should show validation error
    await expect(page.locator('text=Please fill in both English and Russian fields')).toBeVisible();
    
    // Fill only English word
    await page.getByTestId('english-word-input').fill('test');
    await page.getByTestId('save-word-btn').click();
    
    // Should still show validation error
    await expect(page.locator('text=Please fill in both English and Russian fields')).toBeVisible();
  });

  test('should handle learning flow when words exist', async ({ page }) => {
    // First add a word
    await page.getByTestId('english-word-input').fill('hello');
    await page.getByTestId('toggle-fields-btn').click();
    await page.getByRole('textbox', { name: /russian translation/i }).fill('привет');
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
    const englishInput = page.getByTestId('english-word-input');
    await expect(englishInput).toBeVisible();
    await englishInput.fill('mobile test');
    
    // Font size should be 16px to prevent zoom on iOS
    const fontSize = await englishInput.evaluate(el => getComputedStyle(el).fontSize);
    expect(fontSize).toBe('16px');
  });

  test('should toggle word card expand/collapse functionality', async ({ page }) => {
    // First add a word with details to test toggle
    await page.getByTestId('english-word-input').fill('expandable');
    await page.getByTestId('toggle-fields-btn').click();
    await page.getByRole('textbox', { name: /russian translation/i }).fill('раскрываемый');
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

test.describe('Visual Regression Tests', () => {
  test('should match homepage screenshot', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('should match word list with sample data', async ({ page }) => {
    await page.goto('/');
    
    // Add sample data
    await page.evaluate(() => {
      if (window.DataManager) {
        window.DataManager.vocabulary = [
          {
            id: 'test1',
            english: 'beautiful',
            russian: 'красивый',
            definition: 'Pleasing to look at',
            phonetic: '/ˈbjuːtɪfəl/',
            easeFactor: 1.8,
            repetition: 2
          },
          {
            id: 'test2', 
            english: 'challenge',
            russian: 'вызов',
            definition: 'A demanding task',
            easeFactor: 1.4,
            repetition: 1
          }
        ];
      }
    });
    
    await page.getByTestId('list-tab-btn').click();
    await page.waitForTimeout(500); // Let UI update
    
    await expect(page).toHaveScreenshot('word-list-with-data.png');
  });

  test('should match learning interface', async ({ page }) => {
    await page.goto('/');
    
    // Add sample word and go to learning
    await page.evaluate(() => {
      if (window.DataManager) {
        window.DataManager.vocabulary = [{
          id: 'learn_test',
          english: 'learning',
          russian: 'обучение',
          definition: 'The process of acquiring knowledge',
          easeFactor: 1.3,
          repetition: 0
        }];
      }
    });
    
    await page.getByTestId('learn-tab-btn').click();
    await page.waitForTimeout(1000); // Let learning interface load
    
    await expect(page).toHaveScreenshot('learning-interface.png');
  });
});
