import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],

    // Integration tests share one PostgreSQL database and truncate between
    // cases, so test files must not run concurrently. Revisit with a
    // per-worker database if the suite gets slow enough to matter.
    fileParallelism: false,

    // A hung SSH call or DB connection should fail loudly, not stall CI.
    testTimeout: 15_000,
    hookTimeout: 30_000,

    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['api/**/*.ts'],
      exclude: [
        'api/index.ts', // process bootstrap: side effects only
        'api/**/*.d.ts',
        'api/models/**', // type declarations
      ],
    },
  },
});
