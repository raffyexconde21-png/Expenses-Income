// Expenses & Income Tracker Service Worker (v5)
// Auto-update strategy with versioned cache + skipWaiting + clients.claim

// ⬇️ BUMP this when you deploy a new version
const CACHE = 'exin-cache-v5';

// Assets to pre-cache
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
  // Activate new SW immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Strategy:
// - For HTML navigations: Network-first (get latest index.html), fallback to cache offline
// - For others (CSS/JS/Icons): Cache-first with background update
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin requests
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; 

  const acceptsHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (acceptsHTML) {
    // Network-first for pages
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets: cache-first with background update
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached || Promise.reject('offline'));
      return cached || fetchPromise;
    })
  );
});
