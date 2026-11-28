const { test, expect } = require('./fixtures');

const TRANSLATIONS = { hello: 'привет', world: 'мир' };

// Both words were last rated OK in recognition, so the session opens them with build
const word = (id, original) => ({
  id, original, translation: TRANSLATIONS[original], definition: '', examples: [], synonyms: [],
  easeFactor: 2.5, repetition: 1, nextReview: null,
  reviewHistory: [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'regular' }],
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
});

async function buildWord(page, letters) {
  for (const letter of letters) {
    await page.locator(`.build-tile[data-arg="${letter}"]`).click();
  }
  await page.getByTestId('build-check').click();
}

async function wordOnBuildCard(page) {
  const card = await page.locator('.build-card').textContent();
  return Object.keys(TRANSLATIONS).find(original => card.includes(TRANSLATIONS[original]));
}

test.describe('Repeat of a word rated Hard', () => {
  test.beforeEach(async ({ page }) => {
    const words = [word('h1', 'hello'), word('w1', 'world')];
    await page.addInitScript((seed) => {
      if (!localStorage.getItem('vocabulary')) {
        localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: seed }));
      }
    }, words);
    await page.goto('/');
  });

  test('brings the word back one stage easier at the end, answered with Next and not rated', async ({ page }) => {
    const progress = page.getByTestId('session-progress');
    await page.getByTestId('start-session-btn').click();

    await expect(page.getByText('Build the word')).toBeVisible();
    await expect(progress).toContainText('1 / 2');
    const hardWord = await wordOnBuildCard(page);
    const otherWord = hardWord === 'hello' ? 'world' : 'hello';
    await buildWord(page, [...hardWord].reverse());
    await expect(page.locator('.build-feedback--wrong')).toBeVisible();
    await page.locator('.difficulty-btn[data-difficulty="hard"]').click();

    await expect(progress).toContainText('2 / 3');
    expect(await wordOnBuildCard(page)).toBe(otherWord);
    await buildWord(page, [...otherWord]);
    await page.locator('.difficulty-btn[data-difficulty="easy"]').click();

    await expect(progress).toContainText('3 / 3');
    await expect(page.locator('.learning-prompt')).toHaveText('One more time: Do you know this word?');
    await expect(page.locator('#learningMain')).toContainText(hardWord);
    await page.getByRole('button', { name: 'Show Answer' }).click();
    await expect(page.locator('.difficulty-btn')).toHaveCount(0);
    await page.getByTestId('next-card-btn').click();

    await expect(page.getByText('Session Complete!')).toBeVisible();
    await expect(page.getByText(/You reviewed 2 words/)).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary')).words);
    const history = stored.find(w => w.original === hardWord).reviewHistory;
    expect(history).toHaveLength(2);
    expect(history.at(-1)).toMatchObject({ difficulty: 'hard', exerciseType: 'build' });
  });
});
