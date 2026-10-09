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
| Itinéraire | Durée, difficulté, vitesse lent/moyen/rapide, éviter noires et foule, attente estimée, carte schématique |
| Hors ligne | Itinéraire téléchargeable, alerte de fermeture au retour du réseau |
| Problématique écran | Détection GPS des descentes, mode poche, retour vocal/vibration, vote le soir, compteur de temps d'écran, guidage audio |
| Rencontres | Profil avec statut et liens vers ses réseaux (Instagram, Snapchat, Facebook, Strava), annuaire des skieurs de la station (nécessite un serveur), chat général du jour |
| Concurrents | Onglet SKIP : comparatif Skiinfo, Skitude/Strava, Skiif |

## Limites (démo)
- Stations, notes, votes, attentes et positions sont **fictifs** (`data.js`). Il manque un backend (votes partagés, chat, plans officiels, remontées en temps réel).
- La carte est un schéma, pas un fond GPS. Pour de vraies cartes hors ligne, prévoir MapLibre + tuiles.
- Pour publier sur les stores : empaqueter avec Capacitor.
- `engine.js` (calcul de note, itinéraires, détection) est testable sous Node sans navigateur.
