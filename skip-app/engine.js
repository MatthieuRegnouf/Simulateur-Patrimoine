/* Logique pure (sans DOM) : notation, niveaux, durées, enchaînement d'étapes, détection GPS par altitude. */
const Engine = (() => {
  // Vitesse moyenne de descente (km/h), pauses comprises. Hypothèse d'estimation, pas une donnée officielle.
  const SPEED_KMH = { slow: 12, medium: 18, fast: 26 };
  const COLOR_LABEL = { green: 'Verte', blue: 'Bleue', red: 'Rouge', black: 'Noire' };
  // Niveau indicatif d'une piste d'après sa couleur officielle (utilisé seulement tant qu'elle n'est pas notée)
  const COLOR_LEVEL = { green: 2, blue: 4, red: 6.5, black: 8.5 };
  const LIFT_GAP_M = 80;          // écart d'altitude toléré pour dire que deux étapes s'enchaînent
  const MATCH_TOL_M = 120;        // tolérance GPS (altitude) pour reconnaître une piste ou une remontée

  // Seuils de la présentation. Sans vote, aucune note n'existe : on n'invente rien.
  function label(score) {
    if (score == null) return { key: 'none', text: 'Pas encore noté', icon: '' };
    if (score < 4) return { key: 'easy', text: 'Facile', icon: '🟢' };
    if (score < 7.5) return { key: 'mid', text: 'Moyenne', icon: '🟠' };
    return { key: 'hard', text: 'Difficile', icon: '🔴' };
  }

  // Adéquation avec le niveau de l'utilisateur : sa note si elle existe, sinon la couleur officielle.
  function fit(p, myVote, level) {
    const lv = myVote || COLOR_LEVEL[p.color], d = lv - level;
    const basis = myVote ? '' : ' (d\'après la couleur)';
    if (d <= 0.5) return { key: 'ok', text: 'À ton niveau' + basis };
    if (d <= 1.5) return { key: 'progress', text: 'Pour progresser' + basis };
    return { key: 'hard', text: 'Trop dur pour toi' + basis };
  }

  // Durée d'une descente : estimée d'après la longueur (null si la longueur est inconnue)
  function estMin(p, speed) { return p.km ? Math.max(1, Math.round(p.km / SPEED_KMH[speed] * 60)) : null; }
  const stepMin = (kind, ref, speed) => kind === 'lift' ? (ref.min ? Math.round(ref.min) : null) : estMin(ref, speed);
  const drop = p => p.altFrom && p.altTo ? p.altFrom - p.altTo : null;

  // Enchaînement : l'arrivée d'une étape doit être (à peu près) à l'altitude de départ de la suivante.
  function gap(prev, next) {
    const a = prev.altTo, b = next.altFrom;
    if (!a || !b) return { ok: null, d: null };
    const d = Math.abs(a - b);
    return { ok: d <= LIFT_GAP_M, d };
  }

  function summary(steps, speed) {
    let total = 0, unknown = 0, km = 0, descents = 0, up = 0, down = 0;
    steps.forEach(s => {
      const m = stepMin(s.kind, s.ref, speed);
      if (m == null) unknown++; else total += m;
      if (s.kind === 'piste') { descents++; km += s.ref.km || 0; down += drop(s.ref) || 0; }
      else up += s.ref.altFrom && s.ref.altTo ? s.ref.altTo - s.ref.altFrom : 0;
    });
    return { total, unknown, km: Math.round(km * 10) / 10, descents, up, down };
  }

  function distM(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /* Détection sans écran. On suit l'altitude GPS : une descente (ou une montée) commence quand l'altitude
     s'éloigne de 60 m de son extrême, et se termine quand elle remonte (descend) de 40 m. Le segment est
     ensuite rapproché des pistes (ou remontées) dont les altitudes départ/arrivée correspondent. */
  function newTracker() { return { dir: 0, ext: null, extT: 0, start: null, dist: 0, last: null }; }
  function onFix(station, tr, fix) {
    if (fix.alt == null || isNaN(fix.alt)) return null;
    tr.alt = tr.alt == null ? fix.alt : tr.alt * 0.5 + fix.alt * 0.5;       // lissage
    const a = tr.alt;
    if (tr.last && fix.lat != null) tr.dist += distM(tr.last, fix);
    tr.last = fix.lat != null ? { lat: fix.lat, lng: fix.lng } : null;
    if (tr.ext == null) { tr.ext = a; tr.extT = fix.t; tr.extDist = tr.dist; return null; }
    if (tr.dir === 0) {
      if (a <= tr.ext - 60) { tr.dir = -1; tr.start = { alt: tr.ext, t: tr.extT, dist: tr.extDist }; tr.ext = a; }
      else if (a >= tr.ext + 60) { tr.dir = 1; tr.start = { alt: tr.ext, t: tr.extT, dist: tr.extDist }; tr.ext = a; }
      return null;
    }
    if (tr.dir === -1) {
      if (a < tr.ext) { tr.ext = a; tr.extT = fix.t; tr.extDist = tr.dist; return null; }
      if (a >= tr.ext + 40) return close(station, tr, 'piste', fix);
    } else {
      if (a > tr.ext) { tr.ext = a; tr.extT = fix.t; tr.extDist = tr.dist; return null; }
      if (a <= tr.ext - 40) return close(station, tr, 'lift', fix);
    }
    return null;
  }
  function close(station, tr, type, fix) {
    const seg = { type, altFrom: Math.round(tr.start.alt), altTo: Math.round(tr.ext), t: tr.extT, dist: tr.extDist - tr.start.dist, dur: (tr.extT - tr.start.t) / 60000 };
    // on repart de zéro : le segment suivant sera détecté depuis la position actuelle
    tr.start = null; tr.dir = 0; tr.ext = tr.alt; tr.extT = fix.t; tr.extDist = tr.dist;
    return Math.abs(seg.altFrom - seg.altTo) >= 100 ? match(station, seg) : null;
  }
  function match(station, seg) {
    const list = seg.type === 'piste' ? station.pistes : station.lifts;
    const scored = list.filter(x => x.altFrom && x.altTo).map(x => {
      const cost = Math.abs(x.altFrom - seg.altFrom) + Math.abs(x.altTo - seg.altTo);
      let ok = Math.abs(x.altFrom - seg.altFrom) <= MATCH_TOL_M && Math.abs(x.altTo - seg.altTo) <= MATCH_TOL_M;
      if (ok && seg.type === 'piste' && x.km && seg.dist > 0) { const r = seg.dist / (x.km * 1000); ok = r >= 0.5 && r <= 1.6; }
      return { x, cost, ok };
    }).filter(c => c.ok).sort((a, b) => a.cost - b.cost);
    return { type: seg.type, cands: scored.slice(0, 4).map(c => c.x.id), altFrom: seg.altFrom, altTo: seg.altTo, t: seg.t, auto: true };
  }


  /* ---------- Réseau (graph.js) et itinéraires ---------- */
  const WALK_KMH = 2.5;           // marche en chaussures de ski
  const decode = g => { const out = []; let la = 0, lo = 0; for (let i = 0; i < g.length; i += 2) { la += g[i]; lo += g[i + 1]; out.push([la / 1e5, lo / 1e5]); } return out; };

  function buildNet(graph) {
    const nodes = graph.nodes.map(([lat, lng, alt, label], i) => ({ i, lat, lng, alt, label, out: [] }));
    const edges = graph.edges.map((e, id) => ({ ...e, id, geom: null }));
    const geom = e => e.geom || (e.geom = decode(e.g));
    const arcs = [];
    const add = (e, from, to, mode, rev) => { const a = { e, from, to, mode, rev, len: e.m, gain: Math.max(0, nodes[to].alt - nodes[from].alt) }; arcs.push(a); nodes[from].out.push(a); };
    edges.forEach(e => {
      if (e.k === 'lift') add(e, e.a, e.b, 'lift', false);
      else if (e.k === 'piste') add(e, e.a, e.b, 'ski', false);
      else {
        [[e.a, e.b, false], [e.b, e.a, true]].forEach(([f, t, rev]) => {
          const drop = nodes[f].alt - nodes[t].alt;
          add(e, f, t, e.k === 'link' && drop / Math.max(e.m, 1) >= 0.04 ? 'ski' : 'walk', rev);
        });
      }
    });
    return { nodes, edges, arcs, geom, osm: graph.osm };
  }

  // Durée d'un arc (minutes) selon le profil de vitesse
  function arcMin(a, speed) {
    if (a.mode === 'lift') return Math.max(1, a.e.t);
    if (a.mode === 'ski') return Math.max(0.3, a.len / 1000 / (SPEED_KMH[speed] * (a.e.k === 'link' ? 0.6 : 1)) * 60);
    return Math.max(0.3, a.len / 1000 / WALK_KMH * 60 + a.gain / 10);
  }
  // Une piste est autorisée si elle n'est pas plus difficile que la plus difficile des couleurs choisies :
// les couleurs plus faciles non cochées servent de liaisons (pénalisées), jamais l'inverse.
const RANK_C = { green: 0, blue: 1, red: 2, black: 3 };
const maxRank = o => Math.max(...o.colors.map(c => RANK_C[c]), -1);
const arcAllowed = (a, o) => a.mode === 'walk' ? o.walk !== false : a.e.k === 'piste' ? RANK_C[a.e.c] <= maxRank(o) : true;
  const nodeName = n => n.label || `Carrefour à ${Math.round(n.alt / 10) * 10} m`;

  // Points de départ proposés : bas des remontées (là où aucune piste n'arrive), nommés d'après la remontée
  function startPoints(net) {
    const hasIn = new Set(net.arcs.filter(a => a.mode === 'ski').map(a => a.to)), by = new Map();
    net.edges.filter(e => e.k === 'lift' && e.n && !hasIn.has(e.a) && net.nodes[e.a].alt > 0).forEach(e => {
      const g = by.get(e.a) || { i: e.a, names: [], alt: Math.round(net.nodes[e.a].alt) };
      if (!g.names.includes(e.n)) g.names.push(e.n); by.set(e.a, g);
    });
    return [...by.values()].map(g => ({ i: g.i, alt: g.alt, name: 'Départ ' + g.names.join(' / ') })).sort((a, b) => a.name.localeCompare(b.name));
  }
  function nearestNode(net, lat, lng) {
    let best = null, bd = Infinity;
    net.nodes.forEach(n => { const d = distM({ lat, lng }, n); if (d < bd) { bd = d; best = n; } });
    return best;
  }

  // PRNG déterministe : une même "variante" redonne le même itinéraire (utile pour le partage)
  const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  /* Cherche le meilleur enchaînement (remontées, pistes, liaisons, marche) qui revient au point d'arrivée
     en un temps proche de la durée voulue. Recherche par tranches de 30 s, en gardant les meilleurs états de chaque tranche.
     Récompense : minutes skiées, pistes nouvelles. Pénalise : marche, pistes ou remontées déjà refaites. */
  function planRoute(net, o) {
    const speed = o.speed || 'medium', budget = o.budget || 120, cap = budget * 1.08, K = 60, rand = rng(1 + (o.variant || 0) * 7919);
    const end = o.end ?? o.start, jitter = o.variant ? 0.4 : 0;
    // temps minimal pour rejoindre l'arrivée (Dijkstra sur le graphe inversé)
    const rev = net.nodes.map(() => []);
    net.arcs.forEach(a => { if (arcAllowed(a, o)) rev[a.to].push(a); });
    const toEnd = net.nodes.map(() => Infinity); toEnd[end] = 0;
    const pq = [[0, end]];
    while (pq.length) {
      pq.sort((x, y) => x[0] - y[0]); const [d, u] = pq.shift();
      if (d > toEnd[u]) continue;
      for (const a of rev[u]) { const nd = d + arcMin(a, speed); if (nd < toEnd[a.from]) { toEnd[a.from] = nd; pq.push([nd, a.from]); } }
    }
    if (toEnd[o.start] === Infinity) return { error: 'unreachable' };
    const chain = (s, f) => { let n = 0; for (let x = s; x && x.arc; x = x.prev) if (f(x.arc)) n++; return n; };
    const buckets = Array.from({ length: Math.ceil(cap * 2) + 4 }, () => []);
    buckets[0].push({ n: o.start, t: 0, sc: 0, prev: null, arc: null, ps: 0 });
    let best = null, bestObj = -Infinity;
    for (let b = 0; b < buckets.length; b++) {
      const bucket = buckets[b]; if (!bucket.length) continue;
      bucket.sort((x, y) => y.sc - x.sc);
      const perNode = {}, keep = [];
      for (const s of bucket) { perNode[s.n] = (perNode[s.n] || 0) + 1; if (perNode[s.n] <= 3 && keep.length < K) keep.push(s); }
      for (const s of keep) {
        if (s.n === end && s.ps > 0 && s.t >= budget * 0.7) {
          const obj = s.sc - Math.abs(s.t - budget) * 2;
          if (obj > bestObj) { bestObj = obj; best = s; }
        }
        for (const a of net.nodes[s.n].out) {
          if (!arcAllowed(a, o) || (s.arc && s.arc.e.id === a.e.id)) continue;
          const c = arcMin(a, speed), t = s.t + c;
          if (a.mode === 'walk' && c > 10) continue;   // pas de longue marche en chaussures de ski
          if (t + toEnd[a.to] > cap) continue;
          const reuse = chain(s, x => x.e.id === a.e.id);
          let sc = s.sc;
          if (a.mode === 'ski') {
            sc += reuse ? -c * 2 : c * (a.e.k === 'piste' ? 1 : 0.3);
            if (a.e.k === 'piste' && !o.colors.includes(a.e.c)) sc -= c * 3;   // couleur non choisie : seulement en dernier recours
            if (a.e.k === 'piste' && a.e.n) { const same = chain(s, x => x.e.n === a.e.n); sc += !same ? 0.5 : (s.arc.e.n === a.e.n ? 0 : -6); }
          } else if (a.mode === 'walk') sc -= c * 3.5;
          else sc -= 0.2 + reuse * 3;
          if (jitter) sc += rand() * jitter * c;
          buckets[Math.min(buckets.length - 1, Math.max(b + 1, Math.ceil(t * 2)))].push({ n: a.to, t, sc, prev: s, arc: a, ps: s.ps + (a.e.k === 'piste' ? 1 : 0) });
        }
      }
    }
    if (!best) return { error: 'none' };
    const arcsSeq = []; for (let s = best; s.prev; s = s.prev) arcsSeq.unshift(s.arc);
    return buildSteps(net, arcsSeq, o, speed);
  }

  // Regroupe les arcs consécutifs d'une même piste / remontée / marche en étapes lisibles
  function buildSteps(net, seq, o, speed) {
    const steps = [];
    seq.forEach(a => {
      const kind = a.mode === 'lift' ? 'lift' : a.e.k === 'piste' ? 'piste' : a.mode === 'walk' ? 'walk' : 'link';
      const name = kind === 'piste' || kind === 'lift' ? a.e.n : '';
      const last = steps[steps.length - 1];
      let pts = net.geom(a.e); if (a.rev) pts = pts.slice().reverse();
      const min = arcMin(a, speed);
      const same = last && last.kind === kind && (kind === 'walk' || kind === 'link' || last.name === name || (kind === 'piste' && !name));
      if (same) {
        last.minF += min; last.m += a.len; last.to = a.to; last.coords = last.coords.concat(pts.slice(1)); last.edges.push(a.e.id);
        if (kind === 'lift') last.y = last.y || a.e.y;
      } else steps.push({ kind, name, color: a.e.c || null, o: a.e.o || null, y: a.e.y || null, from: a.from, to: a.to, minF: min, m: a.len, coords: pts.slice(), edges: [a.e.id] });
    });
    // un tronçon de piste de moins de ~1 min 30 est absorbé par la piste précédente (ou suivante) : étapes plus lisibles
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.kind !== 'piste' || s.minF >= 1.5) continue;
      const tgt = steps[i - 1]?.kind === 'piste' ? steps[i - 1] : steps[i + 1]?.kind === 'piste' ? steps[i + 1] : null;
      if (!tgt) continue;
      if (tgt === steps[i - 1]) { tgt.minF += s.minF; tgt.m += s.m; tgt.to = s.to; tgt.coords = tgt.coords.concat(s.coords.slice(1)); tgt.edges.push(...s.edges); }
      else { tgt.minF += s.minF; tgt.m += s.m; tgt.from = s.from; tgt.coords = s.coords.concat(tgt.coords.slice(1)); tgt.edges.unshift(...s.edges); tgt.name = tgt.name || s.name; }
      steps.splice(i, 1); i--;
    }
    for (let i = steps.length - 1; i >= 0; i--) if (steps[i].kind === 'walk' && steps[i].m < 25 && steps.length > 1) steps.splice(i, 1);   // raccord de 0 m : inutile à l'écran
    steps.forEach(s => {
      s.min = Math.max(1, Math.round(s.minF)); s.altFrom = Math.round(net.nodes[s.from].alt); s.altTo = Math.round(net.nodes[s.to].alt);
      s.fromName = nodeName(net.nodes[s.from]); s.toName = nodeName(net.nodes[s.to]);
    });
    const totalF = steps.reduce((a, s) => a + s.minF, 0), pis = steps.filter(s => s.kind === 'piste');
    return {
      steps, total: Math.round(totalF), opt: { start: o.start, end: o.end ?? o.start, budget: o.budget, speed, colors: o.colors, walk: o.walk !== false, variant: o.variant || 0 },
      km: Math.round(pis.reduce((a, s) => a + s.m, 0) / 100) / 10, descents: pis.length,
      down: pis.reduce((a, s) => a + Math.max(0, s.altFrom - s.altTo), 0), up: steps.filter(s => s.kind === 'lift').reduce((a, s) => a + Math.max(0, s.altTo - s.altFrom), 0),
      walkMin: Math.round(steps.filter(s => s.kind === 'walk').reduce((a, s) => a + s.minF, 0)),
      offColor: Math.round(pis.filter(s => !o.colors.includes(s.color)).reduce((a, s) => a + s.minF, 0))
    };
  }

  return { buildNet, startPoints, nearestNode, planRoute, nodeName, arcMin, WALK_KMH, SPEED_KMH, COLOR_LABEL, COLOR_LEVEL, LIFT_GAP_M, label, fit, estMin, stepMin, drop, gap, summary, distM, newTracker, onFix };
})();
if (typeof module !== 'undefined') module.exports = Engine;
