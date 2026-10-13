/* Utilisation hors ligne : fond de carte gardé sur l'appareil, vérification de l'application, état du téléchargement.
   - Fond de carte : UN fichier (basemap/alpe.pmtiles, extrait Protomaps de données OpenStreetMap, ODbL) copié dans le cache « skip-offline ».
     On ne télécharge jamais de tuiles une à une depuis les serveurs OpenStreetMap : leur règlement interdit le téléchargement en masse pour usage hors ligne.
   - Application : les fichiers listés dans shell.js sont dans le cache du service worker ; on vérifie qu'ils y sont tous.
   Rien ici ne simule un téléchargement : un échec est signalé tel quel, élément par élément. */
const Offline = (() => {
  const SH = self.SKIP_SHELL, MAGIC = 'PMTiles';
  const hasCaches = () => typeof caches !== 'undefined';
  const magicOk = buf => buf && buf.byteLength > 127 && new TextDecoder().decode(new Uint8Array(buf, 0, 7)) === MAGIC;

  /* Ouvre le fond de carte : copie locale si elle existe, sinon lecture par le réseau. Renvoie { pm, from: 'device'|'network' } ou { pm: null, error } */
  async function openBasemap(prefer) {
    if (hasCaches() && prefer !== 'network') {
      try {
        const r = await (await caches.open(SH.offline)).match(SH.basemap);
        if (r) { const buf = await r.arrayBuffer(); if (magicOk(buf)) return { pm: SkiMap.openPM(new SkiMap.MemSource(buf, 'device')), from: 'device', bytes: buf.byteLength }; }
      } catch { /* copie illisible : on essaie le réseau */ }
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { pm: null, error: 'Hors ligne et fond de carte non téléchargé.' };
    try {
      const pm = SkiMap.openPM(new SkiMap.RangeSource(SH.basemap)); await pm.getHeader();
      return { pm, from: 'network' };
    } catch (e) { return { pm: null, error: 'Fond de carte indisponible (' + (e && e.message || 'erreur') + ').' }; }
  }

  /* Télécharge le fond de carte avec progression. Renvoie { ok, bytes, error }. Le fichier n'est gardé que s'il est complet et valide. */
  async function downloadBasemap(onProgress, signal) {
    if (!hasCaches()) return { ok: false, error: 'Stockage hors ligne indisponible dans ce navigateur.' };
    let r;
    try { r = await fetch(SH.basemap, { cache: 'no-store', signal }); } catch (e) { return { ok: false, error: e && e.name === 'AbortError' ? 'Téléchargement annulé.' : 'Réseau indisponible.' }; }
    if (!r.ok) return { ok: false, error: `Fond de carte introuvable sur le serveur (HTTP ${r.status}).` };
    const total = +r.headers.get('content-length') || 0, rd = r.body && r.body.getReader ? r.body.getReader() : null, parts = []; let got = 0;
    try {
      if (rd) for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onProgress && onProgress(got, total); }
      else { const b = new Uint8Array(await r.arrayBuffer()); parts.push(b); got = b.length; onProgress && onProgress(got, got); }
    } catch (e) { return { ok: false, error: e && e.name === 'AbortError' ? 'Téléchargement annulé.' : 'Connexion interrompue pendant le téléchargement (' + got + ' octets reçus).' }; }
    if (total && got !== total) return { ok: false, error: `Fichier incomplet (${got} octets sur ${total}).` };
    const buf = new Uint8Array(got); let o = 0; parts.forEach(p => { buf.set(p, o); o += p.length; });
    if (!magicOk(buf.buffer)) return { ok: false, error: 'Le fichier reçu n\'est pas un fond de carte valide.' };
    try { await (await caches.open(SH.offline)).put(SH.basemap, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })); }
    catch (e) { return { ok: false, error: 'Espace de stockage insuffisant ou refusé par le navigateur.' }; }
    return { ok: true, bytes: got };
  }
  async function basemapInfo() {
    if (!hasCaches()) return { stored: false, supported: false };
    try { const r = await (await caches.open(SH.offline)).match(SH.basemap); if (!r) return { stored: false, supported: true }; const b = await r.arrayBuffer(); return { stored: magicOk(b), supported: true, bytes: b.byteLength }; } catch { return { stored: false, supported: true }; }
  }
  async function removeBasemap() { if (hasCaches()) { try { await (await caches.open(SH.offline)).delete(SH.basemap); } catch { /* ignore */ } } }

  /* Vérifie que chaque fichier de l'appli est dans le cache ; essaie de compléter ceux qui manquent. Renvoie { missing: [...] }. */
  async function checkShell(repair) {
    if (!hasCaches()) return { supported: false, missing: SH.files.slice() };
    const c = await caches.open(SH.cache); let missing = [];
    for (const f of SH.files) if (!(await c.match(f))) missing.push(f);
    if (missing.length && repair) {
      for (const f of missing.slice()) { try { const r = await fetch(f, { cache: 'reload' }); if (r.ok) { await c.put(f, r); missing = missing.filter(x => x !== f); } } catch { /* reste manquant */ } }
    }
    return { supported: true, missing };
  }

  /* Lance tous les éléments du téléchargement. ctx : { plan, refreshLive():Promise<bool>, refreshWeather():Promise<bool>, onItem(item), onProgress(got,total), signal }.
     Renvoie la liste des éléments { key, label, ok, required, detail }. Les éléments obligatoires : tracé, application, fond de carte. */
  async function run(ctx) {
    const items = [], put = it => { items.push(it); ctx.onItem && ctx.onItem(it, items); };
    put({ key: 'route', label: 'Itinéraire, étapes et consignes écrites', ok: !!(ctx.plan && ctx.plan.steps && ctx.plan.steps.length), required: true, detail: ctx.plan ? `${ctx.plan.steps.length} étapes, tracé de ${ctx.plan.steps.reduce((a, s) => a + s.coords.length, 0)} points` : 'Aucun itinéraire' });
    const sh = await checkShell(true);
    put({ key: 'app', label: 'Application, pistes et remontées, calculs', ok: sh.supported && !sh.missing.length, required: true, detail: !sh.supported ? 'Stockage hors ligne indisponible dans ce navigateur (ouvre l\'appli via https ou localhost)' : sh.missing.length ? 'Fichiers manquants : ' + sh.missing.join(', ') : 'Tous les fichiers sont sur l\'appareil' });
    const bm = await downloadBasemap(ctx.onProgress, ctx.signal);
    put({ key: 'map', label: 'Fond de carte de la zone (Alpe d\'Huez)', ok: bm.ok, required: true, detail: bm.ok ? `${(bm.bytes / 1048576).toFixed(1).replace('.', ',')} Mo` : bm.error, bytes: bm.bytes });
    if (ctx.refreshLive) { let ok = false; try { ok = await ctx.refreshLive(); } catch { /* reste faux */ } put({ key: 'live', label: 'Ouverture des pistes et remontées (instantané)', ok, required: false, detail: ok ? 'Enregistré : ce ne sera PAS du direct' : 'Non récupéré (réseau ou relais indisponible) : aucune information d\'ouverture hors ligne' }); }
    if (ctx.refreshWeather) { let ok = false; try { ok = await ctx.refreshWeather(); } catch { /* reste faux */ } put({ key: 'weather', label: 'Météo (instantané)', ok, required: false, detail: ok ? 'Enregistrée : ce ne sera PAS du direct' : 'Non récupérée : aucune météo hors ligne' }); }
    return items;
  }
  /* « complet » = tous les éléments obligatoires OK ; « partiel » = tracé OK mais autre chose manque ; « echec » sinon */
  const verdict = items => items.every(i => !i.required || i.ok) ? (items.every(i => i.ok) ? 'complet' : 'complet-avertissements') : items.find(i => i.key === 'route' && i.ok) ? 'partiel' : 'echec';

  return { openBasemap, downloadBasemap, basemapInfo, removeBasemap, checkShell, run, verdict, magicOk };
})();
if (typeof module !== 'undefined') module.exports = Offline;
