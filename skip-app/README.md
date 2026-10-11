# SKIP APP – application mobile (PWA)

Application de ski issue de la présentation « SKIP APP » : note de difficulté 1–10 des pistes, itinéraires sur mesure, et moins de temps d'écran sur les pistes.

## Lancer
```bash
cd skip-app && python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```
Servie en HTTPS, l'appli s'installe sur l'écran d'accueil (Android : « Installer », iPhone : Partager → « Sur l'écran d'accueil ») et fonctionne hors ligne. Le GPS exige HTTPS (ou localhost).

## Fonctionnalités
- **Pistes et remontées** : les 111 pistes et 65 remontées de l'Espace Alpe d'Huez (nom, couleur officielle, longueur, altitudes, durée des remontées), recherche sans accent, filtre par couleur et par secteur.
- **Notes 1–10** et **coups de cœur** : tout démarre à zéro, aucune note inventée. Niveau personnel : « à ton niveau / pour progresser / trop dur » (d'après ta note, sinon la couleur officielle).
- **Mon parcours** : tu ajoutes remontées et pistes ; l'appli signale celles qui s'enchaînent (✓, altitudes qui correspondent à ±80 m), alerte quand ça ne colle pas, affiche un profil d'altitude numéroté, additionne les durées. Téléchargement hors ligne, guidage audio, partage.
- **Ma journée** : le GPS suit l'altitude et reconnaît les descentes et remontées dont les altitudes correspondent ; en cas d'hésitation entre plusieurs pistes, tu choisis le soir. Mode poche (écran noir, retour vocal et vibration), vote de fin de journée, compteur de temps d'écran.
- **Rencontres** : profil (pseudo, ski/snowboard, niveau, statut, envies), liens réels vers Instagram, Snapchat, Facebook, Strava, partage de profil / parcours / coups de cœur par message (WhatsApp, SMS…), ajout d'un ami en collant son message, chat général du jour.
- **SKIP** : comparatif Skiinfo, Skitude/Strava, Skiif.

## Données
`data.js` est **généré** par `tools/import_alpe.py` à partir du flux public de l'Espace Alpe d'Huez (le même que celui du site skipass.alpedhuez.com) :
```bash
python3 tools/import_alpe.py          # télécharge le flux et réécrit data.js
python3 tools/import_alpe.py flux.xml # ou lit un fichier local
```
Le flux contient nom, couleur, longueur et altitudes des pistes, type/durée/altitudes/débit des remontées. Il ne contient **pas** les connexions piste ↔ remontée ni les durées de descente (estimées ici d'après la longueur : 12 / 18 / 26 km/h selon ta vitesse). Il est complété par `tools/official_notes.json` (fiches officielles Sarenne, Tunnel, La Fare, page « Pistes mythiques »). Total : 111 pistes comme sur le site (31 bleues et 16 noires identiques ; le flux compte 37 vertes et 27 rouges contre 34 et 30 annoncées : les couleurs du flux sont conservées telles quelles).

## Limites
- Il manque un backend : votes partagés (la moyenne communautaire n'existe pas encore), chat commun, connexion réelle aux réseaux (OAuth) et annuaire des skieurs. Le partage se fait par message texte contenant un code `SKIP:…`.
- Pas de temps d'attente aux remontées ni d'état d'ouverture (hors saison, le flux ne les donne pas).
- Les connexions entre pistes et remontées ne sont connues que par comparaison d'altitudes : toujours vérifier sur le plan officiel.
- La détection GPS dépend de l'altitude fournie par le téléphone (précision limitée).
- Pour publier sur les stores : empaqueter avec Capacitor. `engine.js` est testable sous Node sans navigateur.
