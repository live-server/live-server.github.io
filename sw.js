const CACHE_NAME = 'live_server';

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
        .then((response) => {
            // Cache hit - return response
            if (response) {
                return response;
            }
            return fetch(event.request);
        })
    );
});