import { applyD1Migrations, env } from 'cloudflare:test';

// Applica lo schema completo prima di ogni file di test.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
