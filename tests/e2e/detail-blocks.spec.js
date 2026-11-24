const { test, expect } = require('@playwright/test');

test('detail blocks should have a visible background', async ({ page }) => {
  await page.goto('/');
  
  // Check if app is initialized
  const svInitialized = await page.evaluate(() => {
    return {
      hasSV: typeof window.SV !== 'undefined',
      hasDataManager: typeof window.SV?.DataManager !== 'undefined',
      hasUIComponents: typeof window.SV?.UIComponents !== 'undefined',
      hasAppMain: typeof window.SV?.AppMain !== 'undefined'
    };
  });
  console.log('App initialization status:', svInitialized);

  // Add a word with definition, synonyms and examples
  await page.getByTestId('add-tab-btn').click();
  await page.getByTestId('original-word-input').fill('flair');
  await page.getByRole('textbox', { name: /translation/i }).fill('талант');
  await page.getByRole('textbox', { name: /definition/i }).fill('A natural or innate talent or aptitude.');
  await page.getByRole('textbox', { name: /synonyms/i }).fill('elan, elegance, grace, panache, style');
  await page.getByTestId('save-word-btn').click();

  // Go to list tab and expand first card
  await page.getByTestId('list-tab-btn').click();
  await page.waitForTimeout(400);
  const card = page.locator('[id^="word-card-"]').first();
  await expect(card).toBeVisible();
  const toggle = card.locator('.word-card__toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await page.waitForTimeout(300);

  // Helper to assert a block is set apart from the row by its own background
  async function hasDistinctBg(el) {
    return await el.evaluate((node) => {
      const bg = getComputedStyle(node).backgroundColor;
      return bg !== 'rgba(0, 0, 0, 0)' && bg !== getComputedStyle(node.closest('.word-group__rows')).backgroundColor;
    });
  }

  const def = card.locator('.detail-block--definition');
  const syn = card.locator('.detail-block--synonyms');

  await expect(def).toBeVisible();
  await expect(syn).toBeVisible();
  expect(await hasDistinctBg(def)).toBeTruthy();
  expect(await hasDistinctBg(syn)).toBeTruthy();
  
});


