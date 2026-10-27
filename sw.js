/* Service worker: guarda la app para que abra sin conexión y se pueda instalar.
   Solo funciona cuando la app se sirve por http(s) (no con file://). */
const CACHE = 'capcut-recreacion-v3';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/util.js', './js/catalog.js', './js/state.js', './js/media.js', './js/render.js', './js/timeline.js',
  './js/panels.js', './js/ai.js', './js/export.js', './js/projects.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Archivos propios: primero red (para ver cambios) y si no hay conexión, la caché. */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
