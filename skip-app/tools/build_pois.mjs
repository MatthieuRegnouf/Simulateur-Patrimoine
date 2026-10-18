// Génère pois.js : restaurants, cafés, bars, pubs, snacks et boulangeries du domaine, extraits du fond de carte (OpenStreetMap via Protomaps).
// Usage : depuis un dossier où `npm i pmtiles` a été fait :  node build_pois.mjs <alpe.pmtiles> <graph.js> <mvt.js> > pois.js
// Altitude et éloignement du réseau de pistes/remontées sont calculés avec graph.js. Les horaires ne sont pas dans le fond de carte : ils ne sont pas renseignés ici.
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url);
const [,, PM, GRAPH, MVTJS] = process.argv;
const MVT = require(MVTJS), G = require(GRAPH);
const { PMTiles } = await import('pmtiles');
const buf = fs.readFileSync(PM);
const pm = new PMTiles({ getKey: () => 'f', getBytes: async (o, l) => ({ data: buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + l) }) });
const z = 15, n = 2 ** z, tx = lon => Math.floor((lon + 180) / 360 * n), ty = lat => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
const KINDS = new Set(['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'bakery']);
const un = (x, y, px, py) => { const a = Math.PI * (1 - 2 * (y + py / 4096) / n); return [Math.atan(Math.sinh(a)) * 180 / Math.PI, (x + px / 4096) / n * 360 - 180]; };
const out = [], seen = new Set();
for (let x = tx(5.98); x <= tx(6.22); x++) for (let y = ty(45.21); y <= ty(45.02); y++) {
  const t = await pm.getZxy(z, x, y); if (!t) continue; const L = MVT.decodeTile(new Uint8Array(Buffer.from(t.data))).pois; if (!L) continue;
  for (const f of L.features) { const p = f.props; if (f.type !== 1 || !KINDS.has(p.kind) || !p.name) continue;
    const [lat, lng] = un(x, y, f.geom[0][0], f.geom[0][1]), key = p.kind + '|' + p.name.toLowerCase() + '|' + Math.round(lat * 2000) + '|' + Math.round(lng * 1400);
    if (seen.has(key)) continue; seen.add(key); out.push({ n: p.name, k: p.kind, lat: +lat.toFixed(5), lng: +lng.toFixed(5) }); }
}
// altitude (nœud du réseau le plus proche) et distance au réseau de pistes/remontées
const R = Math.PI / 180, d = (a, b) => { const dl = (b[0] - a[0]) * R, dn = (b[1] - a[1]) * R, h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dn / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(h)); };
const dec = g => { const o = []; let la = 0, lo = 0; for (let i = 0; i < g.length; i += 2) { la += g[i]; lo += g[i + 1]; o.push([la / 1e5, lo / 1e5]); } return o; };
const segs = G.edges.filter(e => e.k === 'piste' || e.k === 'lift').map(e => dec(e.g));
for (const p of out) {
  let best = 1e9, bn = null; G.nodes.forEach(nd => { const dd = d([p.lat, p.lng], [nd[0], nd[1]]); if (dd < best) { best = dd; bn = nd; } }); p.alt = bn ? Math.round(bn[2]) : null;
  let m = 1e9; for (const g of segs) for (let i = 0; i < g.length; i++) { const dd = d([p.lat, p.lng], g[i]); if (dd < m) m = dd; } p.dNet = Math.round(m);
}
out.sort((a, b) => a.n.localeCompare(b.n, 'fr'));
console.log("/* GÉNÉRÉ par tools/build_pois.mjs : restaurants, cafés, bars du domaine (© contributeurs OpenStreetMap, ODbL, via Protomaps). Pas d'horaires ni d'avis dans cette source. alt = altitude du point du réseau le plus proche ; dNet = distance (m) à la piste ou remontée la plus proche (précision limitée par le pas des tracés). */");
console.log('const POIS = ' + JSON.stringify(out) + ";\nif (typeof module !== 'undefined') module.exports = POIS;");
