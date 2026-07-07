/* ─── Atoikura Service Worker ──────────────────────────────────────────
 * PWA offline support for a single-file static app.
 *
 * NOTE: When the app changes, bump CACHE_VERSION (v1 -> v2 …) so the old
 * precache is discarded on activate and clients pick up the new shell.
 * ------------------------------------------------------------------------ */
const CACHE_VERSION = 'atoikura-v3';

// App shell precached on install. index.html is the single entry point;
// the rest are the PWA plumbing.
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

// Origins whose responses we runtime-cache (Google Fonts CSS + font files).
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first: serve from cache, else fetch and store a copy.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, response.clone());
  }
  return response;
}

// Network-first for navigations: keep the app fresh, fall back to cache
// (then the app shell) when offline.
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || caches.match('./index.html');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // HTML navigations → network-first.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Google Fonts (CSS + font files) → cache-first runtime caching.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Same-origin static assets (images/, icons, etc.) → cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Anything else: try cache, then network.
  event.respondWith(cacheFirst(request));
});
