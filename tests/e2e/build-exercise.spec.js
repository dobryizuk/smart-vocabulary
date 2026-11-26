const { test, expect } = require('@playwright/test');

const word = (id, original, translation, reviewHistory) => ({
  id, original, translation, definition: 'A greeting.', examples: [], synonyms: [],
  easeFactor: 2.5, repetition: 1, nextReview: null, reviewHistory,
  createdAt: '2026-11-01T10:00:00.000Z', addedDate: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
});

test.describe('Build exercise', () => {
  test.beforeEach(async ({ page }) => {
    const words = [
      word('b1', 'hello', 'привет', [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'regular' }])
    ];
    await page.addInitScript((seed) => {
      if (!localStorage.getItem('vocabulary')) {
        localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: seed }));
      }
    }, words);
    await page.goto('/');
  });

  test('builds a word from tiles, checks it, rates it and moves on', async ({ page }) => {
    await page.getByTestId('start-session-btn').click();

    await expect(page.getByText('Build the word')).toBeVisible();
    await expect(page.locator('.build-card')).toContainText('привет');
    await expect(page.locator('.build-card')).toContainText('5 letters');
    const check = page.getByTestId('build-check');
    await expect(check).toBeDisabled();

    await expect(page.locator('.build-tile')).toHaveCount(4);
    const lTile = page.locator('.build-tile[data-arg="l"]');
    await expect(lTile.locator('.build-tile__count')).toHaveText('2');

    for (const letter of 'hel') {
      await page.locator(`.build-tile[data-arg="${letter}"]`).click();
    }
    await expect(lTile.locator('.build-tile__count')).toHaveCount(0);
    await expect(lTile).toBeEnabled();
    await lTile.click();
    await expect(lTile).toBeDisabled();
    await expect(lTile.locator('.build-tile__count')).toHaveCount(0);
    await page.locator('.build-tile[data-arg="o"]').click();
    await expect(page.getByTestId('build-slots')).toHaveAttribute('aria-label', 'Your answer: hello');
    await expect(page.locator('.build-slot--right')).toHaveCount(5);
    await expect(check).toBeEnabled();
    await check.click();

    await expect(page.locator('.build-feedback--correct')).toBeVisible();
    await expect(page.locator('.card-translation')).toContainText('hello');
    await expect(page.locator('.difficulty-btn')).toHaveCount(4);
    await expect(page.locator('.difficulty-btn:disabled')).toHaveCount(0);

    await page.locator('.difficulty-btn[data-difficulty="easy"]').click();
    await expect(page.getByText('Session Complete!')).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary')).words[0].reviewHistory);
    expect(stored.at(-1)).toMatchObject({ difficulty: 'easy', exerciseType: 'build' });
  });

  test('undo takes the last letter back and a wrong word is flagged', async ({ page }) => {
    await page.getByTestId('start-session-btn').click();

    await page.locator('.build-tile[data-arg="o"]').click();
    await expect(page.locator('.build-slot--wrong')).toHaveText('o');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.build-slot--wrong')).toHaveCount(0);
    await expect(page.locator('.build-tile[data-arg="o"]')).toBeEnabled();

    for (const letter of 'olleh') {
      await page.locator(`.build-tile[data-arg="${letter}"]`).click();
    }
    await page.getByTestId('build-check').click();

    await expect(page.locator('.build-slot--wrong')).toHaveCount(4);
    await expect(page.locator('.build-feedback--wrong')).toBeVisible();
    await expect(page.locator('.difficulty-btn')).toHaveCount(4);
    await expect(page.locator('.difficulty-btn:enabled')).toHaveCount(1);
    await expect(page.locator('.difficulty-btn[data-difficulty="hard"]')).toBeEnabled();
  });
});

test.describe('Build exercise with a phrase', () => {
  test.beforeEach(async ({ page }) => {
    const words = [
      word('p1', "let me out", 'выпусти меня', [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'regular' }])
    ];
    await page.addInitScript((seed) => {
      if (!localStorage.getItem('vocabulary')) {
        localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: seed }));
      }
    }, words);
    await page.goto('/');
  });

  test('groups the slots by word, marks each letter and checks the phrase', async ({ page }) => {
    await page.getByTestId('start-session-btn').click();

    await expect(page.locator('.build-card')).toContainText('8 letters');
    await expect(page.locator('.build-word')).toHaveCount(3);
    await expect(page.locator('.build-word').nth(0).locator('.build-slot')).toHaveCount(3);
    await expect(page.locator('.build-word').nth(1).locator('.build-slot')).toHaveCount(2);

    const words = await page.locator('.build-word').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
    expect(words[1].left - words[0].right).toBeGreaterThan(15);

    await page.locator('.build-tile[data-arg="l"]').click();
    await page.locator('.build-tile[data-arg="t"]').click();
    await expect(page.locator('.build-slot--right')).toHaveText('l');
    await expect(page.locator('.build-slot--wrong')).toHaveText('t');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.build-slot--wrong')).toHaveCount(0);

    for (const letter of 'etmeout') {
      await page.locator(`.build-tile[data-arg="${letter}"]`).click();
    }
    await expect(page.getByTestId('build-slots')).toHaveAttribute('aria-label', 'Your answer: let me out');
    await page.getByTestId('build-check').click();

    await expect(page.locator('.build-feedback--correct')).toBeVisible();
    await expect(page.locator('.build-slot--right')).toHaveCount(8);
  });
});
