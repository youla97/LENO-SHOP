// Service worker : met en cache l'interface pour un chargement rapide, même avec une connexion faible.
const CACHE = 'leno-shop-v1';
const SHELL = ['/', '/css/style.css', '/js/app.js', '/js/core.js', '/js/views.js', '/js/invoice.js', '/icons/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  // Pages : réseau d'abord, interface en cache si hors ligne.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/')));
    return;
  }
  // Images : cache d'abord. Code et styles : réseau d'abord (toujours à jour), cache en secours.
  const fromNet = () => fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  });
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fromNet()));
  } else {
    e.respondWith(fromNet().catch(() => caches.match(e.request)));
  }
});
