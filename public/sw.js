// TripMate service worker — makes the installed web app (Android "Install app",
// iPhone "Add to Home Screen") open and work without a connection.
//
// Strategy
// - Page navigations and RSC payloads: network first, cached copy when offline.
// - /_next/static/*: cache first (file names are content-hashed, so never stale).
// - Other same-origin GETs (icons, images, manifest): stale-while-revalidate.
// - Cross-origin requests (Supabase, fonts) and /api/*: untouched, so trip data
//   is never served stale from this cache; the app's own local store handles offline data.

const VERSION = 'v2';
const PAGE_CACHE = `tripmate-pages-${VERSION}`;
const STATIC_CACHE = `tripmate-static-${VERSION}`;
const ASSET_CACHE = `tripmate-assets-${VERSION}`;
const CURRENT = [PAGE_CACHE, STATIC_CACHE, ASSET_CACHE];

const PRECACHE_PAGES = ['/', '/create-trip', '/join-trip', '/login'];
const PRECACHE_ASSETS = ['/manifest.json', '/logo.png', '/icon.png', '/apple-icon.png'];
const NETWORK_TIMEOUT_MS = 4000;

// Cache each URL on its own so one missing file cannot abort the whole install.
async function cacheEach(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, res);
      } catch {
        // offline during install — picked up on a later visit
      }
    })
  );
}

// Precache pages together with the hashed JS/CSS they reference, so the app shell
// boots offline even on routes the user has not opened yet.
async function precachePages() {
  const pages = await caches.open(PAGE_CACHE);
  const statics = new Set();
  await Promise.all(
    PRECACHE_PAGES.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (!res.ok) return;
        const html = await res.clone().text();
        await pages.put(url, res);
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) statics.add(m[0]);
      } catch {
        // offline during install
      }
    })
  );
  await cacheEach(STATIC_CACHE, [...statics]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([precachePages(), cacheEach(ASSET_CACHE, PRECACHE_ASSETS)]));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !CURRENT.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function networkFirst(request, { fallbackToShell }) {
  const cache = await caches.open(PAGE_CACHE);
  const network = fetch(request).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    if (fallbackToShell) {
      const shell = await cache.match('/');
      if (shell) return shell;
    }
    return network; // nothing cached: surface the real network result/error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then((res) => {
      if (res.ok && res.type === 'basic') cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, { fallbackToShell: true }));
    return;
  }
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) {
    event.respondWith(networkFirst(request, { fallbackToShell: false }));
    return;
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
