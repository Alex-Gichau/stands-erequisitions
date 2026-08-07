const CACHE_NAME = 'stands-cache-v3-clear';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only intercept HTTP/HTTPS schemes to avoid browser extension/internal errors
  if (!e.request.url.startsWith('http') && !e.request.url.startsWith('https')) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch((err) => {
      console.warn('[SW] Fetch failed for:', e.request.url, err);
      throw err;
    })
  );
});
