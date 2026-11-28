const { test, expect } = require('./fixtures');

const DAY_MS = 86400000;

const answer = (daysAgo, difficulty) => ({
  date: new Date(Date.now() - daysAgo * DAY_MS).toISOString(), difficulty, exerciseType: 'regular'
});

const word = (id, original, reviewHistory, nextReview) => ({
  id, original, translation: `${original} (tr)`, definition: '', examples: [], phonetic: '', synonyms: [],
  easeFactor: 2, repetition: reviewHistory.length, nextReview, reviewHistory,
  createdAt: new Date(Date.now() - 30 * DAY_MS).toISOString()
});

// Two words are due: "shaky" has a history of misses, "fresh" was never answered
function seedVocabulary() {
  const later = new Date(Date.now() + 5 * DAY_MS).toISOString();
  return [
    word('t1', 'shaky', [answer(3, 'hard'), answer(2, 'hard')], null),
    word('t2', 'fresh', [], null),
    word('t3', 'steady', [answer(2, 'easy'), answer(1, 'easy')], later)
  ];
}

async function seed(page, words) {
  await page.addInitScript((seedWords) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: seedWords }));
  }, words);
  await page.goto('/');
}

test.describe('Today', () => {
  test('opens on Today with the numbers of the vocabulary', async ({ page }) => {
    await seed(page, seedVocabulary());

    await expect(page.getByTestId('today-tab-btn')).toHaveClass(/active/);
    await expect(page.getByTestId('today-date')).toBeVisible();
    await expect(page.getByTestId('today-streak')).toHaveText('3-day streak');
    await expect(page.getByTestId('today-due')).toHaveText('2 words');
    await expect(page.getByTestId('today-breakdown')).toHaveText('1 review · 1 new · about 1 min');
    await expect(page.getByTestId('today-total')).toHaveText('3 words');
    await expect(page.getByTestId('today-bucket-difficult')).toContainText('1');
    await expect(page.getByTestId('today-bucket-mastered')).toContainText('1');
    await expect(page.getByTestId('today-bucket-new')).toContainText('1');
    await expect(page.getByTestId('tricky-word')).toHaveText([/shaky.*0% right/s]);
  });

  test('the close button leaves a session at once, keeping the answered cards', async ({ page }) => {
    await seed(page, seedVocabulary());
    await expect(page.getByTestId('today-due')).toHaveText('2 words');

    await page.getByTestId('start-session-btn').click();
    await page.getByRole('button', { name: 'Show Answer' }).click();
    await page.locator('.difficulty-btn[data-difficulty="easy"]').click();
    await expect(page.getByTestId('session-progress')).toContainText('2 / 2');

    await page.getByRole('button', { name: 'End session' }).click();

    await expect(page.getByTestId('today-view')).toBeVisible();
    await expect(page.getByText('Session Complete!')).toHaveCount(0);
    await expect(page.getByTestId('today-due')).toHaveText('1 word');
  });

  test('a session started from Today ends back on Today with the numbers changed', async ({ page }) => {
    await seed(page, seedVocabulary());
    await expect(page.getByTestId('today-due')).toHaveText('2 words');

    await page.getByTestId('start-session-btn').click();
    await expect(page.getByTestId('today-view')).toBeHidden();
    await expect(page.getByText('Do you know this word?')).toBeVisible();

    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Show Answer' }).click();
      await page.locator('.difficulty-btn[data-difficulty="easy"]').click();
    }
    await expect(page.getByText('Session Complete!')).toBeVisible();
    await expect(page.getByText(/You reviewed 2 words/)).toBeVisible();

    await page.getByRole('button', { name: 'Back to Today' }).click();

    await expect(page.getByTestId('today-view')).toBeVisible();
    await expect(page.getByTestId('today-streak')).toHaveText('4-day streak');
    await expect(page.getByTestId('today-review')).toHaveCount(0);
    await expect(page.getByTestId('today-empty')).toContainText('No words need review right now');
    await expect(page.getByTestId('today-next-review')).toHaveText('Tomorrow');
    await expect(page.getByTestId('today-bucket-new')).toContainText('0');
  });

  test('Start New Session from the end screen starts again when words are due', async ({ page }) => {
    const words = Array.from({ length: 12 }, (_, i) => word(`b${i}`, `bulk${i}`, [], null));
    await seed(page, words);
    await expect(page.getByTestId('today-due')).toHaveText('12 words');

    await page.getByTestId('start-session-btn').click();
    for (let i = 0; i < 12; i++) {
      await page.getByRole('button', { name: 'Show Answer' }).click();
      await page.locator('.difficulty-btn[data-difficulty="medium"]').click();
    }
    await expect(page.getByText('Session Complete!')).toBeVisible();

    await page.getByRole('button', { name: /Start New Session/ }).click();
    await expect(page.getByTestId('today-empty')).toBeVisible();
  });

  test('See all opens Words with the Difficult filter selected', async ({ page }) => {
    await seed(page, seedVocabulary());

    await page.getByTestId('tricky-see-all').click();

    await expect(page.locator('#list-tab')).toBeVisible();
    await expect(page.getByTestId('word-filter-difficult')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('word-list')).toContainText('shaky');
    await expect(page.getByTestId('word-list')).not.toContainText('steady');
  });

  test('a vocabulary without words asks to add some', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('today-empty')).toContainText('Add some words first');
    await expect(page.getByTestId('today-vocabulary')).toHaveCount(0);
    await expect(page.getByTestId('today-tricky')).toHaveCount(0);
  });

  test('the Today overview comes back after a visit to another tab', async ({ page }) => {
    await seed(page, seedVocabulary());

    await page.getByTestId('stats-tab-btn').click();
    await page.getByTestId('today-tab-btn').click();

    await expect(page.getByTestId('today-due')).toHaveText('2 words');
  });
});
