const { test, expect } = require('./fixtures');

// Last rated OK in build, so listening comes next when the word has a natural voice clip
const word = {
  id: 'w1', original: 'hello', translation: 'привет', definition: 'A greeting.', phonetic: '/həˈləʊ/',
  examples: [], synonyms: [], easeFactor: 2.5, repetition: 1, nextReview: null,
  reviewHistory: [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'build' }],
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
};

// The model CDN is blocked, so the stored clip is a stand-in that records what it plays
async function startSession(page, { hasClip }) {
  await page.addInitScript((seed) => {
    if (!localStorage.getItem('vocabulary')) {
      localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: [seed] }));
    }
  }, word);
  await page.goto('/');
  await page.evaluate((clip) => {
    window.played = [];
    window.SV.NaturalVoice.hasClip = () => clip;
    window.SV.NaturalVoice.play = (text) => { window.played.push(text); return Promise.resolve(); };
  }, hasClip);
  await page.getByTestId('start-session-btn').click();
}

const played = (page) => page.evaluate(() => window.played);
const lastReview = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary')).words[0].reviewHistory.at(-1));

test.describe('Listening exercise', () => {
  test('plays the word, takes the typed answer and reveals it with the translation', async ({ page }) => {
    await startSession(page, { hasClip: true });

    await expect(page.locator('.learning-prompt')).toHaveText('Write what you hear');
    const main = page.locator('#learningMain');
    await expect(main).not.toContainText('hello');
    await expect(main).not.toContainText('привет');
    await expect(main).not.toContainText('A greeting.');
    await expect.poll(() => played(page)).toEqual(['hello']);

    await page.locator('.listen-card__speaker').click();
    await expect.poll(() => played(page)).toEqual(['hello', 'hello']);

    await page.locator('#reverseTranslationInput').fill('hello');
    await page.getByTestId('reverse-check').click();

    await expect(page.locator('#reverseTranslationInput')).toHaveClass(/typing-input--success/);
    const answer = page.locator('.card-translation');
    await expect(answer).toHaveCount(2);
    await expect(answer.first()).toContainText('Correct answer');
    await expect(answer.first()).toContainText('hello');
    await expect(answer.first()).toContainText('/həˈləʊ/');
    await expect(answer.nth(1)).toContainText('Translation');
    await expect(answer.nth(1)).toContainText('привет');
    await expect(page.getByTestId('detail-definition')).toContainText('A greeting.');
    const translationBox = await answer.nth(1).boundingBox();
    const ratingBar = await page.locator('.difficulty-buttons').boundingBox();
    expect(translationBox.y + translationBox.height).toBeLessThanOrEqual(ratingBar.y + 1);
    await expect(page.locator('.difficulty-btn:enabled')).toHaveCount(4);

    await page.locator('.difficulty-btn[data-difficulty="easy"]').click();
    await expect(page.getByText('Session Complete!')).toBeVisible();
    expect(await lastReview(page)).toMatchObject({ difficulty: 'easy', exerciseType: 'listen' });
  });

  test('repeats a word rated Hard one stage easier, as build', async ({ page }) => {
    await startSession(page, { hasClip: true });
    await page.getByTestId('reverse-check').click();
    await expect(page.locator('.card-translation').nth(1)).toContainText('привет');

    await page.locator('.difficulty-btn[data-difficulty="hard"]').click();

    await expect(page.locator('.learning-prompt')).toHaveText('One more time: Build the word');
    expect(await lastReview(page)).toMatchObject({ difficulty: 'hard', exerciseType: 'listen' });
  });

  test('gives the word writing instead when it has no clip', async ({ page }) => {
    await startSession(page, { hasClip: false });

    await expect(page.locator('.learning-prompt')).toHaveText('Write it in English');
    await expect(page.locator('.exercise-card__title')).toHaveText('привет');
    await page.locator('#reverseTranslationInput').fill('hello');
    await page.getByTestId('reverse-check').click();
    await expect(page.locator('.card-translation')).toHaveCount(1);

    await page.locator('.difficulty-btn[data-difficulty="easy"]').click();
    await expect(page.getByText('Session Complete!')).toBeVisible();
    expect(await lastReview(page)).toMatchObject({ difficulty: 'easy', exerciseType: 'reverse' });
  });
});
