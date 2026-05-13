const CACHE_VERSION = 'v8';
const CACHE_NAME = `aia-cache-${CACHE_VERSION}`;

self.addEventListener('install', event => {
  console.log('[SW] Install skip');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Self-destruct: clearing all caches and unregistering');
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(n => caches.delete(n)))
    ).then(() => self.registration.unregister())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
