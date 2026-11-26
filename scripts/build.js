const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const SHORT_HASH_LENGTH = 7;

const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();

function getCommit() {
    if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, SHORT_HASH_LENGTH);
    try {
        return git('rev-parse', '--short', 'HEAD');
    } catch {
        return 'dev';
    }
}

// Commits on the branch: grows with every deploy, so a bigger build is a newer app
function getBuild() {
    try {
        return git('rev-list', '--count', 'HEAD');
    } catch {
        return 'dev';
    }
}

build({
    absWorkingDir: root,
    entryPoints: ['js/app-init.js'],
    bundle: true,
    outfile: 'dist/app.bundle.js',
    format: 'iife',
    globalName: 'SVApp',
    target: ['es2019'],
    minify: true,
    sourcemap: true,
    define: { __APP_COMMIT__: JSON.stringify(getCommit()), __APP_BUILD__: JSON.stringify(getBuild()) }
}).catch(() => process.exit(1));
