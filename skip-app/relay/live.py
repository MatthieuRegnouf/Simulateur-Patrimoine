#!/usr/bin/env python3
"""Relais SKIP : lit le flux public de l'Espace Alpe d'Huez et produit un `live.json` normalisé.

Le flux (https://live.aten-altitude.com/alpehuez/atenlive.xml, le même que celui du site skipass.alpedhuez.com)
n'autorise pas la lecture depuis un navigateur (pas d'en-tête CORS) : ce relais le lit côté serveur et le republie.
Il ne produit QUE des données présentes dans le flux. Rien n'est inventé :
  - `attente` est reprise telle quelle si l'exploitant la renseigne, sinon `waitMin` vaut null ;
  - les prévisions J+1..J+3 vides (zéros de remplissage) sont marquées `usable: false`.

Usage :  python3 relay/live.py [--xml flux.xml] [-o live.json]
"""
import argparse, json, os, re, sys, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
import import_alpe                                              # noqa: E402  (mêmes identifiants que data.js)

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo('Europe/Paris')
except Exception:                                                # pragma: no cover (tzdata absent)
    TZ = timezone.utc

SOURCE_URL = import_alpe.URL
STATES = {'Ouvert': 'open', 'Ouverture décalée': 'delayed', 'Fermeture momentanée': 'temp_closed', 'Fermé': 'closed',
          "Fermé jusqu'à demain": 'closed_today', "Hors période d'exploitation": 'off_season'}
OPEN_STATES = {'open', 'delayed'}   # « delayed » : ouverture décalée, la remontée ouvrira plus tard dans la journée


def num(v):
    try:
        return float(str(v).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def iso(local_str):
    """'13/10/2026 11:30[:15]' (heure de Paris) -> ISO 8601 avec fuseau."""
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y'):
        try:
            return datetime.strptime((local_str or '').strip(), fmt).replace(tzinfo=TZ).isoformat()
        except ValueError:
            continue
    return None


def state_of(etat, status):
    if status in STATES:
        return STATES[status]
    return {'O': 'open', 'P': 'delayed', 'F': 'closed'}.get(etat or '', 'unknown')


def zone_current(z):
    g = lambda t: (z.findtext(t) or '').strip()
    risk = num(g('VALRISQUE'))
    return {
        'id': import_alpe.slug(z.get('nom', '')), 'name': z.get('nom'), 'alt': int(num(z.get('altitude')) or 0) or None, 'updated': iso(z.get('datemaj')),
        'tempC': num(g('TEMPERATURE')), 'tempPmC': num(g('TEMPERATURE_APM')), 'feelsC': num(g('TEMPERATURE_RESSENTIE')),
        'windKmh': num(g('VENT')), 'gustKmh': num(g('RAFALES')), 'windDir': g('DIRECTION') or None, 'visibilityPct': num(g('VISIBILITE')),
        'freshSnowCm': num(g('NEIGE')), 'snowQuality': g('QUALITE_LABEL') or None, 'lastSnowfall': iso(g('DERNIERE_CHUTE')),
        'isoZeroM': int(num(g('LIMITE_ISOTHERME_0')) or 0) or None, 'skyCode': int(num(g('CIEL_ID')) or 0) or None,
        'avalancheRisk': {'level': int(risk), 'scale': 5, 'label': g('LIBRISQUE')} if risk else None,
    }


def weather(root):
    meteo = next(iter(root.iter('METEO')), None)
    out = {'zones': [], 'forecast': []}
    if meteo is None:
        return out
    for p in meteo.iter('PARAMETRES'):
        k = int(p.get('prevision') or 0)
        for z in p.iter('ZONE'):
            if k == 0:
                out['zones'].append(zone_current(z))
            else:
                g = lambda t: num((z.findtext(t) or '').strip())
                vals = [g('TEMPERATURE'), g('TEMPERATURE_APM'), g('VENT'), g('NEIGE'), g('CIEL_ID')]
                placeholder = (g('TEMPERATURE') or 0) == 0 and (g('TEMPERATURE_APM') or 0) == 0 and (g('VENT') or 0) == 0 and (g('NEIGE') or 0) == 0 and (g('CIEL_ID') or 100) == 100
                out['forecast'].append({'day': k, 'date': iso(z.get('datemaj')), 'alt': int(num(z.get('altitude')) or 0) or None,
                                        'tempMinC': g('TEMPERATURE'), 'tempMaxC': g('TEMPERATURE_APM'), 'windKmh': g('VENT'),
                                        'freshSnowCm': g('NEIGE'), 'skyCode': int(g('CIEL_ID') or 0) or None, 'usable': not placeholder and any(v is not None for v in vals)})
    return out


def indices(root):
    ind = next(iter(root.iter('INDICES')), None)
    if ind is None:
        return {}
    out = {}
    for c in ind:
        if c.get('lib'):
            out[c.tag.lower()] = {'value': num(c.get('val')), 'label': c.get('lib')}
    return out


def build(root, now=None):
    now = now or datetime.now(timezone.utc)
    st = import_alpe.build_station(root, with_live=True)
    lifts, pistes = [], []
    for l in st['lifts']:
        lv = l['_live']; stt = state_of(lv['etat'], lv['status']); w = num(lv['attente'])
        lifts.append({'id': l['id'], 'name': l['name'], 'type': l['type'], 'state': stt, 'status': lv['status'], 'hours': lv.get('hours') or l.get('hours'),
                      'waitMin': w if (w is not None and w >= 0 and lv['attente'] != '') else None})
    for p in st['pistes']:
        lv = p['_live']
        pistes.append({'id': p['id'], 'name': p['name'], 'color': p['color'], 'state': state_of(lv['etat'], lv['status']), 'status': lv['status']})
    lo = sum(1 for l in lifts if l['state'] in OPEN_STATES)
    po = sum(1 for p in pistes if p['state'] in OPEN_STATES)
    return {
        'schema': 1,
        'source': {'name': "Flux ATEN de l'Espace Alpe d'Huez", 'url': SOURCE_URL, 'feedUpdated': iso(root.findtext('DATEINFO', '')), 'fetchedAt': now.isoformat()},
        'weather': weather(root), 'indices': indices(root), 'lifts': lifts, 'pistes': pistes,
        'summary': {'liftsOpen': lo, 'liftsTotal': len(lifts), 'pistesOpen': po, 'pistesTotal': len(pistes),
                    'liftsWithWait': sum(1 for l in lifts if l['waitMin'] is not None), 'seasonOpen': lo >= 5},
    }


def fetch_root(xml_path=None):
    return import_alpe.load_root(xml_path)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--xml'); ap.add_argument('-o', '--out')
    a = ap.parse_args()
    data = build(fetch_root(a.xml))
    txt = json.dumps(data, ensure_ascii=False, indent=1)
    if a.out:
        open(a.out, 'w', encoding='utf-8').write(txt)
        print(a.out, len(txt) // 1024, 'Ko', data['summary'])
    else:
        print(txt)


if __name__ == '__main__':
    main()
