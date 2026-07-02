const CACHE_NAME = 'aethertask-v5';
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

// Push Event - Display a notification for incoming task reminders
self.addEventListener('push', (e) => {
    let payload = { title: 'AetherTask', body: 'You have a task update.' };
    if (e.data) {
        try {
            payload = e.data.json();
        } catch (err) {
            payload.body = e.data.text();
        }
    }

    e.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: './icon-192.png',
            badge: './icon-192.png',
            data: { taskId: payload.taskId || null },
            requireInteraction: true,
            vibrate: [200, 100, 200]
        })
    );
});

// Notification Click - Only reuse a window that's already focused (actively
// visible to the user); otherwise open fresh so Android routes the tap into
// the installed PWA instead of resurfacing a backgrounded browser tab.
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
            const focusedClient = clientsList.find(c => c.focused && c.url.includes(self.registration.scope));
            if (focusedClient) {
                return focusedClient.focus();
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow('./');
            }
        })
    );
});
