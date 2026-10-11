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

  return { SPEED_KMH, COLOR_LABEL, COLOR_LEVEL, LIFT_GAP_M, label, fit, estMin, stepMin, drop, gap, summary, distM, newTracker, onFix };
})();
if (typeof module !== 'undefined') module.exports = Engine;
