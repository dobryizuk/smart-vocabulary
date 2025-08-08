import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/dom/setup.js'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
});
