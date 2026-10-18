/* Décodeur minimal de tuiles vectorielles Mapbox (MVT) : ce dont la carte a besoin, sans dépendance.
   decodeTile(Uint8Array) -> { couche: { extent, features: [{ type: 1|2|3, props, geom }] } }
   geom : points -> [[x,y]], lignes -> [[[x,y],...]], polygones -> [[[x,y],...] (anneaux)] en coordonnées de tuile. */
const MVT = (() => {
  function reader(buf) {
    let p = 0;
    const varint = () => { let r = 0, s = 0, b; do { b = buf[p++]; r += (b & 127) * 2 ** s; s += 7; } while (b & 128); return r; };
    return { get pos() { return p; }, set pos(v) { p = v; }, buf, varint, eof: end => p >= end };
  }
  const zz = n => (n >> 1) ^ -(n & 1);
  function readValue(r, end) {
    let v = null;
    while (!r.eof(end)) {
      const tag = r.varint(), f = tag >> 3, w = tag & 7;
      if (f === 1) { const l = r.varint(); v = new TextDecoder().decode(r.buf.subarray(r.pos, r.pos + l)); r.pos += l; }
      else if (f === 2) { v = new DataView(r.buf.buffer, r.buf.byteOffset + r.pos, 4).getFloat32(0, true); r.pos += 4; }
      else if (f === 3) { v = new DataView(r.buf.buffer, r.buf.byteOffset + r.pos, 8).getFloat64(0, true); r.pos += 8; }
      else if (f === 4 || f === 5) v = r.varint();
      else if (f === 6) v = zz(r.varint());
      else if (f === 7) v = !!r.varint();
      else if (w === 2) { const l = r.varint(); r.pos += l; } else r.varint();
    }
    return v;
  }
  function decodeGeometry(cmds, type) {
    const lines = []; let x = 0, y = 0, cur = null;
    for (let i = 0; i < cmds.length;) {
      const c = cmds[i++], id = c & 7, n = c >> 3;
      if (id === 7) { if (cur) cur.push(cur[0]); continue; }
      for (let k = 0; k < n; k++) {
        x += zz(cmds[i++]); y += zz(cmds[i++]);
        if (id === 1) { cur = [[x, y]]; lines.push(cur); } else cur.push([x, y]);
      }
    }
    return type === 1 ? lines.map(l => l[0]) : lines;
  }
  function decodeLayer(r, end) {
    const layer = { name: '', extent: 4096, features: [] }, keys = [], vals = [], raw = [];
    while (!r.eof(end)) {
      const tag = r.varint(), f = tag >> 3;
      if (f === 1) { const l = r.varint(); layer.name = new TextDecoder().decode(r.buf.subarray(r.pos, r.pos + l)); r.pos += l; }
      else if (f === 2) { const l = r.varint(), e = r.pos + l; raw.push([r.pos, e]); r.pos = e; }
      else if (f === 3) { const l = r.varint(); keys.push(new TextDecoder().decode(r.buf.subarray(r.pos, r.pos + l))); r.pos += l; }
      else if (f === 4) { const l = r.varint(), e = r.pos + l; vals.push(readValue(r, e)); r.pos = e; }
      else if (f === 5) layer.extent = r.varint();
      else if ((tag & 7) === 2) { const l = r.varint(); r.pos += l; } else r.varint();
    }
    raw.forEach(([s, e]) => {
      r.pos = s; const props = {}; let type = 0, cmds = [];
      while (!r.eof(e)) {
        const tag = r.varint(), f = tag >> 3;
        if (f === 2) { const l = r.varint(), pe = r.pos + l; const t = []; while (r.pos < pe) t.push(r.varint()); for (let i = 0; i < t.length; i += 2) props[keys[t[i]]] = vals[t[i + 1]]; }
        else if (f === 3) type = r.varint();
        else if (f === 4) { const l = r.varint(), pe = r.pos + l; while (r.pos < pe) cmds.push(r.varint()); }
        else if ((tag & 7) === 2) { const l = r.varint(); r.pos += l; } else r.varint();
      }
      layer.features.push({ type, props, geom: decodeGeometry(cmds, type) });
    });
    return layer;
  }
  function decodeTile(buf) {
    const r = reader(buf), out = {};
    while (!r.eof(buf.length)) {
      const tag = r.varint();
      if (tag >> 3 === 3) { const l = r.varint(), e = r.pos + l, ly = decodeLayer(r, e); out[ly.name] = ly; r.pos = e; }
      else if ((tag & 7) === 2) { const l = r.varint(); r.pos += l; } else r.varint();
    }
    return out;
  }
  return { decodeTile };
})();
if (typeof module !== 'undefined') module.exports = MVT;
