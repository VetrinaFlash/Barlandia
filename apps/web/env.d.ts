/// <reference types="@cloudflare/workers-types" />

// Binding disponibili via getRequestContext().env (next-on-pages)
interface CloudflareEnv {
  DB: D1Database;
  SESSION_SECRET: string;
  REALTIME_WS_URL: string;
}
