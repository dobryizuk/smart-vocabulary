const { test, expect } = require('./fixtures');

async function addWord(page, original, translation) {
  await page.getByTestId('add-tab-btn').click();
  await page.getByTestId('original-word-input').fill(original);
  await page.getByRole('textbox', { name: /translation/i }).fill(translation);
  await page.getByTestId('save-word-btn').click();
}

async function startSession(page) {
  await page.getByTestId('today-tab-btn').click();
  await page.getByTestId('start-session-btn').click();
}

test.describe('Learning session size and completion', () => {
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

  test('shows Session Complete after answering every card', async ({ page }) => {
    await addWord(page, 'hello', 'привет');
    await addWord(page, 'world', 'мир');
    await startSession(page);

    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Show Answer' }).click();
      await page.locator('.difficulty-btn[data-difficulty="hard"]').click();
    }

    await expect(page.getByText('Session Complete!')).toBeVisible();
    await expect(page.getByText(/You reviewed 2 words/)).toBeVisible();
  });

  test('reopening the Today tab keeps the current card', async ({ page }) => {
    await addWord(page, 'hello', 'привет');
    await addWord(page, 'world', 'мир');
    await startSession(page);
    const content = page.locator('#learningContent');
    const before = await content.innerText();

    await page.getByTestId('stats-tab-btn').click();
    await page.getByTestId('today-tab-btn').click();

    expect(await content.innerText()).toBe(before);
  });

  test('Words per session stepper stays within 10 to 20 and survives a reload', async ({ page }) => {
    await page.getByTestId('stats-tab-btn').click();
    await page.getByTestId('open-settings-btn').click();
    const value = page.getByTestId('session-size-value');
    await expect(value).toHaveText('15');

    for (let i = 0; i < 5; i++) await page.getByTestId('session-size-inc').click();
    await expect(value).toHaveText('20');
    await expect(page.getByTestId('session-size-inc')).toBeDisabled();
    expect(await page.evaluate(() => localStorage.getItem('sessionSize'))).toBe('20');

    await page.reload();
    await page.getByTestId('stats-tab-btn').click();
    await page.getByTestId('open-settings-btn').click();
    await expect(page.getByTestId('session-size-value')).toHaveText('20');

    for (let i = 0; i < 10; i++) await page.getByTestId('session-size-dec').click();
    await expect(page.getByTestId('session-size-value')).toHaveText('10');
    await expect(page.getByTestId('session-size-dec')).toBeDisabled();
    expect(await page.evaluate(() => localStorage.getItem('sessionSize'))).toBe('10');
  });
});
