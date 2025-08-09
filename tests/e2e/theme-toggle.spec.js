const { test, expect } = require('@playwright/test');

test('Theme toggle switches between light and dark', async ({ page }) => {
  await page.goto('/');

  // Перейти на вкладку со свитчером темы
  await page.getByTestId('stats-tab-btn').click();
  await page.waitForTimeout(800);

  const getTheme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const themeSwitcher = page.locator('#theme-switcher');

  // Начальная тема
  const initialTheme = await getTheme();

  // Клик: тема должна измениться
  await themeSwitcher.click();
  await page.waitForTimeout(200);
  const afterFirstClick = await getTheme();
  expect(afterFirstClick).not.toBe(initialTheme);

  // Клик: тема должна вернуться к исходной
  await themeSwitcher.click();
  await page.waitForTimeout(200);
  const afterSecondClick = await getTheme();
  expect(afterSecondClick).toBe(initialTheme);
});


