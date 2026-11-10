// SAMOSA's service worker: cache what the app needs, keep the network out.
//
// Cache-first for the assets and for /app/, so the installed app works on a
// plane. Network-first for /, so the landing page is never stale. The CSP
// already allows a same-origin worker and a same-origin manifest.

var CACHE = 'samosa-v1';

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    self.clients.claim().then(function () {
      // the cache of an older version is dropped, so a deploy takes effect
      // without a hard refresh
      return caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            }),
        );
      });
    }),
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  if (url.pathname.indexOf('/assets/') === 0 || url.pathname === '/app/' || url.pathname === '/app/index.html') {
    // cache-first: these are fingerprinted, so a stale entry cannot exist
    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(event.request).then(function (hit) {
          if (hit) return hit;
          return fetch(event.request).then(function (response) {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        });
      }),
    );
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    // network-first, with the cache as the offline answer
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(function () {
          return caches.match(event.request);
        }),
    );
  }
});
