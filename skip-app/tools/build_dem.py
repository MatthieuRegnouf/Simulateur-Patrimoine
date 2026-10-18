#!/usr/bin/env python3
"""Construit dem.js : relief du domaine (altitudes en grille de 150 m) pour calculer les ombres portées par les crêtes.

Source : EU-DEM v1.1 (Copernicus, 25 m) via l'API publique OpenTopoData (https://api.opentopodata.org/v1/eudem25m), 100 points par requête, ≈ 1 requête/s.
Précision verticale de l'ordre de 7 m ; c'est un modèle de surface (la cime des forêts compte). La grille de 150 m lisse les petits reliefs :
elle sert à voir les grandes ombres (crêtes, sommets), pas les arbres ou les bâtiments.
Usage : python3 tools/build_dem.py [--cache FICHIER.json]   (reprend là où il s'est arrêté)
"""
import argparse, base64, json, math, os, struct, sys, time, urllib.request
BBOX = (45.02 - 0.03, 5.98 - 0.045, 45.21 + 0.03, 6.22 + 0.045)   # sud, ouest, nord, est (marge : les crêtes hors domaine projettent aussi des ombres)
STEP_M = 150
LAT0 = 45.12
DLAT = STEP_M / 111320; DLON = STEP_M / (111320 * math.cos(math.radians(LAT0)))
ROWS = int((BBOX[2] - BBOX[0]) / DLAT) + 1; COLS = int((BBOX[3] - BBOX[1]) / DLON) + 1   # ligne 0 = nord
def pt(r, c): return (round(BBOX[2] - r * DLAT, 6), round(BBOX[1] + c * DLON, 6))
def fetch(chunk):
    q = '|'.join(f'{la},{lo}' for la, lo in chunk)
    for k in range(8):
        try:
            with urllib.request.urlopen(f'https://api.opentopodata.org/v1/eudem25m?locations={q}', timeout=60) as r:
                return [x['elevation'] for x in json.load(r)['results']]
        except Exception as e:
            print('  nouvel essai', k, e, file=sys.stderr); time.sleep(3 + 3 * k)
    raise SystemExit('échec réseau')
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--cache', default='/tmp/dem_cache.json'); a = ap.parse_args()
    pts = [pt(r, c) for r in range(ROWS) for c in range(COLS)]
    z = json.load(open(a.cache)) if os.path.exists(a.cache) else []
    print(f'{ROWS}×{COLS} = {len(pts)} points, déjà {len(z)}')
    while len(z) < len(pts):
        part = pts[len(z):len(z) + 100]; z += fetch(part)
        if (len(z) // 100) % 10 == 0: json.dump(z, open(a.cache, 'w')); print(len(z), '/', len(pts), flush=True)
        time.sleep(1.05)
    json.dump(z, open(a.cache, 'w'))
    vals = [int(round(v)) if v is not None else 0 for v in z]
    raw = struct.pack(f'<{len(vals)}h', *vals)
    meta = {'rows': ROWS, 'cols': COLS, 'south': BBOX[0], 'west': BBOX[1], 'north': BBOX[2], 'east': BBOX[3], 'dlat': DLAT, 'dlon': DLON, 'stepM': STEP_M,
            'source': 'EU-DEM v1.1 (Copernicus, 25 m) via OpenTopoData', 'min': min(vals), 'max': max(vals)}
    head = "/* GÉNÉRÉ par tools/build_dem.py : relief du domaine en grille de 150 m (EU-DEM v1.1, Copernicus), pour les ombres portées. Ne pas modifier à la main. */\n"
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dem.js'), 'w').write(head + 'const DEM = ' + json.dumps({**meta, 'b64': base64.b64encode(raw).decode()}) + ";\nif (typeof module !== 'undefined') module.exports = DEM;\n")
    print('dem.js écrit', meta)
main()
