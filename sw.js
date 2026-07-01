const CACHE_NAME = 'aethertask-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install Event - Cache core assets and activate immediately
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting(); // Activate new SW immediately without waiting for tabs to close
});

// Activate Event - Clean up old caches and claim all clients
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Take control of all open pages immediately
        })
    );
});

// Fetch Event (Network-first with cache fallback for offline support)
self.addEventListener('fetch', (e) => {
    // Skip caching for Supabase API requests and CDN scripts
    if (e.request.url.includes('supabase.co') ||
        e.request.url.includes('cdn.jsdelivr.net') ||
        e.request.url.includes('unpkg.com') ||
        e.request.url.includes('fonts.googleapis.com') ||
        e.request.url.includes('fonts.gstatic.com')) {
        return;
    }
    
    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                // Update cache with the fresh version
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseClone);
                });
                return networkResponse;
            })
            .catch(() => {
                // Network failed - serve from cache (offline mode)
                return caches.match(e.request);
            })
    );
});
