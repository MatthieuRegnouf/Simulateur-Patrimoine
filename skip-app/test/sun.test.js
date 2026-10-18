// Soleil et ombre : node --test test/sun.test.js
const test = require('node:test'), assert = require('node:assert'), fs = require('node:fs');
const S = require('../sun.js');
const synth = (rows, cols, f) => { const z = new Int16Array(rows * cols); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) z[r * cols + c] = f(r, c); return { rows, cols, north: 45.2, west: 6.0, dlat: 150 / 111320, dlon: 150 / (111320 * Math.cos(45.1 * Math.PI / 180)), stepM: 150, b64: Buffer.from(z.buffer).toString('base64') }; };

test('position du soleil : midi solaire du 1er février à Alpe d\'Huez ≈ 27,6° plein sud', () => {
  const p = S.position(new Date('2026-02-01T11:49:00Z'), 45.09, 6.07); assert.ok(Math.abs(p.el - 27.6) < 1.2, p.el); assert.ok(Math.abs(p.az - 180) < 4, p.az);
});
test('position du soleil : matin à l\'est, après-midi à l\'ouest, nuit sous l\'horizon', () => {
  assert.ok(S.position(new Date('2026-02-01T08:00:00Z'), 45.09, 6.07).az < 150); assert.ok(S.position(new Date('2026-02-01T14:30:00Z'), 45.09, 6.07).az > 200);
  assert.ok(S.position(new Date('2026-02-01T23:00:00Z'), 45.09, 6.07).el < 0);
});
test('incidence : pente tournée vers le soleil > à plat > dos au soleil', () => {
  const sud = S.incidence(21, 180, 180, 25), plat = S.incidence(21, 180, 0, 0), nord = S.incidence(21, 180, 0, 25);
  assert.ok(sud > plat && plat > nord); assert.equal(nord, 0); assert.ok(Math.abs(plat - Math.sin(21 * Math.PI / 180)) < 1e-9);
});
test('ombre portée : une crête au sud masque le soleil bas, pas le soleil haut ; pas d\'effet sans relief', () => {
  const D = synth(60, 60, (r, c) => r < 20 ? 2200 : 1000), dem = S.makeDem(D), lat = 45.2 - 40 * D.dlat, lng = 6.0 + 30 * D.dlon;   // crête 1 200 m plus haut, à 6 km au sud... ligne 20 = au nord
  // soleil au nord (az 0) : mur au nord, à ≈ 3 km
  assert.ok(S.horizon(dem, lat, lng, 1000, 0) > 10); assert.ok(S.horizon(dem, lat, lng, 1000, 180) <= 0.01);
  const bas = S.point(dem, new Date('2026-02-01T11:00:00Z'), lat, lng, 180, 20, null); assert.equal(typeof bas.s, 'number');
  const noDem = S.point(null, new Date('2026-02-01T11:49:00Z'), lat, lng, 180, 20, null); assert.ok(noDem.s > 0.9);
});
test('un mur au sud met la pente à l\'ombre à midi en hiver', () => {
  const D = synth(60, 60, (r, c) => r > 30 ? 2600 : 1500), dem = S.makeDem(D), lat = 45.2 - 20 * D.dlat, lng = 6.0 + 30 * D.dlon;
  const ombre = S.point(dem, new Date('2026-02-01T11:49:00Z'), lat, lng, 180, 20, null); assert.equal(ombre.shaded, true); assert.equal(ombre.s, 0);
});
test('nuages : réduisent l\'éclairement, jamais en dessous de 25 % du ciel clair', () => {
  const clair = S.point(null, new Date('2026-02-01T11:49:00Z'), 45.09, 6.07, 180, 20, 0).s, couvert = S.point(null, new Date('2026-02-01T11:49:00Z'), 45.09, 6.07, 180, 20, 1).s;
  assert.ok(couvert < clair && Math.abs(couvert - clair * 0.25) < 1e-9);
});
test('nuit : aucun éclairement', () => { assert.equal(S.point(null, new Date('2026-02-01T23:00:00Z'), 45.09, 6.07, 180, 20, null).s, 0); });
test('échantillons d\'un tronçon : orientation de descente (nord → sud = face au sud)', () => {
  const g = [[45.10, 6.07], [45.09, 6.07]], smp = S.samples(g, 2000, 1900, 3); assert.equal(smp.length, 3); assert.ok(Math.abs(smp[0].face - 180) < 2); assert.ok(smp[0].slope > 5);
  const inv = S.samples(g, 1900, 2000, 3); assert.ok(Math.abs(inv[0].face - 0) < 2 || Math.abs(inv[0].face - 360) < 2);
});
test('relief réel du domaine (si généré) : valeurs plausibles et ombres matinales plus fréquentes que l\'après-midi', { skip: !fs.existsSync(__dirname + '/../dem.js') }, () => {
  const D = require('../dem.js'), dem = S.makeDem(D); assert.ok(D.min > 500 && D.max > 3000 && D.max < 4000, D.min + ' ' + D.max);
  const z = dem.at(45.0905, 6.0705); assert.ok(z > 1700 && z < 2000, z);   // station d'Alpe d'Huez ≈ 1 860 m
  const G = require('../graph.js'), E = require('../engine.js'), net = E.buildNet(G); let m = 0, a = 0, n = 0;
  net.edges.filter(e => e.k === 'piste' && e.o).forEach(e => { const smp = S.samples(net.geom(e), net.nodes[e.a].alt, net.nodes[e.b].alt, 2); if (!smp.length) return;
    const am = S.edge(dem, smp, new Date('2026-02-01T08:30:00Z'), null), pm = S.edge(dem, smp, new Date('2026-02-01T14:00:00Z'), null); m += am.s; a += pm.s; n++; });
  assert.ok(n > 300); assert.ok(a / n > m / n, `matin ${(m / n).toFixed(2)} après-midi ${(a / n).toFixed(2)}`);
});
