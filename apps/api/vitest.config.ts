import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Stub env so importing src/config.ts at test-collection time doesn't
    // explode. Integration / e2e tests override these via vitest.e2e.config.
    env: {
      NODE_ENV: 'test',
      API_PUBLIC_URL: 'http://localhost:4000',
      DATABASE_URL: 'postgresql://chipid:chipid@localhost:5432/chipid_test?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      ROOT_SECRET: 'unit-test-root-secret-thats-long-enough-to-validate',
      CSCA_TRUST_ANCHOR_PATH: './fixtures/csca/dev-csca.pem',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'ap-southeast-1',
      S3_BUCKET: 'chipid-test',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/**/index.ts'],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 60 },
    },
  },
});
