// ============================================================================
// APP VERSION - the major version, the build number and the commit injected at build time
// ============================================================================

/* global __APP_COMMIT__, __APP_BUILD__ -- injected by esbuild define in scripts/build.js */

const { version } = require('../package.json');

const DEV = 'dev';
const MAJOR = version.split('.')[0];

function getCommit() {
    return typeof __APP_COMMIT__ === 'undefined' ? DEV : __APP_COMMIT__;
}

function getBuild() {
    return typeof __APP_BUILD__ === 'undefined' ? DEV : __APP_BUILD__;
}

function getVersionLabel() {
    return `Version ${MAJOR}.${getBuild()} · ${getCommit()}`;
}

module.exports = { getVersionLabel, getCommit };
