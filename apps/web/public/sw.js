/**
 * Service worker minimale di Barlandia: quanto basta per l'installabilità
 * PWA (iOS/Android). Nessun offline reale: il gioco è online per natura.
 * Cache solo per shell statica (icone/manifest), rete per tutto il resto.
 */
const CACHE = 'barlandia-static-v1';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // niente cache per API e WebSocket: solo asset statici noti
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit ?? fetch(event.request)),
    );
  }
  // per tutto il resto: comportamento di rete predefinito
});
