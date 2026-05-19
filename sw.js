/* BoomBoomMovie — Service Worker de migration */
const NEW_ORIGIN = 'https://boomboommovie.live';

// Purge tous les anciens caches
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Redirige toutes les requêtes vers le nouveau domaine
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    const newPath = url.pathname.replace(/^\/BoomBoomMovie/, '') || '/';
    const target = NEW_ORIGIN + newPath + url.search + url.hash;
    event.respondWith(Response.redirect(target, 301));
  }
});
