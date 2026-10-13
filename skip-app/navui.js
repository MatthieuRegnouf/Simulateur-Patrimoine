/* Interface de la carte, de la navigation, du hors-ligne et du profil personnel.
   Chargé AVANT app.js : ne définit que des fonctions ; elles s'appuient sur les variables de app.js (S, plan, NET, render…) au moment de l'appel. */

/* ---------- Fond de carte ---------- */
let bm = { pm: null, from: '', error: '', busy: false, date: '', tried: false };
let pvMap = null, navMap = null, selStep = null, netCache = null, showNet = true;
async function loadBasemap(prefer) {
  bm.busy = true; bm.tried = true; updateBaseNote();
  const r = await Offline.openBasemap(prefer); let date = '';
  if (r.pm) { try { const md = await r.pm.getMetadata(); date = (md['planetiler:osm:osmosisreplicationtime'] || '').slice(0, 10); } catch { /* sans date */ } }
  bm = { pm: r.pm, from: r.from || '', error: r.error || '', busy: false, date, tried: true };
  [pvMap, navMap].forEach(m => m && m.setBase(bm.pm)); updateBaseNote();
}
const frDate = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
const baseNote = () => bm.busy ? 'Chargement du fond de carte…' : bm.pm ? '' : '⚠︎ Pas de fond de carte : ' + (bm.error || 'indisponible.') + ' Le tracé et les étapes restent affichés.';
function updateBaseNote() { const n = $('#pvnote'); if (n) n.textContent = baseNote(); }
function domain() {   // réseau tel que calculé : mêmes tracés que ceux utilisés par le planificateur
  if (netCache) return netCache;
  const st = new Map(); NET.edges.filter(e => e.k === 'lift' && e.n).forEach(e => [[e.a, 'Départ'], [e.b, 'Arrivée']].forEach(([i, w]) => { const n = NET.nodes[i]; if (n.alt > 0 && !st.has(i)) st.set(i, { lat: n.lat, lng: n.lng, n: `${w} ${e.n}` }); }));
  return netCache = { edges: NET.edges.map(e => ({ k: e.k, c: e.c, n: e.n, o: e.o, g: NET.geom(e) })), stations: [...st.values()] };
}

/* ---------- Carte d'aperçu (onglet Itinéraire) ---------- */
const planId = pl => { let h = 5381; const s = pl.steps.map(x => x.edges.join('.')).join('|'); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); };
function previewHtml() {
  return `<div class="mapbox" id="pvmap" style="height:min(56vh,400px)"></div>
    <div class="legend"><span><i class="lg solid"></i> piste</span><span><i class="lg dash"></i> remontée</span><span><i class="lg dot"></i> à pied</span><span>① étape · ➤ sens</span>
      <label class="chk" style="padding:0;margin-left:auto"><input type="checkbox" data-bind="pvnet" ${showNet ? 'checked' : ''}> réseau du domaine</label></div>
    <div class="mut" id="pvnote">${esc(baseNote())}</div>${consistencyHtml(plan)}`;
}
/* Cohérence consignes / tracé : on compare ce qui est écrit (distance de l'étape) à ce qui est dessiné, et on signale les raccords approximatifs */
function consistency(pl) {
  const R = Nav.build(pl), out = { gaps: [], diffs: [] };
  pl.steps.forEach((s, i) => {
    const drawn = R.ranges[i].s1 - R.ranges[i].s0; if (s.m > 50 && Math.abs(drawn - s.m) / s.m > 0.2) out.diffs.push({ i, drawn: Math.round(drawn), written: Math.round(s.m) });
    if (i > 0) { const g = Nav.dist(pl.steps[i - 1].coords[pl.steps[i - 1].coords.length - 1], s.coords[0]); if (g > 40) out.gaps.push({ i, m: Math.round(g) }); }
  });
  return out;
}
function consistencyHtml(pl) {
  if (!pl) return ''; const c = consistency(pl); if (!c.gaps.length && !c.diffs.length) return '';
  return `<div class="warn" style="margin-top:8px">Précision des données : ${c.gaps.length ? `à ${c.gaps.length} endroit${c.gaps.length > 1 ? 's' : ''}, le point d'arrivée d'une étape est à plus de 40 m du départ de la suivante (${c.gaps.map(g => `étapes ${g.i}→${g.i + 1} : ${g.m} m`).join(', ')}) : le tracé OpenStreetMap n'est pas raccordé finement, suis alors les panneaux. ` : ''}${c.diffs.length ? `Distance écrite et distance dessinée différentes pour ${c.diffs.map(d => `l'étape ${d.i + 1} (${d.written} m écrits, ${d.drawn} m dessinés)`).join(', ')}.` : ''}</div>`;
}
function mountPreview() {
  if (pvMap) { pvMap.destroy(); pvMap = null; }
  const h = $('#pvmap'); if (!h || !plan) return;
  pvMap = SkiMap.create(h, { pm: bm.pm, onSelect: i => selectStep(i, true), pad: { t: 24, b: 24, l: 24, r: 24 } });
  pvMap.setRoute(plan, Nav.build(plan)); pvMap.setDomain(domain(), showNet); pvMap.fit();
  if (selStep != null && selStep < plan.steps.length) pvMap.highlight(selStep, true);
  if (!bm.tried) loadBasemap();
}
function selectStep(i, scroll) {
  selStep = selStep === i && !scroll ? null : i;
  document.querySelectorAll('#stepslist .step').forEach(el => el.classList.toggle('sel', +el.dataset.i === selStep));
  if (pvMap) { if (selStep == null) { pvMap.highlight(null); pvMap.fit(); } else pvMap.highlight(selStep, true); }
  if (scroll && selStep != null) document.querySelector(`#stepslist .step[data-i="${selStep}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------- Hors ligne : téléchargement et état ---------- */
let dl = { run: false, got: 0, total: 0, items: [], ctl: null };
const fmtDT = t => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const mo = b => (b / 1048576).toFixed(1).replace('.', ',') + ' Mo';
const VERDICT = { 'complet': ['ok', 'Complet'], 'complet-avertissements': ['warn', 'Complet, avec avertissements'], 'partiel': ['warn', 'Incomplet'], 'echec': ['bad', 'Échec'] };
let offStat = { checked: false, map: null, miss: [], can: false };
/* Le téléchargement hors ligne n'est proposé que s'il peut réellement fonctionner : page servie en http(s) avec service worker actif et stockage disponible (pas dans un aperçu intégré). */
async function offlineSupport() {
  if (window.SKIP_BASEMAP_B64 || !/^https?:$/.test(location.protocol) || !('serviceWorker' in navigator) || typeof caches === 'undefined') return false;
  try { return await Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 4000))]); } catch { return false; }
}
async function refreshOffStat() {
  const can = await offlineSupport(); if (!can) { offStat = { checked: true, can: false, map: null, miss: [] }; updateOffCard(); return; }
  const bi = await Offline.basemapInfo(), sh = await Offline.checkShell(false);
  offStat = { checked: true, can: true, map: bi.stored, miss: sh.missing }; updateOffCard();
}
function itemsHtml(items) {   // seuls les manques qui empêchent l'usage hors ligne sont signalés, en une phrase
  const msg = { route: 'Itinéraire non enregistré.', app: 'L\'application n\'est pas complète hors ligne : reconnecte-toi puis mets à jour.', map: 'Fond de carte non téléchargé : réessaie avec une meilleure connexion (le tracé reste utilisable).' };
  return items.filter(it => !it.ok && it.required).map(it => `<div class="mut" style="margin-top:4px">⚠︎ ${msg[it.key] || esc(it.label)}</div>`).join('');
}
function offCardHtml() {
  const sv = S.route && S.route.stationId === S.station ? S.route : null, cur = plan && sv && sv.planId === planId(plan);
  if (!offStat.checked) return '';
  if (!offStat.can) return '<div class="mut">Disponible en ligne uniquement.</div>';
  if (dl.run) return `<b>📥 Téléchargement…</b><div class="bar" style="margin:8px 0"><i id="dlbar" style="width:${dl.total ? Math.round(dl.got / dl.total * 100) : 5}%"></i></div><div class="mut" id="dltxt">${dl.total ? `${mo(dl.got)} sur ${mo(dl.total)}` : 'Préparation…'}</div><button class="btn sm ghost" style="margin-top:8px" data-action="dlcancel">Annuler</button>`;
  if (!sv) return plan ? `<div class="row"><button class="btn sec" data-action="dlstart">📥 Télécharger hors ligne</button></div><div class="mut" style="margin-top:6px">≈ 5,9 Mo · carte, tracé et étapes sur ton téléphone.</div>` : '';
  const full = sv.items && sv.verdict !== 'partiel' && sv.verdict !== 'echec', mapGone = offStat.map === false && sv.items && sv.items.find(i => i.key === 'map' && i.ok), shellGone = offStat.miss.length;
  return `<b>📥 Hors ligne</b> <span class="badge st-${full && !mapGone && !shellGone ? 'ok' : 'warn'}">${full && !mapGone && !shellGone ? 'disponible' : 'incomplet'}</span>
    <div class="mut" style="margin:4px 0">Téléchargé le ${fmtDT(sv.savedAt)}${cur ? '' : ' · autre itinéraire que celui affiché'}${navigator.onLine ? '' : ' · sans réseau'}</div>
    ${sv.items ? itemsHtml(sv.items) : '<div class="mut">Ancien enregistrement : retélécharge-le.</div>'}
    ${mapGone ? '<div class="mut">⚠︎ Le fond de carte a été effacé par le téléphone : retélécharge.</div>' : ''}${shellGone ? '<div class="mut">⚠︎ L\'application n\'est pas complète hors ligne : reconnecte-toi puis mets à jour.</div>' : ''}
    <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-action="${cur ? 'nstart' : 'loadsaved'}">${cur ? '🧭 Ouvrir le GPS' : 'Ouvrir cet itinéraire'}</button><button class="btn sm sec" data-action="dlstart" ${navigator.onLine ? '' : 'disabled'}>${full ? 'Mettre à jour' : 'Réessayer'}</button><button class="btn sm ghost" data-action="delsaved">Supprimer</button></div>`;
}
function updateOffCard() { const c = $('#offcard'); if (c) c.innerHTML = offCardHtml(); }
async function downloadPackage() {
  if (!plan || dl.run) return;
  if (!navigator.onLine) { toast('Pas de réseau : le téléchargement est impossible pour l\'instant.', 4500); return; }
  dl = { run: true, got: 0, total: 0, items: [], ctl: new AbortController() }; updateOffCard();
  const thePlan = plan;
  const items = await Offline.run({ plan: thePlan, signal: dl.ctl.signal,
    onItem: (it, all) => { dl.items = all.slice(); updateOffCard(); },
    onProgress: (g, t) => { dl.got = g; dl.total = t; const b = $('#dlbar'); if (b) b.style.width = (t ? Math.round(g / t * 100) : 5) + '%'; const x = $('#dltxt'); if (x) x.textContent = `Fond de carte : ${mo(g)}${t ? ' sur ' + mo(t) : ''}`; },
    refreshLive: async () => { await liveLoad(true); return !!live && !live.snapshot && !live.stale; },
    refreshWeather: async () => { await wxLoad(true); return !!(wxData.base && wxData.base.live && !wxData.base.stale && !wxData.base.snapshot); } });
  const verdict = Offline.verdict(items);
  if (verdict === 'echec') { dl.run = false; toast('Échec du téléchargement : rien n\'a été enregistré.', 5000); dl.items = items; updateOffCard(); return; }
  await loadBasemap('device');
  S.route = { stationId: S.station, plan: thePlan, planId: planId(thePlan), savedAt: Date.now(), items, verdict, mapDate: bm.from === 'device' ? bm.date : '',
    liveAt: live && !live.snapshot ? live.data.source.feedUpdated || live.data.source.fetchedAt : null, wxAt: wxData.base && wxData.base.live && !wxData.base.snapshot ? wxData.base.updated : null };
  save(); dl.run = false; toast(verdict === 'complet' ? 'Téléchargement terminé : disponible hors ligne.' : 'Téléchargement terminé avec des éléments manquants (voir la liste).', 5000);
  refreshOffStat(); render();
}

/* ---------- Profil personnel (filtres d'itinéraire) ---------- */
const profileInput = () => ({ level: S.level, levelSet: !!S.levelSet, wants: S.profile.wants, discipline: S.profile.discipline });
const profCrit = () => Nav.profileCriteria(Engine, profileInput(), S.rf.tmp || {});
const hasTmp = () => { const t = S.rf.tmp || {}; return t.level != null || t.wants != null || t.walk != null || t.speed != null; };
/* Formulaire effectif : ce que le calcul utilise réellement */
function effectiveForm() {
  const f = S.rf; if (f.mode !== 'profile') return { mode: f.mode, lo: f.lo, hi: f.hi, colors: f.colors, speed: f.speed, walk: f.walk, profile: null };
  const c = profCrit(), t = f.tmp || {};
  return { mode: 'felt', lo: c.lo, hi: c.hi, colors: f.colors, speed: t.speed || c.speed || f.speed, walk: t.walk != null ? t.walk : c.walk === false ? false : f.walk, profile: c };
}
function profileCardHtml() {
  const c = profCrit(), t = S.rf.tmp || {}, wants = c.wants, tmp = hasTmp();
  const need = c.missing.includes('level');
  const lvl = need ? `<div class="warn"><b>Une seule information manque : ton niveau.</b> Les autres éléments de ton profil sont facultatifs.
      <div class="mut" style="margin-top:6px">Niveau : <b id="plv">${t.level != null ? t.level : S.level}</b>/10</div><input type="range" min="1" max="10" step="0.5" value="${t.level != null ? t.level : S.level}" data-range="plevel" aria-label="Niveau">
      <div class="row" style="margin-top:6px;flex-wrap:wrap"><button class="btn sm" data-action="plvsave">Enregistrer dans mon profil</button><button class="btn sm sec" data-action="plvtmp">Utiliser seulement pour cet itinéraire</button></div></div>` : '';
  return `<div class="inset"><b>👤 Calculé d'après ton profil</b>
    
    ${lvl}
    ${need ? '' : `<div style="margin:4px 0">${c.used.map(u => `<div class="net-row"><span style="width:22px">✔︎</span><div class="sp"><b>${esc(u.label)}</b><div class="mut">${esc(u.effect)}</div></div></div>`).join('')}</div>
    ${c.ignored.length ? `<div class="mut">Non pris en compte : ${c.ignored.map(i => esc(i.label) + ' (' + esc(i.why) + ')').join(' · ')}.</div>` : ''}
    <div class="mut" style="margin-top:4px">Résultat : pistes de difficulté ${c.lo === c.hi ? fmt1(c.lo) : fmt1(c.lo) + ' à ' + fmt1(c.hi)}/10${c.speed ? ' · rythme ' + ({ slow: 'lent' }[c.speed] || c.speed) : ''}${c.walk === false ? ' · sans chemin à pied' : ''}.</div>`}
    ${need && t.level == null ? '' : `<details style="margin-top:8px" ${tmp ? 'open' : ''}><summary><b>Ajuster pour cet itinéraire seulement</b> ${tmp ? '<span class="badge st-warn">ajusté, profil inchangé</span>' : ''}</summary>
      <div class="mut" style="margin:6px 0 4px">Niveau pour ce trajet</div>
      <div class="row"><button class="btn sm sec" data-action="plvl" data-d="-0.5" aria-label="Moins">−</button><b style="min-width:70px;text-align:center">${c.level}/10</b><button class="btn sm sec" data-action="plvl" data-d="0.5" aria-label="Plus">+</button><span class="mut">profil : ${S.levelSet ? S.level + '/10' : 'non renseigné'}</span></div>
      <div class="mut" style="margin:8px 0 4px">Envies pour ce trajet</div>
      <div class="chips">${Nav.WANTS.map(w => `<button class="chip${wants.includes(w) ? ' on' : ''}" data-action="pwant" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>
      ${c.walk === false ? `<label class="chk"><input type="checkbox" data-bind="ptmpwalk" ${t.walk ? 'checked' : ''}> Autoriser quand même les chemins à pied</label>` : ''}
      ${tmp ? `<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm ghost" data-action="preset">Revenir à mon profil</button><button class="btn sm sec" data-action="psave">Enregistrer ces choix dans mon profil</button></div>
        <div class="mut" style="margin-top:4px">« Enregistrer » ne modifie que le niveau et les envies. Le rythme et les chemins à pied ne font pas partie du profil.</div>` : ''}
    </details>`}
  </div>`;
}
function profileAction(d) {
  const rf = S.rf; rf.tmp = rf.tmp || {};
  switch (d.action) {
    case 'plvsave': { const v = +($('[data-range=plevel]').value); S.level = v; S.levelSet = true; delete rf.tmp.level; save(); render(); return true; }
    case 'plvtmp': { rf.tmp.level = +($('[data-range=plevel]').value); save(); render(); return true; }
    case 'plvl': { const c = profCrit(); rf.tmp.level = Math.max(1, Math.min(10, c.level + +d.d)); if (S.levelSet && rf.tmp.level === S.level) delete rf.tmp.level; save(); render(); return true; }
    case 'pwant': { const cur = profCrit().wants, nx = cur.includes(d.w) ? cur.filter(w => w !== d.w) : [...cur, d.w]; const same = nx.length === S.profile.wants.length && nx.every(w => S.profile.wants.includes(w)); if (same) delete rf.tmp.wants; else rf.tmp.wants = nx; save(); render(); return true; }
    case 'preset': rf.tmp = {}; save(); render(); return true;
    case 'psave': { const t = rf.tmp; if (t.level != null) { S.level = t.level; S.levelSet = true; } if (t.wants) S.profile.wants = t.wants.slice(); rf.tmp = {}; save(); toast('Profil mis à jour (niveau et envies).'); render(); return true; }
  }
  return false;
}

/* ---------- Navigation ---------- */
let navIdx = null; const navIndex = () => navIdx || (navIdx = Nav.indexNet(NET));
let nv = null;   // { st, watch, tick, wake, open, expanded, lastStep, off:{ignore}, said }
const KIND_ICON = { lift: '🚡', piste: '⛷', walk: '🚶', link: '↝' };
const kindCol = s => s.kind === 'piste' ? `var(--${s.color})` : s.kind === 'lift' ? '#3d4660' : '#a0702a';
function instrFor(pl, i, rem, list) {   // list : version courte pour la liste d'étapes (la distance est affichée à part)
  const s = pl.steps[i]; if (!s) return { icon: '🏁', main: 'Arrivée', sub: '' };
  const dist = rem != null ? mText(rem) : mText(s.m);
  if (s.kind === 'lift') {
    const cab = /cabine|Télécabine|Téléphérique|Télémix/i.test(liftType(s)), sub = s.viaNames && s.viaNames.length ? (cab ? `Restez dans la cabine jusqu'à ${s.toName}` : `Descendez à ${s.toName} (arrêts intermédiaires : vérifie les panneaux)`) : `Descendez à ${s.toName}`;
    return { icon: '🚡', main: `Rejoignez la remontée ${s.name}`, sub: list ? `${liftType(s)} · ${s.min} min · ${sub}` : `${sub} · ${s.min} min` };
  }
  if (s.kind === 'piste') return { icon: '⛷', main: `Prenez la piste ${stepName(s)}`, sub: list ? `${colorName(s.color)} · jusqu'à ${s.toName}` : `${colorName(s.color)} · encore ${dist} · jusqu'à ${s.toName}` };
  if (s.kind === 'walk') return { icon: '🚶', main: list ? 'Marchez' : `Marchez ${dist}`, sub: list ? `Jusqu'à ${s.toName}` : `En chaussures de ski, jusqu'à ${s.toName}` };
  return { icon: '↝', main: 'Suivez la liaison à ski', sub: list ? `Jusqu'à ${s.toName}` : `Encore ${dist} jusqu'à ${s.toName}` };
}
function nextLine(pl, i) { const n = pl.steps[i + 1]; if (!n) return 'Ensuite : arrivée.'; const x = instrFor(pl, i + 1); return 'Ensuite : ' + x.main.charAt(0).toLowerCase() + x.main.slice(1) + '.'; }
function remainMin(pl, st) {   // minutes restantes : estimation, étape en cours au prorata de la distance
  let t = 0; pl.steps.forEach((s, i) => { if (i > st.step) t += s.min + (s.waitMin || 0); else if (i === st.step) { const r = st.route.ranges[i], len = r.s1 - r.s0 || 1; t += (s.min + (s.waitMin || 0)) * (st.started ? Math.max(0, r.s1 - st.s) / len : 1); } });
  return Math.round(t);
}
const COL_FR = { green: 'verte', blue: 'bleue', red: 'rouge', black: 'noire' };
function hereHtml(st) {   // où est-on sur le domaine : information, jamais un recalage de la position
  const h = st.here; if (!h || h.state === 'none') return '';
  const nm = c => `${c.k === 'lift' ? 'remontée' : 'piste'} ${c.n || '(sans nom)'}${c.c ? ' ' + COL_FR[c.c] : ''}`;
  return h.state === 'unique' ? `<div class="nstat">📍 Près de : <b>${esc(nm(h.best))}</b> (d'après la position mesurée, marge ± ${Math.round(h.cor)} m)</div>`
    : `<div class="nstat g-near">📍 Plusieurs pistes ou remontées dans la marge d'erreur du GPS : ${h.cands.map(c => esc(nm(c))).join(' · ')}. Impossible de dire laquelle : la position n'est pas recalée.</div>`;
}
const gpsUnusable = st => st.geo === 'denied' || st.geo === 'unavailable' || (!st.fix && st.geo !== 'idle' && Date.now() - st.t0 > 30000);
function navTopHtml() {
  const st = nv.st, pl = plan, stt = Nav.statusText(st), fin = Nav.atEnd(st), i = st.step;
  let ins; const rem = st.started ? Nav.stepRemaining(st) : null;
  if (fin) ins = { icon: '🏁', main: 'Arrivée atteinte', sub: pl.steps[pl.steps.length - 1].toName };
  else if (!st.started) ins = { icon: '📍', main: `Rejoins le départ`, sub: `${pl.steps[0].fromName} — puis ${instrFor(pl, 0).main.charAt(0).toLowerCase() + instrFor(pl, 0).main.slice(1)}` };
  else ins = instrFor(pl, i, rem);
  const offBlock = st.off && !nv.ignore ? `<div class="offbox"><b>Tu n'es plus sur l'itinéraire</b> (≈ ${Math.round(st.dev)} m du tracé${st.nearest && st.pos ? `, le point du tracé le plus proche est vers le ${Nav.compass(Nav.bearing(st.pos, st.nearest.p))}` : ''}).
      <div class="mut" style="color:inherit;opacity:.9;margin:4px 0">Rien n'est recalculé tout seul. Choisis :</div>
      <div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn sm" data-action="nrecalc">↻ Recalculer depuis ici</button><button class="btn sm sec" data-action="nrejoin">⤴ Revenir au tracé</button><button class="btn sm ghost" data-action="nignore">Ignorer</button></div></div>` : '';
  const off = !navigator.onLine ? `<div class="nstat">📴 Hors ligne : ouverture, météo et attentes = dernières données enregistrées${live ? ' (' + esc(dm(live.data.source.feedUpdated)) + ' ' + esc(hm(live.data.source.feedUpdated)) + ')' : ' (aucune)'}, pas du direct.</div>` : '';
  const recalc = pl.recalc ? `<div class="nstat">↻ Itinéraire recalculé à ${esc(hhmm(pl.recalc.at))} avec les données enregistrées. Non téléchargé.</div>` : '';
  return `<div class="nmain"><div class="nico" style="background:${st.started && pl.steps[i] ? kindCol(pl.steps[i]) : 'var(--brand)'}">${ins.icon}</div><div class="sp"><div class="nbig">${esc(ins.main)}</div><div class="nsub">${esc(ins.sub)}</div>${fin ? '' : `<div class="nsub nnext">${esc(nextLine(pl, i))}</div>`}</div>
      <button class="nq" data-action="nquit" aria-label="Arrêter la navigation et revenir au résumé">✕ Arrêter</button></div>
    <div class="nstat g-${stt.key}">${{ good: '🟢', fair: '🟡', poor: '🟠', stale: '🟠', denied: '🚫', unavailable: '🚫', off: '🔴', near: '🟡', wait: '⏳' }[stt.key] || ''} ${esc(stt.text)}</div>${hereHtml(st)}${offBlock}${off}${recalc}`;
}
function navBottomHtml() {
  const st = nv.st, pl = plan, tot = st.route.total, done = st.started ? Math.min(st.s, tot) : 0, pct = tot ? Math.round(done / tot * 100) : 0, km = m => (m / 1000).toFixed(1).replace('.', ',');
  const rows = pl.steps.map((s, k) => { const state = st.started ? (k < st.step ? 'done' : k === st.step ? 'cur' : 'todo') : 'todo', r = st.route.ranges[k];
    return `<div class="nrow ${state}${selStep === k ? ' sel' : ''}" data-action="nsel" data-i="${k}"><div class="num" style="background:${kindCol(s)}">${k + 1}</div><div class="sp"><b>${KIND_ICON[s.kind]} ${esc(instrFor(pl, k, null, true).main)}</b><div class="mut">${esc(instrFor(pl, k, null, true).sub)} · ${mText(r.s1 - r.s0)}</div></div><span>${state === 'done' ? '✔︎' : state === 'cur' ? '●' : ''}</span></div>`; }).join('');
  return `<div class="nprog"><div class="bar"><i style="width:${pct}%"></i></div>
    <div class="mut">${st.started ? `Parcouru ${km(done)} km · reste ${km(tot - done)} km · ≈ ${remainMin(pl, st)} min (estimation)` : `Itinéraire : ${km(tot)} km · ≈ ${remainMin(pl, st)} min (estimation)`}</div></div>
    <div class="row nbtn">${gpsUnusable(st) ? `<button class="btn sm sec" data-action="nprev" aria-label="Étape précédente">◀ Étape précédente</button><button class="btn sm" data-action="nnext">Étape faite ▶</button>` : ''}<button class="btn sm ${nv.expanded ? '' : 'ghost'}" data-action="nlist">${nv.expanded ? '▼ Masquer le détail' : '▲ Détail du parcours'}</button></div>
    ${nv.expanded ? `<div class="mut" style="margin-top:8px">Ta position et ta progression viennent du GPS. <b>Correction manuelle</b> de l'étape (si le GPS se trompe) : <button class="btn sm ghost" data-action="nprev">◀</button> <button class="btn sm ghost" data-action="nnext">▶</button> — cela ne déplace jamais le marqueur.</div><div class="nlist">${rows}</div>` : ''}`;
}
function navCtlHtml() {
  const f = navMap && navMap.follow;
  return `<button data-action="nzin" aria-label="Zoom avant">＋</button><button data-action="nzout" aria-label="Zoom arrière">−</button>
    <button data-action="nfollow" class="${f ? 'on' : ''}" aria-label="Recentrer sur ma position" ${nv.st.pos ? '' : 'disabled'}>🎯</button><button data-action="nfit" aria-label="Voir tout l'itinéraire">⤢</button><button data-action="nvoice" aria-label="Réglages de la voix" class="${S.audio ? '' : 'mute'}">${S.audio ? '🔊' : '🔇'}</button>`;
}
let navHtmlCache = {};
function navPaint(force) {
  if (!nv) return; const parts = { top: navTopHtml(), bot: navBottomHtml(), ctl: navCtlHtml() };
  for (const [k, id] of [['top', '#ntop'], ['bot', '#nbot'], ['ctl', '#nctl']]) if (force || navHtmlCache[k] !== parts[k]) { const el = $(id); if (el) { const sc = el.querySelector('.nlist')?.scrollTop; el.innerHTML = parts[k]; const l = el.querySelector('.nlist'); if (l && sc) l.scrollTop = sc; } navHtmlCache[k] = parts[k]; }
}
function navFix(p) {
  const c = p.coords; return { lat: c.latitude, lng: c.longitude, acc: c.accuracy, alt: c.altitude, heading: c.heading, speed: c.speed, t: Date.now() };
}
function navUpdate() {
  if (!nv) return; const st = nv.st;
  navMap.setPosition(st.fix, st.q, st.off && st.nearest ? st.nearest : null);   // position mesurée, jamais recalée ; une ancienne position est dessinée en gris et datée
  if (st.started) navMap.setProgress(st.s);
  if (st.step !== nv.lastStep && st.started) { nv.lastStep = st.step; selStep = null; navMap.highlight(null); }
  if (!st.off) { nv.wasOff = false; nv.ignore = false; } else if (!nv.wasOff) { nv.wasOff = true; nv.ignore = false; }
  if (S.audio) { const m = Voice.decide({ st, plan, instr: instrFor, mem: nv.mem }); if (m.length) speak(m.join(' ')); } else Voice.decide({ st, plan, instr: instrFor, mem: nv.mem });   // la mémoire avance même en silence : pas de rattrapage à la réactivation
  if (Nav.atEnd(st)) nv.done = true;
  navPaint();
}
async function startNav() {
  if (!plan || nv) return;
  const ov = $('#nav'); ov.hidden = false; document.body.classList.add('navopen');
  ov.innerHTML = `<div id="nmap" class="nmap"></div><div id="ntop" class="ntop"></div><div id="nctl" class="nctl"></div><div id="nbot" class="nbot"></div>`;
  nv = { st: Nav.create(plan, navIndex()), mem: {}, expanded: false, lastStep: -1, tick: null, watch: null, wake: null, wasOff: false, ignore: false };
  navHtmlCache = {}; selStep = null;
  navMap = SkiMap.create($('#nmap'), { pm: bm.pm, label: 'Carte de navigation', pad: { t: 150, b: 130, l: 30, r: 60 }, onFollow: () => navPaint(), onSelect: i => { selStep = i; navMap.highlight(i); navPaint(true); } });
  navMap.setRoute(plan, nv.st.route); navMap.setDomain(domain(), true); navMap.fit();
  if (!bm.tried || !bm.pm) loadBasemap(); else navMap.setBase(bm.pm);
  navPaint(true);
  if (!Geo.supported()) { nv.st.geo = 'unavailable'; } else {
    nv.geo = Geo.subscribe({
      fix: fix => { nv.st.geo = 'ok'; Nav.update(nv.st, fix); if (!nv.followed && nv.st.q !== 'poor' && nv.st.dev != null && nv.st.dev < 1500) { nv.followed = true; navMap.setFollow(true, 16); } navUpdate(); },   // la carte suit la position dès qu'elle est fiable et proche du parcours
      err: err => { nv.st.geo = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'; navUpdate(); } });
  }
  navUpdate();
  nv.tick = setInterval(() => { Nav.tick(nv.st); navUpdate(); }, 1000);
  nv.vis = async () => {   // l'écran éteint ou l'appli en arrière-plan suspend la géolocalisation du navigateur : on le dit, et on réactive le maintien de l'écran
    if (document.hidden) { nv.hiddenAt = Date.now(); return; }
    if (nv.hiddenAt && Date.now() - nv.hiddenAt > 15000) toast('Appli restée en arrière-plan : ta position n\'est pas suivie quand l\'écran est éteint. Garde l\'écran allumé.', 7000);
    nv.hiddenAt = 0; try { if (navigator.wakeLock && nv && !nv.wake) nv.wake = await navigator.wakeLock.request('screen'); } catch { /* facultatif */ }
  };
  document.addEventListener('visibilitychange', nv.vis);
  try { if (navigator.wakeLock) { nv.wake = await navigator.wakeLock.request('screen'); nv.wake.addEventListener('release', () => { if (nv) nv.wake = null; }); } } catch { /* facultatif */ }
}
function stopNav() {
  if (!nv) return; clearInterval(nv.tick); document.removeEventListener('visibilitychange', nv.vis); try { speechSynthesis.cancel(); } catch { /* ignore */ } if (nv.geo) nv.geo.off(); try { nv.wake && nv.wake.release(); } catch { /* ignore */ }
  navMap && navMap.destroy(); navMap = null; nv = null; $('#nav').hidden = true; $('#nav').innerHTML = ''; document.body.classList.remove('navopen'); if (S.tab === 'route') { render(); setTimeout(() => $('#planres')?.scrollIntoView({ block: 'start' }), 30); }
}
/* Recalcul depuis la position : fonctionne sans réseau (le planificateur est dans l'appli) mais seulement près d'un point connu du réseau */
function navRecalc() {
  const st = nv.st, rs = Nav.recalcStart(Engine, NET, st.fix);
  if (!rs || rs.idx == null) { toast(`Pas de recalcul possible : le point connu le plus proche est à ${rs ? Math.round(rs.dist) : '?'} m (maximum 150 m). Reviens vers une piste ou une remontée.`, 6500); return; }
  const req = plan.req, endIdx = plan.opt.end, minLeft = Math.max(30, remainMin(plan, st) + 10);
  const r = computePlan({ ...req, start: rs.idx, end: endIdx, budget: minLeft, variant: 0 });
  if (r.error) { toast('Aucun itinéraire trouvé d\'ici jusqu\'à l\'arrivée prévue avec tes filtres (le réseau connu ne permet pas de la rejoindre). Reviens vers le tracé.', 7000); return; }
  r.recalc = { at: Date.now(), from: rs.node.label || 'position' }; r.req = req; r.opt.lo = plan.opt.lo; r.opt.hi = plan.opt.hi; r.reasons = explain(r, routeCtx());
  plan = r; selStep = null; nv.st = Nav.create(plan, navIndex()); nv.mem = {}; nv.lastStep = -1; nv.wasOff = false; nv.ignore = false; navHtmlCache = {};
  navMap.setRoute(plan, nv.st.route); Nav.update(nv.st, nv.st.fix); navMap.fit(); navUpdate(); navPaint(true);
  if (S.audio) speak('Itinéraire recalculé.'); toast('Itinéraire recalculé depuis ta position (données enregistrées).', 4500);
}
function navAction(d) {
  switch (d.action) {
    case 'dlstart': downloadPackage(); return true;
    case 'dlcancel': dl.ctl && dl.ctl.abort(); return true;
    case 'selstep': selectStep(+d.i, false); return true;
    case 'nstart': startNav(); return true;
    case 'nquit': stopNav(); return true;
    case 'nzin': navMap.zoomBy(1); return true;
    case 'nzout': navMap.zoomBy(-1); return true;
    case 'nfit': navMap.fit(); return true;
    case 'nfollow': navMap.setFollow(!navMap.follow, 16); navPaint(true); return true;
    case 'nlist': nv.expanded = !nv.expanded; navPaint(true); return true;
    case 'nsel': selStep = selStep === +d.i ? null : +d.i; navMap.highlight(selStep, true); navMap.setFollow(false); navPaint(true); return true;
    case 'nnext': Nav.jump(nv.st, Math.min(plan.steps.length - 1, nv.st.step + (nv.st.started ? 1 : 0))); navMap.setProgress(nv.st.s); navUpdate(); return true;
    case 'nprev': Nav.jump(nv.st, Math.max(0, nv.st.step - 1)); navMap.setProgress(nv.st.s); navUpdate(); return true;
    case 'nignore': nv.ignore = true; navPaint(true); return true;
    case 'nrejoin': if (nv.st.nearest) { nv.ignore = false; navMap.setFollow(false); navMap.centerOn(nv.st.nearest.p[0], nv.st.nearest.p[1], 16.5); toast(`Le point du tracé le plus proche est à ${Math.round(nv.st.dev)} m${nv.st.pos ? ', vers le ' + Nav.compass(Nav.bearing(nv.st.pos, nv.st.nearest.p)) : ''}. Rejoins-le en suivant la ligne rouge.`, 6000); } return true;
    case 'nrecalc': navRecalc(); return true;
    case 'nvoice': voiceSheet(); return true;
    case 'vtest': speak('Dans deux cents mètres, rejoignez la remontée Signal.'); return true;
  }
  return profileAction(d);
}
/* ---------- Réglages de la voix ---------- */
const getVoices = () => { try { return speechSynthesis.getVoices(); } catch { return []; } };
function voiceSheet() {
  const vs = Voice.list(getVoices(), navigator.onLine), cur = Voice.pick(getVoices(), S.voice.name, navigator.onLine), v = S.voice;
  openSheet(`<h2>🔊 Guidage vocal</h2>
    <label class="chk"><input type="checkbox" data-bind="audio" ${S.audio ? 'checked' : ''}> Activer le guidage vocal</label>
    ${vs.length ? `<div class="mut" style="margin-top:6px">Voix</div><select class="f" id="vname">${vs.map(x => `<option value="${esc(x.name)}" ${cur && cur.name === x.name ? 'selected' : ''}>${esc(x.name)} · ${esc(x.lang)} · ${x.local ? 'fonctionne hors ligne' : 'demande une connexion'}</option>`).join('')}</select>`
      : '<div class="warn">Aucune voix française trouvée sur cet appareil : le guidage vocal n\'est pas disponible ici (les instructions écrites restent affichées).</div>'}
    <div class="mut" style="margin-top:10px">Débit : <b id="vratev">${v.rate.toFixed(2).replace('.', ',')}</b> (1 = normal)</div><input type="range" id="vrate" min="0.7" max="1.3" step="0.05" value="${v.rate}">
    <div class="mut" style="margin-top:6px">Volume : <b id="vvolv">${Math.round(v.volume * 100)}</b> %</div><input type="range" id="vvol" min="0.2" max="1" step="0.1" value="${v.volume}">
    <div style="height:10px"></div><button class="btn sec" data-action="vtest" ${vs.length ? '' : 'disabled'}>▶ Écouter un extrait</button>
    <p class="mut" style="margin-top:10px">Annonces courtes, une seule fois : début de chaque étape, « Dans 200 mètres… » avant la fin d'une étape longue, sortie de parcours, perte et retour du GPS, arrivée. Rien n'est annoncé quand la position est trop imprécise.</p>
    <p class="mut">La voix est celle de ton téléphone : gratuite, sans compte, <b>sans connexion si la voix est locale</b>. Pour une voix plus naturelle, installe une voix « améliorée » dans les réglages du téléphone (iPhone : Réglages → Accessibilité → Contenu énoncé → Voix ; Android : Réglages → Synthèse vocale). Une voix de service en ligne (qualité studio) demanderait un abonnement externe et une connexion : non utilisée.</p>`);
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => { if (typeof $ === 'function' && !$('#sheet').hidden && $('#vname')) voiceSheet(); };
function afterRender() { if (S.tab === 'route') { mountPreview(); if (!offStat.checked) refreshOffStat(); } else if (pvMap) { pvMap.destroy(); pvMap = null; } }
