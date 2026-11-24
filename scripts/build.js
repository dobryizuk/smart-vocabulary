const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const SHORT_HASH_LENGTH = 7;

function getCommit() {
    if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, SHORT_HASH_LENGTH);
    try {
        return execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
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
    define: { __APP_COMMIT__: JSON.stringify(getCommit()) }
}).catch(() => process.exit(1));
