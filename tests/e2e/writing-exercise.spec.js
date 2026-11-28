const { test, expect } = require('./fixtures');

const word = (id, original, translation, reviewHistory) => ({
  id, original, translation, definition: 'A greeting.', examples: [], synonyms: [],
  easeFactor: 2.5, repetition: 1, nextReview: null, reviewHistory,
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
});

// Last rated OK in build: listening comes next, but without a natural voice clip (e2e never has one) the word is written
const afterBuild = [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'build' }];

const ratings = ['hard', 'medium', 'easy', 'perfect'];

async function expectEnabledRatings(page, enabled) {
  await expect(page.locator('.difficulty-btn')).toHaveCount(ratings.length);
  for (const rating of ratings) {
    const button = page.locator(`.difficulty-btn[data-difficulty="${rating}"]`);
    if (enabled.includes(rating)) await expect(button).toBeEnabled();
    else await expect(button).toBeDisabled();
  }
}

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
    await expect(page.getByRole('button', { name: 'Show Answer' })).toHaveCount(0);

    await page.locator('#reverseTranslationInput').fill('Hello');
    await page.getByTestId('reverse-check').click();

    await expect(page.locator('#reverseTranslationInput')).toHaveClass(/typing-input--success/);
    await expect(page.locator('#typingFeedback')).toHaveClass(/sr-only/);
    await expect(page.locator('#typingFeedback')).toHaveText('Correct!');
    await expect(page.locator('#typingDiff')).toBeEmpty();
    await expect(page.locator('.card-translation')).toContainText('hello');
    await expect(page.locator('.card-translation [data-action="speak-word"]')).toBeVisible();
    await expectEnabledRatings(page, ratings);
    await expect(page.getByTestId('reverse-check')).toBeHidden();

    await page.locator('.difficulty-btn[data-difficulty="easy"]').click();
    await expect(page.getByText('Session Complete!')).toBeVisible();
  });

  test('a wrong answer tints the field and allows only Hard', async ({ page }) => {
    await page.locator('#reverseTranslationInput').fill('world');
    await page.getByTestId('reverse-check').click();

    await expect(page.locator('#reverseTranslationInput')).toHaveClass(/typing-input--danger/);
    await expect(page.locator('#typingFeedback')).toHaveText('Not quite');
    await expectEnabledRatings(page, ['hard']);

    await page.locator('.difficulty-btn[data-difficulty="perfect"]').click({ force: true });
    await expect(page.locator('.difficulty-buttons')).toBeVisible();
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary')).words[0].reviewHistory);
    expect(history).toHaveLength(1);

    // One stage easier is listening; without a clip the word skips it down to build
    await page.locator('.difficulty-btn[data-difficulty="hard"]').click();
    await expect(page.locator('.learning-prompt')).toHaveText('One more time: Build the word');
  });

  test('Enter in the input checks the answer', async ({ page }) => {
    await page.locator('#reverseTranslationInput').fill('hello');
    await page.locator('#reverseTranslationInput').press('Enter');

    await expect(page.locator('#reverseTranslationInput')).toHaveClass(/typing-input--success/);
    await expectEnabledRatings(page, ratings);
  });

  test('a misspelled answer shows the differences marked and allows up to Medium', async ({ page }) => {
    await page.locator('#reverseTranslationInput').fill('hallo');
    await page.getByTestId('reverse-check').click();

    await expect(page.locator('#reverseTranslationInput')).toHaveClass(/typing-input--warn/);
    await expectEnabledRatings(page, ['hard', 'medium']);
    await expect(page.locator('#typingDiff')).toHaveText('haello');
    await expect(page.locator('#typingDiff .typing-diff__wrong')).toHaveText('a');
    await expect(page.locator('#typingDiff .typing-diff__missing')).toHaveText('e');
  });

  test('Hint writes the first letters of the answer into the field', async ({ page }) => {
    const input = page.locator('#reverseTranslationInput');
    const hint = page.getByRole('button', { name: /^Hint/ });

    await hint.click();
    await expect(input).toHaveValue('h');
    await expect(hint).toHaveText('Hint (2 left)');
    await hint.click();
    await hint.click();
    await expect(input).toHaveValue('hel');
    await expect(hint).toBeDisabled();
    await expect(page.locator('#reverseHint')).toHaveCount(0);

    await page.getByTestId('reverse-check').click();
    await expect(input).toHaveClass(/typing-input--/);
    await expect(page.locator('#reverseActions')).toBeHidden();
  });

  test('Check with an empty field gives up without a verdict', async ({ page }) => {
    await page.getByTestId('reverse-check').click();

    await expect(page.locator('#typingFeedback')).toBeEmpty();
    await expect(page.locator('#typingDiff')).toBeEmpty();
    await expect(page.locator('#reverseTranslationInput')).not.toHaveClass(/typing-input--/);
    await expectEnabledRatings(page, ['hard']);
  });
});
