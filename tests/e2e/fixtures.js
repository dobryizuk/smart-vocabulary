// Shared e2e fixtures: every page runs with the voice library CDN and the model host
// blocked, so tests never download the ~90 MB Kokoro model
const base = require('@playwright/test');

const BLOCKED_HOSTS = ['cdn.jsdelivr.net', 'huggingface.co', 'hf.co'];
const isBlocked = (url) => BLOCKED_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));

const test = base.test.extend({
  context: async ({ context }, use) => {
    await context.route(isBlocked, route => route.abort());
    await use(context);
  }
});

module.exports = { test, expect: base.expect, isBlocked };
