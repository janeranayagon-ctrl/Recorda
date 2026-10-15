const CACHE = 'recordaplus-v1';

const archivos = [
  './',
  'login.html',
  'index.html',
  'crear_evento.html',
  'mis_eventos.html',
  'notificaciones.html',
  'perfil.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(archivos))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
      .catch(() => {
        if (event.request.mode === 'navigate') return caches.match('login.html');
        return new Response('', {status: 503, statusText: 'Offline'});
      })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('index.html'));
});
