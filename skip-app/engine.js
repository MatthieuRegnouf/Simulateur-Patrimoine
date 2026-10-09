/* Logique pure (sans DOM) : notation, niveaux, calcul d'itinéraire, détection GPS. */
const Engine = (() => {
  const SPEED = { slow: 1.35, medium: 1, fast: 0.75 };
  const COLOR_LABEL = { green: 'Verte', blue: 'Bleue', red: 'Rouge', black: 'Noire' };

  // Seuils de la slide « Système de notation »
  function label(score) {
    if (score < 4) return { key: 'easy', text: 'Facile', icon: '🟢' };
    if (score < 7.5) return { key: 'mid', text: 'Moyenne', icon: '🟠' };
    return { key: 'hard', text: 'Difficile', icon: '🔴' };
  }

  // Note « objective » estimée depuis les données terrain (pente, largeur)
  function objectiveScore(p) {
    const s = 1 + (p.slope - 4) * 0.28 + (p.maxSlope - p.slope) * 0.05 + (p.width < 20 ? 0.6 : 0);
    return Math.min(10, Math.max(1, s));
  }

  // Note affichée = mélange communauté / objectif, la communauté pèse plus avec le nombre de votes
  function blended(p, myVote) {
    const votes = p.votes + (myVote ? 1 : 0);
    const comm = myVote ? (p.comm * p.votes + myVote) / votes : p.comm;
    const w = votes / (votes + 30);
    const obj = objectiveScore(p);
    return { score: Math.round((w * comm + (1 - w) * obj) * 10) / 10, comm: Math.round(comm * 10) / 10, obj: Math.round(obj * 10) / 10, votes, reliable: votes >= 30 };
  }

  // Adéquation avec le niveau de l'utilisateur (sécurité + progression)
  function fit(score, level) {
    const d = score - level;
    if (d <= 0.5) return { key: 'ok', text: 'À ton niveau' };
    if (d <= 1.5) return { key: 'progress', text: 'Pour progresser' };
    return { key: 'hard', text: 'Trop dur pour toi' };
  }

  function speedMin(p, speed) { return Math.round(p.min * SPEED[speed]); }

  // Attente simulée selon l'heure (en prod : flux temps réel des remontées)
  function waitMin(lift, hour) {
    const f = hour < 9.5 ? 1.2 : hour < 11.5 ? 1.0 : hour < 14 ? 0.5 : hour < 16 ? 0.9 : 0.4;
    return Math.max(1, Math.round(lift.wait * f));
  }

  /* Planificateur : cherche le meilleur enchaînement remontée/piste qui
     remplit la durée voulue, reste proche de la difficulté visée et finit en bas. */
  function plan(station, opt) {
    const { start = station.base, budget = 120, target = 6, speed = 'medium', avoidBlack = false,
            avoidCrowded = false, hour = 10, closed = [] } = opt;
    const end = station.base;
    const maxScore = target + 1.5;
    const pistesFrom = {}, liftsFrom = {};
    station.pistes.forEach(p => {
      if (closed.includes(p.id)) return;
      if (avoidBlack && p.color === 'black') return;
      if (avoidCrowded && p.crowd > 0.65) return;
      if (blended(p).score > maxScore) return;
      (pistesFrom[p.from] = pistesFrom[p.from] || []).push(p);
    });
    station.lifts.forEach(l => {
      if (closed.includes(l.id)) return;
      if (avoidCrowded && waitMin(l, hour) > 8) return;
      (liftsFrom[l.from] = liftsFrom[l.from] || []).push(l);
    });

    let best = null, bestScore = Infinity, visits = 0;
    const steps = [], used = new Set();
    function score(total) {
      const ps = steps.filter(s => s.kind === 'piste');
      if (!ps.length) return Infinity;
      const skiT = ps.reduce((a, s) => a + s.min, 0);
      const diff = ps.reduce((a, s) => a + Math.abs(s.score - target) * s.min, 0) / skiT;
      const liftShare = 1 - skiT / total;
      return Math.abs(total - budget) / budget * 4 + diff * 0.6 + Math.max(0, liftShare - 0.45) * 3;
    }
    function dfs(node, total) {
      if (++visits > 250000) return;
      if (node === end && total >= budget * 0.75 && steps.some(s => s.kind === 'piste')) {
        const sc = score(total);
        if (sc < bestScore) { bestScore = sc; best = { steps: steps.slice(), total }; }
      }
      for (const l of liftsFrom[node] || []) {
        const w = waitMin(l, hour), t = l.min + w;
        if (total + t > budget) continue;
        steps.push({ kind: 'lift', ref: l, min: l.min, wait: w, from: l.from, to: l.to });
        dfs(l.to, total + t);
        steps.pop();
      }
      for (const p of pistesFrom[node] || []) {
        if (used.has(p.id)) continue;
        const t = speedMin(p, speed);
        if (total + t > budget) continue;
        used.add(p.id);
        steps.push({ kind: 'piste', ref: p, min: t, score: blended(p).score, from: p.from, to: p.to });
        dfs(p.to, total + t);
        steps.pop(); used.delete(p.id);
      }
    }
    dfs(start, 0);
    if (!best) return null;
    const pistes = best.steps.filter(s => s.kind === 'piste');
    const skiMin = pistes.reduce((a, s) => a + s.min, 0);
    return {
      stationId: station.id, steps: best.steps, total: best.total,
      km: Math.round(pistes.reduce((a, s) => a + s.ref.km, 0) * 10) / 10,
      descents: pistes.length,
      avg: Math.round(pistes.reduce((a, s) => a + s.score * s.min, 0) / skiMin * 10) / 10,
      waitTotal: best.steps.reduce((a, s) => a + (s.wait || 0), 0),
      opt: { start, budget, target, speed, avoidBlack, avoidCrowded }
    };
  }

  function distM(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function nearestNode(station, pos, radius = 150) {
    let best = null, bd = Infinity;
    for (const [id, n] of Object.entries(station.nodes)) {
      const d = distM(n, pos);
      if (d < bd) { bd = d; best = id; }
    }
    return bd <= radius ? best : null;
  }

  /* Détection sans écran : chaque fix GPS passe ici. Quand on passe d'un point clé A à un point B
     reliés par une/des piste(s) ou remontée(s), on enregistre un segment. */
  function onFix(station, state, pos, t) {
    const node = nearestNode(station, pos);
    if (!node || node === state.lastNode) return null;
    const prev = state.lastNode;
    state.lastNode = node; state.lastTime = t;
    if (!prev) return null;
    const pistes = station.pistes.filter(p => p.from === prev && p.to === node);
    if (pistes.length) return { type: 'piste', cands: pistes.map(p => p.id), from: prev, to: node, t, auto: true };
    const lifts = station.lifts.filter(l => l.from === prev && l.to === node);
    if (lifts.length) return { type: 'lift', cands: lifts.map(l => l.id), from: prev, to: node, t, auto: true };
    return null;
  }

  return { SPEED, COLOR_LABEL, label, objectiveScore, blended, fit, speedMin, waitMin, plan, distM, nearestNode, onFix };
})();
if (typeof module !== 'undefined') module.exports = Engine;
