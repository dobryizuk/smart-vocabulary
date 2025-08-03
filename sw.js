// Smart Vocabulary - Service Worker
const CACHE_NAME = 'smart-vocabulary-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/js/app.js',
  '/css/styles.css',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
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
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  console.log('Service Worker: Fetching', event.request.url);
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // If both cache and network fail, show offline page
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
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