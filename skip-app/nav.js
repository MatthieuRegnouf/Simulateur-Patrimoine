/* Navigation sur un itinéraire : logique pure (sans DOM), testée dans test/nav.test.js.
   - Route : les étapes du plan mises bout à bout en une seule ligne avec distances cumulées.
   - Position : projetée sur la ligne, avec une fenêtre de progression (on ne « saute » pas d'un bout à l'autre d'un parcours qui se croise).
   - Qualité du GPS : jamais de fausse précision. Si la position est imprécise ou ancienne, on le dit et on ne déclare rien d'autre. */
const Nav = (() => {
  const GOOD_M = 25, FAIR_M = 50, STALE_MS = 20000;   // seuils de précision / d'ancienneté d'un point GPS
  const OFF_FIXES = 3, OFF_MS = 8000;                  // sortie de parcours confirmée après 3 points hors couloir, sur au moins 8 s
  const BACK_M = 60, AHEAD_M = 600;                    // fenêtre de recherche autour de la progression précédente
  const R = 6371000, RAD = Math.PI / 180;

  const dist = (a, b) => { // m, a et b = [lat, lng]
    const dl = (b[0] - a[0]) * RAD, dn = (b[1] - a[1]) * RAD;
    const x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  /* Ligne continue du plan : pts = [{p:[lat,lng], s:mètres cumulés, i:index d'étape}], ranges[i] = {s0, s1, p0, p1} */
  function build(plan) {
    const pts = [], ranges = [];
    plan.steps.forEach((st, i) => {
      const p0 = pts.length;
      st.coords.forEach((c, k) => {
        const s = pts.length ? pts[pts.length - 1].s + dist(pts[pts.length - 1].p, c) : 0;
        pts.push({ p: c, s, i });
      });
      ranges[i] = { p0, p1: pts.length - 1 };
    });
    ranges.forEach(r => { r.s0 = pts[r.p0].s; r.s1 = pts[r.p1].s; });
    return { pts, ranges, total: pts.length ? pts[pts.length - 1].s : 0 };
  }

  /* Projette une position sur le segment a-b (repère plan local). Renvoie {d, t, p} */
  function proj(pos, a, b) {
    const k = Math.cos(pos[0] * RAD), x = (q) => (q[1] - pos[1]) * k * RAD * R, y = (q) => (q[0] - pos[0]) * RAD * R;
    const ax = x(a), ay = y(a), bx = x(b), by = y(b), dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    const px = ax + t * dx, py = ay + t * dy;
    return { d: Math.hypot(px, py), t, p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
  }

  /* Meilleure projection sur les segments dont les distances cumulées sont dans [s0, s1] */
  function best(route, pos, s0, s1) {
    let out = null;
    for (let j = 0; j < route.pts.length - 1; j++) {
      const A = route.pts[j], B = route.pts[j + 1];
      if (B.s < s0 || A.s > s1) continue;
      const q = proj(pos, A.p, B.p);
      if (!out || q.d < out.d) out = { d: q.d, s: A.s + (B.s - A.s) * q.t, p: q.p, j };
    }
    return out;
  }

  /* Qualité d'un point GPS : good | fair | poor | stale | none. acc = précision annoncée (m) */
  function quality(fix, now = Date.now()) {
    if (!fix) return 'none';
    if (now - fix.t > STALE_MS) return 'stale';
    if (fix.acc == null || !isFinite(fix.acc)) return 'poor';
    return fix.acc <= GOOD_M ? 'good' : fix.acc <= FAIR_M ? 'fair' : 'poor';
  }
  const corridor = acc => Math.max(40, 2 * (acc || 0));

  const create = (plan, index) => ({ index: index || null, route: build(plan), s: 0, step: 0, t0: Date.now(), started: false, offCount: 0, offSince: 0, off: false, fix: null, geo: 'idle', msg: '' });

  /* Fait avancer l'état avec un point GPS ; renvoie l'état (muté). geo : idle | denied | unavailable | timeout | ok */
  function update(st, fix, now = Date.now()) {
    st.fix = fix || st.fix;
    const q = quality(st.fix, now); st.q = q;
    if (!st.fix || q === 'stale' || q === 'none') { st.pos = null; return st; }
    const pos = [st.fix.lat, st.fix.lng], acc = st.fix.acc, cor = corridor(acc);
    // fenêtre autour de la progression ; au tout début (rien d'engagé), on cherche partout pour accepter un départ de n'importe où sur le tracé
    const w = st.started ? best(st.route, pos, st.s - BACK_M, st.s + AHEAD_M) : best(st.route, pos, 0, st.route.total);
    const g = w && w.d <= cor ? null : best(st.route, pos, 0, st.route.total);   // meilleur point global, pour dire où l'on est par rapport au tracé
    const onWindow = w && w.d <= cor;
    st.pos = pos; st.nearest = g || w; st.here = st.index && (q === 'good' || q === 'fair') ? hereOn(st.index, pos, acc) : null;
    if (q === 'poor') {   // trop imprécis : on ne déclare ni progression ni sortie de parcours
      st.off = false; st.offCount = 0; st.offSince = 0; st.onRoute = null; return st;
    }
    if (onWindow) {
      if (!st.started) { st.started = true; st.s = w.s; } else if (w.s > st.s) st.s = w.s;
      st.step = Math.max(0, st.route.ranges.findIndex(r => st.s <= r.s1));
      st.snap = w.p; st.dev = w.d; st.onRoute = true; st.off = false; st.offCount = 0; st.offSince = 0;
    } else {
      st.onRoute = false; st.dev = w ? w.d : g ? g.d : null; st.snap = null;   // distance au tracé attendu (pas à une autre section du parcours qui passerait à côté)
      if (!st.offSince) st.offSince = now;
      st.offCount++;
      if (st.offCount >= OFF_FIXES && now - st.offSince >= OFF_MS) st.off = true;
    }
    return st;
  }

  /* Réévaluation à vide (sans nouveau point GPS) : ne fait que détecter un signal devenu trop ancien, sans compter de sortie de parcours */
  function tick(st, now = Date.now()) { st.q = quality(st.fix, now); if (st.q === 'stale') st.pos = null; return st; }
  const remaining = st => Math.max(0, st.route.total - st.s);
  const stepRemaining = st => Math.max(0, st.route.ranges[st.step].s1 - st.s);
  const atEnd = st => st.started && remaining(st) < 25;



  /* ---------- Où suis-je sur le domaine ? ----------
     On ne « colle » jamais le skieur sur une piste : la position reste celle mesurée. On indique seulement, à titre d'information, de quelle piste ou remontée elle est proche,
     et seulement quand c'est sans ambiguïté. Quand plusieurs pistes sont dans la marge d'erreur du GPS, on les liste sans choisir. */
  function indexNet(net) {
    return net.edges.filter(e => e.k === 'piste' || e.k === 'lift').map(e => { const g = net.geom(e); let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180; g.forEach(p => { la0 = Math.min(la0, p[0]); la1 = Math.max(la1, p[0]); lo0 = Math.min(lo0, p[1]); lo1 = Math.max(lo1, p[1]); });
      return { id: e.id, key: e.k + ':' + (e.n || e.id), k: e.k, n: e.n || '', c: e.c || null, o: e.o || null, g, b: [la0, la1, lo0, lo1] }; });
  }
  function hereOn(index, pos, acc) {
    const cor = Math.max(30, 1.5 * (acc || 0)), pad = cor / 111320 * 1.2, padLo = pad / Math.cos(pos[0] * RAD), per = new Map();
    for (const e of index) {
      if (pos[0] < e.b[0] - pad || pos[0] > e.b[1] + pad || pos[1] < e.b[2] - padLo || pos[1] > e.b[3] + padLo) continue;
      let d = Infinity; for (let j = 0; j < e.g.length - 1; j++) d = Math.min(d, proj(pos, e.g[j], e.g[j + 1]).d);
      if (d <= cor && (!per.has(e.key) || per.get(e.key).d > d)) per.set(e.key, { key: e.key, k: e.k, n: e.n, c: e.c, o: e.o, d });
    }
    const c = [...per.values()].sort((a, b) => a.d - b.d);
    if (!c.length) return { state: 'none', cor };
    const named = c.filter(x => x.n), top = c[0];
    if (c.length === 1 || c[1].d - top.d >= 25) return { state: 'unique', best: top, cor };
    return { state: 'ambiguous', cands: c.slice(0, 4), cor };
  }

  /* Remet la progression sur le début d'une étape (suivi manuel, ou correction par l'utilisateur) */
  function jump(st, i) { const r = st.route.ranges[Math.max(0, Math.min(i, st.route.ranges.length - 1))]; st.s = r.s0; st.step = st.route.ranges.indexOf(r); st.started = true; st.off = false; st.offCount = 0; st.offSince = 0; return st; }
  /* Cap (0 = nord) et direction en mots, de a vers b ([lat,lng]) */
  function bearing(a, b) { const k = Math.cos(a[0] * RAD), y = (b[1] - a[1]) * k, x = b[0] - a[0]; return (Math.atan2(y, x) / RAD + 360) % 360; }
  const compass = deg => ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'][Math.round(deg / 45) % 8];
  /* Recalcul : seul un point connu du réseau, à moins de maxM mètres de la position, peut servir de départ. Sinon null (pas de recalcul inventé). */
  function recalcStart(Engine, net, fix, maxM = 150) {
    if (!fix) return null; const n = Engine.nearestNode(net, fix.lat, fix.lng); if (!n) return null;
    const d = Engine.distM({ lat: fix.lat, lng: fix.lng }, n); return d <= maxM ? { idx: net.nodes.indexOf(n), dist: d, node: n } : { idx: null, dist: d, node: n };
  }

  /* Texte d'état de la position, pour l'écran. Honnête : dit ce qu'on sait et ce qu'on ne sait pas. */
  function statusText(st, now = Date.now()) {
    if (st.geo === 'denied') return { key: 'denied', text: 'Localisation refusée. Autorise-la dans les réglages du navigateur, ou suis les étapes à la main.' };
    if (st.geo === 'unavailable') return { key: 'unavailable', text: 'Localisation indisponible sur cet appareil. Suis les étapes à la main.' };
    if (!st.fix) { const w = Math.round((now - (st.t0 || now)) / 1000); return { key: 'wait', text: st.geo === 'timeout' || w > 25 ? `Position introuvable depuis ${w} s : signal faible ou localisation coupée. Passe à l'air libre et vérifie que la localisation est activée.` : `Recherche de ta position… ${w} s (la première position peut demander quelques dizaines de secondes).` }; }
    const q = quality(st.fix, now);
    if (q === 'stale') return { key: 'stale', text: `Pas de nouvelle position depuis ${Math.round((now - st.fix.t) / 1000)} s (signal interrompu, ou tu es immobile). La progression affichée peut être dépassée.` };
    if (q === 'poor') return { key: 'poor', text: `Position imprécise (± ${Math.round(st.fix.acc)} m) : on ne suit pas la progression tant qu'elle n'est pas meilleure.` };
    if (st.off) return { key: 'off', text: `Tu es à environ ${Math.round(st.dev)} m de l'itinéraire.` };
    if (st.onRoute === false && !st.started) return { key: 'near', text: `Tu n'es pas encore sur l'itinéraire : le tracé le plus proche est à ${Math.round(st.dev)} m. La progression démarre dès que tu le rejoins.` };
    if (st.onRoute === false) return { key: 'near', text: `Un peu à l'écart du tracé (${Math.round(st.dev)} m). Vérification en cours…` };
    if (st.onRoute) return { key: q, text: `Position ± ${Math.round(st.fix.acc)} m${q === 'fair' ? ' (précision moyenne)' : ''}` };
    return { key: 'wait', text: 'Recherche de ta position…' };
  }

  /* ---------- Profil personnel ---------- */
  /* Critères de calcul déduits UNIQUEMENT des champs qui existent dans le profil :
     S.level (niveau 1–10), S.profile.wants, S.profile.discipline. Renvoie aussi la liste des champs ignorés et ce qui manque.
     Entrées : { level, levelSet, wants[], discipline, tmp? } ; Engine fourni pour les paliers 1–5. */
  const WANTS = ['Progresser', 'Rouge sportive', 'Balade', 'Pause chocolat', 'Photos', 'Famille'];
  function profileCriteria(Engine, pr, tmp = {}) {
    const level = tmp.level != null ? tmp.level : pr.level, wants = tmp.wants || pr.wants || [];
    const missing = [];
    if (!pr.levelSet && tmp.level == null) missing.push('level');
    const L = Engine.levelOf(level).n, used = [], ignored = [];
    let hi = L, lo = 1, speed = null, walk = null;
    used.push({ k: 'level', label: `Niveau ${level}/10`, effect: `pistes jusqu'au palier ${L}/5 (${Engine.LEVELS[L - 1].label.toLowerCase()})` });
    if (wants.includes('Progresser')) { hi = Math.min(5, Engine.levelOf(Math.min(10, level + 1)).n); used.push({ k: 'want', label: 'Envie : progresser', effect: `un palier au-dessus du niveau possible (jusqu'à ${hi}/5)` }); }
    if (wants.includes('Rouge sportive')) { const r = Engine.levelOf(Engine.COLOR_LEVEL.red).n; if (level >= 4) { hi = Math.max(hi, Math.min(r, Engine.levelOf(level + 2).n)); lo = Math.max(lo, Math.max(1, hi - 1)); used.push({ k: 'want', label: 'Envie : rouge sportive', effect: `pistes plutôt exigeantes (paliers ${lo} à ${hi}/5)` }); } else ignored.push({ label: 'Envie : rouge sportive', why: 'ignorée : ton niveau est trop bas pour ce choix' }); }
    if (wants.includes('Famille')) { hi = Math.min(hi, L); lo = Math.min(lo, hi); used.push({ k: 'want', label: 'Envie : famille', effect: `pas au-dessus de ton niveau (max ${hi}/5)` }); }
    if (wants.includes('Balade')) { speed = 'slow'; used.push({ k: 'want', label: 'Envie : balade', effect: 'rythme lent' }); }
    if (pr.discipline === 'snowboard') { walk = false; used.push({ k: 'disc', label: 'Snowboard', effect: 'chemins à pied évités' }); } else if (pr.discipline) used.push({ k: 'disc', label: 'Ski', effect: 'aucun réglage particulier' });
    for (const w of ['Pause chocolat', 'Photos']) if (wants.includes(w)) ignored.push({ label: `Envie : ${w.toLowerCase()}`, why: 'non utilisée : aucune donnée du réseau ne permet de la prendre en compte' });
    if (hi < lo) lo = hi;
    return { lo, hi, speed, walk, used, ignored, missing, level, wants };
  }

  return { dist, build, proj, best, quality, corridor, create, update, tick, indexNet, hereOn, jump, bearing, compass, recalcStart, remaining, stepRemaining, atEnd, statusText, profileCriteria, WANTS, GOOD_M, FAIR_M, STALE_MS, OFF_FIXES, OFF_MS };
})();
if (typeof module !== 'undefined') module.exports = Nav;
