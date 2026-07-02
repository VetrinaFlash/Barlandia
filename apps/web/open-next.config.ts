import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * Config minima: niente cache incrementale R2/KV per ora (nessuna delle
 * nostre pagine usa ISR/revalidate — /login e /bar sono statiche e senza
 * dati lato server). Se in futuro serve caching distribuito tra isolate,
 * aggiungere qui l'override r2-incremental-cache + il binding R2 in
 * wrangler.jsonc (vedi https://opennext.js.org/cloudflare/caching).
 */
export default defineCloudflareConfig();
