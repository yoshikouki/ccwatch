import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.test.ts'],
    testTimeout: 30000, // E2Eテストは時間がかかる
    hookTimeout: 30000,
  }
});