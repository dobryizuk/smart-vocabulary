// ============================================================================
// APP VERSION - the package version and the commit injected at build time
// ============================================================================

/* global __APP_COMMIT__ -- injected by esbuild define in scripts/build.js */

const { version } = require('../package.json');

const DEV_COMMIT = 'dev';

function getCommit() {
    return typeof __APP_COMMIT__ === 'undefined' ? DEV_COMMIT : __APP_COMMIT__;
}

function getVersionLabel() {
    return `Version ${version} · ${getCommit()}`;
}

module.exports = { getVersionLabel, getCommit };
