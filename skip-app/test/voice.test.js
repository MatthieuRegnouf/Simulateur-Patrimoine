// Tests du guidage vocal : node --test test/voice.test.js
const test = require('node:test'), assert = require('node:assert');
const E = require('../engine.js'), G = require('../graph.js'), N = require('../nav.js'), V = require('../voice.js');
const net = E.buildNet(G), start = E.startPoints(net).find(s => s.name === 'Départ Signal').i;
const plan = E.planRoute(net, { start, budget: 120, speed: 'medium', walk: true, colors: ['green', 'blue', 'red'] });
const instr = (pl, i) => ({ main: pl.steps[i].kind === 'lift' ? 'Rejoignez la remontée ' + pl.steps[i].name : 'Prenez la piste ' + pl.steps[i].name });
const mk = (s, extra) => { const st = N.create(plan); st.started = true; st.s = s; st.q = 'good'; st.step = Math.max(0, st.route.ranges.findIndex(r => s <= r.s1)); return Object.assign(st, extra); };
const voices = [{ name: 'Thomas', lang: 'fr-FR', localService: true }, { name: 'Google français', lang: 'fr-FR', localService: false }, { name: 'Compact fr', lang: 'fr-CA', localService: true }, { name: 'Samantha', lang: 'en-US', localService: true }];

test('voix : seules les françaises, les plus naturelles d\'abord ; hors ligne, locales d\'abord', () => {
  const on = V.list(voices, true).map(v => v.name); assert.ok(!on.includes('Samantha')); assert.ok(on.indexOf('Compact fr') > on.indexOf('Thomas'));
  assert.equal(V.list(voices, false)[0].local, true); assert.equal(V.pick(voices, 'Google français', false).local, true);   // voix en ligne refusée hors ligne
  assert.equal(V.pick(voices, 'Google français', true).name, 'Google français'); assert.equal(V.pick([], '', true), null);
});
test('annonces : une seule fois par événement, courtes, liées à l\'étape réelle', () => {
  const mem = {}, r = plan.steps.length ? N.build(plan).ranges[1] : null, st = mk(r.s0 + 10);
  const a = V.decide({ st, plan, instr, mem }); assert.equal(a.length, 1); assert.match(a[0], new RegExp(plan.steps[1].name.slice(0, 4)));
  assert.deepEqual(V.decide({ st, plan, instr, mem }), []);                        // pas de répétition
  assert.ok(a[0].length < 60);
});
test('annonce d\'approche : « Dans N mètres » seulement près de la fin d\'une étape longue', () => {
  const R = N.build(plan), i = R.ranges.findIndex(r => r.s1 - r.s0 > 600 && plan.steps[R.ranges.indexOf(r)].kind === 'piste'), r = R.ranges[i], mem = {};
  V.decide({ st: mk(r.s0 + 20), plan, instr, mem }); assert.deepEqual(V.decide({ st: mk(r.s0 + 100), plan, instr, mem }), []);
  const a = V.decide({ st: mk(r.s1 - 150), plan, instr, mem }); assert.equal(a.length, 1); assert.match(a[0], /^Dans (150|200|100) mètres, /);
  assert.deepEqual(V.decide({ st: mk(r.s1 - 140), plan, instr, mem }), []);
});
test('rien d\'annoncé si la position est imprécise ou si on n\'est pas encore sur le tracé', () => {
  assert.deepEqual(V.decide({ st: mk(500, { q: 'poor' }), plan, instr, mem: {} }), []);
  const st = N.create(plan); st.q = 'good'; assert.deepEqual(V.decide({ st, plan, instr, mem: {} }), []);
});
test('perte de signal, sortie de parcours et retour : annoncés une fois chacun', () => {
  const mem = {}; V.decide({ st: mk(500), plan, instr, mem });
  assert.deepEqual(V.decide({ st: mk(500, { q: 'stale' }), plan, instr, mem }), ['Position perdue.']); assert.deepEqual(V.decide({ st: mk(500, { q: 'stale' }), plan, instr, mem }), []);
  const back = V.decide({ st: mk(500), plan, instr, mem }); assert.equal(back[0], 'Position retrouvée.');
  assert.deepEqual(V.decide({ st: mk(500, { off: true }), plan, instr, mem }), ['Tu t\'es écarté de l\'itinéraire.']); assert.deepEqual(V.decide({ st: mk(500, { off: true }), plan, instr, mem }), []);
  V.decide({ st: mk(500), plan, instr, mem }); assert.deepEqual(V.decide({ st: mk(500, { off: true }), plan, instr, mem }), ['Tu t\'es écarté de l\'itinéraire.']);   // nouvel épisode : on le redit
});
test('arrivée', () => { const R = N.build(plan), mem = {}; const a = V.decide({ st: mk(R.total - 5), plan, instr, mem }); assert.deepEqual(a, ['Vous êtes arrivé.']); });
