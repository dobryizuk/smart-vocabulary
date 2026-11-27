const { test, expect } = require('./fixtures');

// C31: on a long chunk the tiles sit below the fold; pressing a tile or Undo must not scroll the screen back up
const CHUNK = 'take something for granted';
const chunkWord = {
  id: 'c1', original: CHUNK, translation: 'принимать как должное',
  definition: 'To fail to properly appreciate someone or something, especially as a result of overfamiliarity, '
    + 'and to assume that they will always be there and always behave in the same way.',
  examples: [], synonyms: [], easeFactor: 2.5, repetition: 1, nextReview: null,
  reviewHistory: [{ date: '2026-11-20T10:00:00.000Z', difficulty: 'easy', exerciseType: 'regular' }],
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
};

test.use({ viewport: { width: 375, height: 667 } });

test.describe('Build exercise with a long chunk below the fold', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((seed) => {
      if (!localStorage.getItem('vocabulary')) {
        localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: [seed] }));
      }
    }, chunkWord);
    await page.goto('/');
    await page.getByTestId('start-session-btn').click();
    await expect(page.getByText('Build the word')).toBeVisible();
  });

  const scrollTop = (page) => page.locator('#today-tab').evaluate((tab) => tab.scrollTop);

  // The tile is fully on screen, between the top and the sticky Undo/Check bar, so it can be tapped as it is
  const expectTappableInPlace = async (page, tile) => {
    const box = await tile.boundingBox();
    const controls = await page.locator('.build-controls').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(controls.y);
  };

  // Scroll the screen to its end, where the last row of tiles sits right above the controls
  const scrollToTiles = async (page) => {
    const tab = page.locator('#today-tab');
    const overflow = await tab.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(overflow).toBeGreaterThan(0);
    await tab.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const top = await scrollTop(page);
    expect(top).toBeGreaterThan(0);
    return top;
  };

  const tile = (page, letter) => page.locator(`.build-tile[data-arg="${letter}"]`);

  test('a tapped tile, the next tile and Undo keep the scroll position', async ({ page }) => {
    const top = await scrollToTiles(page);

    let built = '';
    for (const letter of 'tak') {
      await expectTappableInPlace(page, tile(page, letter));
      await tile(page, letter).tap();
      built += letter;
      await expect(page.getByTestId('build-slots')).toHaveAttribute('aria-label', new RegExp(`^Your answer: ${built} `));
      expect(await scrollTop(page)).toBe(top);
    }

    await page.getByRole('button', { name: 'Undo' }).tap();
    await expect(page.getByTestId('build-slots')).toHaveAttribute('aria-label', /^Your answer: ta /);
    expect(await scrollTop(page)).toBe(top);
    await expectTappableInPlace(page, tile(page, 'k'));
  });

  test('Check keeps the built answer and the correct answer on screen', async ({ page }) => {
    await page.evaluate(() => { for (const letter of 'takesomethingforgrante') window.SV.LearningSession.placeBuildLetter(letter); });
    const top = await scrollToTiles(page);
    await tile(page, 'd').tap();
    expect(await scrollTop(page)).toBe(top);

    await page.getByTestId('build-check').tap();

    await expect(page.locator('.build-feedback--correct')).toBeVisible();
    await expect(page.locator('.card-translation')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('build-slots')).toBeInViewport({ ratio: 1 });
  });

  test('a clicked tile keeps the scroll position too', async ({ page }) => {
    const top = await scrollToTiles(page);
    await tile(page, 't').click();
    await expect(page.getByTestId('build-slots')).toHaveAttribute('aria-label', /^Your answer: t /);
    expect(await scrollTop(page)).toBe(top);
    await expectTappableInPlace(page, tile(page, 'a'));
  });
});
