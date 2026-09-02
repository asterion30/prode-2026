const CACHE_NAME = 'prode-2026-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Ignorar esquemas no HTTP/HTTPS
    if (!event.request.url.startsWith('http')) return;

    // No interceptar peticiones a terceros (YouTube, Google Fonts, CDNs) para no violar CSP connect-src
    try {
        const requestUrl = new URL(event.request.url);
        if (requestUrl.origin !== self.location.origin) {
            return;
        }
    } catch (e) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response("Estás sin conexión a internet.", {
                status: 503,
                statusText: "Service Unavailable",
                headers: new Headers({
                    'Content-Type': 'text/plain; charset=utf-8'
                })
            });
        })
    );
});
