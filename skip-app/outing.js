/* Ma journée : enregistrement d'une sortie (parcours GPS réellement mesuré) et bilan. Calculs purs : trackcalc.js.
   Le parcours enregistré est toujours distinct de l'itinéraire prévu.
   Chargé avant app.js : les fonctions d'interface n'utilisent les variables de app.js (S, save, render…) qu'au moment de l'appel. */


/* ---------- Géolocalisation partagée : un seul récepteur pour la navigation et l'enregistrement ---------- */
const Geo = (() => {
  const subs = new Set(); let id = null, last = null;
  const fixOf = p => ({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, heading: p.coords.heading, speed: p.coords.speed, t: Date.now() });
  function stop() { if (id !== null) { try { navigator.geolocation.clearWatch(id); } catch { /* ignore */ } id = null; } }
  function start() {
    if (id !== null) return true; if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
    id = navigator.geolocation.watchPosition(p => { last = fixOf(p); subs.forEach(s => s.fix && s.fix(last)); },
      err => { subs.forEach(s => s.err && s.err(err)); if (err.code === 1) stop(); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    return true;
  }
  return { subscribe(sub) { subs.add(sub); const ok = start(); return { ok, off() { subs.delete(sub); if (!subs.size) stop(); } }; }, last: () => last, supported: () => typeof navigator !== 'undefined' && !!navigator.geolocation };
})();

/* ---------- Enregistrement ---------- */
let outSub = null, outMap = null, outTick = null, outGeoErr = '', recSheetId = null;
const outDay = () => todayKey();
function outPrune() { const keep = Object.keys(S.days || {}).sort().slice(-45); Object.keys(S.days || {}).forEach(k => { if (!keep.includes(k)) delete S.days[k]; }); }
function outingStart() {
  if (S.outing) return;
  if (!Geo.supported()) { toast('Localisation indisponible sur cet appareil : impossible d\'enregistrer un parcours.', 5000); return; }
  S.outing = { id: 'o' + Date.now().toString(36), day: outDay(), t0: Date.now(), pausedMs: 0, pausedAt: 0, status: 'rec', pts: [], rejected: 0, station: S.station };
  trk = Engine.newTracker(); outGeoErr = ''; outAttach(); save(); render();
}
function outAttach() {
  if (outSub || !S.outing || S.outing.status !== 'rec') return;
  outSub = Geo.subscribe({ fix: outFix, err: e => { outGeoErr = e.code === 1 ? 'Localisation refusée : l\'enregistrement ne reçoit aucune position.' : e.code === 3 ? 'Position introuvable pour l\'instant.' : 'Localisation indisponible.'; if (S.tab === 'day') outPaint(); } });
}
function outDetach() { if (outSub) { outSub.off(); outSub = null; } }
function outFix(fix) {
  const o = S.outing; if (!o || o.status !== 'rec') return; outGeoErr = '';
  if (fix.acc != null && fix.acc > 60) { o.rejected++; return; }   // trop imprécis pour tracer
  const last = o.pts[o.pts.length - 1];
  if (!last || Outing.dist(last, [fix.lat, fix.lng]) >= 6 || fix.t - last[3] >= 15000) {
    o.pts.push([+fix.lat.toFixed(6), +fix.lng.toFixed(6), fix.alt == null ? null : Math.round(fix.alt), fix.t, fix.acc == null ? 0 : Math.round(fix.acc)]);
    if (o.pts.length > 9000) o.pts.splice(1, 1);
    if (o.pts.length % 12 === 0) save();
  }
  try { handleFix(fix); } catch { /* détection des descentes facultative */ }
  if (S.tab === 'day') outPaint();
}
function outingPause() { const o = S.outing; if (!o || o.status !== 'rec') return; o.status = 'pause'; o.pausedAt = Date.now(); outDetach(); save(); render(); }
function outingResume() { const o = S.outing; if (!o || o.status !== 'pause') return; o.pausedMs += Date.now() - o.pausedAt; o.pausedAt = 0; o.status = 'rec'; trk = Engine.newTracker(); outAttach(); save(); render(); }
function outingStop(auto) {
  const o = S.outing; if (!o) return;
  if (!auto && !confirm('Arrêter et terminer cette sortie ? Elle sera gardée dans Ma journée.')) return;
  if (o.status === 'pause' && o.pausedAt) { o.pausedMs += Date.now() - o.pausedAt; o.pausedAt = 0; }
  o.t1 = auto && o.pts.length ? o.pts[o.pts.length - 1][3] : Date.now(); o.auto = !!auto; o.status = 'done'; outDetach();
  (S.days[o.day] = S.days[o.day] || []).push(o); S.outing = null; outPrune(); save();
  if (!auto) { S.tab = 'day'; render(); outingRecap(o.id); }
}
/* Fin d'une journée enregistrée : arrêt confirmé par l'utilisateur. Seule exception : une sortie restée ouverte plus de 12 h sans nouveau point est refermée à son dernier point (signalée « fermée automatiquement »). */
function outingResumeOnLoad() {
  const o = S.outing; if (!o) return;
  const lastT = o.pts.length ? o.pts[o.pts.length - 1][3] : o.t0;
  if (Date.now() - lastT > 12 * 3600e3) { outingStop(true); return; }
  if (o.status === 'rec') outAttach();
}
const fmtDur = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const outLog = o => (S.log[o.day] || []).filter(e => e.stationId === o.station && e.t >= o.t0 - 120000 && e.t <= (o.t1 || Date.now()) + 120000);
const outById = id => (S.outing && S.outing.id === id ? S.outing : Object.values(S.days).flat().find(x => x.id === id));

/* Identification par le tracé GPS d'une descente qui vient d'être détectée */
function refineByTrack(seg) {
  const o = S.outing; if (!o || seg.type !== 'piste' || !seg.t0) return seg;
  const pts = o.pts.filter(p => p[3] >= seg.t0 - 5000 && p[3] <= seg.t + 5000);
  const v = Outing.verdict(Outing.identify(pts, navIndex()));
  if (v.kind === 'track') { seg.cands = [v.pick]; seg.conf = 'track'; seg.cover = v.cover; }
  else if (v.kind === 'cands') { seg.cands = v.cands; seg.conf = 'cands'; }
  else seg.conf = seg.cands.length ? 'alt' : 'none';
  return seg;
}

/* ---------- Écran « Ma journée » ---------- */
function outStateHtml() {
  const o = S.outing;
  if (!o) return `<button class="btn gps" data-action="ostart">▶ Démarrer ma sortie</button>
    <div class="mut" style="margin-top:8px">Ton parcours GPS et tes descentes sont enregistrés ici automatiquement. Tu arrêtes quand tu veux ; rien n'est envoyé ailleurs.</div>`;
  const last = o.pts[o.pts.length - 1], age = last ? Math.round((Date.now() - last[3]) / 1000) : null;
  return `<div class="row" style="justify-content:space-between"><b>${o.status === 'rec' ? '🔴 Enregistrement en cours' : '⏸ En pause'}</b><b id="outtime">${fmtDur(Outing.durationMs(o))}</b></div>
    <div class="mut" id="outinfo" style="margin:4px 0 10px">${outInfoText(o, age)}</div>
    <div class="row" style="gap:8px">${o.status === 'rec' ? '<button class="btn sec" data-action="opause">⏸ Pause</button>' : '<button class="btn sec" data-action="oresume">▶ Reprendre</button>'}<button class="btn" data-action="ostop" style="background:#c62828">⏹ Arrêter</button></div>
    <button class="btn sm ghost" data-action="pocket" style="margin-top:8px">🌑 Mode poche (écran noir)</button>`;
}
function outInfoText(o, age) {
  if (outGeoErr) return outGeoErr;
  if (o.status === 'pause') return 'Pause : aucune position n\'est enregistrée.';
  if (age == null) return 'En attente de la première position…';
  return `${o.pts.length} points GPS · ${(Outing.distanceM(o.pts) / 1000).toFixed(1).replace('.', ',')} km · dernière position il y a ${age} s${age > 30 ? ' (signal faible ou interrompu)' : ''}`;
}
function outPaint() {
  const o = S.outing; if (!o) return; const t = $('#outtime'), i = $('#outinfo');
  if (t) t.textContent = fmtDur(Outing.durationMs(o));
  if (i) { const last = o.pts[o.pts.length - 1]; i.textContent = outInfoText(o, last ? Math.round((Date.now() - last[3]) / 1000) : null); }
}
function renderDay() {
  const st = station(), log = logToday(), days = (S.days[outDay()] || []).slice().reverse(), hour = new Date().getHours();
  const pistes = [...new Set(log.filter(e => e.type === 'piste' && e.pick).map(e => e.pick))], nPending = Object.keys(pending).length;
  const todo = log.filter(e => e.type === 'piste' && !e.pick);
  return `<h2>Ma journée</h2>
  ${S.outing || !pistes.length || hour < 16 ? '' : '<div class="warn">🌇 La journée est finie ? Note tes pistes ci-dessous en 2 secondes chacune.</div>'}
  <div class="card" id="outcard">${outStateHtml()}</div>
  ${days.length ? `<h3>Mes sorties</h3><div class="card">${days.map(o => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><div class="sp"><b>${hhmm(o.t0)} – ${hhmm(o.t1)}</b> <span class="mut">· ${fmtDur(Outing.durationMs(o))} · ${outLog(o).filter(e => e.type === 'piste').length} descente(s)${o.auto ? ' · fermée automatiquement' : ''}</span></div><button class="btn sm sec" data-action="orecap" data-id="${o.id}">Bilan</button></div>`).join('')}</div>` : ''}
  <h3>Descentes du jour (${log.filter(e => e.type === 'piste').length})</h3>
  <div class="card">${todo.length ? `<div class="warn">${todo.length} descente(s) à confirmer : touche le nom de la piste proposée.</div>` : ''}${log.length ? log.map((e, k) => logRow(e, k)).join('') : '<p class="mut" style="margin:0">Rien d\'enregistré pour l\'instant. Démarre une sortie, ou ajoute une piste à la main.</p>'}
    <div class="row" style="margin-top:10px"><select class="f" id="manual" style="flex:1"><option value="">Ajouter une piste à la main…</option>${st.pistes.map(p => `<option value="${p.id}">${esc(p.name)} (${colorName(p.color).toLowerCase()})</option>`).join('')}</select></div></div>
  ${quickRateCard()}
  ${pistes.length ? `<h3>⭐ Noter mes pistes</h3><div class="card">${pistes.map(id => { const p = pisteOf(id), cur = pending[id] ?? myVote(id)?.s; return `<div style="margin-bottom:12px"><div class="row"><span class="sq ${p.color}"></span><b class="sp">${esc(p.name)}</b></div>
      <div class="rate mini">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${cur === n ? 'on' : ''}" data-action="pend" data-id="${id}" data-n="${n}">${n}</button>`).join('')}</div></div>`; }).join('')}
    <button class="btn" data-action="sendvotes" ${nPending ? '' : 'disabled'}>Enregistrer mes ${nPending} note(s)</button></div>` : ''}`;
}
function logRow(e, k) {
  const alt = e.altFrom && e.altTo ? ` <span class="mut">(${e.altFrom} → ${e.altTo} m)</span>` : '';
  let txt;
  if (e.pick) { const x = thing(e.pick); txt = e.type === 'lift' ? '🚡 ' + esc(x.name) : `<span class="sq ${x.color}" style="display:inline-block"></span> ${esc(x.name)}${e.conf === 'track' ? ' <span class="mut">· identifiée par le tracé</span>' : e.manual ? '' : ''}`; }
  else if (e.cands.length) txt = `${e.type === 'lift' ? 'Remontée' : 'Piste'} à confirmer${alt} <div class="chips" style="margin-top:4px">${e.cands.map(c => `<button class="chip" data-action="resolve" data-k="${k}" data-id="${c}">${esc(thing(c).name)}</button>`).join('')}</div>`;
  else txt = `${e.type === 'lift' ? 'Montée' : 'Descente'} non identifiée${alt}`;
  return `<div class="step"><span class="mut">${hhmm(e.t)}</span><div class="sp">${txt}</div></div>`;
}

/* ---------- Bilan ---------- */
function outingRecap(id) {
  const o = outById(id); if (!o) return; recSheetId = id;
  const log = outLog(o), downs = log.filter(e => e.type === 'piste'), certain = downs.filter(e => e.pick), unsure = downs.filter(e => !e.pick);
  const el = Outing.elevation(o.pts), km = Outing.distanceM(o.pts) / 1000, byPiste = new Map(); certain.forEach(e => byPiste.set(e.pick, (byPiste.get(e.pick) || 0) + 1));
  const rows = [...byPiste].map(([pid, n]) => { const p = pisteOf(pid), i = info(p); return `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><span class="sq ${p.color}"></span><div class="sp"><b>${esc(p.name)}</b>${n > 1 ? ` <span class="mut">× ${n}</span>` : ''}</div>
      ${i.liked ? '❤' : ''}<button class="btn sm ${i.mine ? 'sec' : ''}" data-action="open" data-id="${pid}">${i.mine ? 'Ma note ' + i.mine + '/10' : 'Noter'}</button></div>`; }).join('');
  openSheet(`<h2 style="margin-bottom:2px">Bilan de ma sortie</h2><div class="mut">${new Date(o.t0).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${hhmm(o.t0)} – ${hhmm(o.t1 || Date.now())}${o.auto ? ' · fermée automatiquement' : ''}</div>
    ${o.pts.length > 1 ? '<div class="mapbox" id="recmap" style="height:240px;margin:10px 0"></div>' : '<div class="warn" style="margin-top:10px">Aucun parcours GPS enregistré (pas de position reçue). Les descentes ajoutées à la main sont listées ci-dessous.</div>'}
    <div class="stats"><div><b>${fmtDur(Outing.durationMs(o))}</b><span>durée</span></div><div><b>${km ? km.toFixed(1).replace('.', ',') : '—'}</b><span>km (GPS)</span></div><div><b>${certain.length}</b><span>descentes</span></div><div><b>${el.down == null ? '—' : el.down}</b><span>m descendus ≈</span></div></div>
    <h3>Pistes parcourues</h3>${rows ? `<div>${rows}</div>` : '<p class="mut">Aucune piste identifiée avec certitude.</p>'}
    ${unsure.length ? `<div class="warn" style="margin-top:8px">${unsure.length} descente(s) non identifiée(s) avec assez de fiabilité : elles ne sont pas comptées comme parcourues. <button class="btn sm" data-action="close">Les confirmer dans Ma journée</button></div>` : ''}
    <details style="margin-top:12px"><summary class="mut">Plus de détails</summary>
      <div class="mut" style="margin:6px 0">Altitude max ${el.max == null ? '—' : el.max + ' m'} · montées cumulées ≈ ${el.up == null ? '—' : el.up + ' m'} · ${o.pts.length} points GPS${o.rejected ? ` (${o.rejected} écartés car trop imprécis)` : ''} · pauses ${fmtDur(o.pausedMs || 0)}.</div>
      <div class="mut">Parcours mesuré par le GPS du téléphone. Une piste n'est comptée que si le tracé GPS la recouvre à plus de 60 % et nettement plus que sa voisine ; sinon elle reste « à confirmer ». Distances et dénivelés sont des estimations.</div>
      <div style="margin-top:8px">${log.length ? log.map((e, k) => `<div class="step"><span class="mut">${hhmm(e.t)}</span><div class="sp">${e.pick ? esc(thing(e.pick).name) : (e.type === 'lift' ? 'Remontée' : 'Descente non confirmée')}</div></div>`).join('') : ''}</div></details>
    <div class="row" style="margin-top:12px"><button class="btn sm ghost" data-action="odel" data-id="${id}">Supprimer cette sortie</button></div>`);
  if (o.pts.length > 1) setTimeout(() => { const h = $('#recmap'); if (!h) return; if (outMap) outMap.destroy(); outMap = SkiMap.create(h, { pm: bm.pm, label: 'Parcours enregistré' }); outMap.setDomain(domain(), true); outMap.setTrack(o.pts.map(p => [p[0], p[1]])); outMap.fitTrack(); if (!bm.tried) loadBasemap(); }, 30);
}
function outingAction(d) {
  switch (d.action) {
    case 'ostart': outingStart(); return true;
    case 'opause': outingPause(); return true;
    case 'oresume': outingResume(); return true;
    case 'ostop': outingStop(false); return true;
    case 'orecap': outingRecap(d.id); return true;
    case 'odel': if (confirm('Supprimer cette sortie et son parcours ?')) { Object.keys(S.days).forEach(k => { S.days[k] = S.days[k].filter(x => x.id !== d.id); }); save(); closeSheet(); render(); } return true;
  }
  return false;
}
setInterval(() => { if (S.outing && S.tab === 'day' && !document.hidden) outPaint(); }, 1000);
