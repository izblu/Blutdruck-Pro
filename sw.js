/* Blutdruck Pro – Service Worker für Offline-Betrieb.
   Wird vom Browser automatisch genutzt; nicht manuell öffnen.
   Strategie: network-first (online immer aktuell, offline aus dem Cache).
   WICHTIG (v22): Der Netzwerk-Abruf revalidiert (cache:'no-cache'), sonst kann der Browser innerhalb
   seiner Cache-Frist eine ALTE Datei als „frisch" durchreichen → neues index.html, aber altes
   app.js/styles.css (kaputte/tote Knöpfe nach einem Update). Siehe fetch unten. */
// Eigenes Präfix: Unter izblu.github.io liegen auch andere Apps, deren Offline-Speicher bleiben unangetastet.
const CACHE_PREFIX = 'blutdruck-pro-';
const CACHE = CACHE_PREFIX + 'v14';
const ASSETS = ['./', './index.html', './styles.css', './vitals.js', './app.js','./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png', './apple-touch-icon.png', './fonts/hanken-grotesk.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })   // beim Server rückfragen statt evtl. veraltete Browser-Cache-Kopie
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
  );
});
