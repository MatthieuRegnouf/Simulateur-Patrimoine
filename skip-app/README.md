# SKIP APP – application mobile (PWA)

Application de ski issue de la présentation « SKIP APP » : note de difficulté 1–10 des pistes, itinéraires sur mesure, et moins de temps d'écran sur les pistes.

## Lancer
```bash
cd skip-app && python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```
Servie en HTTPS, l'appli s'installe sur l'écran d'accueil (Android : « Installer », iPhone : Partager → « Sur l'écran d'accueil ») et fonctionne hors ligne. Le GPS exige HTTPS (ou localhost).

## Fonctionnalités
| Slide | Fonction |
|---|---|
| Notation | Note 1–10 (communauté + pente/largeur), Facile < 4 · Moyenne 4–7,5 · Difficile ≥ 7,5, vote en 1 tap, « moyenne basée sur N votes » |
| Coups de cœur | Cœur, compteur, « Top coups de cœur » |
| Sécurité/progression | Niveau personnel : « à ton niveau / pour progresser / trop dur » |
| Itinéraire | Durée, couleurs de pistes au choix, vitesse lent/moyen/rapide ; schéma avec étapes numérotées et pas-à-pas détaillé |
| Hors ligne | Itinéraire téléchargeable, alerte de fermeture au retour du réseau |
| Problématique écran | Détection GPS des descentes, mode poche, retour vocal/vibration, vote le soir, compteur de temps d'écran, guidage audio |
| Rencontres | Profil (pseudo, ski/snowboard, niveau, statut, envies), liens réels vers Instagram, Snapchat, Facebook, Strava, partage de profil / itinéraire / coups de cœur par message (WhatsApp, SMS…), ajout d'un ami en collant son message, chat général du jour |
| Concurrents | Onglet SKIP : comparatif Skiinfo, Skitude/Strava, Skiif |

## Données
Rien n'est inventé : aucune note, aucun vote, aucun coup de cœur au départ.
`data.js` ne contient pour l'Alpe d'Huez que :
- l'itinéraire exemple de la présentation SKIP (4 pistes, 2 remontées, durées et couleurs) ;
- 5 pistes confirmées par des sources publiques (Sarenne, Tunnel, Signal, Petite Sûre, Marcel), sans tracé ni durée.

Pour compléter la station, ajouter dans `data.js` des `nodes` (point d'arrivée/départ), `lifts` (`from`, `to`, `min`) et `pistes` (`from`, `to`, `min`, `km`, `color`). Une piste sans `from`/`to`/`min` apparaît dans la liste mais pas dans les itinéraires. Les données officielles (plan des pistes, durées de remontée) restent à importer.

## Limites
- Il manque un backend : votes partagés, chat commun, connexion réelle aux réseaux (OAuth) et annuaire des skieurs. Le partage se fait par message texte contenant un code `SKIP:…`.
- Pas de temps d'attente aux remontées (aucune source de données en temps réel).
- La détection GPS des descentes n'est pas active tant que les points clés n'ont pas de coordonnées (`lat`, `lng`).
- La carte est un schéma, pas un fond GPS.
- Pour publier sur les stores : empaqueter avec Capacitor.
- `engine.js` (notation, itinéraires, détection) est testable sous Node sans navigateur.
