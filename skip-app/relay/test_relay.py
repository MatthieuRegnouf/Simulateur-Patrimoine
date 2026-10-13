"""Tests du relais : python3 -m unittest relay.test_relay  (depuis le dossier skip-app)"""
import json, os, sys, threading, unittest, urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import live, server  # noqa: E402

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'atenlive-sample.xml')


class Normalisation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = live.build(live.fetch_root(FIX))

    def test_structure(self):
        for k in ('schema', 'source', 'weather', 'indices', 'lifts', 'pistes', 'summary'):
            self.assertIn(k, self.d)
        self.assertTrue(self.d['source']['feedUpdated'].endswith(('+01:00', '+02:00', '+00:00')))

    def test_ids_identiques_a_data_js(self):
        ids = {l['id'] for l in self.d['lifts']}
        self.assertIn('l-lievre-blanc', ids)
        self.assertTrue(any(p['id'] == 'sarenne-black' for p in self.d['pistes']))

    def test_etats(self):
        by = {l['name']: l for l in self.d['lifts']}
        self.assertEqual(by['Lièvre Blanc']['state'], 'open')
        self.assertEqual(by['Herpie']['state'], 'closed_today')

    def test_attente_jamais_inventee(self):
        self.assertTrue(all(l['waitMin'] is None for l in self.d['lifts']))   # le flux ne renseigne aucune attente aujourd'hui

    def test_previsions_vides_signalees(self):
        fc = {f['day']: f for f in self.d['weather']['forecast']}
        self.assertTrue(fc[1]['usable']); self.assertFalse(fc[2]['usable'])

    def test_risque_avalanche(self):
        pb = next(z for z in self.d['weather']['zones'] if z['id'] == 'pic-blanc')
        self.assertEqual(pb['avalancheRisk'], {'level': 2, 'scale': 5, 'label': 'Limité'})


class Serveur(unittest.TestCase):
    def test_http_cors_cache_et_stale(self):
        rel = server.Relay(ttl=0, xml=FIX)
        srv = ThreadingHTTPServer(('127.0.0.1', 0), server.handler(rel, 'https://appli.test')); port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            r = urllib.request.urlopen(f'http://127.0.0.1:{port}/live.json')
            self.assertEqual(r.headers['Access-Control-Allow-Origin'], 'https://appli.test')
            self.assertEqual(json.loads(r.read())['schema'], 1)
            self.assertTrue(json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/health').read())['ok'])
            rel.xml = '/inexistant.xml'                                  # amont indisponible : dernière version servie, marquée périmée
            r2 = urllib.request.urlopen(f'http://127.0.0.1:{port}/live.json')
            self.assertEqual(r2.headers['X-Relay-Stale'], '1'); self.assertTrue(json.loads(r2.read())['stale'])
            with self.assertRaises(urllib.error.HTTPError) as cm: urllib.request.urlopen(f'http://127.0.0.1:{port}/autre')
            self.assertEqual(cm.exception.code, 404)
            req = urllib.request.Request(f'http://127.0.0.1:{port}/push/subscribe', data=b'{}', method='POST')
            with self.assertRaises(urllib.error.HTTPError) as cm2: urllib.request.urlopen(req)
            self.assertEqual(cm2.exception.code, 501)   # Web Push non configuré : réponse explicite, pas de faux succès
        finally:
            srv.shutdown()


if __name__ == '__main__':
    unittest.main()
