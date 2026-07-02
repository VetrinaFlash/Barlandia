/// <reference types="@cloudflare/workers-types" />

// Binding del worker, accessibili via getCloudflareContext() (OpenNext).
// `CloudflareEnv` è dichiarata come interfaccia globale dal pacchetto
// @opennextjs/cloudflare: qui la estendiamo per merging.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    SESSION_SECRET: string;
    REALTIME_WS_URL: string;
  }
}

export {};
