// Smart Vocabulary - Service Worker
const CACHE_NAME = 'smart-vocabulary-v3';
const BASE_PATH = location.pathname.replace(/\/[^\/]*$/, '/'); // Dynamic base path
const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'dist/app.bundle.js',
  BASE_PATH + 'css/themes.css',
  BASE_PATH + 'css/base.css',
  BASE_PATH + 'css/navigation.css',
  BASE_PATH + 'css/components.css',
  BASE_PATH + 'css/forms.css',
  BASE_PATH + 'css/learning.css',
  BASE_PATH + 'css/stats.css',
  BASE_PATH + 'css/today.css',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'icon-192.png',
  BASE_PATH + 'icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  self.skipWaiting(); // Force new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Service Worker: Cache failed', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take control of all clients immediately
    })
  );
});

// Fetch event - network first so deploys reach users; cache is the offline fallback
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match(BASE_PATH + 'index.html');
        return Response.error();
      }))
  );
});

// Background sync for data synchronization
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  if (event.tag === 'vocabulary-sync') {
    event.waitUntil(syncVocabularyData());
  }
});

// Sync vocabulary data when online
async function syncVocabularyData() {
  console.log('Service Worker: Syncing vocabulary data...');
  // This would sync with a backend service if implemented
  // For now, we rely on localStorage
}