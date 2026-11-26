import { describe, it, expect, afterEach, vi } from 'vitest';

const { getVersionLabel, getCommit } = require('../../js/app-version.js');
const { version } = require('../../package.json');

const major = version.split('.')[0];

describe('App version label', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows dev for the build and the commit when the build did not inject them', () => {
    expect(getCommit()).toBe('dev');
    expect(getVersionLabel()).toBe(`Version ${major}.dev · dev`);
  });

  it('shows the build number and the commit injected at build time', () => {
    vi.stubGlobal('__APP_COMMIT__', 'a1b2c3d');
    vi.stubGlobal('__APP_BUILD__', '48');

    expect(getVersionLabel()).toBe(`Version ${major}.48 · a1b2c3d`);
  });

});
