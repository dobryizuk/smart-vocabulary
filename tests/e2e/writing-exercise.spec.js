const { test, expect } = require('@playwright/test');

const word = (id, original, translation, reviewHistory) => ({
  id, original, translation, definition: 'A greeting.', examples: [], synonyms: [],
  easeFactor: 2.5, repetition: 1, nextReview: null, reviewHistory,
  createdAt: '2026-11-01T10:00:00.000Z', addedDate: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
});

const afterBuild = [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'build' }];

test.describe('Writing exercise', () => {
  test.beforeEach(async ({ page }) => {
    const words = [word('w1', 'hello', 'привет', afterBuild)];
    await page.addInitScript((seed) => {
      if (!localStorage.getItem('vocabulary')) {
        localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: seed }));
      }
    }, words);
    await page.goto('/');
    await page.getByTestId('start-session-btn').click();
    await expect(page.getByText('Write it in English')).toBeVisible();
  });

  test('Check marks the right answer, reveals the answer and the session advances after rating', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Hint' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show Answer' })).toBeVisible();

    await page.locator('#reverseTranslationInput').fill('Hello');
    await page.getByTestId('reverse-check').click();

    await expect(page.locator('#typingFeedback')).toHaveText('Correct!');
    await expect(page.locator('#reverseTranslationInput')).toHaveClass(/typing-input--success/);
    await expect(page.locator('.card-translation')).toContainText('hello');
    await expect(page.locator('.difficulty-btn')).toHaveCount(4);
    await expect(page.getByTestId('reverse-check')).toBeHidden();

    await page.locator('.difficulty-btn[data-difficulty="easy"]').click();
    await expect(page.getByText('Session Complete!')).toBeVisible();
  });

  test('a wrong answer is flagged Not quite and can still be rated', async ({ page }) => {
    await page.locator('#reverseTranslationInput').fill('world');
    await page.getByTestId('reverse-check').click();

    await expect(page.locator('#typingFeedback')).toHaveText('Not quite');
    await expect(page.locator('#reverseTranslationInput')).toHaveClass(/typing-input--danger/);

    await page.locator('.difficulty-btn[data-difficulty="hard"]').click();
    await expect(page.getByText('Session Complete!')).toBeVisible();
  });

  test('Enter in the input checks the answer', async ({ page }) => {
    await page.locator('#reverseTranslationInput').fill('hello');
    await page.locator('#reverseTranslationInput').press('Enter');

    await expect(page.locator('#typingFeedback')).toHaveText('Correct!');
    await expect(page.locator('.difficulty-btn')).toHaveCount(4);
  });

  test('Show Answer reveals the answer without a verdict', async ({ page }) => {
    await page.locator('#reverseTranslationInput').fill('hello');
    await page.getByRole('button', { name: 'Show Answer' }).click();

    await expect(page.locator('#typingFeedback')).toBeEmpty();
    await expect(page.locator('#reverseTranslationInput')).not.toHaveClass(/typing-input--/);
    await expect(page.locator('.difficulty-btn')).toHaveCount(4);
  });
});
