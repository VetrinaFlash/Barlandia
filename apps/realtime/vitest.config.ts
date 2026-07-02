import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

export default defineConfig(async () => {
  // Le migration D1 vengono lette qui (contesto Node) e passate al worker
  // di test come binding, poi applicate in test/apply-migrations.ts.
  const migrations = await readD1Migrations(path.join(__dirname, '../../migrations'));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            SESSION_SECRET: 'segreto-di-test',
            ALLOWED_ORIGINS: 'http://localhost:3000',
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
    },
  };
});
