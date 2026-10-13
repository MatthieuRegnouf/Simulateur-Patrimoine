# Relais SKIP

Petit serveur (bibliothèque standard Python, aucune dépendance) qui lit le flux public de l'Espace Alpe d'Huez et le republie en `live.json`, lisible depuis l'appli.

## Pourquoi un relais
Le flux `https://live.aten-altitude.com/alpehuez/atenlive.xml` (celui qui alimente le site skipass.alpedhuez.com) ne renvoie pas d'en-tête CORS : un navigateur ne peut pas le lire directement. Le relais le lit côté serveur, le normalise et ajoute les en-têtes CORS.

## Ce que contient `live.json` (uniquement ce que le flux contient)
| Bloc | Contenu | Remarque |
|---|---|---|
| `weather.zones` | mesures par zone (1300 à 3300 m) : température, ressenti, vent, rafales, visibilité, neige fraîche, qualité de neige, dernière chute, limite 0 °C, risque d'avalanche | mesures de la station, avec heure de mise à jour |
| `weather.forecast` | prévisions J+1 à J+3 | `usable: false` quand le flux ne contient que des zéros de remplissage |
| `lifts[]`, `pistes[]` | état d'ouverture (`open`, `delayed`, `temp_closed`, `closed`, `closed_today`, `off_season`), horaires | mêmes `id` que `data.js` |
| `lifts[].waitMin` | attente en minutes **si l'exploitant la renseigne**, sinon `null` | vide pour les 65 remontées le 13/10/2026 (hors saison) : on ignore si ce champ est utilisé en saison |
| `indices` | indice de skiabilité, état des routes… | |
| `summary` | décomptes ; `seasonOpen` = au moins 5 remontées ouvertes | |

## Lancer en local
```bash
python3 relay/server.py --port 8788            # http://127.0.0.1:8788/live.json
python3 relay/live.py -o live.json              # ou produire un fichier statique (tâche planifiée + hébergement de fichiers)
python3 -m unittest relay.test_relay            # tests
```
Dans `config.js` : `window.SKIP_CONFIG = { relay: 'http://127.0.0.1:8788', liveUrl: '' }`.

## Déployer (à choisir, rien n'est hébergé aujourd'hui)
- **Serveur / conteneur** : `docker build -f relay/Dockerfile -t skip-relay . && docker run -p 8788:8788 skip-relay --host 0.0.0.0 --origin https://votre-appli`. Mettre un reverse proxy HTTPS devant.
- **Fichier statique** : une tâche planifiée (cron, GitHub Actions) exécute `python3 relay/live.py -o live.json` toutes les 5 minutes et publie le fichier avec l'appli (`liveUrl: 'live.json'`). Aucun serveur à maintenir, mais pas de cache à la demande.

## Limites et précautions
- Une seule source en amont, fixée dans le code : aucun paramètre du client n'influence la requête sortante.
- `--origin` doit être restreint à l'adresse de l'appli en production.
- Le flux est public mais appartient à la station : prévenir l'exploitant (SATA / Espace Alpe d'Huez) avant un usage régulier ou commercial, et respecter ses conditions d'utilisation.
- Fréquence de mise à jour du flux : environ toutes les 15 à 30 minutes d'après les dates observées (météo 11:30:15 le 13/10/2026) ; non garantie.
- Notifications poussées (appli fermée) : non fournies, elles demandent un service Web Push avec clés VAPID.

## Notifications poussées (appli fermée) : non implémentées
L'appli affiche déjà des invitations quand elle est ouverte (bandeau) et des notifications système via le service worker quand elle tourne en arrière-plan. Pour prévenir **appli fermée** (par exemple « Fin de journée : tes pistes à noter »), il faut :
1. une paire de clés VAPID (`npx web-push generate-vapid-keys`), la clé publique dans `config.js` (`vapidKey`) ;
2. un service d'envoi (Node `web-push` ou Python `pywebpush`) et un stockage des abonnements ;
3. l'implémentation de `POST /push/subscribe` (contrat : `{ "subscription": PushSubscription, "prefs": { "evening": "17:30" } }`) — aujourd'hui le relais répond **501** ;
4. une tâche planifiée qui envoie `{ title, body, data: { evening: true } }` ; le service worker (`sw.js`) ouvre alors directement l'écran des pistes à noter.
Le relais ne connaît pas les pistes skiées (elles restent sur le téléphone) : le message du soir est générique, la liste précise s'affiche à l'ouverture.
La détection des pistes en arrière-plan (téléphone verrouillé) n'est pas possible dans une appli web : elle demande une appli native (par exemple Capacitor avec la permission de localisation en arrière-plan).
