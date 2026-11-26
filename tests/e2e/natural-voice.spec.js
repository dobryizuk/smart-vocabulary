const { test, expect, isBlocked } = require('./fixtures');
const fixture = require('../test-vocabulary.json');

test('never downloads the voice model: the blocked hosts fail and Settings says the natural voice is unavailable', async ({ page, context }) => {
  const attempted = [];
  const finished = [];
  context.on('request', request => { if (isBlocked(new URL(request.url()))) attempted.push(request.url()); });
  context.on('requestfinished', request => { if (isBlocked(new URL(request.url()))) finished.push(request.url()); });
  await page.addInitScript((words) => {
    localStorage.setItem('vocabulary', JSON.stringify({ schemaVersion: 1, words }));
  }, fixture.vocabulary);

  await page.goto('/');
  await page.getByTestId('stats-tab-btn').click();
  await page.getByTestId('open-settings-btn').click();

  await expect(page.getByTestId('natural-voice-status')).toHaveText('Natural voice: unavailable');
  expect(attempted.length).toBeGreaterThan(0);
  expect(finished).toEqual([]);
});
