/* ============================================
   BoomBoomMovie — Service Worker
   Cache-first for static assets, network-first for API
   ============================================ */

const CACHE_NAME = 'bbm-v35';
const IMAGE_CACHE = 'bbm-images-v1';
const MAX_IMAGE_CACHE = 500;
const STATIC_ASSETS = [
  './',
  'index.html',
  'browse.html',
  'watch.html',
  'stats.html',
  'mcu.html',
  'admin.html',
  'settings.html',
  'faq.html',
  'help.html',
  'terms.html',
  'privacy.html',
  'changelog.html',
  'profile.html',
  'downloads.html',
  'css/style.css',
  'js/changelog-data.js',
  'js/config.js',
  'js/settings.js',
  'js/settings-page.js',
  'js/auth.js',
  'js/api.js',
  'js/browse.js',
  'js/player.js',
  'js/admin.js',
  'js/mcu.js',
  'js/stats.js',
  'js/tv-nav.js',
  'js/downloads.js',
  'js/update-modal.js',
  'js/mini-player.js',
  'manifest.json'
];

// Install — cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== IMAGE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-first for API calls and Firebase
  if (url.hostname !== location.hostname ||
      url.pathname.startsWith('/api') ||
      url.hostname.includes('firebaseio') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic')) {
    return;
  }

  // Cache-first for TMDB images with LRU eviction
  if (url.hostname.includes('image.tmdb.org')) {
    e.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) {
          // Re-put to refresh LRU order
          cache.put(e.request, cached.clone());
          return cached;
        }
        try {
          const res = await fetch(e.request);
          if (res.ok) {
            cache.put(e.request, res.clone());
            // Evict oldest entries if over limit
            cache.keys().then(keys => {
              if (keys.length > MAX_IMAGE_CACHE) {
                const toDelete = keys.length - MAX_IMAGE_CACHE;
                for (let i = 0; i < toDelete; i++) {
                  cache.delete(keys[i]);
                }
              }
            });
          }
          return res;
        } catch (err) {
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
