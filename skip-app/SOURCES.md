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
