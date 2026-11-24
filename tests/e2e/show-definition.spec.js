const { test, expect } = require('@playwright/test');

const word = (id, original, translation, definition, reviewHistory = []) => ({
  id, original, translation, definition, examples: ['First long example sentence for the word.', 'Second long example sentence for the word.'], synonyms: ['alpha', 'beta'],
  easeFactor: 2.5, repetition: 1, nextReview: null, reviewHistory,
  createdAt: '2026-11-01T10:00:00.000Z', addedDate: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
});

const afterRecognition = [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'regular' }];
const afterBuild = [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'build' }];

async function seed(page, words, showDefinition) {
  await page.addInitScript(({ seedWords, flag }) => {
    if (!localStorage.getItem('vocabulary')) {
      localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: seedWords }));
      if (flag) localStorage.setItem('showDefinition', 'true');
    }
  }, { seedWords: words, flag: showDefinition });
  await page.goto('/');
}

async function expectAboveRatingBar(page) {
  const answer = await page.locator('#learningContent .card-translation').boundingBox();
  const bar = await page.locator('.difficulty-buttons').boundingBox();
  expect(answer.y + answer.height).toBeLessThanOrEqual(bar.y + 1);
  expect(answer.y).toBeGreaterThanOrEqual(0);
}

test.describe('Document', () => {
  test('disables double-tap zoom without blocking pinch-zoom', async ({ page }) => {
    await page.goto('/');

    const touchActions = await page.evaluate(() => [document.documentElement, document.body, document.querySelector('button')]
      .map((el) => getComputedStyle(el).touchAction));
    expect(touchActions).toEqual(['manipulation', 'manipulation', 'manipulation']);
    await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute('content', /user-scalable/);
  });
});

test.describe('Settings', () => {
  test('shows the app version at the bottom and persists the definition switch', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('stats-tab-btn').click();
    await page.getByTestId('open-settings-btn').click();

    await expect(page.getByTestId('app-version')).toHaveText(/^Version \d+\.\d+\.\d+ · \S+$/);
    const toggle = page.getByTestId('show-definition-toggle');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => localStorage.getItem('showDefinition'))).toBe('true');

    await page.reload();
    await page.getByTestId('stats-tab-btn').click();
    await page.getByTestId('open-settings-btn').click();
    await expect(page.getByTestId('show-definition-toggle')).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Definition instead of translation', () => {
  test('recognition reveal shows the definition as the answer', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', 'A greeting.')], true);
    await page.getByTestId('start-session-btn').click();
    await page.getByRole('button', { name: 'Show Answer' }).click();

    await expect(page.locator('.card-translation .detail-title')).toHaveText('Definition');
    await expect(page.locator('.card-translation .detail-text')).toHaveText('A greeting.');
    await expect(page.locator('#learningContent')).not.toContainText('привет');
    await expectAboveRatingBar(page);
  });

  test('recognition reveal shows the translation when the setting is off', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', 'A greeting.')], false);
    await page.getByTestId('start-session-btn').click();
    await page.getByRole('button', { name: 'Show Answer' }).click();

    await expect(page.locator('.card-translation .detail-text')).toHaveText('привет');
    await expectAboveRatingBar(page);
  });

  test('recognition falls back to the translation for a word without a definition', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', '')], true);
    await page.getByTestId('start-session-btn').click();
    await page.getByRole('button', { name: 'Show Answer' }).click();

    await expect(page.locator('.card-translation .detail-title')).toHaveText('Translation');
    await expect(page.locator('.card-translation .detail-text')).toHaveText('привет');
  });

  test('build prompt shows the definition without the translation when on', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', 'A greeting.', afterRecognition)], true);
    await page.getByTestId('start-session-btn').click();

    await expect(page.locator('.build-card .exercise-card__title')).toHaveText('A greeting.');
    await expect(page.locator('.build-card')).not.toContainText('привет');
  });

  test('build prompt shows translation and definition when off', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', 'A greeting.', afterRecognition)], false);
    await page.getByTestId('start-session-btn').click();

    await expect(page.locator('.build-card .exercise-card__title')).toHaveText('привет');
    await expect(page.locator('.build-card .exercise-card__definition')).toHaveText('A greeting.');
  });

  test('build falls back to the translation for a word without a definition', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', '', afterRecognition)], true);
    await page.getByTestId('start-session-btn').click();

    await expect(page.locator('.build-card .exercise-card__title')).toHaveText('привет');
  });

  test('writing prompt shows the definition without the translation when on', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', 'A greeting.', afterBuild)], true);
    await page.getByTestId('start-session-btn').click();

    await expect(page.getByText('Write it in English')).toBeVisible();
    await expect(page.locator('.exercise-card__title')).toHaveText('A greeting.');
    await expect(page.locator('.exercise-card')).not.toContainText('привет');
  });

  test('writing prompt shows translation and definition when off', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', 'A greeting.', afterBuild)], false);
    await page.getByTestId('start-session-btn').click();

    await expect(page.locator('.exercise-card__title')).toHaveText('привет');
    await expect(page.locator('.exercise-card__definition')).toHaveText('A greeting.');
  });
});

test.describe('Revealed answer', () => {
  test('stays above the rating bar after a wrong writing check', async ({ page }) => {
    await seed(page, [word('w1', 'inconceivable', 'невероятный', 'Not able to be believed.', afterBuild)], false);
    await page.getByTestId('start-session-btn').click();
    await page.locator('#reverseTranslationInput').fill('inconcievable');
    await page.getByTestId('reverse-check').click();

    await expect(page.locator('.difficulty-btn')).toHaveCount(4);
    await expectAboveRatingBar(page);
  });

  test('stays above the rating bar after Show Answer in writing', async ({ page }) => {
    await seed(page, [word('w1', 'inconceivable', 'невероятный', 'Not able to be believed.', afterBuild)], false);
    await page.getByTestId('start-session-btn').click();
    await page.getByRole('button', { name: 'Show Answer' }).click();

    await expectAboveRatingBar(page);
  });

  test('stays above the rating bar after checking a build', async ({ page }) => {
    await seed(page, [word('w1', 'hello', 'привет', 'A greeting.', afterRecognition)], false);
    await page.getByTestId('start-session-btn').click();
    for (const letter of 'hello') {
      await page.locator(`.build-tile[data-arg="${letter}"]`).click();
    }
    await page.getByTestId('build-check').click();

    await expect(page.locator('.difficulty-btn')).toHaveCount(4);
    await expectAboveRatingBar(page);
  });
});
