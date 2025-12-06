// Import Pusher Beams service worker
importScripts("https://js.pusher.com/beams/service-worker.js");

// Service worker installation
self.addEventListener('install', (event) => {
    console.log('Platform Fighter Service Worker installing...');
    event.waitUntil(
        caches.open('platform-fighter-v1').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/style.css',
                '/client.js',
                '/assets.json',
                '/favicon.ico'
            ]);
        })
    );
});

// Service worker activation
self.addEventListener('activate', (event) => {
    console.log('Platform Fighter Service Worker activating...');
    
    // Clean up old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== 'platform-fighter-v1') {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Take control of all clients
    return self.clients.claim();
});

// Fetch event - handle cache and network requests
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests and browser extension requests
    if (event.request.method !== 'GET' || 
        event.request.url.startsWith('chrome-extension://') ||
        event.request.url.includes('extension')) {
        return;
    }

    // Skip WebSocket requests
    if (event.request.url.startsWith('ws://') || 
        event.request.url.startsWith('wss://')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached response if available
            if (cachedResponse) {
                return cachedResponse;
            }

            // Otherwise fetch from network
            return fetch(event.request).then((networkResponse) => {
                // Cache the response for future use (except for API calls)
                if (!event.request.url.includes('/api/') && 
                    networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open('platform-fighter-v1').then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch((error) => {
                // Network failed, try to return a fallback
                console.log('Network request failed, returning offline page:', error);
                
                // If this is a page request, return offline page
                if (event.request.headers.get('Accept').includes('text/html')) {
                    return caches.match('/offline.html') || 
                           new Response('You are offline. Please check your connection.');
                }
                
                // For other requests, return a generic error
                return new Response('Network error occurred', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' }
                });
            });
        })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);
    
    if (!event.data) {
        console.log('Push event but no data');
        return;
    }
    
    let data;
    try {
        data = event.data.json();
    } catch (error) {
        console.log('Push data is not JSON:', error);
        data = {
            title: 'Platform Fighter',
            body: 'You have a new notification!'
        };
    }
    
    const options = {
        body: data.body || 'New game notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
            roomId: data.roomId
        },
        actions: [
            {
                action: 'play',
                title: 'Join Game',
                icon: '/icons/game-72x72.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/icons/dismiss-72x72.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Platform Fighter', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.notification);
    
    event.notification.close();
    
    const urlToOpen = event.notification.data.url || '/';
    
    // Handle action buttons
    if (event.action === 'play') {
        // Open the game and join specific room if available
        const roomId = event.notification.data.roomId;
        const gameUrl = roomId ? `/?room=${roomId}` : '/';
        urlToOpen = gameUrl;
    }
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((windowClients) => {
            // Check if there's already a window/tab open with the target URL
            for (let client of windowClients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // If not, open a new window/tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Service worker message handling
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Sync event for background sync
self.addEventListener('sync', (event) => {
    console.log('Background sync:', event.tag);
    
    if (event.tag === 'game-sync') {
        event.waitUntil(
            // Handle background sync here
            // This could be used for syncing game state or sending analytics
            Promise.resolve()
        );
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker unhandled rejection:', event.reason);
});
