// Service Worker for Thermal POS & Billing Manager (Ultra-Lightweight & Offline-First)
const CACHE_NAME = 'thermal-pos-v8-offline';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // NEVER intercept cross-origin requests (e.g. Google Fonts, Firebase, CDNs)
  if (url.origin !== self.location.origin) {
    return;
  }

  // CRITICAL: Do NOT intercept or cache API requests or Vite dev modules / scripts
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('/node_modules/')
  ) {
    return;
  }

  // Fast Stale-While-Revalidate for navigation: Open instantly in 10ms from cache whether Data is ON or OFF!
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        // Background revalidation
        const bgFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        // If cached shell is available, return it immediately for instant 0ms cold-start!
        if (cached) {
          return cached;
        }
        return bgFetch.then((res) => res || fetch(request));
      })
    );
    return;
  }

  // Cache-First for static assets (/icon.svg, /manifest.json), fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});


