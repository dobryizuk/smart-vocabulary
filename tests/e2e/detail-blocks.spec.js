const { test, expect } = require('@playwright/test');

test('detail blocks should have visible backgrounds and borders', async ({ page }) => {
  await page.goto('/');

  // Add a word with definition, synonyms and examples
  await page.getByTestId('english-word-input').fill('flair');
  await page.getByTestId('toggle-fields-btn').click();
  await page.getByRole('textbox', { name: /russian translation/i }).fill('талант');
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

  // Helpers to assert block styles
  async function hasBorderAndBg(el) {
    return await el.evaluate((node) => {
      const cs = getComputedStyle(node);
      const hasBorder = (parseFloat(cs.borderLeftWidth) > 0) || (cs.borderLeftStyle !== 'none');
      const hasBg = cs.backgroundImage !== 'none' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
      return hasBorder && hasBg;
    });
  }

  const def = card.locator('.detail-block--definition');
  const syn = card.locator('.detail-block--synonyms');

  await expect(def).toBeVisible();
  await expect(syn).toBeVisible();
  expect(await hasBorderAndBg(def)).toBeTruthy();
  expect(await hasBorderAndBg(syn)).toBeTruthy();
  
});


