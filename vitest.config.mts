import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-not-for-production';
process.env.JWT_EXPIRES_IN = '1h';
process.env.GRAPHQL_DEPTH_LIMIT = '6';
process.env.RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_WINDOW_MS = '60000';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});
