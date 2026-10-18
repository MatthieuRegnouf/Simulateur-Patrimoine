#!/usr/bin/env node
/* Génère parcours.js : parcours découverte (demi-journée, journée) et programmes (3 jours, semaine) pour l'Espace Alpe d'Huez.
   Principe : pour chaque parcours, le planificateur propose des variantes ; on garde la meilleure qui respecte les contraintes (durée, difficulté, secteurs, remontées ou pistes imposées, peu de marche).
   Le résultat est un enchaînement EXACT de tronçons du graphe (parcours.js) : l'appli le recrée tel quel (Engine.planFromArcs), avec les durées et fermetures du jour.
   Ces parcours sont proposés par SKIP d'après le réseau ; ils n'ont PAS été relus par la station (le champ `review` le dit).
   Usage : node tools/build_parcours.js > parcours.js */
const path = require('path'), root = path.join(__dirname, '..');
const E = require(path.join(root, 'engine.js')), G = require(path.join(root, 'graph.js')), D = require(path.join(root, 'data.js')).stations.alpe;
const net = E.buildNet(G), sp = E.startPoints(net);
const levelOf = e => ({ level: E.COLOR_LEVEL[e.c] ?? 5, n: 0 });
const sectorsOf = r => { const s = new Set(); r.steps.forEach(st => { if (st.o) { const x = D.pistes.find(p => p.id === st.o) || D.lifts.find(l => l.id === st.o); x && x.sectors.forEach(id => s.add(D.sectors[id])); } }); return [...s]; };
const names = r => r.steps.filter(x => x.name).map(x => x.name);
const SPECS = [
  { id: 'premiers-virages', title: "Premiers virages à l'Alpe d'Huez", format: 'half', start: 'Départ Signal', budget: 180, lo: 1, hi: 4, colors: ['green', 'blue'], tagline: 'Pistes vertes et bleues autour de la station, pour prendre ses marques.' },
  { id: 'incontournables', title: "Les incontournables de l'Alpe d'Huez", format: 'half', start: 'Départ Signal', budget: 180, lo: 3, hi: 6.5, colors: ['green', 'blue', 'red'], tagline: 'Un premier tour des grands classiques, bleues et rouges accessibles.' },
  { id: 'grand-tour', title: 'Grand tour du domaine', format: 'day', start: 'Départ Signal', budget: 330, lo: 1, hi: 6.5, colors: ['green', 'blue', 'red'], wantSectors: ['Villard Reculas Station'], tagline: 'Une grande journée à travers plusieurs secteurs du domaine.' },
  { id: 'pic-blanc-sarenne', title: 'Pic Blanc et Sarenne', format: 'day', start: 'Départ Signal', budget: 330, lo: 3, hi: 8.5, colors: ['green', 'blue', 'red', 'black'], mustNames: ['Pic Blanc', 'Sarenne'], tagline: 'Le point culminant du domaine et la longue piste de Sarenne : pour skieurs confirmés.' },
  { id: 'oz-vaujany', title: 'Journée Oz et Vaujany', format: 'day', start: 'Départ Signal', budget: 330, lo: 3, hi: 8.5, colors: ['green', 'blue', 'red', 'black'], mustSectors: ['Oz 3300 · Vaujany'], tagline: 'Une journée vers Oz et Vaujany, pour skieurs à l’aise sur rouge.' }
];
const out = [], report = [];
for (const spec of SPECS) {
  const s = sp.find(x => x.name === spec.start).i; let best = null, bestSc = -1e9;
  for (const walk of [false, true]) {
    for (let v = 0; v < 70; v++) {
      const r = E.planRoute(net, { start: s, end: s, budget: spec.budget, speed: 'medium', walk, colors: spec.colors, levelOf, lo: spec.lo, hi: spec.hi, variant: v });
      if (r.error || Math.abs(r.total - spec.budget) > spec.budget * 0.12) continue;
      const secs = sectorsOf(r), nm = names(r);
      if ((spec.mustSectors || []).some(x => !secs.some(y => y.includes(x)))) continue;
      if ((spec.mustNames || []).some(x => !nm.some(y => y.includes(x)))) continue;
      const mine = new Set(r.arcs.map(a => a[0])), clash = out.some(o => { const theirs = new Set(o.arcs.map(a => a[0])); let c = 0; mine.forEach(x => theirs.has(x) && c++); return c / mine.size > 0.75; });
      if (clash) continue;   // deux parcours quasi identiques n'ont aucun intérêt
      const pistes = new Set(r.steps.filter(x => x.kind === 'piste').map(x => x.name)).size;
      const sc = pistes + 3 * secs.length + 4 * (spec.wantSectors || []).filter(x => secs.some(y => y.includes(x))).length - 3 * r.walkMin - 2 * (r.steps.length - new Set(r.steps.map(x => x.edges.join())).size) - Math.abs(r.total - spec.budget) / 6;
      if (sc > bestSc) { bestSc = sc; best = { r, walk, v }; }
    }
    if (best) break;
  }
  if (!best) { report.push(`${spec.id}: AUCUNE variante valable`); continue; }
  const r = best.r;
  report.push(`${spec.id}: variante ${best.v}, ${r.total} min, ${r.km} km, ${r.descents} descentes, ${r.steps.filter(x => x.kind === 'lift').length} remontées, marche ${r.walkMin} min, secteurs ${sectorsOf(r).join(' / ')}`);
  out.push({ id: spec.id, title: spec.title, format: spec.format, tagline: spec.tagline, startName: spec.start, speed: 'medium', arcs: r.arcs, expect: { min: r.total, km: r.km, descents: r.descents }, lo: spec.lo, hi: spec.hi, colors: spec.colors, budget: spec.budget, review: 'Proposé par SKIP d\'après le réseau, non relu par la station.' });
}
const programs = [
  { id: 'trois-jours', title: '3 jours pour découvrir la station', days: [{ title: 'Premiers virages', parcours: 'premiers-virages' }, { title: 'Grand tour', parcours: 'grand-tour' }, { title: 'Pic Blanc et Sarenne', parcours: 'pic-blanc-sarenne' }] },
  { id: 'semaine', title: 'Une semaine de découverte', days: [{ title: 'Premiers virages', parcours: 'premiers-virages' }, { title: 'Les incontournables', parcours: 'incontournables' }, { title: 'Grand tour', parcours: 'grand-tour' }, { title: 'Pic Blanc et Sarenne', parcours: 'pic-blanc-sarenne' }, { title: 'Oz et Vaujany', parcours: 'oz-vaujany' }] }
].map(p => ({ ...p, days: p.days.filter(d => out.some(x => x.id === d.parcours)) }));
console.error(report.join('\n'));
console.log("/* GÉNÉRÉ par tools/build_parcours.js : parcours découverte de l'Espace Alpe d'Huez, enchaînements exacts de tronçons du réseau (graph.js). Ne pas modifier à la main. Proposés par SKIP, non relus par la station. */");
console.log('const PARCOURS = ' + JSON.stringify({ osm: G.osm, parcours: out, programs }) + ";\nif (typeof module !== 'undefined') module.exports = PARCOURS;");
