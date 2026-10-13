const CACHE = 'skip-v2';
const FILES = ['./', 'index.html', 'styles.css', 'config.js', 'data.js', 'graph.js', 'engine.js', 'app.js', 'manifest.webmanifest', 'icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});

// Clic sur une notification : ouvre directement la fiche de notation (ou la liste du soir), sans écran intermédiaire
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {}, msg = d.evening ? { type: 'evening' } : { type: 'rate', id: d.id, k: d.k ?? null };
  const url = d.evening ? 'index.html#evening' : 'index.html#rate=' + encodeURIComponent(d.id || '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.length) { cs[0].postMessage(msg); return cs[0].focus(); }
    return self.clients.openWindow(url);
  }));
});
