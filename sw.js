/* MotoCare - Service Worker for Offline PWA Support */

const CACHE_NAME = 'motocare-cache-v1.0.9';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/presets.js',
    './js/db.js',
    './js/ui.js',
    './js/app.js'
];

// Install Event - Pre-cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching static shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event - Network first for local resources, Cache first for images and CDNs
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    let url;
    try {
        url = new URL(event.request.url);
    } catch {
        return;
    }

    // Bypass external APIs
    const BYPASS_DOMAINS = ['generativelanguage.googleapis.com'];
    if (BYPASS_DOMAINS.some(domain => url.hostname.includes(domain))) return;

    // Bypass non-http
    if (!url.protocol.startsWith('http')) return;

    const isImage = /\.(png|jpg|jpeg|svg|ico|webp|gif)(\?.*)?$/i.test(url.pathname);
    const isCDN = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].some(domain => url.hostname.includes(domain));

    if (isImage || isCDN) {
        // Cache-first for assets and CDNs
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);
            })
        );
    } else {
        // Network-first with cache fallback for local HTML/JS/CSS (always get latest code)
        let fetchPromise;
        try {
            // Bypass browser disk cache to force fetch from server
            fetchPromise = fetch(event.request, { cache: 'no-cache' });
        } catch (e) {
            fetchPromise = fetch(event.request);
        }

        event.respondWith(
            fetchPromise
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then(cached => {
                        if (cached) return cached;
                        if (url.pathname.endsWith('/') || !url.pathname.includes('.')) {
                            return caches.match('./index.html');
                        }
                    });
                })
        );
    }
});
