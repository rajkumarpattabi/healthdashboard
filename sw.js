// Offline cache for HealthDashboard (mealfast-style). Bump VERSION to force refresh.
const VERSION = 'hd-v6';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './config.js',
  './data/seed.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // never cache Google APIs
  if (url.includes('googleapis.com') || url.includes('accounts.google.com') || url.includes('gstatic.com')) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      if (e.request.method === 'GET' && res.status === 200 && url.startsWith(self.location.origin)) {
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
