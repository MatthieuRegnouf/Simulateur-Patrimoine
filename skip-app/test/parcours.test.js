// Parcours prêts : node --test test/parcours.test.js
const test = require('node:test'), assert = require('node:assert');
const E = require('../engine.js'), G = require('../graph.js'), P = require('../parcours.js'), POIS = require('../pois.js');
const net = E.buildNet(G), levelOf = e => ({ level: E.COLOR_LEVEL[e.c] ?? 5, n: 0 });
const build = sp => E.planFromArcs(net, sp.arcs, { levelOf, lo: sp.lo, hi: sp.hi, colors: sp.colors, budget: sp.budget, speed: sp.speed });

test('tous les parcours se recréent à l\'identique avec le réseau actuel (sinon : regénérer parcours.js)', () => {
  assert.ok(P.parcours.length >= 5);
  for (const sp of P.parcours) { const r = build(sp); assert.ok(!r.error, sp.id + ' invalide'); assert.ok(Math.abs(r.total - sp.expect.min) <= 1, `${sp.id} ${r.total} vs ${sp.expect.min}`); assert.equal(r.descents, sp.expect.descents); }
});
test('boucles : retour au point de départ ; formats cohérents avec les durées', () => {
  for (const sp of P.parcours) { const r = build(sp); assert.equal(r.opt.start, r.opt.end, sp.id); if (sp.format === 'half') assert.ok(r.total >= 150 && r.total <= 210, sp.id + ' ' + r.total); else assert.ok(r.total >= 270 && r.total <= 380, sp.id + ' ' + r.total); }
});
test('les parcours sont distincts (similarité de Jaccard < 0,6 entre deux parcours)', () => {
  const sets = P.parcours.map(p => new Set(p.arcs.map(a => a[0])));
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) { let c = 0; sets[i].forEach(x => sets[j].has(x) && c++); assert.ok(c / (sets[i].size + sets[j].size - c) < 0.6, `${P.parcours[i].id} / ${P.parcours[j].id}`); }
});
test('niveaux annoncés respectés : jamais une piste plus difficile que le maximum + garde-fou de couleur', () => {
  for (const sp of P.parcours) { const r = build(sp); r.steps.filter(s => s.kind === 'piste').forEach(s => assert.ok(E.COLOR_LEVEL[s.color] <= sp.hi + 2.5, `${sp.id} ${s.name} ${s.color}`)); }
});
test('programmes : chaque jour renvoie à un parcours existant', () => {
  for (const pr of P.programs) { assert.ok(pr.days.length >= 3); pr.days.forEach(d => assert.ok(P.parcours.some(p => p.id === d.parcours))); }
  assert.ok(P.programs.some(p => p.days.length >= 5));
});
test('chaque parcours porte la mention « non relu par la station »', () => { P.parcours.forEach(p => assert.match(p.review, /non relu par la station/)); });
test('établissements : données utilisables (nom, type, position, altitude)', () => {
  assert.ok(POIS.length > 80); POIS.forEach(p => { assert.ok(p.n && p.k && Math.abs(p.lat - 45.1) < 0.2 && Math.abs(p.lng - 6.1) < 0.2); });
  assert.ok(POIS.some(p => p.alt >= 2000));
});
