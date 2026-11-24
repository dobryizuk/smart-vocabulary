import { describe, it, expect, afterEach, vi } from 'vitest';

const { getVersionLabel, getCommit } = require('../../js/app-version.js');
const { version } = require('../../package.json');

describe('App version label', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows dev as the commit when the build did not inject one', () => {
    expect(getCommit()).toBe('dev');
    expect(getVersionLabel()).toBe(`Version ${version} · dev`);
  });

  it('shows the commit injected at build time', () => {
    vi.stubGlobal('__APP_COMMIT__', 'a1b2c3d');

    expect(getVersionLabel()).toBe(`Version ${version} · a1b2c3d`);
  });
});
