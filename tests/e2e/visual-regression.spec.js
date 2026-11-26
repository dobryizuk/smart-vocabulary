const { test, expect } = require('./fixtures');

test.describe.skip('Visual Regression Tests', () => {
  test('should match homepage screenshot', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('should match word list with sample data', async ({ page }) => {
    await page.goto('/');
    
    // Add sample data
    await page.evaluate(() => {
      const dm = window.SV?.DataManager;
      if (dm) {
        dm.vocabulary = [
          {
            id: 'test1',
            original: 'beautiful',
            translation: 'красивый',
            definition: 'Pleasing to look at',
            phonetic: '/ˈbjuːtɪfəl/',
            easeFactor: 1.8,
            repetition: 2
          },
          {
            id: 'test2', 
            original: 'challenge',
            translation: 'вызов',
            definition: 'A demanding task',
            easeFactor: 1.4,
            repetition: 1
          }
        ];
      }
    });
    
    await page.getByTestId('list-tab-btn').click();
    await page.waitForTimeout(1000); // Let UI update
    
    // Update screenshot
    await expect(page).toHaveScreenshot('word-list-with-data.png');
  });

  test('should match learning interface', async ({ page }) => {
    await page.goto('/');
    
    // Add sample word and go to learning
    await page.evaluate(() => {
      const dm2 = window.SV?.DataManager;
      if (dm2) {
        dm2.vocabulary = [{
          id: 'learn_test',
          original: 'learning',
          translation: 'обучение',
          definition: 'The process of acquiring knowledge',
          easeFactor: 1.3,
          repetition: 0
        }];
      }
    });
    
    await page.getByTestId('start-session-btn').click();
    await page.waitForTimeout(1500); // Let learning interface load
    
    // Update screenshot
    await expect(page).toHaveScreenshot('learning-interface.png');
  });
});
