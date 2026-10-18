/* Soleil et ombre sur les pistes : calcul pur (sans DOM), testé dans test/sun.test.js.
   Modèle, par point d'une piste et à une heure donnée :
     1. position du soleil (hauteur, azimut) : formules astronomiques, sans service externe ;
     2. orientation de la pente (direction de descente) et inclinaison : d'après le tracé et les altitudes du réseau ;
     3. éclairement direct = cosinus de l'angle entre le soleil et la pente (0 = dos au soleil) ;
     4. ombre portée : si le relief (grille de 150 m, EU-DEM) cache le soleil depuis ce point, éclairement 0 ;
     5. nuages : l'éclairement est réduit selon la nébulosité prévue, quand elle est connue.
   Ce que le modèle NE sait PAS : arbres, bâtiments, petits reliefs (< 150 m), état réel de la neige. C'est une estimation, pas une mesure. */
const Sun = (() => {
  const R = Math.PI / 180;
  const norm360 = a => ((a % 360) + 360) % 360;

  /* Position du soleil : { el: hauteur en degrés, az: azimut en degrés depuis le nord, vers l'est } */
  function position(date, lat, lng) {
    const d = date.getTime() / 864e5 - 10957.5;                 // jours depuis J2000
    const L = norm360(280.46 + 0.9856474 * d), g = norm360(357.528 + 0.9856003 * d) * R;
    const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * R, eps = (23.439 - 0.0000004 * d) * R;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    const H = (norm360(280.16 + 360.9856235 * d) + lng) * R - ra;
    const el = Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(lat * R) - Math.sin(lat * R) * Math.cos(H));
    return { el: el / R, az: norm360(az / R) };
  }

  /* Cosinus de l'angle soleil / pente. face = azimut vers lequel la pente est tournée ; slope = inclinaison (°). Plat : sin(hauteur). */
  function incidence(el, az, face, slope) {
    const e = el * R, s = slope * R;
    return Math.max(0, Math.sin(e) * Math.cos(s) + Math.cos(e) * Math.sin(s) * Math.cos((az - face) * R));
  }

  /* Relief : DEM = { rows, cols, north, west, dlat, dlon, b64 } (ligne 0 = nord). Renvoie { at(lat, lng) } altitude interpolée, ou null hors grille. */
  function makeDem(D) {
    if (!D) return null;
    const bin = typeof atob === 'function' ? atob(D.b64) : Buffer.from(D.b64, 'base64').toString('binary'), z = new Int16Array(D.rows * D.cols);
    for (let i = 0; i < z.length; i++) { const lo = bin.charCodeAt(2 * i), hi = bin.charCodeAt(2 * i + 1); z[i] = ((hi << 8) | lo) << 16 >> 16; }
    const at = (lat, lng) => {
      const r = (D.north - lat) / D.dlat, c = (lng - D.west) / D.dlon; if (r < 0 || c < 0 || r > D.rows - 1 || c > D.cols - 1) return null;
      const r0 = Math.floor(r), c0 = Math.floor(c), fr = r - r0, fc = c - c0, r1 = Math.min(D.rows - 1, r0 + 1), c1 = Math.min(D.cols - 1, c0 + 1);
      return (z[r0 * D.cols + c0] * (1 - fc) + z[r0 * D.cols + c1] * fc) * (1 - fr) + (z[r1 * D.cols + c0] * (1 - fc) + z[r1 * D.cols + c1] * fc) * fr;
    };
    return { at, stepM: D.stepM, meta: D };
  }

  /* Angle d'élévation (°) du relief le plus haut dans la direction az, vu depuis (lat, lng, z0), jusqu'à maxM mètres */
  function horizon(dem, lat, lng, z0, az, maxM = 8000) {
    if (!dem) return 0;
    const step = dem.stepM || 150, dla = Math.cos(az * R) / 111320, dlo = Math.sin(az * R) / (111320 * Math.cos(lat * R)); let best = -90;
    for (let d = step; d <= maxM; d += step) { const z = dem.at(lat + dla * d, lng + dlo * d); if (z == null) break; const a = Math.atan2(z - z0, d) / R; if (a > best) best = a; }
    return best;
  }

  /* Éclairement 0..1 d'un point de piste : { s, lit, shaded, el, az }. cloud = nébulosité 0..1 (ou null si inconnue). */
  function point(dem, date, lat, lng, face, slope, cloud) {
    const p = position(date, lat, lng);
    if (p.el <= 1) return { s: 0, lit: false, shaded: false, night: true, el: p.el, az: p.az };
    const inc = incidence(p.el, p.az, face, slope);
    let shaded = false, pen = 1;
    if (dem) { const z0 = dem.at(lat, lng); if (z0 != null) { const h = horizon(dem, lat, lng, z0 + 2, p.az); if (h > p.el - 0.3) shaded = true; else if (h > p.el - 2) pen = 0.5; } }
    let s = shaded ? 0 : Math.min(1, inc / 0.45) * pen;
    if (cloud != null) s *= 1 - 0.75 * Math.max(0, Math.min(1, cloud));
    return { s, lit: s >= 0.2, shaded, el: p.el, az: p.az };
  }
  const label = s => s >= 0.55 ? 'soleil' : s >= 0.2 ? 'soleil faible' : 'ombre';
  const bearing = (a, b) => { const k = Math.cos(a[0] * R), y = (b[1] - a[1]) * k, x = b[0] - a[0]; return norm360(Math.atan2(y, x) / R); };
  const distM = (a, b) => { const dl = (b[0] - a[0]) * R, dn = (b[1] - a[1]) * R, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dn / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };

  /* Échantillons d'un tronçon : jusqu'à n points avec leur direction de descente et l'inclinaison moyenne. g = [[lat, lng]…], altA/altB = altitudes des extrémités. */
  function samples(g, altA, altB, n = 3) {
    if (!g || g.length < 2) return [];
    let len = 0; const cum = [0]; for (let i = 1; i < g.length; i++) { len += distM(g[i - 1], g[i]); cum.push(len); }
    if (len < 15) return [];
    const down = altA >= altB, slope = Math.min(60, Math.atan2(Math.abs(altA - altB), len) / R), out = [];
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n * len; let j = 1; while (j < g.length - 1 && cum[j] < t) j++;
      const a = g[j - 1], b = g[j], f = (t - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1), pt = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      out.push({ lat: pt[0], lng: pt[1], face: down ? bearing(a, b) : bearing(b, a), slope });
    }
    return out;
  }

  /* Éclairement moyen d'un tronçon à une date (moyenne des échantillons) */
  function edge(dem, smp, date, cloud) {
    if (!smp.length) return null; let sum = 0, shaded = 0;
    smp.forEach(q => { const r = point(dem, date, q.lat, q.lng, q.face, q.slope, cloud); sum += r.s; if (r.shaded) shaded++; });
    return { s: sum / smp.length, shaded: shaded / smp.length };
  }
  return { position, incidence, makeDem, horizon, point, label, samples, edge, bearing, distM };
})();
if (typeof module !== 'undefined') module.exports = Sun;
