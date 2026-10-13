// Calculs d'une sortie enregistrée : node --test test/outing.test.js
const test = require('node:test'), assert = require('node:assert');
global.Nav = require('../nav.js'); const O = require('../trackcalc.js'), E = require('../engine.js'), G = require('../graph.js');
const net = E.buildNet(G), idx = Nav.indexNet(net);
const pisteEdge = idx.find(e => e.k === 'piste' && e.o && e.g.length > 6);
const along = (e, n = 30) => { const pts = []; for (let i = 0; i < n; i++) { const t = i / (n - 1) * (e.g.length - 1), j = Math.min(e.g.length - 2, Math.floor(t)), f = t - j; pts.push([e.g[j][0] + (e.g[j + 1][0] - e.g[j][0]) * f, e.g[j][1] + (e.g[j + 1][1] - e.g[j][1]) * f, 2000 - i * 10, 1e12 + i * 5000, 8]); } return pts; };

test('distance : somme des segments, les sauts de signal ne comptent pas', () => {
  const a = [[45, 6, 1000, 0, 5], [45.001, 6, 1000, 10000, 5], [45.002, 6, 1000, 20000, 5]]; assert.ok(Math.abs(O.distanceM(a) - 222) < 3);
  const gap = [[45, 6, 0, 0, 5], [45.5, 6, 0, 10000, 5]]; assert.equal(O.distanceM(gap), 0);
});
test('dénivelé : le bruit d\'altitude (±3 m) n\'est pas compté, une vraie descente l\'est', () => {
  const noise = Array.from({ length: 40 }, (_, i) => [45, 6, 2000 + (i % 2 ? 3 : -3), i * 1000, 5]); assert.equal(O.elevation(noise).down, 0);
  const ski = Array.from({ length: 40 }, (_, i) => [45, 6, 2000 - i * 10, i * 1000, 5]); const e = O.elevation(ski); assert.ok(e.down > 300 && e.down < 420, e.down); assert.equal(e.max, 2000);
});
test('durée : pauses déduites', () => { assert.equal(O.durationMs({ t0: 0, t1: 3600000, pausedMs: 600000 }), 3000000); });
test('identification : une descente sur le tracé d\'une piste officielle est reconnue, avec son taux de recouvrement', () => {
  const v = O.verdict(O.identify(along(pisteEdge), idx)); assert.ok(v.kind === 'track' || v.kind === 'cands'); assert.ok(v.cands.includes(pisteEdge.o));
});
test('identification : ailleurs, rien n\'est annoncé ; peu de points : rien non plus', () => {
  const far = along(pisteEdge).map(p => [p[0] + 0.01, p[1] + 0.01, p[2], p[3], p[4]]); assert.equal(O.verdict(O.identify(far, idx)).kind, 'none'); assert.deepEqual(O.identify(along(pisteEdge, 3), idx), []);
});
test('verdict : deux pistes se recouvrant autant => candidats à confirmer, jamais un choix arbitraire', () => {
  assert.equal(O.verdict([{ o: 'a', c: 0.9 }, { o: 'b', c: 0.85 }]).kind, 'cands'); assert.equal(O.verdict([{ o: 'a', c: 0.9 }, { o: 'b', c: 0.5 }]).kind, 'track');
});
