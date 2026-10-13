# SKIP APP – application mobile (PWA)

Application de ski issue de la présentation « SKIP APP » : note de difficulté 1–10 des pistes, itinéraires sur mesure, et moins de temps d'écran sur les pistes.

## Lancer
```bash
cd skip-app && python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```
Servie en HTTPS, l'appli s'installe sur l'écran d'accueil (Android : « Installer », iPhone : Partager → « Sur l'écran d'accueil ») et fonctionne hors ligne. Le GPS exige HTTPS (ou localhost).

## Fonctionnalités
- **Pistes et remontées** : les 111 pistes et 65 remontées de l'Espace Alpe d'Huez (nom, couleur officielle, longueur, altitudes, durée des remontées), recherche sans accent, filtre par couleur et par secteur.
- **Notation** : chaque carte de piste affiche « Difficulté : 7,4/10 · 136 votes » ; sans vote, « Difficulté estimée : 6/10 » (pastille en pointillés, d'après la couleur officielle et la pente). Vote en 1 tap (échelle 1–10), conditions facultatives en un 2e tap (damée, poudreuse, transformée, dure/verglacée, bosses, peu de neige), effet immédiat sur la note. Note globale = moyenne des votes mélangée à l'estimation objective (poids de l'estimation = 8 votes). Filtres de période discrets (24 h, 3 j, 7 j, 30 j) avec tendance sur 3 jours.
- **Caractéristiques** (bouton repliable sur la fiche) : pente moyenne et maximale, exposition, niveau technique estimé, état récent, neige habituelle (≥ 3 votes), longueur, altitudes, durée, repères de sécurité. Largeur : non fournie par la station.
- **Sécurité et progression** : niveau personnel, badges « à ton niveau / pour progresser / trop dur », mode « 🎯 Pour moi » (pistes un cran au-dessus d'abord, trop dures masquées), avertissement de neige dure signalée.
- **Coups de cœur**, **Pistes et remontées** : liste complète, recherche sans accent, filtres couleur et secteur.
- **Mon itinéraire** : départ, arrivée, durée (1 h à 4 h), vitesse ; difficulté choisie soit par **difficulté ressentie** (barème 1–5 = tranches de la note 1–10, plage « de… à… »), soit par couleurs officielles. La couleur officielle, la difficulté ressentie (avec nombre de votes et fiabilité) et la difficulté recherchée sont affichées séparément ; la couleur reste un garde-fou. Durées décomposées : descente / liaison / remontée (trajet) / attente, avec la source de l'attente (exploitant, signalement, moyenne historique, estimation, indisponible). Consignes d'étape liées au parcours (remontée, station d'arrivée, stations intermédiaires déduites du réseau, suite). « Pourquoi cet itinéraire ? » et limites. Suggestions personnalisées (niveau, notes, coups de cœur, météo, ouverture, attentes). Carte réelle, hors ligne, guidage audio, partage.
- **Invitations à noter** : « Alors, cette piste, tu l'as trouvée difficile ? », un tap ouvre la fiche (noter, ajouter à la journée, coup de cœur, corriger la piste). Pendant la remontée (si détectée, appli ouverte) et en fin de journée ; consentement, plafond, jamais en descente, jamais deux fois, jamais pour une piste déjà notée.
- **Météo** : prévisions jour par jour sur 9 jours pour la station (1860 m) et le sommet (3000 m), heure par heure pour la journée, avec cache hors ligne. Source : MET Norway (modèle météo public, lecture directe depuis l'appli). Conseils vent / neige fraîche / froid affichés seulement en saison.
- **Ma journée** : le GPS suit l'altitude et reconnaît les descentes et remontées dont les altitudes correspondent ; en cas d'hésitation entre plusieurs pistes, tu choisis le soir. Mode poche (écran noir, retour vocal et vibration), vote de fin de journée, compteur de temps d'écran.
- **Rencontres** : profil (pseudo, ski/snowboard, niveau, statut, envies), liens réels vers Instagram, Snapchat, Facebook, Strava, partage de profil / parcours / coups de cœur par message (WhatsApp, SMS…), ajout d'un ami en collant son message, chat général du jour.
- **SKIP** : comparatif Skiinfo, Skitude/Strava, Skiif.

## Données
`data.js` est **généré** par `tools/import_alpe.py` à partir du flux public de l'Espace Alpe d'Huez (le même que celui du site skipass.alpedhuez.com) :
```bash
python3 tools/import_alpe.py          # télécharge le flux et réécrit data.js
python3 tools/import_alpe.py flux.xml # ou lit un fichier local
```
Le flux contient nom, couleur, longueur et altitudes des pistes, type/durée/altitudes/débit des remontées. Il ne contient **pas** les connexions piste ↔ remontée (voir plus bas) ni les durées de descente (estimées d'après la longueur : 12 / 18 / 26 km/h selon ta vitesse ; marche : 2,5 km/h). Il est complété par `tools/official_notes.json` (fiches officielles Sarenne, Tunnel, La Fare, page « Pistes mythiques »). Total : 111 pistes comme sur le site (31 bleues et 16 noires identiques ; le flux compte 37 vertes et 27 rouges contre 34 et 30 annoncées : les couleurs du flux sont conservées telles quelles).

## Réseau pistes / remontées / chemins (itinéraires)
Le flux officiel ne donne pas les connexions. `graph.js` est **généré** par `tools/build_graph.py` :
- tracés et jonctions des pistes, remontées, liaisons et chemins piétons : **OpenStreetMap** (© contributeurs OpenStreetMap, ODbL) ;
- noms, couleurs et durées des remontées : flux officiel (rapprochement par nom, alias dans `tools/aliases.json`) ;
- altitudes des jonctions (pour orienter pistes et remontées) : EU-DEM 25 m via OpenTopoData.
```bash
python3 tools/build_graph.py            # interroge OpenStreetMap + altitudes, réécrit graph.js (réessaie si le serveur est instable)
python3 tools/build_graph.py --cache /chemin/cache --xml flux.xml   # réutilise des téléchargements déjà faits
```
Couverture actuelle : 98 pistes officielles sur 111 et 59 remontées sur 65 ont un tracé ; les autres (stades débutants, ascenseurs, tapis) n'y sont pas. Les liaisons sont déduites de la carte OpenStreetMap, qui n'est pas une source officielle : elles peuvent contenir des erreurs, d'où l'avertissement dans l'appli.

## Sources, relais, tests
- Sources vérifiées, limites et solutions pour les temps d'attente : [`SOURCES.md`](SOURCES.md).
- Relais (flux officiel → `live.json`, ouverture, mesures de la station) : [`relay/README.md`](relay/README.md) ; l'adresse se règle dans `config.js`.
- Tests : `node --test test/engine.test.js` (moteur), `python3 -m unittest relay.test_relay` (relais), `node test/e2e.js` (navigateur mobile simulé, demande `playwright-core`).

## Météo
Les prévisions viennent de l'API publique MET Norway (`api.met.no`, autorise la lecture depuis un navigateur ; les données sont mises en cache 30 min). Le fichier de la station (`live.aten-altitude.com/alpehuez/atenlive.xml`) contient aussi la météo mesurée (température, neige, vent, limite du 0 °C, risque d'avalanche) et des prévisions J+1 à J+3, mais il n'autorise pas la lecture depuis un navigateur : pour l'afficher il faut un petit relais (serveur ou tâche planifiée). La neige affichée est une estimation (1 mm d'eau ≈ 1 cm de neige sous 1 °C).

## Limites
- Il manque un backend : la « communauté » se limite à toi et à tes contacts SKIP (les votes se partagent par message) ; moyenne et chat partagés, chat commun, connexion réelle aux réseaux (OAuth) et annuaire des skieurs. Le partage se fait par message texte contenant un code `SKIP:…`.
- Pas de temps d'attente aux remontées ni d'état d'ouverture (hors saison, le flux ne les donne pas).
- Pas d'état d'ouverture des pistes ni d'attente aux remontées : l'itinéraire peut inclure une piste fermée.
- La détection GPS dépend de l'altitude fournie par le téléphone (précision limitée).
- Pour publier sur les stores : empaqueter avec Capacitor. `engine.js` est testable sous Node sans navigateur.
