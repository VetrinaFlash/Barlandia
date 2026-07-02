import type { D1Migration } from '@cloudflare/vitest-pool-workers';

declare global {
  namespace Cloudflare {
    // `env` di cloudflare:test è tipizzato come Cloudflare.Env: qui
    // dichiariamo i binding del worker (come farebbe `wrangler types`)
    // più le migration passate dal vitest.config.
    interface Env {
      ROOM: DurableObjectNamespace;
      DB: D1Database;
      SESSION_SECRET: string;
      ALLOWED_ORIGINS: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
