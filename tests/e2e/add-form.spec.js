const { test, expect } = require('@playwright/test');

// A service worker would let requests bypass page.route, so none is registered here
test.use({ serviceWorkers: 'block' });

const FIELD_LABELS = [/word or phrase/i, /phonetic/i, /definition/i, /translation/i, /synonyms/i, /examples/i];

const savedWord = (id, original) => ({
  id, original, translation: `${original} (tr)`, definition: '', examples: [], phonetic: '', synonyms: [],
  easeFactor: 2, repetition: 0, nextReview: null, reviewHistory: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
});

// Every lookup request waits for release(), so the loading state can be inspected; no real server is reached
async function mockLookup(page) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const reply = (body) => async (route) => {
    await gate;
    await route.fulfill({ json: body });
  };
  await page.route(/api\.dictionaryapi\.dev/, reply([{
    word: 'lantern', phonetic: '/ˈlæntən/',
    meanings: [{ partOfSpeech: 'noun', synonyms: ['lamp'], definitions: [{ definition: 'A case with a light inside.', example: 'She lit the lantern.' }] }]
  }]));
  await page.route(/api\.datamuse\.com/, reply([]));
  await page.route(/translate\.googleapis\.com/, reply([[['фонарь']]]));
  return release;
}

async function seedWords(page, words) {
  await page.addInitScript((seed) => {
    if (!localStorage.getItem('vocabulary')) {
      localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words: seed }));
    }
  }, words);
}

test.describe('Add form', () => {
  test.beforeEach(async ({ page }) => {
    await seedWords(page, [savedWord('w1', 'anchor')]);
    await page.goto('/');
    await page.getByTestId('add-tab-btn').click();
  });

  test('has no More Fields button and shows every field', async ({ page }) => {
    await expect(page.getByTestId('toggle-fields-btn')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /more fields/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^clear$/i })).toHaveCount(0);
    for (const label of FIELD_LABELS) {
      await expect(page.getByRole('textbox', { name: label })).toBeVisible();
    }
  });

  test('typing shows the clear button and pressing it empties every field', async ({ page }) => {
    const clear = page.getByTestId('clear-form-btn');
    await expect(clear).toBeHidden();

    await page.getByRole('textbox', { name: /translation/i }).fill('якорь');
    await expect(clear).toBeVisible();

    await page.getByTestId('original-word-input').fill('anchor');
    await page.getByRole('textbox', { name: /phonetic/i }).fill('/x/');
    await page.getByRole('textbox', { name: /definition/i }).fill('heavy');
    await page.getByRole('textbox', { name: /synonyms/i }).fill('hook');
    await page.getByRole('textbox', { name: /examples/i }).fill('drop it');
    await clear.click();

    for (const label of FIELD_LABELS) {
      await expect(page.getByRole('textbox', { name: label })).toHaveValue('');
    }
    await expect(clear).toBeHidden();
    await expect(page.getByTestId('original-word-input')).toBeFocused();
  });

  test('the phonetic speaker shows only while there is a word', async ({ page }) => {
    const speaker = page.getByTestId('speak-original-btn');
    await expect(speaker).toBeHidden();

    await page.getByTestId('original-word-input').fill('lantern');
    await expect(speaker).toBeVisible();

    await page.getByTestId('original-word-input').fill('');
    await expect(speaker).toBeHidden();
  });

  test('a pending lookup shows the loading state and restores the normal one afterwards', async ({ page }) => {
    const release = await mockLookup(page);
    await page.getByTestId('original-word-input').fill('lantern');
    const lookup = page.getByTestId('dictionary-lookup-btn');

    await lookup.click();

    await expect(lookup).toBeDisabled();
    await expect(lookup).toHaveText('Looking up…');
    await expect(lookup.locator('.spinner')).toBeVisible();
    await expect(page.getByTestId('original-word-input')).not.toBeEditable();
    await expect(page.getByRole('textbox', { name: /translation/i })).not.toBeEditable();

    release();

    await expect(lookup).toBeEnabled();
    await expect(lookup).toHaveText('Lookup');
    await expect(lookup.locator('.spinner')).toHaveCount(0);
    await expect(page.getByTestId('original-word-input')).toBeEditable();
    await expect(page.getByRole('textbox', { name: /translation/i })).toHaveValue('фонарь');
    await expect(page.getByRole('textbox', { name: /phonetic/i })).toHaveValue('/ˈlæntən/');
  });

  test('a lookup with the services unreachable restores the normal state too', async ({ page }) => {
    await page.route(/dictionaryapi|datamuse|googleapis|mymemory|wiktionary/, route => route.abort());
    await page.getByTestId('original-word-input').fill('lantern');
    const lookup = page.getByTestId('dictionary-lookup-btn');

    await lookup.click();

    await expect(lookup).toBeEnabled();
    await expect(lookup).toHaveText('Lookup');
    await expect(page.getByTestId('original-word-input')).toBeEditable();
  });

  test('Save opens Words on All with the new word first, highlighted, and clears the form', async ({ page }) => {
    await page.getByTestId('original-word-input').fill('lantern');
    await page.getByRole('textbox', { name: /translation/i }).fill('фонарь');
    await page.getByTestId('save-word-btn').click();

    await expect(page.locator('text=Word added successfully')).toBeVisible();
    await expect(page.locator('#list-tab')).toBeVisible();
    await expect(page.getByTestId('word-filter-all')).toHaveAttribute('aria-pressed', 'true');
    const rows = page.locator('[data-testid="word-group-due"] .word-card');
    await expect(rows.first()).toContainText('lantern');
    await expect(rows.nth(1)).toContainText('anchor');
    await expect(rows.first()).toHaveClass(/word-card--new/);
    await expect(rows.nth(1)).not.toHaveClass(/word-card--new/);
    await expect(rows.first()).not.toHaveClass(/word-card--new/, { timeout: 5000 });

    await page.getByTestId('add-tab-btn').click();
    await expect(page.getByTestId('original-word-input')).toHaveValue('');
    await expect(page.getByTestId('clear-form-btn')).toBeHidden();
  });

  test('a duplicate stays on Add', async ({ page }) => {
    await page.getByTestId('original-word-input').fill('anchor');
    await page.getByRole('textbox', { name: /translation/i }).fill('якорь');
    await page.getByTestId('save-word-btn').click();

    await expect(page.locator('text=This word already exists')).toBeVisible();
    await expect(page.locator('#add-tab')).toBeVisible();
    await expect(page.getByTestId('original-word-input')).toHaveValue('anchor');
  });
});
