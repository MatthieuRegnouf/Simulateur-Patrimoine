// Tests de la navigation : node --test test/nav.test.js
const test = require('node:test'), assert = require('node:assert');
const E = require('../engine.js'), G = require('../graph.js'), N = require('../nav.js');
const net = E.buildNet(G), start = E.startPoints(net).find(s => s.name === 'Départ Signal').i;
const plan = E.planRoute(net, { start, budget: 120, speed: 'medium', walk: true, colors: ['green', 'blue', 'red'] });
const R = N.build(plan), T = 1_000_000;
const fixAt = (p, acc = 8, t = T) => ({ lat: p[0], lng: p[1], acc, t });
// point à la distance s (m) le long du tracé, décalé de off mètres perpendiculairement à lui
const at = (s, off = 0) => { const pts = R.pts; let j = 0; while (j < pts.length - 2 && pts[j + 1].s < s) j++; const A = pts[j], B = pts[j + 1], t = (s - A.s) / (B.s - A.s || 1);
  const k = Math.cos(A.p[0] * Math.PI / 180), dx = (B.p[1] - A.p[1]) * k, dy = B.p[0] - A.p[0], l = Math.hypot(dx, dy) || 1;   // normale unitaire (repère local)
  return [A.p[0] + dy * t + (dx / l) * off / 111320, A.p[1] + (B.p[1] - A.p[1]) * t - (dy / l) * off / 111320 / k]; };

test('ligne : distances cumulées croissantes, une plage par étape, longueur cohérente avec le plan', () => {
  assert.equal(R.ranges.length, plan.steps.length);
  for (let i = 1; i < R.pts.length; i++) assert.ok(R.pts[i].s >= R.pts[i - 1].s);
  const planM = plan.steps.reduce((a, s) => a + s.m, 0);
  assert.ok(Math.abs(R.total - planM) / planM < 0.15, `${R.total} vs ${planM}`);
});
test('qualité du GPS : bonne / moyenne / imprécise / ancienne / absente', () => {
  assert.equal(N.quality(fixAt([45, 6], 10, T), T + 1000), 'good'); assert.equal(N.quality(fixAt([45, 6], 40, T), T + 1000), 'fair');
  assert.equal(N.quality(fixAt([45, 6], 120, T), T + 1000), 'poor'); assert.equal(N.quality(fixAt([45, 6], 5, T), T + 60000), 'stale');
  assert.equal(N.quality(null), 'none'); assert.equal(N.quality({ lat: 1, lng: 1, t: T }, T), 'poor');
});
test('progression : sur le tracé, la distance parcourue suit et ne recule pas', () => {
  const st = N.create(plan); let prev = -1;
  for (const s of [10, 120, 300, 480, 470, 700]) { N.update(st, fixAt(at(Math.min(s, R.total - 1))), T); assert.equal(st.onRoute, true); assert.ok(st.s >= prev); prev = st.s; }
  assert.ok(Math.abs(st.s - Math.min(700, R.total - 1)) < 25);
  assert.ok(N.remaining(st) < R.total);
});
test('étape courante : suit la plage de la progression', () => {
  const st = N.create(plan); const r = R.ranges[Math.min(1, R.ranges.length - 1)];
  N.update(st, fixAt(at(r.s0 + (r.s1 - r.s0) / 2)), T); assert.equal(st.step, Math.min(1, R.ranges.length - 1));
});
test('position imprécise : aucune progression ni sortie de parcours déclarée', () => {
  const st = N.create(plan); N.update(st, fixAt(at(200), 8), T); const s0 = st.s;
  for (let i = 0; i < 6; i++) N.update(st, fixAt(at(200, 400), 150, T + i * 5000), T + i * 5000);
  assert.equal(st.q, 'poor'); assert.equal(st.off, false); assert.equal(st.s, s0); assert.match(N.statusText(st, T + 25000).text, /imprécise/);
});
test('position ancienne : signalée comme interrompue', () => {
  const st = N.create(plan); N.update(st, fixAt(at(200), 8, T), T + 60000);
  assert.equal(st.q, 'stale'); assert.equal(st.pos, null); assert.match(N.statusText(st, T + 60000).text, /interrompu/); N.tick(st, T + 70000); assert.equal(st.offCount, 0);
});
test('sortie de parcours : confirmée seulement après plusieurs points et quelques secondes', () => {
  const st = N.create(plan); N.update(st, fixAt(at(200)), T);
  N.update(st, fixAt(at(220, 150), 8, T + 1000), T + 1000); assert.equal(st.onRoute, false); assert.equal(st.off, false);     // un seul point : pas de panique
  N.update(st, fixAt(at(225, 150), 8, T + 4000), T + 4000); N.update(st, fixAt(at(230, 150), 8, T + 9500), T + 9500);
  assert.equal(st.off, true); assert.ok(st.dev > 100);
  N.update(st, fixAt(at(240), 8, T + 12000), T + 12000); assert.equal(st.off, false); assert.equal(st.onRoute, true);        // retour sur le tracé
});
test('couloir : élargi quand la précision est moyenne', () => {
  assert.equal(N.corridor(5), 40); assert.equal(N.corridor(45), 90);
  const st = N.create(plan); N.update(st, fixAt(at(200, 70), 45), T); assert.equal(st.onRoute, true);
});
test('position sans tracé proche au départ : pas de progression inventée', () => {
  const st = N.create(plan); N.update(st, fixAt([46.5, 2.0]), T); assert.equal(st.started, false); assert.equal(st.onRoute, false); assert.equal(st.s, 0);
});
test('textes de statut : refus et indisponibilité', () => {
  const st = N.create(plan); st.geo = 'denied'; assert.match(N.statusText(st).text, /refusée/); st.geo = 'unavailable'; assert.match(N.statusText(st).text, /indisponible/);
});
test('profil : critères issus des seuls champs existants, champs ignorés listés', () => {
  const c = N.profileCriteria(E, { level: 5, levelSet: true, wants: ['Progresser', 'Photos'], discipline: 'ski' });
  assert.ok(c.hi >= E.levelOf(5).n && c.hi <= 5); assert.equal(c.missing.length, 0);
  assert.ok(c.ignored.some(x => /photos/.test(x.label))); assert.ok(c.used.every(u => ['level', 'want', 'disc'].includes(u.k)));
  const sb = N.profileCriteria(E, { level: 5, levelSet: true, wants: ['Balade'], discipline: 'snowboard' }); assert.equal(sb.walk, false); assert.equal(sb.speed, 'slow');
});
test('profil : niveau non renseigné signalé ; ajustement temporaire sans toucher au profil', () => {
  const pr = { level: 5, levelSet: false, wants: [], discipline: 'ski' }, snap = JSON.stringify(pr);
  assert.deepEqual(N.profileCriteria(E, pr).missing, ['level']);
  const t = N.profileCriteria(E, pr, { level: 7 }); assert.equal(t.missing.length, 0); assert.equal(t.level, 7); assert.equal(JSON.stringify(pr), snap);
});
test('profil : famille ne dépasse jamais le niveau ; rouge sportive ignorée pour un débutant', () => {
  const f = N.profileCriteria(E, { level: 4, levelSet: true, wants: ['Progresser', 'Famille'], discipline: 'ski' }); assert.ok(f.hi <= E.levelOf(4).n);
  const b = N.profileCriteria(E, { level: 2, levelSet: true, wants: ['Rouge sportive'], discipline: 'ski' }); assert.ok(b.ignored.some(x => /rouge/.test(x.label)));
});
test('suivi manuel : jump replace la progression au début de l\'étape', () => {
  const st = N.create(plan); N.jump(st, 2); assert.equal(st.step, 2); assert.equal(st.s, R.ranges[2].s0); N.update(st, fixAt(at(R.ranges[2].s0 + 50)), T); assert.equal(st.onRoute, true); assert.ok(st.s >= R.ranges[2].s0);
});
test('recalcul : refusé loin du réseau, accepté près d\'un nœud connu', () => {
  const p0 = net.nodes[start]; assert.ok(N.recalcStart(E, net, { lat: p0.lat + 0.0003, lng: p0.lng }).idx != null);
  assert.equal(N.recalcStart(E, net, { lat: 46.5, lng: 2 }).idx, null); assert.equal(N.recalcStart(E, net, null), null);
  const r = E.planRoute(net, { start: N.recalcStart(E, net, { lat: p0.lat, lng: p0.lng }).idx, end: start, budget: 60, speed: 'medium', walk: true, colors: ['green', 'blue', 'red'] });
  assert.ok(r.steps && r.steps.length);
});
test('cap et direction', () => { assert.equal(N.compass(N.bearing([45, 6], [45.01, 6])), 'nord'); assert.equal(N.compass(N.bearing([45, 6], [45, 6.01])), 'est'); });
