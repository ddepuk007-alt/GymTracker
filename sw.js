const CACHE_NAME = 'gymtrack-pwa-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './assets/hero.png',
    './assets/legs.png',
    './assets/pull.png',
    './assets/push.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});
