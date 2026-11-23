const { test, expect } = require('@playwright/test');

// A service worker would let requests bypass page.route, so none is registered here
test.use({ serviceWorkers: 'block' });

// The real server is never reached: every request to it is recorded and aborted.
// The probe host cannot resolve, so it proves the interception without contacting anyone.
async function blockServer(page) {
    const requests = [];
    await page.route(/supabase\.co/, (route) => {
        requests.push(route.request().url());
        return route.abort();
    });
    return requests;
}

async function expectServerBlocked(page, requests) {
    const probe = 'https://probe.supabase.co.invalid/';
    await page.evaluate((url) => fetch(url).catch(() => null), probe);
    expect(requests).toEqual([probe]);
    requests.length = 0;
}

async function addWord(page, original, translation) {
    await page.getByTestId('add-tab-btn').click();
    await page.getByTestId('original-word-input').fill(original);
    await page.getByTestId('toggle-fields-btn').click();
    await page.getByRole('textbox', { name: /translation/i }).fill(translation);
    await page.getByTestId('save-word-btn').click();
    await expect(page.locator('text=Word added successfully')).toBeVisible();
}

test.describe('Cloud backup', () => {
    test('signed out: offers sign-in in Stats and never contacts the server, even after a save', async ({ page }) => {
        const requests = await blockServer(page);
        await page.goto('/');
        await expectServerBlocked(page, requests);

        await page.getByTestId('stats-tab-btn').click();
        await expect(page.getByTestId('progress-cloud-status')).toHaveText('Not signed in');
        await page.getByTestId('progress-cloud-row').click();
        await expect(page.getByTestId('sync-sign-in-form')).toBeVisible();
        await expect(page.getByTestId('sync-email')).toHaveAttribute('autocomplete', 'username');
        await expect(page.getByTestId('sync-password')).toHaveAttribute('autocomplete', 'current-password');

        await addWord(page, 'offline', 'офлайн');
        await page.waitForTimeout(5500);

        expect(requests).toEqual([]);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary')).words);
        expect(saved).toHaveLength(1);
        expect(saved[0].updatedAt).toBe(saved[0].createdAt);
    });

    test('an unreachable server shows the sign-in error and keeps the app working', async ({ page }) => {
        const requests = await blockServer(page);
        await page.goto('/');
        await addWord(page, 'kept', 'сохранено');

        await page.getByTestId('stats-tab-btn').click();
        await page.getByTestId('open-settings-btn').click();
        await expectServerBlocked(page, requests);
        await page.getByTestId('sync-email').fill('learner@example.com');
        await page.getByTestId('sync-password').fill('not-a-real-password');
        await page.getByTestId('sync-sign-in-btn').click();

        await expect(page.getByTestId('sync-error')).not.toBeEmpty();
        await expect(page.getByTestId('sync-sign-in-form')).toBeVisible();
        expect(requests.length).toBeGreaterThan(0);

        await page.getByTestId('list-tab-btn').click();
        await expect(page.locator('#wordList')).toContainText('kept');
    });
});
