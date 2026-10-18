/* Carte interactive : Canvas 2D, fond vectoriel lu dans une archive PMTiles (extrait Protomaps de données © contributeurs OpenStreetMap, ODbL).
   Aucun serveur de tuiles tiers n'est appelé : le fond vient d'un seul fichier (basemap/alpe.pmtiles) qui peut être gardé sur l'appareil.
   Sans ce fichier, la carte affiche quand même le tracé, avec un fond neutre et un message clair.
   Dépendances : vendor/pmtiles.js (global `pmtiles`), mvt.js (global `MVT`). */
const SkiMap = (() => {
  const TS = 512, MAXZ = 15;               // taille de tuile logique ; zoom maximal de l'archive (au-delà : agrandissement)
  const PCOL = { green: '#1fb04a', blue: '#1e7bff', red: '#e5372b', black: '#1b1b1f' }, LIFT = '#3d4660', WALK = '#a0702a', LINK = '#6b7a99';
  const LAND = { glacier: '#e1edf8', forest: '#d9e6d0', wood: '#d9e6d0', scrub: '#e2e9d3', meadow: '#e7efdc', grassland: '#e7efdc', pitch: '#e1ecd6', park: '#e1ecd6', garden: '#e7efdc',
    bare_rock: '#e7e2da', residential: '#ece8e1', wetland: '#d9e9e8', school: '#efebe4', kindergarten: '#efebe4', parking: '#eeeae4', pedestrian: '#f2eee8', farmland: '#eef0df' };
  const wx = (lat, lng, z) => { const n = TS * 2 ** z, s = Math.sin(lat * Math.PI / 180); return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
  const unwx = (x, y, z) => { const n = TS * 2 ** z, a = Math.PI - 2 * Math.PI * y / n; return [180 / Math.PI * Math.atan(0.5 * (Math.exp(a) - Math.exp(-a))), x / n * 360 - 180]; };
  const mpp = (lat, z) => 40075016.686 * Math.cos(lat * Math.PI / 180) / (TS * 2 ** z);   // mètres par pixel CSS

  /* ---- fond : rendu d'une tuile vectorielle en image ---- */
  function drawTile(L, tz, ratio) {
    const c = document.createElement('canvas'); c.width = c.height = TS * ratio; const g = c.getContext('2d'); g.scale(ratio, ratio);
    const k = TS / 4096, P = (ring, close) => { g.moveTo(ring[0][0] * k, ring[0][1] * k); for (let i = 1; i < ring.length; i++) g.lineTo(ring[i][0] * k, ring[i][1] * k); if (close) g.closePath(); };
    g.fillStyle = '#f3f5f7'; g.fillRect(0, 0, TS, TS);
    g.lineJoin = g.lineCap = 'round';
    const fillLayer = (name, colorOf) => (L[name]?.features || []).forEach(f => {
      if (f.type !== 3) return; const col = colorOf(f.props); if (!col) return;
      g.fillStyle = col; g.beginPath(); f.geom.forEach(r => P(r, true)); g.fill('evenodd');
    });
    fillLayer('landuse', p => LAND[p.kind] || LAND[p.kind_detail]);
    fillLayer('water', p => p.kind === 'water' || p.kind === 'lake' || p.kind === 'ocean' ? '#b6d7ee' : null);
    (L.water?.features || []).forEach(f => { if (f.type === 2) { g.strokeStyle = '#a9cfe9'; g.lineWidth = f.props.kind === 'river' ? 2 : 1.1; g.beginPath(); f.geom.forEach(r => P(r)); g.stroke(); } });
    const roads = (L.roads?.features || []).filter(f => f.type === 2 && !/aerialway|aeroway|rail|ferry/.test(f.props.kind || ''));
    const rw = { major_road: tz >= 15 ? 6 : tz >= 13 ? 4 : 2.6, minor_road: tz >= 15 ? 3.6 : tz >= 14 ? 2.4 : 1.4, path: 1.3 };
    [['major_road', '#cfc9bd', 1.6], ['minor_road', '#d9d4ca', 1.2]].forEach(([kind, cas, add]) => { // contours puis remplissage
      g.strokeStyle = cas; g.lineWidth = rw[kind] + add * 2; g.beginPath(); roads.filter(f => f.props.kind === kind).forEach(f => f.geom.forEach(r => P(r))); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = rw[kind]; g.beginPath(); roads.filter(f => f.props.kind === kind).forEach(f => f.geom.forEach(r => P(r))); g.stroke();
    });
    if (tz >= 15) { g.strokeStyle = 'rgba(150,135,115,.55)'; g.lineWidth = .9; g.setLineDash([2, 3]); g.beginPath();   // sentiers : seulement très zoomé, discrets
      roads.filter(f => f.props.kind === 'path').forEach(f => f.geom.forEach(r => P(r))); g.stroke(); g.setLineDash([]); }
    if (tz >= 14) { g.fillStyle = '#ddd7ce'; g.strokeStyle = '#cbc4b9'; g.lineWidth = .6; (L.buildings?.features || []).forEach(f => { if (f.type !== 3) return; g.beginPath(); f.geom.forEach(r => P(r, true)); g.fill('evenodd'); g.stroke(); }); }
    return c;
  }
  /* étiquettes de la tuile, en coordonnées 0..TS */
  function tileLabels(L) {
    const out = [], k = TS / 4096;
    (L.places?.features || []).forEach(f => { const p = f.props; if (f.type === 1 && p.name && p.kind !== 'neighbourhood') out.push({ n: p.name, x: f.geom[0][0] * k, y: f.geom[0][1] * k, z: p.min_zoom ?? 12, t: 'place', r: p.kind_detail || p.kind }); });
    const KEEP = { peak: 1, hospital: 1, ski_school: 1, pharmacy: 1, post_office: 1, tourist_information: 1, information: 1, viewpoint: 1, supermarket: 1, parking: 0, bus_station: 1, aerialway_station: 0 };
    (L.pois?.features || []).forEach(f => { const p = f.props; if (f.type === 1 && p.name && KEEP[p.kind]) out.push({ n: p.name, x: f.geom[0][0] * k, y: f.geom[0][1] * k, z: Math.max(15.5, p.min_zoom ?? 15.5), t: 'poi', r: p.kind }); });
    return out;
  }

  /* ---- sources PMTiles ---- */
  class RangeSource {   // lecture par plages ; si le serveur ignore les plages, le fichier entier est lu une fois puis gardé en mémoire
    constructor(url) { this.url = url; this.whole = null; }
    getKey() { return this.url; }
    async getBytes(offset, length, signal) {
      if (this.whole) return { data: this.whole.slice(offset, offset + length) };
      const r = await fetch(this.url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` }, signal });
      if (r.status === 206) return { data: await r.arrayBuffer() };
      if (r.status === 200) { this.whole = await r.arrayBuffer(); return { data: this.whole.slice(offset, offset + length) }; }
      throw new Error('Fond de carte : HTTP ' + r.status);
    }
  }
  class MemSource { constructor(buf, key) { this.buf = buf; this.key = key || 'mem'; } getKey() { return this.key; } async getBytes(o, l) { return { data: this.buf.slice(o, o + l) }; } }
  const openPM = src => new pmtiles.PMTiles(src);

  /* ---- la carte ---- */
  function create(host, opt = {}) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.className = 'skimap'; cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;border-radius:inherit';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', opt.label || 'Carte de l\'itinéraire'); host.appendChild(cv);
    const ratio = Math.min(2, window.devicePixelRatio || 1), cache = new Map(), pend = new Set(), bad = new Set();
    const M = { pm: opt.pm || null, w: 0, h: 0, lat: 45.09, lng: 6.07, z: 14, route: null, plan: null, s: 0, hi: null, pos: null, near: null, follow: false, labels: true, net: !!opt.network, dead: false, tileErr: 0, noBase: !opt.pm };
    let raf = 0, bounds = null;
    const ask = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    const resize = () => { const r = host.getBoundingClientRect(); M.w = Math.max(50, r.width); M.h = Math.max(50, r.height); cv.width = M.w * ratio; cv.height = M.h * ratio; ask(); };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; ro && ro.observe(host); resize();

    async function getTile(z, x, y) {
      const key = `${z}/${x}/${y}`; if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
      if (!M.pm || pend.has(key) || bad.has(key)) return null; pend.add(key);
      try {
        const t = await M.pm.getZxy(z, x, y);
        const L = t ? MVT.decodeTile(new Uint8Array(t.data)) : {};
        cache.set(key, { img: drawTile(L, z, ratio), labels: tileLabels(L) });
        if (cache.size > 90) cache.delete(cache.keys().next().value);
      } catch (e) { bad.add(key); M.tileErr++; if (opt.onError) opt.onError(e); }
      pend.delete(key); ask(); return null;
    }
    const peek = (z, x, y) => cache.get(`${z}/${x}/${y}`);

    function draw() {
      if (M.dead) return;
      g.setTransform(ratio, 0, 0, ratio, 0, 0); g.fillStyle = '#eef1f4'; g.fillRect(0, 0, M.w, M.h);
      const z = M.z, [cx, cy] = wx(M.lat, M.lng, z), left = cx - M.w / 2, top = cy - M.h / 2;
      const P = (lat, lng) => { const [x, y] = wx(lat, lng, z); return [x - left, y - top]; };
      const tz = Math.max(0, Math.min(MAXZ, Math.round(z))), sc = 2 ** (z - tz), tsz = TS * sc, n = 2 ** tz;
      const labels = [];
      if (M.pm) {
        const x0 = Math.floor(left / tsz), x1 = Math.floor((left + M.w) / tsz), y0 = Math.floor(top / tsz), y1 = Math.floor((top + M.h) / tsz);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
          if (ty < 0 || ty >= n || tx < 0 || tx >= n) continue;
          const px = tx * tsz - left, py = ty * tsz - top, t = peek(tz, tx, ty);
          if (t) { g.drawImage(t.img, px, py, tsz, tsz); t.labels.forEach(l => labels.push({ ...l, sx: px + l.x * sc, sy: py + l.y * sc })); }
          else {
            getTile(tz, tx, ty);
            const pt = tz > 0 && peek(tz - 1, tx >> 1, ty >> 1);   // en attendant : la tuile parente, agrandie
            if (pt) { const h = TS / 2; g.drawImage(pt.img, (tx & 1) * h * ratio, (ty & 1) * h * ratio, h * ratio, h * ratio, px, py, tsz, tsz); }
          }
        }
      }
      /* Réseau du domaine (tracés OpenStreetMap + couleurs officielles) : le détail dépend du zoom ; sous un itinéraire il passe en retrait pour que le parcours reste le premier plan */
      const dl = [];
      if (M.net && M.dom && z >= 12.5) {
        const dim = M.route ? .42 : .9, W = z < 14 ? 1.6 : z < 15 ? 2.4 : 3.2, seen = new Map();
        g.lineCap = g.lineJoin = 'round';
        const inView = e => { for (const p of e.g) { const x = (wx(p[0], p[1], z)[0] - left), y = (wx(p[0], p[1], z)[1] - top); if (x > -40 && y > -40 && x < M.w + 40 && y < M.h + 40) return true; } return false; };
        const vis = M.dom.edges.filter(e => (e.k !== 'link' && e.k !== 'walk' || z >= 15) && inView(e));
        const stroke = e => { g.beginPath(); e.g.forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); };
        g.setLineDash([]);
        vis.filter(e => e.k === 'piste').forEach(e => { g.strokeStyle = PCOL[e.c] || '#8c93a3'; g.lineWidth = e.o ? W : W * .6; g.globalAlpha = e.o ? dim : dim * .55; stroke(e); });
        g.setLineDash([2, 4]); vis.filter(e => e.k === 'walk').forEach(e => { g.strokeStyle = WALK; g.lineWidth = 1.4; g.globalAlpha = dim; stroke(e); });
        g.setLineDash([5, 3]); vis.filter(e => e.k === 'link').forEach(e => { g.strokeStyle = LINK; g.lineWidth = 1.6; g.globalAlpha = dim; stroke(e); });
        g.setLineDash([8, 5]); vis.filter(e => e.k === 'lift').forEach(e => { g.strokeStyle = LIFT; g.lineWidth = Math.max(1.8, W * .8); g.globalAlpha = Math.min(1, dim + .15); stroke(e); });
        g.setLineDash([]); g.globalAlpha = 1;
        // noms : un seul par piste / remontée (le tronçon le plus visible), seulement à partir d'un certain zoom
        if (z >= 14.2) vis.filter(e => e.n && (e.k === 'lift' || (e.k === 'piste' && e.o))).forEach(e => {
          let len = 0, pr = null; e.g.forEach(p => { const q = P(p[0], p[1]); if (pr) len += Math.hypot(q[0] - pr[0], q[1] - pr[1]); pr = q; });
          const key = e.k + e.n; if (!seen.has(key) || seen.get(key).len < len) seen.set(key, { e, len });
        });
        seen.forEach(({ e, len }) => { if (len < 40) return; let acc = 0, mid = null, pr = null; e.g.forEach(p => { const q = P(p[0], p[1]); if (pr && !mid) { acc += Math.hypot(q[0] - pr[0], q[1] - pr[1]); if (acc >= len / 2) mid = q; } pr = q; });
          if (mid) dl.push({ n: e.n, sx: mid[0], sy: mid[1], t: e.k === 'lift' ? 'dlift' : 'dpiste', col: e.k === 'piste' ? PCOL[e.c] : LIFT, italic: e.k === 'lift' }); });
        if (z >= 15) (M.dom.stations || []).forEach(s => { const q = P(s.lat, s.lng); if (q[0] > -20 && q[1] > -20 && q[0] < M.w + 20 && q[1] < M.h + 20) { g.fillStyle = '#fff'; g.strokeStyle = LIFT; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], 4, 0, 7); g.fill(); g.stroke(); dl.push({ n: s.n, sx: q[0] + 7, sy: q[1] + 9, t: 'dstation', left: 1, col: LIFT }); } });
      }
      const R = M.route, plan = M.plan; const names = [];
      if (R && plan) {
        const col = i => { const s = plan.steps[i]; return s.kind === 'piste' ? PCOL[s.color] || '#444' : s.kind === 'lift' ? LIFT : s.kind === 'walk' ? WALK : LINK; };
        const wd = i => { const k = plan.steps[i].kind; return k === 'piste' ? 5.5 : k === 'lift' ? 4 : 3.5; };
        const dash = i => { const k = plan.steps[i].kind; return k === 'lift' ? [9, 5] : k === 'walk' ? [2, 5] : k === 'link' ? [6, 4] : []; };
        const path = (i, sFrom, sTo) => { // sous-ligne de l'étape i entre deux distances cumulées
          const r = R.ranges[i]; g.beginPath(); let started = false, prev = null;
          for (let j = r.p0; j <= r.p1; j++) {
            const pt = R.pts[j]; if (pt.s < sFrom) { prev = pt; continue; }
            if (pt.s > sTo) { if (prev && prev.s < sTo) { const t = (sTo - prev.s) / (pt.s - prev.s), q = P(prev.p[0] + (pt.p[0] - prev.p[0]) * t, prev.p[1] + (pt.p[1] - prev.p[1]) * t); started ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } break; }
            if (!started && prev && prev.s < sFrom) { const t = (sFrom - prev.s) / (pt.s - prev.s), q = P(prev.p[0] + (pt.p[0] - prev.p[0]) * t, prev.p[1] + (pt.p[1] - prev.p[1]) * t); g.moveTo(q[0], q[1]); started = true; }
            const q = P(pt.p[0], pt.p[1]); started ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); started = true; prev = pt;
          }
        };
        const hasHi = M.hi != null, prog = M.s > 0 ? M.s : -1;
        // 1) contour blanc (lisibilité sur le fond)
        g.lineCap = g.lineJoin = 'round'; g.setLineDash([]);
        plan.steps.forEach((s, i) => { g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = wd(i) + 4; path(i, 0, 1e12); g.stroke(); });
        // 2) halo de l'étape choisie
        if (hasHi) { g.strokeStyle = 'rgba(255,196,0,.55)'; g.lineWidth = wd(M.hi) + 12; path(M.hi, 0, 1e12); g.stroke(); }
        // 3) tracé : déjà parcouru = grisé ; à parcourir = couleur
        plan.steps.forEach((s, i) => {
          const r = R.ranges[i], faded = hasHi && i !== M.hi;
          g.lineWidth = wd(i); g.setLineDash(dash(i));
          if (prog > r.s0) { g.strokeStyle = '#9aa3b2'; g.globalAlpha = .75; path(i, 0, Math.min(prog, r.s1)); g.stroke(); }
          if (prog < r.s1) { g.strokeStyle = col(i); g.globalAlpha = faded ? .5 : 1; path(i, Math.max(prog, 0), 1e12); g.stroke(); }
          g.globalAlpha = 1;
        });
        g.setLineDash([]);
        // 4) flèches de sens, une tous les ~110 px
        g.fillStyle = '#fff'; let acc = 0;
        for (let j = 0; j < R.pts.length - 1; j++) {
          const a = P(R.pts[j].p[0], R.pts[j].p[1]), b = P(R.pts[j + 1].p[0], R.pts[j + 1].p[1]), d = Math.hypot(b[0] - a[0], b[1] - a[1]);
          acc += d; if (acc < 110 || d < 6) continue; acc = 0;
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, an = Math.atan2(b[1] - a[1], b[0] - a[0]);
          if (mx < -10 || my < -10 || mx > M.w + 10 || my > M.h + 10) continue;
          g.save(); g.translate(mx, my); g.rotate(an); g.beginPath(); g.moveTo(3.5, 0); g.lineTo(-2.5, -3); g.lineTo(-2.5, 3); g.closePath(); g.globalAlpha = .95; g.fill(); g.restore();
        }
        // 5) pastilles numérotées au début de chaque étape
        plan.steps.forEach((s, i) => {
          const p0 = P(R.pts[R.ranges[i].p0].p[0], R.pts[R.ranges[i].p0].p[1]); if (p0[0] < -20 || p0[1] < -20 || p0[0] > M.w + 20 || p0[1] > M.h + 20) return;
          const act = M.hi === i, big = act || z >= 14.7, r = act ? 12 : big ? 9 : 4;   // zoom éloigné : simples points, pour ne pas masquer la carte
          g.fillStyle = col(i); g.beginPath(); g.arc(p0[0], p0[1], r, 0, 7); g.fill(); g.lineWidth = big ? 2 : 1.5; g.strokeStyle = '#fff'; g.stroke();
          if (big) { g.fillStyle = '#fff'; g.font = `800 ${act ? 13 : 11}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i + 1, p0[0], p0[1] + .5); }
          // nom de l'étape : seulement si on a assez zoomé, ou si elle est choisie
          const nm = s.kind === 'piste' || s.kind === 'lift' ? (s.name || (s.kind === 'piste' ? 'Piste ' + (({ green: 'verte', blue: 'bleue', red: 'rouge', black: 'noire' })[s.color] || '') : '')) : '';
          if (nm && (act || z >= 14.6)) { const m = R.ranges[i], mid = R.pts[Math.floor((m.p0 + m.p1) / 2)], q = P(mid.p[0], mid.p[1]); names.push({ n: nm, x: q[0], y: q[1], pri: act ? 0 : 1 }); }
        });
        // départ / arrivée
        const f = R.pts[0].p, e = R.pts[R.pts.length - 1].p, same = Math.abs(f[0] - e[0]) + Math.abs(f[1] - e[1]) < 0.0004;
        const flag = (p, t, c, dy) => { const q = P(p[0], p[1]); g.fillStyle = c; g.beginPath(); g.arc(q[0], q[1], 6.5, 0, 7); g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); labels.push({ n: t, sx: q[0] + 10, sy: q[1] + dy, t: 'flag', bold: 1, left: 1 }); };
        if (same) flag(f, 'Départ · arrivée', '#7b3fe4', -10); else { flag(f, 'Départ', '#1fb04a', -10); flag(e, 'Arrivée', '#12213a', 14); }
        if (M.near && M.near.p) {   // point du tracé le plus proche, quand on est hors parcours
          const a = M.pos ? P(M.pos[0], M.pos[1]) : null, q = P(M.near.p[0], M.near.p[1]);
          if (a) { g.setLineDash([5, 5]); g.strokeStyle = '#d0021b'; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(q[0], q[1]); g.stroke(); g.setLineDash([]); }
          g.strokeStyle = '#d0021b'; g.lineWidth = 3; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.stroke();
        }
      }
      if (M.track && M.track.length > 1) {   // parcours réellement enregistré par le GPS (distinct de l'itinéraire prévu)
        g.lineCap = g.lineJoin = 'round'; g.setLineDash([]);
        const tp = () => { g.beginPath(); M.track.forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); };
        tp(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 8; g.stroke(); tp(); g.strokeStyle = '#d6336c'; g.lineWidth = 4; g.stroke();
        const s0 = P(M.track[0][0], M.track[0][1]), e0 = P(M.track[M.track.length - 1][0], M.track[M.track.length - 1][1]);
        [[s0, '#1fb04a'], [e0, '#12213a']].forEach(([q, c]) => { g.fillStyle = c; g.beginPath(); g.arc(q[0], q[1], 6.5, 0, 7); g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); });
      }
      // étiquettes : une seule passe, avec évitement des chevauchements. Priorité : étiquettes de l'itinéraire, puis lieux, puis points d'intérêt.
      if (M.labels) {
        const placed = [], fits = (x, y, w, h) => { for (const r of placed) if (x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]) return false; return true; };
        const all = [...names.sort((a, b) => a.pri - b.pri).map(l => ({ ...l, t: 'route', sx: l.x + 12, sy: l.y - 12, left: 1, bold: 1 })), ...labels.filter(l => l.t === 'flag'), ...dl.filter(l => l.t === 'dlift'), ...dl.filter(l => l.t === 'dpiste'), ...dl.filter(l => l.t === 'dstation'), ...labels.filter(l => l.t === 'place' && z >= l.z - 0.2).sort((a, b) => a.z - b.z), ...labels.filter(l => l.t === 'poi' && z >= l.z)];
        all.forEach(l => {
          if (l.sx < -50 || l.sy < -20 || l.sx > M.w + 50 || l.sy > M.h + 20) return;
          g.font = `${l.italic ? 'italic ' : ''}${l.bold ? 800 : l.t === 'place' ? 700 : 600} ${l.t === 'place' ? 13 : 11.5}px system-ui,sans-serif`; g.textBaseline = 'middle';
          const w = g.measureText(l.n).width, x = l.left ? l.sx : l.sx - w / 2, y = l.sy;
          if (l.t !== 'flag' && !fits(x - 2, y - 8, w + 4, 16)) return; placed.push([x - 2, y - 8, w + 4, 16]);
          g.textAlign = 'left'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(255,255,255,.92)'; g.strokeText(l.n, x, y);
          g.fillStyle = l.col && l.t[0] === 'd' ? (l.col === PCOL.green ? '#12803a' : l.col) : l.t === 'route' || l.t === 'flag' ? '#12213a' : l.t === 'place' ? '#3a4660' : '#5a6580'; g.fillText(l.n, x, y);
        });
      }
      // position de l'utilisateur : jamais plus nette que ce que le GPS sait
      if (M.pos) {
        const q = P(M.pos.lat ?? M.pos[0], M.pos.lng ?? M.pos[1]), acc = M.accM || 0, rpx = acc / mpp(M.lat, z), ok = M.posQ === 'good' || M.posQ === 'fair';
        if (rpx > 4) { g.fillStyle = ok ? 'rgba(11,95,255,.14)' : 'rgba(150,150,150,.18)'; g.strokeStyle = ok ? 'rgba(11,95,255,.5)' : 'rgba(110,110,110,.6)'; g.lineWidth = 1.2; g.setLineDash(ok ? [] : [4, 3]); g.beginPath(); g.arc(q[0], q[1], rpx, 0, 7); g.fill(); g.stroke(); g.setLineDash([]); }
        if (M.heading != null && ok) { g.save(); g.translate(q[0], q[1]); g.rotate(M.heading * Math.PI / 180); g.fillStyle = 'rgba(11,95,255,.9)'; g.beginPath(); g.moveTo(0, -17); g.lineTo(6, -8); g.lineTo(-6, -8); g.closePath(); g.fill(); g.restore(); }
        g.fillStyle = ok ? '#0b5fff' : '#8a8f9c'; g.beginPath(); g.arc(q[0], q[1], 8, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
        if (M.posQ === 'stale') { const t = `dernière position · il y a ${Math.round((Date.now() - M.fixT) / 1000)} s`; g.font = '700 11px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(t, q[0], q[1] - 14); g.fillStyle = '#5a6070'; g.fillText(t, q[0], q[1] - 14); }
      }
      // échelle + mention de licence (obligatoire pour les données OpenStreetMap)
      const mp = mpp(M.lat, z), nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]; let m = nice[0]; for (const v of nice) if (v / mp < 110) m = v;
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(8, M.h - 24, m / mp + 12, 16); g.fillStyle = '#12213a'; g.fillRect(12, M.h - 12, m / mp, 2);
      g.font = '600 10px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', 12, M.h - 14);
      const at = M.pm ? '© OpenStreetMap · Protomaps' : 'Pas de fond de carte (tracé seul)'; g.font = '10px system-ui,sans-serif'; g.textAlign = 'right';
      const aw = g.measureText(at).width; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(M.w - aw - 12, M.h - 18, aw + 10, 15); g.fillStyle = '#3a4660'; g.fillText(at, M.w - 7, M.h - 7);
    }

    /* ---- interactions ---- */
    const clampZ = z => Math.max(11, Math.min(18, z));
    const pts = new Map(); let drag = null, pinch = null, moved = false;
    const moveBy = (dx, dy) => { const [cx, cy] = wx(M.lat, M.lng, M.z); [M.lat, M.lng] = unwx(cx - dx, cy - dy, M.z); };
    const zoomAt = (nz, px, py) => { nz = clampZ(nz); const [cx, cy] = wx(M.lat, M.lng, M.z), fx = cx - M.w / 2 + px, fy = cy - M.h / 2 + py, k = 2 ** (nz - M.z), nx = fx * k, ny = fy * k; M.z = nz; [M.lat, M.lng] = unwx(nx - px + M.w / 2, ny - py + M.h / 2, nz); };
    const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e)); moved = false; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: M.z }; } else drag = rel(e); });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const p = rel(e), old = pts.get(e.pointerId); pts.set(e.pointerId, p);
      if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(pinch.z + Math.log2(d / pinch.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); moved = true; userMoved(); ask(); }
      else if (drag) { const dx = p[0] - old[0], dy = p[1] - old[1]; if (Math.abs(p[0] - drag[0]) + Math.abs(p[1] - drag[1]) > 6 || moved) { moved = true; moveBy(dx, dy); userMoved(); ask(); } }
    });
    const up = e => { const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { if (was && !moved && e.type === 'pointerup') tap(rel(e)); drag = null; } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = rel(e); zoomAt(M.z - e.deltaY / 300, p[0], p[1]); userMoved(); ask(); }, { passive: false });
    cv.addEventListener('dblclick', e => { const p = rel(e); zoomAt(M.z + 1, p[0], p[1]); userMoved(); ask(); });
    function userMoved() { if (M.follow) { M.follow = false; opt.onFollow && opt.onFollow(false); } }
    function tap(p) {   // sélection d'une étape en touchant le tracé
      if (!M.route || !M.plan || !opt.onSelect) return;
      const z = M.z, [cx, cy] = wx(M.lat, M.lng, z), left = cx - M.w / 2, top = cy - M.h / 2; let bestI = -1, bd = 18;
      for (let j = 0; j < M.route.pts.length - 1; j++) {
        const A = wx(M.route.pts[j].p[0], M.route.pts[j].p[1], z), B = wx(M.route.pts[j + 1].p[0], M.route.pts[j + 1].p[1], z), ax = A[0] - left, ay = A[1] - top, bx = B[0] - left, by = B[1] - top;
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0, d = Math.hypot(ax + t * dx - p[0], ay + t * dy - p[1]);
        if (d < bd) { bd = d; bestI = M.route.pts[j].i; }
      }
      if (bestI >= 0) opt.onSelect(bestI);
    }

    /* ---- API ---- */
    Object.assign(M, {
      setBase(pm) { M.pm = pm; M.noBase = !pm; cache.clear(); bad.clear(); M.tileErr = 0; ask(); },
      setDomain(dom, on) { M.dom = dom; M.net = !!on; ask(); },
      showDomain(on) { M.net = !!on; ask(); },
      setRoute(plan, route) { M.plan = plan; M.route = route; M.s = 0; M.hi = null; bounds = null; ask(); },
      setProgress(s) { M.s = s; ask(); },
      setPosition(fix, q, near) { M.pos = fix ? [fix.lat, fix.lng] : null; M.accM = fix ? fix.acc : 0; M.heading = fix && fix.heading != null && !isNaN(fix.heading) && (fix.speed || 0) > 1 ? fix.heading : null; M.posQ = q; M.near = near || null; M.fixT = fix ? fix.t : 0;
        if (M.follow && M.pos) { M.lat = M.pos[0]; M.lng = M.pos[1]; } ask(); },
      highlight(i, fitIt) { M.hi = i; if (i != null && fitIt) M.fit(i); ask(); },
      fit(i) { // cadre une étape (ou tout le tracé), en laissant de la marge pour les bandeaux
        const R = M.route; if (!R) return; const a = i == null ? 0 : R.ranges[i].p0, b = i == null ? R.pts.length - 1 : R.ranges[i].p1;
        let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180; for (let j = a; j <= b; j++) { const p = R.pts[j].p; la0 = Math.min(la0, p[0]); la1 = Math.max(la1, p[0]); lo0 = Math.min(lo0, p[1]); lo1 = Math.max(lo1, p[1]); }
        const pad = opt.pad || { t: 20, b: 20, l: 20, r: 20 }, aw = Math.max(40, M.w - pad.l - pad.r), ah = Math.max(40, M.h - pad.t - pad.b);
        let z = 18; for (; z > 11; z -= .25) { const A = wx(la1, lo0, z), B = wx(la0, lo1, z); if (B[0] - A[0] <= aw && B[1] - A[1] <= ah) break; }
        M.z = clampZ(Math.min(z, 17)); const A = wx(la1, lo0, M.z), B = wx(la0, lo1, M.z), mx = (A[0] + B[0]) / 2 + (pad.r - pad.l) / 2, my = (A[1] + B[1]) / 2 + (pad.b - pad.t) / 2;
        [M.lat, M.lng] = unwx(mx, my, M.z); M.follow = false; ask();
      },
      setTrack(pts) { M.track = pts; ask(); },
      fitTrack() {
        const t = M.track; if (!t || !t.length) return; let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180; t.forEach(p => { la0 = Math.min(la0, p[0]); la1 = Math.max(la1, p[0]); lo0 = Math.min(lo0, p[1]); lo1 = Math.max(lo1, p[1]); });
        const aw = Math.max(40, M.w - 40), ah = Math.max(40, M.h - 40); let z = 17; for (; z > 11; z -= .25) { const A = wx(la1, lo0, z), B = wx(la0, lo1, z); if (B[0] - A[0] <= aw && B[1] - A[1] <= ah) break; }
        M.z = clampZ(z); [M.lat, M.lng] = [(la0 + la1) / 2, (lo0 + lo1) / 2]; M.follow = false; ask();
      },
      centerOn(lat, lng, z) { M.lat = lat; M.lng = lng; if (z) M.z = clampZ(z); ask(); },
      setFollow(on, z) { M.follow = on; if (on && M.pos) { M.lat = M.pos[0]; M.lng = M.pos[1]; if (z) M.z = clampZ(z); } opt.onFollow && opt.onFollow(on); ask(); },
      zoomBy(d) { zoomAt(M.z + d, M.w / 2, M.h / 2); userMoved(); ask(); },
      stats: () => ({ tiles: cache.size, errors: M.tileErr, base: !!M.pm }), resize, redraw: ask, view: () => ({ lat: M.lat, lng: M.lng, z: M.z }),
      destroy() { M.dead = true; ro && ro.disconnect(); cv.remove(); },
      canvas: cv
    });
    return M;
  }
  return { create, RangeSource, MemSource, openPM, wx, unwx, mpp };
})();
if (typeof module !== 'undefined') module.exports = SkiMap;
