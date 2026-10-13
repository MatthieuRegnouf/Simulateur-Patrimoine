/* Calculs purs d'une sortie enregistrée (distance, dénivelé, durée, identification des pistes par le tracé GPS) : testés dans test/outing.test.js.
   Une piste n'est « identifiée » que si le tracé GPS la recouvre de façon fiable ; sinon elle reste à confirmer. */
const Outing = (() => {
  const R = 6371000, RAD = Math.PI / 180;
  const dist = (a, b) => { const dl = (b[0] - a[0]) * RAD, dn = (b[1] - a[1]) * RAD, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  /* points : [lat, lng, alt|null, t(ms), précision(m)] */
  function distanceM(pts) { let d = 0; for (let i = 1; i < pts.length; i++) { const s = dist(pts[i - 1], pts[i]); if (pts[i][3] - pts[i - 1][3] < 300000 && s < 1500) d += s; } return d; }
  /* dénivelé : altitude lissée (moyenne sur 5 points) puis cumul des variations d'au moins 10 m (le bruit GPS d'altitude est de plusieurs mètres) */
  function elevation(pts) {
    const a = pts.map(p => p[2]).filter(v => v != null); if (a.length < 3) return { down: null, up: null, max: null };
    const sm = a.map((_, i) => { const w = a.slice(Math.max(0, i - 2), i + 3); return w.reduce((x, y) => x + y, 0) / w.length; });
    let down = 0, up = 0, ext = sm[0], dir = 0;
    for (const v of sm) { if (dir <= 0 && v - ext >= 10) { dir = 1; ext = v; } else if (dir >= 0 && ext - v >= 10) { dir = -1; ext = v; } else if (dir === 1 && v > ext) { up += v - ext; ext = v; } else if (dir === -1 && v < ext) { down += ext - v; ext = v; } }
    return { down: Math.round(down), up: Math.round(up), max: Math.round(Math.max(...a)) };
  }
  const durationMs = o => Math.max(0, (o.t1 || Date.now()) - o.t0 - (o.pausedMs || 0) - (o.status === 'pause' && o.pausedAt ? Date.now() - o.pausedAt : 0));
  /* Identification d'une descente par le tracé : part des points GPS à moins de 35 m d'une piste officielle (index = Nav.indexNet). Renvoie [{o, c}] triés. */
  function identify(pts, index, minCover = 0.6, R35 = 35) {
    if (pts.length < 4) return [];
    const groups = new Map(); index.filter(e => e.k === 'piste' && e.o).forEach(e => { if (!groups.has(e.o)) groups.set(e.o, []); groups.get(e.o).push(e); });
    const out = [];
    for (const [o, edges] of groups) {
      let n = 0; const pad = R35 / 111320 * 1.3;
      for (const p of pts) {
        let near = false;
        for (const e of edges) {
          const padLo = pad / Math.cos(p[0] * RAD); if (p[0] < e.b[0] - pad || p[0] > e.b[1] + pad || p[1] < e.b[2] - padLo || p[1] > e.b[3] + padLo) continue;
          for (let j = 0; j < e.g.length - 1; j++) if (Nav.proj([p[0], p[1]], e.g[j], e.g[j + 1]).d <= R35) { near = true; break; }
          if (near) break;
        }
        if (near) n++;
      }
      const c = n / pts.length; if (c >= minCover) out.push({ o, c });
    }
    return out.sort((a, b) => b.c - a.c);
  }
  /* Verdict : « certaine » seulement si une piste recouvre bien le tracé ET dépasse nettement la suivante ; sinon on garde les candidats à confirmer. */
  function verdict(scored) {
    if (!scored.length) return { kind: 'none', cands: [] };
    if (scored.length === 1 || scored[0].c - scored[1].c >= 0.2) return { kind: 'track', pick: scored[0].o, cover: Math.round(scored[0].c * 100), cands: [scored[0].o] };
    return { kind: 'cands', cands: scored.slice(0, 3).map(s => s.o) };
  }
  return { dist, distanceM, elevation, durationMs, identify, verdict };
})();
if (typeof module !== 'undefined') module.exports = Outing;
