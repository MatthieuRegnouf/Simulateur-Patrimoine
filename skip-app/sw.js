importScripts('shell.js');
const CACHE = self.SKIP_SHELL.cache, FILES = self.SKIP_SHELL.files;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== self.SKIP_SHELL.offline).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range') || r.url.endsWith('.pmtiles')) return;   // le fond de carte est géré par l'appli (offline.js), pas par ce cache
  e.respondWith(fetch(r).then(res => { if (res.ok && new URL(r.url).origin === self.location.origin) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: r.mode === 'navigate' })));
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
