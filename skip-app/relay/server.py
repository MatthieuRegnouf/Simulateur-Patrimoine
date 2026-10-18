#!/usr/bin/env python3
"""Petit serveur relais (bibliothèque standard uniquement) : GET /live.json, GET /bra.json (bulletin avalanche), GET /health.

    python3 relay/server.py --port 8788 [--origin https://mon-appli.example] [--ttl 120] [--xml flux.xml]

- Une seule source en amont (fixée dans le code) : aucun paramètre du client n'est utilisé pour construire une requête.
- Cache de --ttl secondes : le flux amont est lu au plus une fois par période, quel que soit le nombre de clients.
- Si le flux amont est injoignable, la dernière version est servie avec "stale": true (et l'en-tête X-Relay-Stale: 1).
- CORS : l'origine autorisée est celle donnée par --origin (défaut « * », à restreindre en production).
"""
import argparse, json, sys, threading, time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import live, bra


class Relay:
    def __init__(self, ttl, xml=None):
        self.ttl, self.xml, self.lock, self.data, self.at = ttl, xml, threading.Lock(), None, 0

    def get(self):
        with self.lock:
            if self.data and time.time() - self.at < self.ttl:
                return self.data, False
            try:
                self.data = json.dumps(live.build(live.fetch_root(self.xml)), ensure_ascii=False).encode('utf-8'); self.at = time.time()
                return self.data, False
            except Exception as e:                       # amont injoignable : on sert la dernière version connue
                print('amont indisponible :', e, file=sys.stderr)
                if self.data:
                    d = json.loads(self.data); d['stale'] = True
                    return json.dumps(d, ensure_ascii=False).encode('utf-8'), True
                return None, True


class BraRelay:
    """Bulletin d'avalanche : la clé d'API est lue dans METEOFRANCE_BRA_KEY (jamais journalisée). Cache de 30 min ; dernière version servie (stale) si l'amont est injoignable."""
    def __init__(self, ttl=1800, xml=None, massif=bra.MASSIF):
        self.ttl, self.xml, self.massif, self.lock, self.data, self.at = ttl, xml, massif, threading.Lock(), None, 0

    def get(self):
        with self.lock:
            if self.data and time.time() - self.at < self.ttl:
                return self.data, False
            try:
                raw, lm = (open(self.xml, 'rb').read(), None) if self.xml else bra.fetch(self.massif)
                self.data = json.dumps(bra.parse(raw, self.massif, last_modified=lm), ensure_ascii=False).encode('utf-8'); self.at = time.time()
                return self.data, False
            except Exception as e:
                print('bulletin avalanche indisponible :', type(e).__name__, file=sys.stderr)   # le message peut citer l'URL, jamais la clé
                if self.data:
                    d = json.loads(self.data); d['stale'] = True
                    return json.dumps(d, ensure_ascii=False).encode('utf-8'), True
                return None, True


def handler(relay, origin, brarelay=None):
    class H(BaseHTTPRequestHandler):
        def _send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
            self.send_response(code)
            self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', origin); self.send_header('Vary', 'Origin')
            self.send_header('Cache-Control', 'public, max-age=60')
            for k, v in (extra or {}).items(): self.send_header(k, v)
            self.end_headers(); self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204); self.send_header('Access-Control-Allow-Origin', origin); self.send_header('Access-Control-Allow-Methods', 'GET, POST'); self.send_header('Access-Control-Allow-Headers', 'Content-Type'); self.end_headers()

        def do_POST(self):
            if self.path.split('?')[0] == '/push/subscribe':   # contrat préparé, non implémenté : il faut des clés VAPID et un service d'envoi (voir README)
                return self._send(501, json.dumps({'error': 'Web Push non configuré', 'see': 'relay/README.md#notifications-poussées'}).encode())
            self._send(404, json.dumps({'error': 'introuvable'}).encode())

        def do_GET(self):
            path = self.path.split('?')[0]
            if path == '/health':
                return self._send(200, json.dumps({'ok': True, 'at': datetime.now(timezone.utc).isoformat()}).encode())
            if path == '/bra.json':
                body, stale = (brarelay or BraRelay()).get()
                if body is None:
                    return self._send(502, json.dumps({'error': 'bulletin avalanche indisponible'}).encode())
                return self._send(200, body, extra={'X-Relay-Stale': '1'} if stale else None)
            if path in ('/live.json', '/'):
                body, stale = relay.get()
                if body is None:
                    return self._send(502, json.dumps({'error': 'source indisponible'}).encode())
                return self._send(200, body, extra={'X-Relay-Stale': '1'} if stale else None)
            self._send(404, json.dumps({'error': 'introuvable'}).encode())

        def log_message(self, *a):
            pass
    return H


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--port', type=int, default=8788); ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--origin', default='*'); ap.add_argument('--ttl', type=int, default=120); ap.add_argument('--xml'); ap.add_argument('--bra-xml', help='bulletin avalanche local (tests)'); ap.add_argument('--bra-massif', type=int, default=bra.MASSIF)
    a = ap.parse_args()
    srv = ThreadingHTTPServer((a.host, a.port), handler(Relay(a.ttl, a.xml), a.origin, BraRelay(xml=a.bra_xml, massif=a.bra_massif)))
    print(f'Relais SKIP sur http://{a.host}:{a.port}/live.json (cache {a.ttl} s, origine {a.origin})')
    srv.serve_forever()


if __name__ == '__main__':
    main()
