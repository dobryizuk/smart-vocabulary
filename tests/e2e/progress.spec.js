const { test, expect } = require('./fixtures');

const DAY_MS = 86400000;

// Words with answers on fixed days back from today, in the browser's own time zone
function seedVocabulary() {
  const answer = (daysAgo, difficulty) => {
    const date = new Date(Date.now() - daysAgo * DAY_MS);
    date.setHours(10, 0, 0, 0);
    return { date: date.toISOString(), difficulty, exerciseType: 'regular' };
  };
  const word = (id, original, reviewHistory, nextReview) => ({
    id, original, translation: `${original} (tr)`, definition: '', examples: [], phonetic: '', synonyms: [],
    easeFactor: 2, repetition: reviewHistory.length, nextReview, reviewHistory,
    createdAt: new Date(Date.now() - 30 * DAY_MS).toISOString()
  });
  const later = new Date(Date.now() + 5 * DAY_MS).toISOString();
  return [
    word('p1', 'lantern', [answer(2, 'easy'), answer(1, 'perfect'), answer(0, 'easy')], later),
    word('p2', 'harbour', [answer(1, 'easy'), answer(0, 'medium')], later),
    word('p3', 'rubble', [answer(0, 'hard')], new Date(Date.now() - DAY_MS).toISOString()),
    word('p4', 'thicket', [], null),
    word('p5', 'quill', [answer(9, 'easy'), answer(8, 'easy'), answer(7, 'easy'), answer(6, 'easy')], later)
  ];
}

test.describe('Progress', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((words) => {
      if (localStorage.getItem('seeded')) return;
      localStorage.setItem('seeded', '1');
      localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words }));
    }, seedVocabulary());
    await page.goto('/');
    await page.getByTestId('stats-tab-btn').click();
  });

  test('shows the day streak, its best, and the word total', async ({ page }) => {
    await expect(page.getByTestId('progress-streak-current')).toHaveText('3');
    await expect(page.getByTestId('progress-streak-best')).toHaveText('4');
    await expect(page.getByTestId('progress-total-value')).toHaveText('5');
  });

  test('buckets the words by status and counts those that need review', async ({ page }) => {
    await expect(page.getByTestId('progress-bucket-mastered')).toContainText('2');
    await expect(page.getByTestId('progress-bucket-learning')).toContainText('1');
    await expect(page.getByTestId('progress-bucket-difficult')).toContainText('1');
    await expect(page.getByTestId('progress-bucket-new')).toContainText('1');
    await expect(page.getByTestId('progress-due')).toContainText('2');
  });

  test('charts the answers of the last seven days, today last', async ({ page }) => {
    const bars = page.getByTestId('week-day');
    await expect(bars).toHaveCount(7);
    await expect(bars.last()).toHaveAttribute('data-count', '3');
    await expect(bars.nth(5)).toHaveAttribute('data-count', '2');
    await expect(bars.nth(4)).toHaveAttribute('data-count', '1');
    await expect(page.getByTestId('progress-week-total')).toHaveText('7 total');
  });
});
