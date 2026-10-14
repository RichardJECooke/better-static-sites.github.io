import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'use-screenshots/tests/**/*.test.mjs',
      'generate-screenshots/tests/**/*.test.mjs',
    ],
    environment: 'node',
    // chrome/placeholder tests use sharp which is native -- run them serially
    // to avoid port/resource contention
    pool: 'forks',
    timeout: 30000,
  },
});
