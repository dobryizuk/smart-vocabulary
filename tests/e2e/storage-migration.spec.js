const { test, expect } = require('./fixtures');
const fixture = require('../test-vocabulary.json');

test('shows words saved by the previous version and moves them to the `vocabulary` key', async ({ page }) => {
  const [first, second] = fixture.vocabulary;
  const oldWords = JSON.stringify([{ ...first, repetition: 0 }, { ...second, repetition: 0 }]);
  const oldProgress = JSON.stringify({
    [first.id]: { repetition: 7, easeFactor: first.easeFactor, nextReview: first.nextReview, reviewHistory: first.reviewHistory }
  });
  await page.addInitScript(([words, progress]) => {
    localStorage.setItem('allVocabulary', words);
    localStorage.setItem('userProgress', progress);
  }, [oldWords, oldProgress]);

  await page.goto('/');
  await page.getByTestId('list-tab-btn').click();

  await expect(page.locator('#wordCount')).toHaveText('2');
  const firstCard = page.locator(`#word-card-${first.id}`);
  await expect(firstCard).toBeVisible();
  await expect(firstCard).toContainText(first.original);
  await expect(firstCard).toContainText('7 repetitions');
  await expect(page.locator(`#word-card-${second.id}`)).toContainText(second.original);

  const stored = await page.evaluate(() => ({
    vocabulary: localStorage.getItem('vocabulary'),
    allVocabulary: localStorage.getItem('allVocabulary'),
    userProgress: localStorage.getItem('userProgress')
  }));
  const migrated = JSON.parse(stored.vocabulary);
  expect(migrated.schemaVersion).toBe(1);
  expect(migrated.words.map(word => [word.id, word.repetition])).toEqual([[first.id, 7], [second.id, 0]]);
  expect(stored.allVocabulary).toBe(oldWords);
  expect(stored.userProgress).toBe(oldProgress);
});
