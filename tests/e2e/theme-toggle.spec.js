const { test, expect } = require('@playwright/test');

test('Choosing the opposite theme switches the page and choosing the first one switches it back', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('stats-tab-btn').click();
  await page.getByTestId('open-settings-btn').click();

  const getTheme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const initialTheme = await getTheme();
  const opposite = initialTheme === 'light' ? 'dark' : 'light';

  await page.getByTestId(`theme-${opposite}`).click();
  expect(await getTheme()).toBe(opposite);

  await page.getByTestId(`theme-${initialTheme}`).click();
  expect(await getTheme()).toBe(initialTheme);
});
