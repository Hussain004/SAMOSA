import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    benchmark: { include: ['tests/**/*.bench.ts'] },
    testTimeout: 30_000,
  },
});
