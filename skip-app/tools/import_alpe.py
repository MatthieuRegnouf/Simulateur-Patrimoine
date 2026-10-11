#!/usr/bin/env python3
"""Régénère data.js à partir du flux public de l'Espace Alpe d'Huez (ATEN).

Usage :  python3 tools/import_alpe.py [fichier.xml]
Sans argument, le flux est téléchargé depuis live.aten-altitude.com.
Le flux donne : nom, couleur, longueur, altitudes départ/arrivée des pistes ; type, durée, altitudes, débit des remontées.
Il ne donne PAS les connexions piste <-> remontée ni les durées de descente.
"""
import json, os, re, sys, unicodedata, urllib.request
import xml.etree.ElementTree as ET

URL = 'https://live.aten-altitude.com/alpehuez/atenlive.xml'
COLORS = {'V': 'green', 'B': 'blue', 'R': 'red', 'N': 'black'}
LIFT_TYPES = {'TC': 'Télécabine', 'TSD': 'Télésiège débrayable', 'TS': 'Télésiège', 'TMX': 'Télémix', 'TPH': 'Téléphérique',
              'TK': 'Téléski', 'TR': 'Tapis', 'ASC': 'Ascenseur', 'FNT': 'Remontée'}
# secteurs génériques (doublons des secteurs précis) : classés en dernier
GENERIC = {'Première Glisse', 'Débutants'}

def slug(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def num(v):
    m = re.search(r'\d+(?:[.,]\d+)?', v or '')
    return float(m.group(0).replace(',', '.')) if m and float(m.group(0).replace(',', '.')) > 0 else None

def hours(el):
    p = el.find('PLAGES/PLAGE')
    return f"{p.get('heuredeb')} - {p.get('heurefin')}" if p is not None and p.get('heuredeb') else None

def load_root(path=None):
    raw = open(path, 'rb').read() if path else urllib.request.urlopen(URL, timeout=60).read()
    return ET.fromstring(raw)

def build_station(root):
    sectors = {}
    for s in root.iter('SECTEUR'):
        parts = [p.strip() for p in re.split(r'<br\s*/>', s.get('nom')) if p.strip()]
        sectors[s.get('sct_id')] = ' · '.join(parts)
    pistes, lifts = {}, {}
    for p in root.iter('PISTE'):
        a = p.attrib
        if a['type'] != 'A' or a['niveau'] not in COLORS:
            continue
        name = a['nom'].strip()
        km = num(a.get('longueur')); km = round(km / 1000, 2) if km else None
        d, r = num(a.get('alt_depart')), num(a.get('alt_arrivee'))
        key = (name.lower(), a['niveau'], d, r)
        e = pistes.setdefault(key, {'name': name, 'color': COLORS[a['niveau']], 'km': km, 'altFrom': int(d) if d else None,
                                    'altTo': int(r) if r else None, 'denivele': int(num(a.get('denivele')) or 0) or None, 'hours': hours(p), 'sectors': []})
        if a['sct_id'] not in e['sectors']:
            e['sectors'].append(a['sct_id'])
    for l in root.iter('REMONTEE'):
        a = l.attrib
        if a['type'] not in LIFT_TYPES:
            continue
        d, r, m = num(a.get('alt_depart')), num(a.get('alt_arrivee')), num(a.get('duree'))
        key = (a['nom'].strip().lower(), a['type'], d, r)
        e = lifts.setdefault(key, {'name': a['nom'].strip(), 'type': LIFT_TYPES[a['type']], 'altFrom': int(d) if d else None,
                                   'altTo': int(r) if r else None, 'min': m, 'debit': int(num(a.get('debit')) or 0) or None,
                                   'denivele': int(num(a.get('denivele')) or 0) or None, 'hours': hours(l), 'sectors': []})
        if a['sct_id'] not in e['sectors']:
            e['sectors'].append(a['sct_id'])
    def order(sids):
        return sorted(sids, key=lambda s: (sectors[s].split(' · ')[-1] in GENERIC, sectors[s]))
    notes = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'official_notes.json'), encoding='utf-8'))
    out_p, seen = [], {}
    for e in sorted(pistes.values(), key=lambda e: (e['color'], e['name'].lower())):
        e['sectors'] = order(e['sectors'])
        base = slug(e['name']) + '-' + e['color']; seen[base] = seen.get(base, 0) + 1
        e['id'] = base if seen[base] == 1 else f"{base}-{seen[base]}"
        n = notes.get(e['name'].lower() + '|' + e['color'])
        if n:
            e['official'] = n['stats']; e['info'] = n['info']
            if not e['km'] and n.get('km'): e['km'] = n['km']
        out_p.append(e)
    out_l, seen = [], {}
    for e in sorted(lifts.values(), key=lambda e: e['name'].lower()):
        e['sectors'] = order(e['sectors'])
        base = 'l-' + slug(e['name']); seen[base] = seen.get(base, 0) + 1
        e['id'] = base if seen[base] == 1 else f"{base}-{seen[base]}"
        out_l.append(e)
    used = {s for e in out_p + out_l for s in e['sectors']}
    station = {'id': 'alpe', 'name': "Espace Alpe d'Huez", 'updated': root.findtext('DATEINFO', '').strip(),
               'site': {'km': 250, 'pistes': 111, 'colors': {'green': 34, 'blue': 31, 'red': 30, 'black': 16}, 'min': 1300, 'max': 3330},
               'sectors': {s: sectors[s] for s in sorted(used, key=lambda s: sectors[s])}, 'lifts': out_l, 'pistes': out_p}
    return station

def main():
    station = build_station(load_root(sys.argv[1] if len(sys.argv) > 1 else None))
    out_p, out_l = station['pistes'], station['lifts']
    head = """/* Données de l'Espace Alpe d'Huez : GÉNÉRÉ par tools/import_alpe.py, ne pas modifier à la main.
   Source : flux public ATEN de l'Espace Alpe d'Huez (live.aten-altitude.com/alpehuez), repris du site skipass.alpedhuez.com.
   Contient nom, couleur, longueur et altitudes des pistes ; type, durée, altitudes et débit des remontées.
   Complété par tools/official_notes.json (page officielle « Les pistes mythiques »).
   Ne contient pas : les connexions piste <-> remontée, les durées de descente, ni aucune note ou vote.
   Les notes et coups de cœur démarrent à zéro : seule la communauté les remplit. */
"""
    js = head + 'const DATA = { stations: { alpe: ' + json.dumps(station, ensure_ascii=False, indent=1) + ' } };\nif (typeof module !== \'undefined\') module.exports = DATA;\n'
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data.js'), 'w', encoding='utf-8').write(js)
    c = {}
    for e in out_p: c[e['color']] = c.get(e['color'], 0) + 1
    print(len(out_p), 'pistes', c, '|', len(out_l), 'remontées |', len(station['sectors']), 'secteurs |', station['updated'])

if __name__ == '__main__':
    main()
