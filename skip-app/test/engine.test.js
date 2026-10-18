// Tests unitaires du moteur : node --test test/
const test = require('node:test'), assert = require('node:assert');
const E = require('../engine.js'), G = require('../graph.js'), D = require('../data.js').stations.alpe;
const net = E.buildNet(G), start = E.startPoints(net).find(s => s.name === 'Départ Signal').i;
const plan = o => E.planRoute(net, { start, budget: 120, speed: 'medium', walk: true, ...o });
const colorLevel = e => ({ level: E.COLOR_LEVEL[e.c], n: 0 });

test('barème : 5 niveaux = tranches de la note 1–10', () => {
  assert.deepEqual([1, 2, 4.5, 7.4, 10].map(n => E.levelOf(n).n), [1, 1, 3, 4, 5]);
  assert.deepEqual(E.levelRange(2, 3), [2, 6]);
  assert.equal(E.LEVELS.length, 5);
});
test('fiabilité : jamais présentée comme certaine avec peu de votes', () => {
  assert.equal(E.reliability(0).key, 'est'); assert.equal(E.reliability(3).key, 'low');
  assert.equal(E.reliability(8).key, 'mid'); assert.equal(E.reliability(40).key, 'good');
});
test('plage de difficulté : un parcours 1–2 ne contient ni rouge ni noire', () => {
  const [lo, hi] = E.levelRange(1, 2), r = plan({ levelOf: colorLevel, lo, hi });
  const cols = new Set(r.steps.filter(s => s.kind === 'piste').map(s => s.color));
  assert.ok(!cols.has('red') && !cols.has('black'), [...cols].join());
});
test('garde-fou : des notes isolées ne rendent pas une noire « facile »', () => {
  const [lo, hi] = E.levelRange(1, 2), black = new Set(D.pistes.filter(p => p.color === 'black').map(p => p.id));
  const levelOf = e => black.has(e.o) ? { level: 2, n: 20 } : colorLevel(e);
  const r = plan({ levelOf, lo, hi });
  assert.ok(r.steps.filter(s => s.kind === 'piste').every(s => s.color !== 'black'));
});
test('durées : descente + liaison + remontée + attente = total', () => {
  const r = plan({ colors: ['green', 'blue', 'red'], waitOf: () => ({ min: 5, src: 'estimate' }) });
  const t = r.times; assert.ok(Math.abs(t.descent + t.link + t.ride + t.wait - r.total) <= 3, JSON.stringify(t));
  assert.equal(t.waitKnown, t.lifts); assert.ok(t.wait > 0);
});
test('attente inconnue : jamais comptée', () => {
  const r = plan({ colors: ['green', 'blue', 'red'] });
  assert.equal(r.times.wait, 0); assert.equal(r.times.waitKnown, 0);
});
test("fermetures : une remontée bloquée n'est pas utilisée", () => {
  const free = plan({ colors: ['green', 'blue', 'red'] }), used = free.steps.find(s => s.kind === 'lift' && s.edges.length), name = used.name;
  const r = plan({ colors: ['green', 'blue', 'red'], blocked: e => e.k === 'lift' && e.n === name });
  assert.ok(!r.error && r.steps.every(s => s.name !== name));
});
test('arrêts intermédiaires : déduits uniquement des tronçons cartographiés de la remontée', () => {
  const r = plan({ colors: ['green', 'blue', 'red', 'black'], budget: 240 });
  r.steps.filter(s => s.kind === 'lift').forEach(s => { assert.equal(s.via.length, s.edges.length - 1); assert.equal(s.viaNames.length, s.via.length); });
});
test('détection GPS : descente reconnue par ses altitudes', () => {
  const tr = E.newTracker(), p = D.pistes.find(x => x.id === 'sarenne-black'); let t = 0, lng = 6.07, found = null;
  const push = (alt, d) => { lng += d / 78000; const x = E.onFix(D, tr, { lat: 45.09, lng, alt, t: t += 10000 }); if (x) found = x; };
  for (let i = 0; i < 3; i++) push(p.altFrom, 0);
  for (let i = 1; i <= 40; i++) push(p.altFrom - (p.altFrom - p.altTo) * i / 40, p.km * 1000 / 40);
  for (let i = 1; i <= 9; i++) push(p.altTo + Math.min(i, 6) * 25, 5);
  assert.ok(found && found.cands.includes('sarenne-black'));
});
test('contexte d\'invitation : pas pendant une descente', () => {
  const tr = E.newTracker(); tr.dir = -1; assert.equal(E.descending(tr), true);
  tr.dir = 1; tr.start = { alt: 1000 }; tr.ext = 1100; assert.equal(E.climbGain(tr), 100);
});
