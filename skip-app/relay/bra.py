#!/usr/bin/env python3
"""Relais SKIP : bulletin d'estimation du risque d'avalanche (BRA) de Météo-France, normalisé en `bra.json`.

Source : API « DonneesPubliquesBRA » (https://public-api.meteofrance.fr/public/DPBRA/v1), fiche : https://www.data.gouv.fr/dataservices/api-bulletin-avalanche
Une clé d'API est nécessaire : elle se lit UNIQUEMENT dans la variable d'environnement METEOFRANCE_BRA_KEY (jamais dans un fichier du dépôt, jamais affichée, jamais envoyée au navigateur).
Le massif par défaut est « Grandes-Rousses » (identifiant 12), qui contient Alpe d'Huez, Oz et Vaujany (vérifié avec les polygones officiels de /liste-massifs).

Ce module ne produit QUE ce que le bulletin contient. Hors saison, l'API renvoie un simple message : on le relaie tel quel (state = off_season).
Le bulletin est une information GÉNÉRALE sur un massif entier ; il ne dit rien d'un itinéraire précis.

Usage :  METEOFRANCE_BRA_KEY=... python3 relay/bra.py [--massif 12] [--xml bulletin.xml] [-o bra.json]
"""
import argparse, json, os, sys, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

BASE = 'https://public-api.meteofrance.fr/public/DPBRA/v1'
MASSIF = 12
MASSIF_NAMES = {12: 'Grandes-Rousses', 15: 'Oisans'}
LABELS = {1: 'faible', 2: 'limité', 3: 'marqué', 4: 'fort', 5: 'très fort'}   # échelle européenne du risque d'avalanche
DIRS = ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW')


def fetch(massif=MASSIF, key=None):
    key = key or os.environ.get('METEOFRANCE_BRA_KEY')
    if not key:
        raise RuntimeError('clé METEOFRANCE_BRA_KEY absente')
    req = urllib.request.Request(f'{BASE}/massif/BRA?id-massif={massif}&format=xml', headers={'apikey': key, 'accept': 'application/xml'})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read(), r.headers.get('Last-Modified')


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _txt(el, path):
    x = el.find(path)
    return (x.text or '').strip() if x is not None and x.text else ''


def parse(raw, massif=MASSIF, fetched_at=None, last_modified=None):
    """Transforme le XML en dictionnaire normalisé. Jamais d'exception pour un contenu inattendu : state = unavailable."""
    now = fetched_at or datetime.now(timezone.utc).isoformat(timespec='seconds')
    out = {'schema': 1, 'massif': {'id': massif, 'name': MASSIF_NAMES.get(massif, f'massif {massif}')},
           'source': {'name': 'Météo-France, bulletin d\'estimation du risque d\'avalanche (BRA)', 'url': 'https://www.data.gouv.fr/dataservices/api-bulletin-avalanche', 'fetchedAt': now, 'lastModified': last_modified}}
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return {**out, 'state': 'unavailable', 'message': 'Bulletin illisible.'}
    if root.tag == 'message':                                                    # hors saison : l'API renvoie un message seul
        return {**out, 'state': 'off_season', 'message': (root.text or '').strip()}
    if root.tag != 'BULLETINS_NEIGE_AVALANCHE':
        return {**out, 'state': 'unavailable', 'message': 'Format de bulletin inattendu.'}
    r = root.find('CARTOUCHERISQUE/RISQUE')
    if r is None or _int(r.get('RISQUE1')) is None:
        return {**out, 'state': 'unavailable', 'message': 'Le bulletin ne contient pas de niveau de risque.'}
    r1, r2, mx = _int(r.get('RISQUE1')), _int(r.get('RISQUE2')), _int(r.get('RISQUEMAXI'))
    pente = root.find('CARTOUCHERISQUE/PENTE')
    slopes = {d: (pente.get(d) == 'true') for d in DIRS} if pente is not None else {}
    fresh = root.find('NEIGEFRAICHE')
    out.update({
        'state': 'bulletin', 'issuedAt': root.get('DATEBULLETIN'), 'validUntil': root.get('DATEVALIDITE') or root.get('DATEECHEANCE'),
        'amended': root.get('AMENDEMENT') == 'true',
        'risk': {'max': mx or max(x for x in (r1, r2) if x), 'r1': r1, 'r2': r2, 'loc1': r.get('LOC1') or '', 'loc2': r.get('LOC2') or '', 'altitude': _int(r.get('ALTITUDE')),
                 'comment': r.get('COMMENTAIRE') or '', 'label': LABELS.get(mx or r1, ''), 'j2': {'label': _txt(root, 'CARTOUCHERISQUE/RisqueJ2'), 'comment': _txt(root, 'CARTOUCHERISQUE/CommentaireRisqueJ2')}},
        'warning': _txt(root, 'CARTOUCHERISQUE/AVIS'),
        'slopes': slopes, 'slopesComment': (pente.get('COMMENTAIRE') if pente is not None else '') or '',
        'summary': _txt(root, 'CARTOUCHERISQUE/RESUME') or (_txt(root, 'CARTOUCHERISQUE/ACCIDENTEL')),
        'stability': _txt(root, 'STABILITE/TEXTE'), 'quality': _txt(root, 'QUALITE/TEXTE'),
        'freshSnow': {'altitude': _int(fresh.get('ALTITUDESS')), 'days': [{'date': n.get('DATE'), 'min': _int(n.get('SS24Min')), 'max': _int(n.get('SS24Max'))} for n in fresh.findall('NEIGE24H')]} if fresh is not None else None,
    })
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--massif', type=int, default=MASSIF); ap.add_argument('--xml'); ap.add_argument('-o')
    a = ap.parse_args()
    if a.xml:
        raw, lm = open(a.xml, 'rb').read(), None
    else:
        raw, lm = fetch(a.massif)
    js = json.dumps(parse(raw, a.massif, last_modified=lm), ensure_ascii=False, indent=1)
    (open(a.o, 'w', encoding='utf-8').write(js + '\n') if a.o else print(js))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:                                   # pragma: no cover
        print('erreur :', type(e).__name__, e, file=sys.stderr); sys.exit(1)
