/**
 * Saral Niti — Progressive Web App Service Worker (v1.1)
 * Provides offline shell caching, stale-while-revalidate API caching,
 * and village/gram-panchayat offline resilience.
 */

const CACHE_VERSION = 'saral-niti-v1.1';
const DATA_CACHE_NAME = 'saral-niti-data-v1.1';

const STATIC_SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/static/manifest.json',
  '/static/css/main.css',
  '/static/css/base.css',
  '/static/css/navbar.css',
  '/static/css/hero.css',
  '/static/css/schemes.css',
  '/static/css/modals.css',
  '/static/css/footer.css',
  '/static/css/dark-mode.css',
  '/static/js/family_vault.js',
  '/static/js/main.js',
  '/static/js/chatbot.js',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/icon-maskable.png',
  '/static/icons/favicon.svg',
  '/static/icons/favicon.ico',
  // Standalone frontend relative asset paths
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/base.css',
  './css/navbar.css',
  './css/hero.css',
  './css/schemes.css',
  './css/modals.css',
  './css/footer.css',
  './css/dark-mode.css',
  './js/family_vault.js',
  './js/main.js',
  './js/chatbot.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/favicon.svg',
  './icons/favicon.ico'
];

// Pre-cache core app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Use allSettled so individual missing paths in different environments don't abort install
      const cachePromises = STATIC_SHELL_ASSETS.map((url) =>
        fetch(url, { cache: 'no-cache' })
          .then((res) => {
            if (res.ok) return cache.put(url, res);
          })
          .catch(() => {
            // Silently ignore optional paths that don't apply to the active host
          })
      );
      await Promise.allSettled(cachePromises);
    })
  );
});

// Clean up stale caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION && key !== DATA_CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch interception strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Navigation requests (HTML pages) -> Network-first with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match('/') || await caches.match('./index.html') || await caches.match('/index.html');
          return fallback || new Response(
            '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Saral Niti Offline</h2><p>You are offline. Please reconnect to load new pages.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 2. Read-only API requests (/api/schemes, /api/schemes/filter, /api/schemes/<id>)
  if (url.pathname.startsWith('/api/schemes') && req.method === 'GET') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(DATA_CACHE_NAME).then((c) => c.put(req, copy));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;

          // If exact query not cached, try base /api/schemes cache
          const baseCached = await caches.match('/api/schemes?page=1&limit=24') ||
                             await caches.match('/api/schemes');
          if (baseCached) return baseCached;

          return new Response(
            JSON.stringify({
              schemes: [],
              total: 0,
              offline: true,
              message: 'Offline mode active. No cached records found for this specific query.'
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 3. Mutation or Non-GET API calls while offline
  if (url.pathname.startsWith('/api/') && req.method !== 'GET') {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'offline',
            status: 'offline',
            message: 'You are currently offline. Please reconnect to access online AI and verification services.'
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 4. Static assets (CSS, JS, Fonts, Images) -> Cache-first with network refresh
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        // Asynchronously revalidate in background if online
        fetch(req).then((freshRes) => {
          if (freshRes.ok) {
            caches.open(CACHE_VERSION).then((c) => c.put(req, freshRes));
          }
        }).catch(() => {});
        return cachedRes;
      }
      return fetch(req).then((networkRes) => {
        if (networkRes.ok && (req.url.startsWith('http') || req.url.startsWith('/'))) {
          const copy = networkRes.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return networkRes;
      });
    })
  );
});

