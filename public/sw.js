// SAMOSA's service worker: cache what the app needs, keep the network out.
//
// Cache-first for the fingerprinted assets. Network-first for the pages, so
// a deploy reaches everybody and the installed app still works on a plane. The CSP
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

  if (url.pathname.indexOf('/assets/') === 0) {
    // cache-first: the assets are fingerprinted, so an entry is never stale
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

  // The pages are not fingerprinted: a cache-first page would pin a visitor
  // to the first engine they loaded, fixes and all, because this file does
  // not change between deploys. So the pages are network-first, and the
  // cache is the answer only when there is no network.
  var pages = ['/', '/index.html', '/app', '/app/', '/app/index.html'];
  if (pages.indexOf(url.pathname) !== -1) {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response.ok) {
            var copy = response.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(event.request);
        }),
    );
  }
});
