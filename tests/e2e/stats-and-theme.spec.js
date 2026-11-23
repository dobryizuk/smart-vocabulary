const { test, expect } = require('@playwright/test');

async function openSettings(page) {
  await page.getByTestId('stats-tab-btn').click();
  await page.getByTestId('open-settings-btn').click();
}

const currentTheme = (page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const savedTheme = (page) => page.evaluate(() => localStorage.getItem('smart-vocabulary-theme'));

test.describe('Progress, Settings and theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      const dm = window.SV?.DataManager;
      if (dm) {
        dm.vocabulary = [];
      }
    });
  });

  test('the Stats tab opens on Progress, Settings is one tap away and back returns', async ({ page }) => {
    await page.getByTestId('stats-tab-btn').click();
    await expect(page.getByTestId('progress-view')).toBeVisible();
    await expect(page.getByTestId('settings-view')).toBeHidden();

    await page.getByTestId('open-settings-btn').click();
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await expect(page.getByTestId('progress-view')).toBeHidden();

    await page.getByTestId('settings-back-btn').click();
    await expect(page.getByTestId('progress-view')).toBeVisible();
    await expect(page.getByTestId('settings-view')).toBeHidden();
  });

  test('the theme choice persists, is applied and survives a reload', async ({ page }) => {
    await openSettings(page);
    expect(await savedTheme(page)).toBeNull();
    await expect(page.getByTestId('theme-system')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('theme-dark').click();
    expect(await savedTheme(page)).toBe('dark');
    expect(await currentTheme(page)).toBe('dark');
    await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('theme-system')).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId('theme-light').click();
    expect(await savedTheme(page)).toBe('light');
    expect(await currentTheme(page)).toBe('light');

    await page.reload();
    expect(await currentTheme(page)).toBe('light');
    await openSettings(page);
    await expect(page.getByTestId('theme-light')).toHaveAttribute('aria-pressed', 'true');
  });

  test('System follows the device again after a fixed theme', async ({ page }) => {
    await openSettings(page);
    await page.getByTestId('theme-light').click();
    await page.getByTestId('theme-system').click();

    expect(await savedTheme(page)).toBe('system');
    await expect(page.getByTestId('theme-system')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Settings shows Backup, Restore and the other sections', async ({ page }) => {
    await openSettings(page);

    await expect(page.getByTestId('backup-btn')).toBeVisible();
    await expect(page.getByTestId('restore-btn')).toBeVisible();
    await expect(page.getByTestId('log-toggle-btn')).toBeVisible();
    await expect(page.getByTestId('save-logs-btn')).toBeVisible();
    await expect(page.getByTestId('session-size-value')).toBeVisible();
    await page.getByTestId('backup-btn').click();
  });

  test('the sound switches reflect and change the saved settings', async ({ page }) => {
    await openSettings(page);
    const sound = page.getByTestId('speech-toggle');
    await expect(sound).toHaveAttribute('aria-checked', /true|false/);
    const before = await sound.getAttribute('aria-checked');

    await sound.click();

    await expect(sound).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('speechSettings')).enabled);
    expect(String(saved)).toBe(before === 'true' ? 'false' : 'true');
  });

  test('the logging switch turns logging on and off', async ({ page }) => {
    await openSettings(page);
    const logging = page.getByTestId('log-toggle-btn');
    await expect(logging).toHaveAttribute('aria-checked', 'false');

    await logging.click();
    await expect(logging).toHaveAttribute('aria-checked', 'true');

    await logging.click();
    await expect(logging).toHaveAttribute('aria-checked', 'false');
  });
});
