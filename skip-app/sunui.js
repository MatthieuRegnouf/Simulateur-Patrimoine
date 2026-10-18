/* Soleil / ombre : liaison entre le modèle (sun.js) et l'appli. Chargé avant app.js ; n'utilise S, NET, wxData… qu'au moment de l'appel.
   Source des données : orientation et altitudes du réseau (OpenStreetMap + EU-DEM 25 m), relief en grille de 150 m (dem.js), nuages prévus (MET Norway) si disponibles.
   C'est une ESTIMATION : sans arbres ni bâtiments ni petits reliefs, et sans lien démontré avec l'état de la neige. */
let sunDem = null, sunDemTried = false;
const getDem = () => { if (!sunDemTried) { sunDemTried = true; try { sunDem = typeof DEM !== 'undefined' ? Sun.makeDem(DEM) : null; } catch { sunDem = null; } } return sunDem; };
const sunSmp = new Map(), sunCache = new Map();
const edgeSamples = e => { let s = sunSmp.get(e.id); if (!s) { const A = NET.nodes[e.a], B = NET.nodes[e.b]; s = Sun.samples(NET.geom(e), A.alt, B.alt, 3); sunSmp.set(e.id, s); } return s; };

/* Nébulosité prévue (0..1) à une date, ou null si la prévision ne couvre pas l'heure */
function cloudAt(date) {
  const d = typeof wxData !== 'undefined' && (wxData.top || wxData.base); if (!d || !d.ts) return null;
  let best = null, bd = 1e12; for (const e of d.ts) { const t = new Date(e.time).getTime(), dd = Math.abs(t - date.getTime()); if (dd < bd) { bd = dd; best = e; } }
  const c = best && best.data && best.data.instant && best.data.instant.details && best.data.instant.details.cloud_area_fraction;
  return bd <= 90 * 60000 && c != null ? c / 100 : null;
}
/* Éclairement 0..1 d'un tronçon à une date (null si le tronçon est trop court ou sans altitudes) */
function edgeSun(e, date, useCloud) {
  const cl = useCloud ? cloudAt(date) : null, key = e.id + '|' + Math.round(date.getTime() / 900000) + '|' + (cl == null ? 'x' : Math.round(cl * 4));
  if (sunCache.has(key)) return sunCache.get(key);
  const smp = edgeSamples(e), r = smp.length ? Sun.edge(getDem(), smp, date, cl) : null; sunCache.set(key, r); return r;
}
/* Heure de départ choisie (date locale) */
function sunStart() {
  const w = S.rf.when || { day: 0, time: '' }, d = new Date(); d.setSeconds(0, 0);
  if (w.time) { const [h, m] = w.time.split(':').map(Number); d.setHours(h || 0, m || 0, 0, 0); } else { d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15); }
  if (w.day) d.setDate(d.getDate() + 1);
  return d;
}
/* Pour le planificateur : { w, score(edge, minutes depuis le départ) } ; null si l'utilisateur n'a pas de préférence */
function sunForPlanner(sun, startAt) {
  if (!sun) return null; const t0 = startAt, dem = getDem();
  return { w: sun * 6, score: (e, min) => { const r = edgeSun(e, new Date(t0 + min * 60000), true); return r ? r.s : 0.45; }, hasRelief: !!dem };
}
/* Part de la longueur de piste au soleil pour un itinéraire, et verdict par étape (à l'heure de passage estimée) */
function planSun(pl, startAt) {
  let lit = 0, tot = 0, clo = 0; const per = []; let t = 0;
  pl.steps.forEach((s, i) => {
    if (s.kind === 'piste' && s.edges.length) {
      let acc = 0, ss = 0, ll = 0; const totM = s.edges.reduce((a, id) => a + (NET.edges[id].m || 0), 0) || 1;
      s.edges.forEach(id => { const e = NET.edges[id], m = e.m || 0, tm = t + (acc + m / 2) / totM * s.minF, r = edgeSun(e, new Date(startAt + tm * 60000), true); acc += m; if (r) { ss += r.s * m; ll += m; if (r.s >= 0.35) lit += m; tot += m; } });
      per.push({ i, s: ll ? ss / ll : null, label: ll ? Sun.label(ss / ll) : null });
    }
    t += s.minF;
  });
  const cl = cloudAt(new Date(startAt + (pl.total || 0) * 30000)); void clo;
  return { pct: tot ? Math.round(lit / tot * 100) : null, per, cloud: cl, relief: !!getDem() };
}
/* Soleil sur une piste officielle : matin, midi, après-midi (date du jour en saison, sinon 1er février) */
function pisteSunSlots(pid) {
  const es = NET.edges.filter(e => e.k === 'piste' && e.o === pid); if (!es.length) return null;
  const now = new Date(), inSeason = [10, 11, 0, 1, 2, 3, 4].includes(now.getMonth()), base = inSeason ? now : new Date(now.getFullYear() + (now.getMonth() > 4 ? 1 : 0), 1, 1);
  const out = [['Matin', 9, 30], ['Midi', 12, 30], ['Après-midi', 15, 30]].map(([n, h, m]) => {
    const d = new Date(base); d.setHours(h, m, 0, 0); let s = 0, l = 0;
    es.forEach(e => { const r = edgeSun(e, d, false), len = e.m || 0; if (r) { s += r.s * len; l += len; } });
    return { name: n, s: l ? s / l : null };
  });
  return out.every(x => x.s == null) ? null : { slots: out, date: base, typical: !inSeason };
}
const SUN_ICON = { soleil: '☀️', 'soleil faible': '🌤', ombre: '🌑' };
const sunTag = s => s == null ? '' : `${SUN_ICON[Sun.label(s)]} ${Sun.label(s)}`;
