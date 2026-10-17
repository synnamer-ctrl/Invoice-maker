// Bump this version whenever cached assets change.
const CACHE_VERSION = 'v9';
const CACHE_NAME = `invoice-maker-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/storage.js',
  './js/company.js',
  './js/document.js',
  './js/products.js',
  './js/history.js',
  './js/format.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload' skips the browser's HTTP cache. GitHub Pages lets files
    // be reused for 10 minutes, which could otherwise store old files here.
    caches.open(CACHE_NAME).then((cache) => cache.addAll(
      PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))
    ))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network first, so the page, styles and scripts always come from the same
  // deployed version. 'no-cache' revalidates with the server (a quick 304 when
  // unchanged) instead of trusting the browser's HTTP cache. Offline, fall back
  // to the cached copy.
  const isPage = request.mode === 'navigate';
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(isPage ? './index.html' : request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(isPage ? './index.html' : request)) ?? Response.error())
  );
});
