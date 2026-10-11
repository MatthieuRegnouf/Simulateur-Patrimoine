#!/usr/bin/env python3
"""Construit graph.js : le réseau pistes / remontées / liaisons / chemins à pied de l'Espace Alpe d'Huez.

Sources
  - OpenStreetMap (© contributeurs OpenStreetMap, licence ODbL) : tracés, jonctions, chemins piétons.
  - Flux officiel de l'Espace Alpe d'Huez (via import_alpe.py) : noms, couleurs, durées des remontées.
  - OpenTopoData / EU-DEM 25 m : altitude des jonctions (sert à orienter pistes et remontées).

Usage : python3 tools/build_graph.py [--cache DOSSIER] [--xml flux.xml]
Le dossier de cache (défaut : tools/.cache) évite de relancer les requêtes réseau.
"""
import argparse, heapq, json, math, os, re, sys, time, unicodedata, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_alpe

HERE = os.path.dirname(os.path.abspath(__file__))
# Zone interrogée, en deux morceaux (le serveur Overpass refuse les requêtes trop grosses) : sud, ouest, nord, est
BBOXES = [(45.02, 5.98, 45.15, 6.22), (45.15, 5.98, 45.21, 6.22)]
MIRRORS = ['https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
LIFT_TYPES = {'gondola', 'chair_lift', 'mixed_lift', 'cable_car', 'platter', 'magic_carpet', 'rope_tow', 'drag_lift', 't-bar', 'j-bar'}
DIFF_COLOR = {'novice': 'green', 'easy': 'blue', 'intermediate': 'red', 'advanced': 'black', 'expert': 'black'}
WALK_HW = {'footway', 'path', 'pedestrian', 'steps', 'living_street', 'residential', 'service', 'unclassified', 'tertiary', 'track'}
OFF_TYPE = {'gondola': ('Télécabine', 'Télémix'), 'mixed_lift': ('Télémix', 'Télécabine'), 'chair_lift': ('Télésiège', 'Télésiège débrayable', 'Télémix'),
            'cable_car': ('Téléphérique', 'Remontée'), 'platter': ('Téléski',), 'drag_lift': ('Téléski',), 't-bar': ('Téléski',), 'j-bar': ('Téléski',),
            'rope_tow': ('Téléski', 'Tapis'), 'magic_carpet': ('Tapis',)}
LIFT_MS = {'gondola': 5.0, 'chair_lift': 3.5, 'mixed_lift': 4.5, 'cable_car': 8.0, 'platter': 2.5, 'magic_carpet': 0.7, 'rope_tow': 1.5, 'drag_lift': 2.5, 't-bar': 2.5, 'j-bar': 2.5}

def hav(a, b):
    r = math.pi / 180
    x = math.sin((b[0] - a[0]) * r / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin((b[1] - a[1]) * r / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(x))

def norm(s):
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
    s = re.sub(r"\b(piste|pistes|le|la|les|l|du|de|des|d|tc|ts|tsd|tk|tkf|tph|tmx|tapis|telecabine|telesiege|teleski)\b", ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def overpass(q, tries=12):
    data = urllib.parse.urlencode({'data': q}).encode()
    for i in range(tries):
        try:
            j = json.loads(urllib.request.urlopen(urllib.request.Request(MIRRORS[i % 2], data), timeout=170).read())
            if 'elements' in j: return j
        except Exception as e:
            print('  overpass retry', i, str(e)[:50], file=sys.stderr)
        time.sleep(3)
    raise SystemExit('Overpass indisponible')

def cached(path, fn):
    if os.path.exists(path): return json.load(open(path, encoding='utf-8'))
    v = fn(); json.dump(v, open(path, 'w', encoding='utf-8')); return v

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; best, bi = 0, 0
    for i in range(1, len(pts) - 1):
        # distance approx. en mètres du point au segment [a,b]
        ax, ay = 0, 0; bx = (b[1] - a[1]) * 111320 * math.cos(math.radians(a[0])); by = (b[0] - a[0]) * 110540
        px = (pts[i][1] - a[1]) * 111320 * math.cos(math.radians(a[0])); py = (pts[i][0] - a[0]) * 110540
        L = bx * bx + by * by
        t = 0 if L == 0 else max(0, min(1, (px * bx + py * by) / L))
        d = math.hypot(px - t * bx, py - t * by)
        if d > best: best, bi = d, i
    if best <= eps: return [a, b]
    return rdp(pts[:bi + 1], eps)[:-1] + rdp(pts[bi:], eps)

def encode(pts):
    out, pl, pg = [], 0, 0
    for la, lo in pts:
        la, lo = round(la * 1e5), round(lo * 1e5)
        out += [la - pl, lo - pg]; pl, pg = la, lo
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--cache', default=os.path.join(HERE, '.cache')); ap.add_argument('--xml')
    args = ap.parse_args(); os.makedirs(args.cache, exist_ok=True)
    official = import_alpe.build_station(import_alpe.load_root(args.xml))
    aliases = json.load(open(os.path.join(HERE, 'aliases.json'), encoding='utf-8'))

    # 1. OpenStreetMap : pistes, liaisons, remontées + nœuds
    N, ways, stamp = {}, {}, ''
    for i, box in enumerate(BBOXES):
        bb = ','.join(map(str, box))
        part = cached(os.path.join(args.cache, f'osm_{i}.json'), lambda: overpass(
            f'[out:json][timeout:150];(way["piste:type"~"^(downhill|connection)$"]({bb});way["aerialway"]({bb}););out body;>;out skel qt;'))
        stamp = stamp or part.get('osm3s', {}).get('timestamp_osm_base', '')
        for e in part['elements']:
            if e['type'] == 'node': N[e['id']] = (e['lat'], e['lon'])
            elif e['type'] == 'way': ways[e['id']] = e
    sel = []
    for w in ways.values():
        t = w['tags']
        if 'abandoned' in t or 'disused' in t or any(k.startswith('disused:') or k.startswith('abandoned:') for k in t): continue
        if t.get('aerialway') in LIFT_TYPES: k = 'lift'
        elif t.get('piste:type') == 'downhill' and t.get('piste:difficulty') in DIFF_COLOR: k = 'piste'
        elif t.get('piste:type') == 'downhill' and not t.get('piste:difficulty') and (t.get('piste:name') or t.get('name')): k = 'piste?'
        elif t.get('piste:type') == 'connection': k = 'link'
        else: continue
        if any(n not in N for n in w['nodes']): continue
        sel.append((k, w))

    # 2. découpage aux jonctions
    cnt = {}
    for _, w in sel:
        for n in set(w['nodes']): cnt[n] = cnt.get(n, 0) + 1
    segs = []
    for k, w in sel:
        ns, cut = w['nodes'], [0]
        for i in range(1, len(ns) - 1):
            if cnt[ns[i]] >= 2 and ns[i] != ns[0]: cut.append(i)
        cut.append(len(ns) - 1)
        for j in range(len(cut) - 1):
            part = ns[cut[j]:cut[j + 1] + 1]
            if len(part) >= 2 and part[0] != part[-1]:
                segs.append({'k': k, 'w': w, 'ns': part, 'i': j})

    # 3. rapprochement avec les données officielles (nom normalisé + alias)
    off_p, off_l = {}, {}
    for p in official['pistes']: off_p.setdefault(norm(p['name']), []).append(p)
    for l in official['lifts']: off_l.setdefault(norm(l['name']), []).append(l)
    used_off = set()
    def match(seg):
        t = seg['w']['tags']; nm = norm(t.get('piste:name') or t.get('name') or '')
        nm = aliases.get('pistes' if seg['k'] != 'lift' else 'lifts', {}).get(nm, nm)
        pool = (off_l if seg['k'] == 'lift' else off_p).get(nm)
        if not pool: return None
        if seg['k'] == 'lift':
            want = OFF_TYPE.get(t.get('aerialway'), ())
            return next((l for l in pool if l['type'] in want), None)   # un type différent n'est jamais rapproché
        col = DIFF_COLOR.get(t.get('piste:difficulty'))
        return next((p for p in pool if p['color'] == col), pool[0])
    for s in segs:
        s['off'] = match(s) if s['k'] != 'link' else None
        if s['k'] == 'piste?' and not s['off']: s['k'] = None
    segs = [s for s in segs if s['k']]
    for s in segs: s['k'] = 'piste' if s['k'] == 'piste?' else s['k']

    # 4. nœuds du graphe + chemins à pied
    deg = {}
    for s in segs:
        for n in (s['ns'][0], s['ns'][-1]): deg[n] = deg.get(n, 0) + 1
    terminals = [n for n, d in deg.items() if d == 1]
    walk_q = '[out:json][timeout:150];(' + ''.join(
        f'way["highway"~"^({"|".join(sorted(WALK_HW))})$"]({N[n][0]-0.0035:.5f},{N[n][1]-0.005:.5f},{N[n][0]+0.0035:.5f},{N[n][1]+0.005:.5f});' for n in terminals) + ');out body;>;out skel qt;'
    walk = cached(os.path.join(args.cache, 'walk.json'), lambda: overpass(walk_q))
    WN = {e['id']: (e['lat'], e['lon']) for e in walk['elements'] if e['type'] == 'node'}
    adj = {}
    for w in (e for e in walk['elements'] if e['type'] == 'way'):
        t = w['tags']
        if t.get('access') in ('private', 'no') or t.get('foot') == 'no' or t.get('highway') not in WALK_HW or t.get('piste:type'): continue
        for a, b in zip(w['nodes'], w['nodes'][1:]):
            if a in WN and b in WN:
                d = hav(WN[a], WN[b]); adj.setdefault(a, []).append((b, d)); adj.setdefault(b, []).append((a, d))
    wnodes = list(adj)
    def snap(p, r=70):
        best, bd = None, r
        for n in wnodes:
            d = hav(p, WN[n])
            if d < bd: best, bd = n, d
        return best, bd
    links = {}
    SN = {t: snap(N[t]) for t in terminals}   # accroche de chaque point terminal au réseau piéton (calculée une fois)
    for t in terminals:
        pt = N[t]; s0, d0 = SN[t]
        reach = {}
        if s0 is not None:
            dist, prev, pq = {s0: 0}, {}, [(0, s0)]
            while pq:
                d, u = heapq.heappop(pq)
                if d > dist[u] or d > 900: continue
                for v, w in adj[u]:
                    if d + w < dist.get(v, 1e9): dist[v] = d + w; prev[v] = u; heapq.heappush(pq, (d + w, v))
            snaps = {}
            for u in terminals:
                if u == t: continue
                su, du = SN[u]
                if su is not None and su in dist: snaps[u] = (dist[su] + d0 + du, su)
            for u, (d, su) in snaps.items():
                path, x = [su], su
                while x != s0: x = prev[x]; path.append(x)
                reach[u] = (d, [pt] + [WN[x] for x in reversed(path)] + [N[u]])
        for u in terminals:
            if u != t and hav(pt, N[u]) <= 60 and u not in reach: reach[u] = (hav(pt, N[u]), [pt, N[u]])
        for u, (d, geom) in sorted(reach.items(), key=lambda x: x[1][0])[:5]:
            key = tuple(sorted((t, u)))
            if key not in links or links[key][0] > d: links[key] = (d, geom if t < u else geom[::-1])

    # 5. altitudes (OpenTopoData EU-DEM) pour tous les nœuds utilisés
    used = set(); [used.update((s['ns'][0], s['ns'][-1])) for s in segs]; [used.update(k) for k in links]
    ids = sorted(used)
    def fetch_elev():
        out = {}
        for i in range(0, len(ids), 100):
            chunk = ids[i:i + 100]
            loc = '|'.join(f'{N[n][0]:.5f},{N[n][1]:.5f}' for n in chunk)
            for attempt in range(6):
                try:
                    j = json.loads(urllib.request.urlopen('https://api.opentopodata.org/v1/eudem25m?locations=' + urllib.parse.quote(loc, safe=',|'), timeout=60).read())
                    for n, r in zip(chunk, j['results']): out[str(n)] = r['elevation']
                    break
                except Exception as e:
                    print('  elev retry', attempt, str(e)[:50], file=sys.stderr); time.sleep(3)
            else: raise SystemExit('Altitudes indisponibles')
            time.sleep(1.2)
        return out
    ELEV = cached(os.path.join(args.cache, 'elev.json'), fetch_elev)
    alt = lambda n: ELEV.get(str(n))

    # 6. arêtes finales
    nodes, nid = [], {}
    def node(n):
        if n not in nid: nid[n] = len(nodes); nodes.append([round(N[n][0], 5), round(N[n][1], 5), round(alt(n) or 0), 0])
        return nid[n]
    edges, flipped, lens = [], 0, {}
    for s in segs:
        pts = [N[n] for n in s['ns']]; ns = s['ns']
        L = sum(hav(a, b) for a, b in zip(pts, pts[1:])); s['L'] = L
        key = id(s['off']) if s['off'] else None
        if s['off']: lens[(s['k'], s['off']['id'])] = lens.get((s['k'], s['off']['id']), 0) + L
    for s in segs:
        ns = s['ns']; pts = [N[n] for n in ns]; t = s['w']['tags']; k = s['k']
        a0, a1 = alt(ns[0]), alt(ns[-1])
        if k in ('piste', 'lift') and a0 is not None and a1 is not None and abs(a0 - a1) > 20 and ((a0 < a1) if k == 'piste' else (a0 > a1)):
            ns, pts = ns[::-1], pts[::-1]; flipped += 1
        o = s['off']; name = o['name'] if o else (t.get('piste:name') or t.get('name') or '')
        e = {'k': k, 'a': node(ns[0]), 'b': node(ns[-1]), 'n': name, 'm': round(s['L']), 'g': encode(rdp(pts, 14))}
        if k == 'piste': e['c'] = o['color'] if o else DIFF_COLOR.get(t.get('piste:difficulty'), 'blue')
        if k == 'lift':
            tot = lens.get(('lift', o['id']), 0) if o else 0
            if o and o.get('min') and tot: e['t'] = round(o['min'] * s['L'] / tot, 1)
            elif t.get('aerialway:duration') and t['aerialway:duration'].isdigit(): e['t'] = int(t['aerialway:duration'])
            else: e['t'] = round(s['L'] / LIFT_MS.get(t.get('aerialway'), 3) / 60 + 1, 1)
            e['y'] = t.get('aerialway')
        if o: e['o'] = o['id']
        if t.get('piste:oneway') == 'no' and k == 'link': e['bi'] = 1
        edges.append(e)
    for (u, v), (d, geom) in links.items():
        edges.append({'k': 'walk', 'a': node(u), 'b': node(v), 'n': '', 'm': round(d), 'g': encode(rdp(geom, 14))})

    # 6a. fusion des tronçons en chaîne : un nœud touché par exactement deux arêtes de même nature (a->x, x->b) disparaît
    def decode(g):
        out, la, lo = [], 0, 0
        for i in range(0, len(g), 2): la += g[i]; lo += g[i + 1]; out.append((la / 1e5, lo / 1e5))
        return out
    merged = True
    while merged:
        merged = False
        inc = {}
        for i, e in enumerate(edges): inc.setdefault(e['a'], []).append(i); inc.setdefault(e['b'], []).append(i)
        for x, l in inc.items():
            if len(l) != 2 or l[0] == l[1]: continue
            e1, e2 = edges[l[0]], edges[l[1]]
            if e1['b'] != x or e2['a'] != x or e1['a'] == e2['b']: continue
            if e1['k'] != e2['k'] or e1['k'] in ('walk', 'link') or e1.get('c') != e2.get('c') or (e1['n'] != e2['n'] and e1['n'] and e2['n']): continue
            m = dict(e1); m['b'] = e2['b']; m['m'] = e1['m'] + e2['m']; m['n'] = e1['n'] or e2['n']
            m['g'] = encode(rdp(decode(e1['g']) + decode(e2['g'])[1:], 14))
            if 't' in e1: m['t'] = round(e1['t'] + e2['t'], 1)
            if e1.get('o') != e2.get('o'): m['o'] = e1.get('o') or e2.get('o')
            edges[l[0]] = m; edges[l[1]] = None; edges = [e for e in edges if e]; merged = True; break

    # 6b. noms des points : arrivée/départ des remontées, fin de piste
    for e in edges:
        a, b = nodes[e['a']], nodes[e['b']]
        if e['k'] == 'lift' and e['n']:
            if not a[3]: a[3] = 'Départ ' + e['n']
            if not b[3]: b[3] = 'Arrivée ' + e['n']
    for e in edges:
        if e['k'] == 'piste' and e['n'] and not nodes[e['b']][3]: nodes[e['b']][3] = 'Bas de ' + e['n']
    for n in nodes:
        if not n[3]: n[3] = ''

    # 7. rapport de couverture
    got_p = {e['o'] for e in edges if e['k'] == 'piste' and 'o' in e}; got_l = {e['o'] for e in edges if e['k'] == 'lift' and 'o' in e}
    print(f"OSM {stamp} | {len(nodes)} nœuds, {len(edges)} arêtes : "
          + ', '.join(f"{k} {sum(1 for e in edges if e['k'] == k)}" for k in ('piste', 'lift', 'link', 'walk')) + f" | {flipped} arêtes réorientées")
    print(f"pistes officielles couvertes : {len(got_p)}/{len(official['pistes'])} | remontées : {len(got_l)}/{len(official['lifts'])}")
    miss_p = [p['name'] for p in official['pistes'] if p['id'] not in got_p]; miss_l = [l['name'] for l in official['lifts'] if l['id'] not in got_l]
    print('pistes sans tracé :', miss_p); print('remontées sans tracé :', miss_l)
    graph = {'osm': stamp[:10], 'nodes': nodes, 'edges': edges, 'missing': {'pistes': miss_p, 'lifts': miss_l}}
    head = ("/* Réseau pistes / remontées / liaisons / chemins à pied : GÉNÉRÉ par tools/build_graph.py.\n"
            "   Tracés et jonctions : © contributeurs OpenStreetMap (ODbL). Noms, couleurs, durées : flux officiel Espace Alpe d'Huez.\n"
            "   Altitudes des jonctions : EU-DEM 25 m via OpenTopoData. Liaisons : déduites des tracés, à vérifier sur le plan officiel. */\n")
    open(os.path.join(HERE, '..', 'graph.js'), 'w', encoding='utf-8').write(
        head + 'const GRAPH = ' + json.dumps(graph, ensure_ascii=False, separators=(',', ':')) + ';\nif (typeof module !== \'undefined\') module.exports = GRAPH;\n')

if __name__ == '__main__':
    main()
