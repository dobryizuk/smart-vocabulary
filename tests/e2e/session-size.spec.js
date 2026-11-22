const { test, expect } = require('@playwright/test');

async function addWord(page, original, translation) {
  await page.getByTestId('add-tab-btn').click();
  await page.getByTestId('original-word-input').fill(original);
  await page.waitForSelector('[data-testid="toggle-fields-btn"]', { timeout: 5000 });
  const translationInput = page.getByRole('textbox', { name: /translation/i });
  if (!(await translationInput.isVisible())) await page.getByTestId('toggle-fields-btn').click();
  await translationInput.fill(translation);
  await page.getByTestId('save-word-btn').click();
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
    await page.getByTestId('learn-tab-btn').click();

    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Show Answer' }).click();
      await page.locator('.difficulty-btn[data-difficulty="hard"]').click();
    }

    await expect(page.getByText('Session Complete!')).toBeVisible();
    await expect(page.getByText(/You reviewed 2 words/)).toBeVisible();
  });

  test('reopening the Learn tab keeps the current card', async ({ page }) => {
    await addWord(page, 'hello', 'привет');
    await addWord(page, 'world', 'мир');
    await page.getByTestId('learn-tab-btn').click();
    const content = page.locator('#learningContent');
    const before = await content.innerText();

    await page.getByTestId('stats-tab-btn').click();
    await page.getByTestId('learn-tab-btn').click();

    expect(await content.innerText()).toBe(before);
  });

  test('Words per session control exists and survives a reload', async ({ page }) => {
    await page.getByTestId('stats-tab-btn').click();
    const select = page.getByTestId('session-size-select');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('15');

    await select.selectOption('20');
    expect(await page.evaluate(() => localStorage.getItem('sessionSize'))).toBe('20');

    await page.reload();
    await page.getByTestId('stats-tab-btn').click();
    await expect(page.getByTestId('session-size-select')).toHaveValue('20');
  });
});
