/* Logique pure (sans DOM) : notation, niveaux, calcul d'itinéraire, détection GPS. */
const Engine = (() => {
  const SPEED = { slow: 1.35, medium: 1, fast: 0.75 };
  const COLOR_LABEL = { green: 'Verte', blue: 'Bleue', red: 'Rouge', black: 'Noire' };

  // Seuils de la présentation. Sans vote, aucune note n'existe : on n'invente rien.
  function label(score) {
    if (score == null) return { key: 'none', text: 'Pas encore noté', icon: '' };
    if (score < 4) return { key: 'easy', text: 'Facile', icon: '🟢' };
    if (score < 7.5) return { key: 'mid', text: 'Moyenne', icon: '🟠' };
    return { key: 'hard', text: 'Difficile', icon: '🔴' };
  }

  // Note « objective » possible seulement si on a la pente (aucune donnée pour l'instant)
  function objectiveScore(p) {
    if (p.slope == null) return null;
    const s = 1 + (p.slope - 4) * 0.28 + ((p.maxSlope ?? p.slope) - p.slope) * 0.05 + (p.width != null && p.width < 20 ? 0.6 : 0);
    return Math.min(10, Math.max(1, s));
  }

  // Note affichée : moyenne des votes (+ données terrain si elles existent). Aucun vote = null.
  function blended(p, myVote) {
    const seeded = p.votes || 0, votes = seeded + (myVote ? 1 : 0);
    const obj = objectiveScore(p);
    if (votes === 0) return { score: null, comm: null, obj, votes: 0, reliable: false };
    const comm = ((p.comm || 0) * seeded + (myVote || 0)) / votes;
    const w = votes / (votes + 30);
    const score = obj == null ? comm : w * comm + (1 - w) * obj;
    const r = x => x == null ? null : Math.round(x * 10) / 10;
    return { score: r(score), comm: r(comm), obj: r(obj), votes, reliable: votes >= 30 };
  }

  // Adéquation avec le niveau de l'utilisateur (seulement si la piste est notée)
  function fit(score, level) {
    if (score == null) return { key: 'none', text: '' };
    const d = score - level;
    if (d <= 0.5) return { key: 'ok', text: 'À ton niveau' };
    if (d <= 1.5) return { key: 'progress', text: 'Pour progresser' };
    return { key: 'hard', text: 'Trop dur pour toi' };
  }

  const routable = p => p.from && p.to && p.min;
  function speedMin(p, speed) { return p.min ? Math.round(p.min * SPEED[speed]) : null; }

  /* Planificateur : enchaîne remontées et pistes (couleurs choisies) pour remplir la durée,
     en finissant au pied de la station. Une piste peut être refaite (légère pénalité). */
  function plan(station, opt) {
    const { start = station.base, budget = 120, speed = 'medium', colors = ['green', 'blue', 'red', 'black'], closed = [] } = opt;
    const end = station.base, cap = budget * 1.1;
    const pistesFrom = {}, liftsFrom = {};
    station.pistes.forEach(p => {
      if (!routable(p) || closed.includes(p.id) || !colors.includes(p.color)) return;
      (pistesFrom[p.from] = pistesFrom[p.from] || []).push(p);
    });
    station.lifts.forEach(l => { if (!closed.includes(l.id)) (liftsFrom[l.from] = liftsFrom[l.from] || []).push(l); });

    let best = null, bestScore = Infinity, visits = 0;
    const steps = [], count = {};
    function score(total) {
      const reps = Object.values(count).reduce((a, n) => a + Math.max(0, n - 1), 0);
      return Math.abs(total - budget) / budget * 4 + reps * 0.05;
    }
    function dfs(node, total) {
      if (++visits > 250000) return;
      if (node === end && steps.some(s => s.kind === 'piste')) {
        const sc = score(total);
        if (sc < bestScore) { bestScore = sc; best = { steps: steps.slice(), total }; }
      }
      for (const l of liftsFrom[node] || []) {
        if (total + l.min > cap) continue;
        steps.push({ kind: 'lift', ref: l, min: l.min, from: l.from, to: l.to });
        dfs(l.to, total + l.min);
        steps.pop();
      }
      for (const p of pistesFrom[node] || []) {
        const t = speedMin(p, speed);
        if (total + t > cap || (count[p.id] || 0) >= 6) continue;
        count[p.id] = (count[p.id] || 0) + 1;
        steps.push({ kind: 'piste', ref: p, min: t, from: p.from, to: p.to });
        dfs(p.to, total + t);
        steps.pop(); count[p.id]--;
      }
    }
    dfs(start, 0);
    if (!best) return null;
    const pistes = best.steps.filter(s => s.kind === 'piste');
    return {
      stationId: station.id, steps: best.steps, total: best.total,
      km: Math.round(pistes.reduce((a, s) => a + s.ref.km, 0) * 10) / 10,
      descents: pistes.length,
      opt: { start, budget, speed, colors }
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
    if (pos.nodeId) return station.nodes[pos.nodeId] ? pos.nodeId : null;
    for (const [id, n] of Object.entries(station.nodes)) {
      if (n.lat == null) continue;
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

  return { SPEED, COLOR_LABEL, label, objectiveScore, blended, fit, speedMin, routable, plan, distM, nearestNode, onFix };
})();
if (typeof module !== 'undefined') module.exports = Engine;
