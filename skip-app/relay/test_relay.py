"""Tests du relais : python3 -m unittest relay.test_relay  (depuis le dossier skip-app)"""
import json, os, sys, threading, unittest, urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import live, server, bra  # noqa: E402

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


class Avalanche(unittest.TestCase):
    FIXD = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')

    def parse(self, name):
        return bra.parse(open(os.path.join(self.FIXD, name), 'rb').read(), 12, fetched_at='2026-02-01T15:00:00+00:00')

    def test_bulletin_en_saison(self):
        d = self.parse('bra-sample.xml')
        self.assertEqual(d['state'], 'bulletin'); self.assertEqual(d['risk']['max'], 3); self.assertEqual(d['risk']['label'], 'marqué')
        self.assertEqual((d['risk']['r1'], d['risk']['r2'], d['risk']['altitude']), (2, 3, 2100))
        self.assertTrue(d['slopes']['NE'] and d['slopes']['S'] and not d['slopes']['N']); self.assertEqual(d['validUntil'], '2026-02-02T18:00:00')
        self.assertEqual(d['freshSnow']['days'][1]['max'], 30); self.assertIn('Départs spontanés', d['summary'])

    def test_hors_saison_message_relaye_tel_quel(self):
        d = self.parse('bra-offseason.xml'); self.assertEqual(d['state'], 'off_season'); self.assertIn('saison est terminée', d['message']); self.assertNotIn('risk', d)

    def test_contenu_inattendu_jamais_un_faux_niveau(self):
        self.assertEqual(bra.parse(b'<html/>', 12)['state'], 'unavailable'); self.assertEqual(bra.parse(b'pas du xml', 12)['state'], 'unavailable')
        self.assertEqual(bra.parse(b'<BULLETINS_NEIGE_AVALANCHE><CARTOUCHERISQUE/></BULLETINS_NEIGE_AVALANCHE>', 12)['state'], 'unavailable')

    def test_cle_absente_et_jamais_dans_la_sortie(self):
        old = os.environ.pop('METEOFRANCE_BRA_KEY', None)
        try:
            with self.assertRaises(RuntimeError): bra.fetch(12)
        finally:
            if old: os.environ['METEOFRANCE_BRA_KEY'] = old
        self.assertNotIn('apikey', json.dumps(self.parse('bra-sample.xml')).lower())

    def test_route_bra_json(self):
        srv = ThreadingHTTPServer(('127.0.0.1', 0), server.handler(server.Relay(60, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'atenlive-sample.xml')), '*', server.BraRelay(xml=os.path.join(self.FIXD, 'bra-sample.xml'))))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            d = json.load(urllib.request.urlopen(f'http://127.0.0.1:{srv.server_port}/bra.json', timeout=10)); self.assertEqual(d['state'], 'bulletin')
        finally:
            srv.shutdown()


if __name__ == '__main__':
    unittest.main()
