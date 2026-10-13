# Sources de données vérifiées (13/10/2026)

Chaque ligne indique ce qui a été **réellement ouvert et lu** pendant le développement, et ce qui reste inconnu.

| Besoin | Source | Constat | Réutilisable ? | Mise à jour |
|---|---|---|---|---|
| Pistes, remontées, couleurs, durées de remontée | [Flux ATEN de l'Espace Alpe d'Huez](https://live.aten-altitude.com/alpehuez/atenlive.xml) (celui du site [skipass.alpedhuez.com](https://skipass.alpedhuez.com/hiver/domaine-skiable/plan-des-pistes/)) | lu intégralement, 111 pistes et 65 remontées | public, sans clé ; pas d'en-tête CORS (donc relais) ; conditions d'utilisation non trouvées : prévenir l'exploitant | météo observée à 11:30:15 le 13/10/2026 |
| Ouverture des remontées et pistes | même flux (`etat`, `status`) | états réels : Ouvert, Ouverture décalée, Fermeture momentanée, Fermé, Fermé jusqu'à demain, Hors période d'exploitation | idem | idem |
| **Temps d'attente** | même flux (`attente` sur chaque remontée) | champ **présent mais vide pour les 65 remontées** aujourd'hui (hors saison) | on ignore s'il est rempli en saison : à re-vérifier en décembre | — |
| Météo mesurée | même flux (7 zones de 1250 à 3300 m) | température, ressenti, vent, rafales, visibilité, neige fraîche, qualité de neige, 0 °C, risque d'avalanche (1–5) | idem | idem |
| Prévisions J+1 à J+3 de la station | même flux | J+2 et J+3 contiennent des zéros de remplissage : marqués inutilisables | — | — |
| Prévisions jour par jour (9 jours) | [MET Norway, locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) | testé pour 1860 m et 3000 m ; CORS ouvert ; modèle, pas des mesures | oui, licence CC BY 4.0 : citer « MET Norway » (fait) ; l'API demande une identification de l'appli (User-Agent) | modèle, ~1 h |
| Attentes habituelles (vacances / hors vacances / heure) | recherche web + [article Mon séjour en montagne, 10/03/2024](https://www.mon-sejour-en-montagne.com/tutos/attente-aux-remontees-comment-l-alpe-d-huez-gere-les-flux-de-skieurs/) | **aucune statistique par remontée, ni par période**. Seulement du qualitatif : « 45 minutes d'attente pour monter au Pic Blanc » (exemple cité), conseil de monter à la pause de midi (voire 13 h 30), 10 remontées utilisées par skieur et par jour en moyenne | non exploitable comme donnée | — |
| Application officielle de la station | [App Store](https://apps.apple.com/fr/app/alpe-dhuez/id1326746233), [Google Play](https://play.google.com/store/apps/details?id=com.lumiplan.montagne.alpedhuez) | présente ; description : informations en temps réel, alertes météo ; **rien sur les temps d'attente** ; aucune API publique trouvée | non : on ne suppose aucun accès | — |
| Skiif (exemple cité) | [skiif.com](https://skiif.com/) et [ses CGU](https://skiif.com/politique-de-confidentialite-et-conditions-generales-dutilisation-de-lapplication-mobile-skiif/) | **aucune API publique** trouvée ; les CGU réservent la propriété intellectuelle de l'application ; des articles de presse (vus seulement dans des résultats de recherche, pages non ouvertes) indiquent que les temps d'attente viennent surtout des signalements d'utilisateurs, valables environ 30 minutes | **non** : pas de récupération de ses données ; on construit notre propre collecte | — |
| Tracés, liaisons, chemins | OpenStreetMap (voir README) | réseau connexe, pas officiel | oui (ODbL, attribution faite) | instantané du 31/05/2026 |

## Périodes de vacances couvertes par les données trouvées
**Aucune.** Aucune source trouvée ne donne d'attente par période de vacances. Le code accepte un fichier `waits-history.json` (voir ci-dessous) pour le jour où un exploitant en fournira un ; il n'est pas livré.

## Solutions à évaluer pour les temps d'attente
| Solution | Limites | Ce qu'il faut |
|---|---|---|
| **1. Partenariat avec l'exploitant** (SATA / Espace Alpe d'Huez) : flux d'attente ou historique par remontée | délai, accord commercial ou juridique, format imposé ; l'article indique que l'exploitant suit les flux par caméras et écrans, mais rien ne dit que ces données sont partageables | un contact, un cahier des charges (par remontée, au pas de 5 min, historique depuis plusieurs saisons), un accord d'usage ; ensuite remplir `lifts[].waitMin` du relais et/ou fournir `waits-history.json` |
| **2. Collecte volontaire auprès des utilisateurs** | peu de signalements au départ ; biais (on signale surtout les longues attentes) ; abus possibles ; sans serveur, les signalements ne circulent qu'entre contacts | un serveur (stockage, anti-abus, agrégation par créneau de 30 min), assez d'utilisateurs ; déjà prêt côté appli : boutons « Signaler l'attente » (5 tranches), valables 30 min, jamais présentés comme mesure |
| **3. Constitution progressive d'un historique** | il faut au moins une saison complète, avec les vacances scolaires, pour avoir une moyenne par période ; les petites remontées resteront sans donnée | le serveur de la solution 2, un calendrier officiel des vacances (zone A pour Grenoble), un seuil de fiabilité (par exemple 10 signalements par créneau) ; en attendant, seule la « moyenne locale » (≥ 3 signalements sur ≥ 2 jours, même heure) est affichée, étiquetée comme telle |
| **4. Surveiller le champ `attente` du flux officiel** | peut rester vide toute la saison | relancer le relais en décembre et regarder `summary.liftsWithWait` |

### Format de `waits-history.json` (optionnel, aucun fichier livré)
```json
{ "source": "SATA, saisons 2023-2025", "holidays": [{ "from": "2025-02-08", "to": "2025-03-09" }],
  "lifts": { "l-pic-blanc-1-et-2": { "holiday": { "9-11": 25, "11-13": 12, "13-17": 18 }, "offpeak": { "9-11": 8, "11-13": 3, "13-17": 6 } } } }
```
Les identifiants de remontées sont ceux de `data.js`. L'appli affiche alors « moyenne historique (vacances scolaires / hors vacances, créneau) » avec la source.

## Fond de carte, navigation et hors ligne

- **Fond de carte** : `basemap/alpe.pmtiles` (≈ 5,4 Mo), extrait de la zone d'Alpe d'Huez (5,98–6,22 °E, 45,02–45,21 °N, zoom ≤ 15) de la construction quotidienne **Protomaps** (données © contributeurs OpenStreetMap, licence ODbL ; date des données lue dans le fichier et affichée dans l'appli). Régénération : `sh tools/build_basemap.sh`. La mention « © OpenStreetMap · Protomaps » est affichée sur chaque carte.
- **Pourquoi pas les tuiles openstreetmap.org** : leur règlement d'usage interdit le téléchargement en masse et le stockage pour usage hors ligne. Un fichier unique sous licence ODbL, servi par l'appli elle-même, n'a pas cette restriction. Aucun serveur de tuiles tiers n'est appelé.
- **Lecteur** : `vendor/pmtiles.js` (bibliothèque PMTiles de Protomaps, BSD-3-Clause) ; décodeur de tuiles vectorielles `mvt.js` et rendu Canvas `map.js` écrits pour l'appli.
- **Position** : API de géolocalisation du navigateur (GPS du téléphone, utilisable sans réseau). Aucune donnée de position n'est envoyée nulle part.
- **Ce qui est « direct » ou non** : hors ligne, ouverture et météo sont des instantanés datés, jamais présentés comme du direct ; les attentes sont des estimations.
- **Limites connues** : tracés OpenStreetMap simplifiés à 6 m (graph.js) ; 98/111 pistes et 59/65 remontées ont un tracé ; liaisons parfois approximatives ; un recalcul hors ligne exige d'être à moins de 150 m d'un point connu du réseau et utilise les fermetures enregistrées au téléchargement.

## Diagnostic des données cartographiques (mesuré sur `graph.js`, instantané OpenStreetMap du 31/05/2026)

| Élément | Source | Nature du tracé |
|---|---|---|
| Pistes (1039 tronçons, dont 497 rapprochés d'une piste officielle) | OpenStreetMap (`piste:type=downhill`) | **Réels** : polylignes OSM simplifiées à 6 m ; longueur du tracé = longueur annoncée à 0,3 % près (médiane), 8 % au pire |
| Remontées (92 tronçons, 65 rapprochés d'une remontée officielle) | OpenStreetMap (`aerialway=*`) | **Réels**, mais presque rectilignes (82 sur 92 n'ont que 2 points : une remontée est une ligne droite entre deux gares) |
| Liaisons (69) | OpenStreetMap (`piste:type=connection`) et raccords déduits de la proximité | **Courtes** (médiane 19 m, max 81 m), souvent rectilignes ; à considérer comme **estimées** |
| Chemins à pied (106) | OpenStreetMap | Réels |
| Noms, couleurs officielles, durées des remontées | Flux officiel ATEN (Espace Alpe d'Huez) | Pas de géométrie |
| Altitudes des jonctions | EU-DEM 25 m (OpenTopoData) | Précision de l'ordre de la maille (25 m) |

- Le calcul d'itinéraire **suit ces tracés** (graphe de tronçons) ; il ne relie jamais deux points par une ligne droite, sauf pour une remontée (réellement rectiligne) et les petites liaisons ci-dessus.
- Couverture : 98 pistes sur 111 et 59 remontées sur 65 ont un tracé. Les autres (Champclotury, Allouettes, Rif Nel, stades débutants, etc.) sont **absentes de la carte et du calcul** : aucun tracé n'est inventé pour elles.
- Le lien openstreetmap.org fourni est une page de consultation : il n'offre pas de réseau téléchargeable en soi. Les **données** OpenStreetMap sont réutilisables (licence ODbL, mention obligatoire) via Overpass/Protomaps, ce que fait l'appli ; les **tuiles** du site, elles, ne peuvent pas être stockées pour un usage hors ligne.
- Positions des départs/arrivées et intersections : ce sont les nœuds partagés d'OpenStreetMap ; leur justesse est celle de la contribution OSM (non vérifiée sur le terrain).

## Géolocalisation : paramètres et limites
- API du navigateur (`watchPosition`, haute précision, `maximumAge` 1 s, délai 20 s). La fréquence d'actualisation est décidée par l'appareil (en général ≈ 1 Hz au GPS) ; la précision annoncée (± m) est affichée telle quelle.
- **Seuils** : bonne ≤ 25 m, moyenne ≤ 50 m, au-delà « imprécise » (aucune progression ni sortie de parcours déclarée) ; signal « ancien » après 20 s sans point (position grisée et datée) ; sortie de parcours après 3 points hors couloir (max(40 m, 2 × précision)) sur au moins 8 s.
- **Le marqueur est la position mesurée**, jamais recalée. La progression est calculée à part (projection sur le tracé, fenêtre vers l'avant), et la correction manuelle d'étape est un troisième mécanisme, sans effet sur le marqueur. Quand plusieurs pistes sont dans la marge d'erreur, l'appli les liste sans choisir.
- **Arrière-plan / écran éteint** : une page web ne peut pas suivre la position de façon fiable en arrière-plan. L'appli garde l'écran allumé (Wake Lock, consomme de la batterie) et prévient si elle a été suspendue.
- **Internet n'est pas nécessaire au GPS** : la carte (fichier local) et la position (récepteur du téléphone) sont indépendantes ; hors réseau le premier point peut seulement être plus lent.

## Voix
- Synthèse vocale du téléphone (Web Speech API) : choix de la voix française, débit, volume, extrait, désactivation. Une voix « locale » fonctionne hors ligne ; une voix « en ligne » exige une connexion. La naturalité dépend des voix installées sur l'appareil ; une voix de service externe (qualité studio) serait payante et en ligne : non utilisée.

## Secours (bouton SOS)
- **Numéro des secours sur les pistes, Espace Alpe d'Huez : +33 (0)4 76 80 37 38**, repris tel quel de la carte « Plan des pistes hiver 2025-2026 » publiée par la station (PDF `alpedhuez.com/wp-content/uploads/2025/11/PLAN-DES-PISTES-HIVER-2025-2026.pdf`), mention « Numéro d'urgence domaine skiable / Ski area emergency number ». Le même plan indique : « Appelez le numéro du domaine skiable puis prévenez le personnel d'exploitation. »
- **112** : numéro d'urgence européen (toute situation, hors pistes aussi), affiché à part ; il ne remplace pas le numéro du domaine pour un accident sur piste.
- À revérifier chaque saison (la valeur est dans `data.js` > `sos`, générée par `tools/import_alpe.py`). Pour une autre station sans numéro vérifié, l'appli le dit et ne propose que le 112.
- Ancien dysfonctionnement : le bouton passait par `confirm()` puis `location.href = 'tel:112'`, bloqués dans une page intégrée (aperçu), et n'offrait que le 112. Désormais : fenêtre « Secours » avec liens `tel:` classiques (ouvrent le composeur du téléphone, aucun appel automatique), numéro affiché et copiable, et conseil si l'appareil ne peut pas appeler.
