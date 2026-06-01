const CACHE_NAME = 'prode-2026-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Un simple fetch para cumplir con el requerimiento de PWA de tener un fetch handler
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response("Estás sin conexión a internet.", {
                status: 503,
                statusText: "Service Unavailable",
                headers: new Headers({
                    'Content-Type': 'text/plain'
                })
            });
        })
    );
});
