# Étude de faisabilité : soleil, hors-piste, parcours découverte, avalanche, restaurants

Étude, pas de mise en œuvre. Date : 18/10/2026. Les chiffres « mesurés » viennent des données de l'appli (graphe OpenStreetMap, fond de carte, planificateur). Les chiffres « sources » viennent de pages web citées ; quand une source diverge d'une autre, c'est dit. Tout ce qui est une hypothèse est marqué **[À VÉRIFIER]**.

---

## 0. Synthèse et priorisation

| Priorité | Fonction | Valeur | Effort | Risque | Verdict |
|---|---|---|---|---|---|
| 1 | **3. Parcours découverte** (demi-journée, journée, multi-jours) | Très forte : alternative simple au sur-mesure | Faible à moyen (données et planificateur existent ; surtout du travail éditorial) | Faible, sauf si présenté comme « officiel » | **À faire en premier** |
| 2 | **1. Soleil / ombre** | Forte : critère nouveau, différenciant | Moyen (V1 sans relief ; V2 avec relief) | Faible (information de confort) | **À faire ensuite**, V1 d'abord |
| 3 | **5. Restaurants, cafés, bars** | Forte, fréquente | Moyen | Moyen : **l'intégration des avis Google pose un problème de licence avec notre carte** | V1 avec OpenStreetMap + avis internes ; Google en option |
| 4 | **4. Avalanche** | Sécurité : nécessaire dès qu'on parle de hors-piste | Faible pour un bandeau d'information ; moyen pour des alertes | Moyen : mal présentée, elle peut rassurer à tort | Bandeau d'information **avant** toute section hors-piste |
| 5 | **2. Hors-piste communautaire** | Forte mais sensible | Élevé (modération, juridique, serveur) | **Élevé** (sécurité des personnes, responsabilité éditeur) | **Ne pas lancer** sans validation juridique ; commencer par une version sans publication |

Ordre conseillé : 3 → 1 → 5 (V1) → 4 (bandeau) → 2 (préparation seulement). Ce qui bloque la dernière marche (2) : un serveur, une modération, un avis juridique, un partenariat avec des professionnels (guides, pisteurs).

**Ce qui manque avant de s'engager (informations manquantes)**
1. Validation de la station ou des pisteurs pour tout parcours présenté comme recommandé ; existence de navettes/skibus de retour (Oz, Vaujany, Auris, Villard-Reculas) et leurs horaires : non disponibles dans nos données.
2. Règles locales de hors-piste (arrêtés municipaux des 5 communes, statut précis des pentes au regard du Parc national des Écrins) : introuvables dans mes recherches.
3. Accès à l'API du bulletin d'avalanche (clé, licence, identifiant du massif Oisans).
4. Texte actuel des règles Google Places (affichage sur carte non Google) et tarifs applicables.
5. Avis d'un juriste (liste en 2.5).

---

## 1. Météo et exposition au soleil

### 1.1 Fonctionnement et intérêt
Pour chaque tronçon de piste, estimer s'il est au soleil ou à l'ombre à l'heure où le skieur y passera, et laisser choisir : « privilégier le soleil » (matin froid, après-midi), « privilégier l'ombre » (neige qui se transforme, chaleur de printemps) ou neutre. L'heure de passage est déjà connue du planificateur (temps cumulé depuis le départ).

### 1.2 Interface et planificateur
- Fiche piste : « Matin : ombre · Après-midi : soleil » (par tranche), à la place de la mention « exposition ».
- Itinéraire › Options avancées : « Soleil » : neutre / privilégier / éviter.
- Planificateur : chaque tronçon reçoit un score de 0 (ombre) à 1 (plein soleil) calculé à l'heure estimée de passage ; le coût du tronçon est ajusté selon la préférence (le mécanisme de préférence `pref` existe déjà dans le planificateur : favoris, vent).
- Résumé du parcours : « environ 60 % du parcours au soleil ».

### 1.3 Données nécessaires
| Donnée | Disponible ? | Source |
|---|---|---|
| Direction de descente de chaque tronçon | **Oui** (tracés OSM) | graphe de l'appli |
| Pente et altitude | Oui, approximatives (altitudes des jonctions : modèle 25 m) | EU-DEM / OpenTopoData |
| Position du soleil (azimut, hauteur) | Oui, **calcul pur** (pas d'API, hors ligne possible) | formules astronomiques |
| Nébulosité prévue | Oui | MET Norway (déjà utilisée) |
| **Ombres portées par le relief** | Non | nécessite un modèle de terrain fin : RGE ALTI 5 m (IGN, licence ouverte Etalab 2.0 ; la version 1 m n'est pas confirmée) |

Mesuré sur notre graphe (145 km de pistes officielles avec tracé et altitudes) : **63 % de la longueur descend vers le sud, sud-ouest ou ouest**, 27 % vers le nord, nord-ouest ou nord-est, 10 % seulement vers l'est ou le sud-est. Conséquence : le domaine reçoit surtout le soleil l'après-midi ; le matin, la majorité des pistes sont « de face » à l'ombre. C'est un vrai critère de choix.
Soleil à Alpe d'Huez (45,09° N) : 1er février, 11 h : hauteur 23°, azimut 151° (sud-sud-est) ; 15 h : hauteur 21°, azimut 213° ; 21 décembre à 15 h : hauteur 14° seulement. À si faible hauteur, **les crêtes projettent de longues ombres** : sans modèle de relief, la V1 surestimera le soleil dans les combes.

### 1.4 Limites de fiabilité
- V1 (orientation seule) : indique « face au soleil », pas « ensoleillé » ; ne voit pas l'ombre des crêtes, ni celle des arbres et des bâtiments.
- L'orientation d'un tronçon n'est celle de la pente que pour une piste dans la ligne de pente ; une traversée est approximative.
- Aucun lien démontré avec l'état de la neige : ne pas écrire « neige transformée » ou « verglas » sans mesure ou retour de skieurs.
- Nébulosité : prévision, pas observation.

### 1.5 Version minimale, puis évolutions
- **V1** : score = face au soleil × (1 − nébulosité), par demi-journée, affiché en fiche et pris en compte par le planificateur. Aucune donnée nouvelle.
- **V2** : tables précalculées « tronçon × heure × quelques dates » avec horizon calculé sur le relief 5 m (quelques centaines de ko, hors ligne possible).
- **V3** : retours de skieurs (« neige dure à 10 h ») pour calibrer ; météo par altitude plus fine (déjà : 1 860 m et 3 000 m).

---

## 2. Section hors-piste « façon Komoot »

### 2.1 Recommandation
**Ne pas ouvrir de publication communautaire de traces hors-piste dans un premier temps.** Ce que l'appli fait déjà sans risque supplémentaire : enregistrer **ses propres** sorties (privées). Le reste dépend d'un serveur, d'une modération et d'un avis juridique.

### 2.2 Réglementation : à ne pas présumer
Le hors-piste n'est ni systématiquement autorisé ni systématiquement interdit. Ce que mes recherches établissent, avec leurs limites :
- **France** : pas de principe général d'interdiction trouvé ; le maire tient ses pouvoirs de police de l'article L. 2212-2 du CGCT et organise les secours ; les communes peuvent demander aux personnes secourues une participation aux frais (loi du 27 février 2002, codifiée selon les sources aux articles L. 2321-2 ou L. 2331-4 15° du CGCT, avec condition d'information/affichage : [réponse du Sénat, 2025](https://www.senat.fr/questions/base/2025/qSEQ250203383.html)). **[À VÉRIFIER sur Légifrance]** : numéros d'articles en vigueur, responsabilité civile et pénale du skieur hors-piste, et la facturation à Alpe d'Huez.
- **Parc national des Écrins** (voisin du domaine) : le cœur du parc relève du code de l'environnement et du décret n° 2009-448, précisé par la charte et des décisions du directeur. Je n'ai **pas** trouvé le texte précis sur le ski hors-piste autour d'Alpe d'Huez. **[À VÉRIFIER]** auprès du parc.
- **Italie** : depuis le 1er janvier 2022, détecteur de victimes d'avalanche (DVA/ARTVA), pelle et sonde obligatoires en ski de randonnée, raquettes, etc., en terrain enneigé à risque ; amendes régionales rapportées (par ex. 25 à 250 € en Lombardie) : [article Lacrux](https://www.lacrux.com/fr/alpinisme/plus-d%27obligations-plus-de-s%C3%A9curit%C3%A9-l%27italie-%C3%A9tablit-des-svt-obligatoires-et-plus/). Texte exact (le décret 40/2021 n'est pas confirmé par mes sources) **[À VÉRIFIER]**.
- **Autriche, Suisse, Allemagne** : régimes régionaux/cantonaux, **non étudiés**.
- Conséquence produit : toute fonction hors-piste doit être **spécifique par pays, commune et zone**, avec une liste de zones où la publication est bloquée (réserves, zones de quiétude de la faune, zones d'arrêté municipal).

### 2.3 Trace d'utilisateur ≠ parcours recommandé
| | Trace partagée | Parcours recommandé |
|---|---|---|
| Qui | N'importe quel utilisateur | Professionnel nommé (guide diplômé) ou partenaire |
| Statut affiché | « Trace non vérifiée, partagée par X, le … » | « Proposé par … le … ; valable pour les conditions décrites » |
| Contenu | Tracé, date, commentaire | Tracé, difficulté, exposition, points de décision, conditions requises, bulletin du jour |
| Promesse | Aucune | Aucune de sécurité : il reste dépendant du bulletin et des conditions du jour |
Aucun parcours n'est « validé » par l'application elle-même ; aucun calcul automatique ne confère un label de sûreté.

### 2.4 Prévention et affichage de sécurité
- Écran d'information **avant** chaque ouverture de la section (pas une case à cocher unique) : équipement (DVA, pelle, sonde), bulletin d'avalanche du jour, ne pas partir seul, prévenir un proche, météo, numéro des secours, « le hors-piste n'est pas secouru comme une piste ».
- Bandeau permanent sur toute trace : date de la trace, absence d'évaluation locale, risque du jour.
- Risque 4 ou 5 : masquer les recommandations, ne laisser que l'information.
- « Aucune alerte » ne s'affiche jamais comme un signal positif.

### 2.5 Modération
Pré-modération des premières traces d'un compte ; signalement en un geste ; retrait rapide ; refus automatique dans les zones bloquées ; relecture par des professionnels pour tout label « recommandé » ; journal de décisions ; floutage des départs/arrivées proches d'un domicile (les traces GPS sont des données personnelles, RGPD : consentement, suppression, minimisation).

### 2.6 Responsabilité et points à faire valider par un juriste
Une décharge ou des CGU **ne suffisent pas** : en droit de la consommation français, des clauses d'exonération trop larges peuvent être écartées **[À VÉRIFIER]**, et une responsabilité propre peut naître d'une faute de l'éditeur (information trompeuse, modération défaillante, recommandation).
À faire valider : (1) statut d'hébergeur et obligations de retrait (LCEN/DSA) ; (2) responsabilité en cas d'accident lié à une trace ou à un parcours « recommandé » ; (3) validité et portée de la décharge/CGU selon pays de l'utilisateur ; (4) conformité RGPD des traces ; (5) assurance responsabilité civile professionnelle de l'éditeur ; (6) relation avec la station, les guides, le Parc ; (7) règles locales par zone ; (8) mentions obligatoires pour les mineurs ; (9) droit applicable et juridiction.

### 2.7 Version minimale, puis évolutions
- **V0 (réalisable)** : fiche « Hors-piste : ce qu'il faut savoir » + bulletin d'avalanche du jour + liens officiels ; traces **privées** (sorties déjà enregistrables).
- **V1** : partage **entre amis** uniquement (liens, sans annuaire public), avec écran de prévention.
- **V2** : bibliothèque publique modérée, avec zones bloquées. **Prérequis** : serveur, comptes, modération, avis juridique.
- **V3** : parcours recommandés par des professionnels.

---

## 3. Parcours découverte (inspiration : Dolomiti Superski)

### 3.1 Ce que font les circuits Dolomiti Superski
**Sellaronda** (carte PDF jointe, lue en détail) : boucle autour du massif du Sella, **deux sens** : orange = sens horaire, vert = sens antihoraire, balisée sur les pistes, avec **liste numérotée et ordonnée des remontées** pour chaque sens :
- Sens horaire (16 remontées) : 19 Boè, 7 Campolongo, 8 Arabba Fly, 3 Portados, 9 Carpazza, 126 Fodom, 124 Lezuo, 155 Pradel–Salei, 154 Ciavazes–Grohmann, 48 Sole, 47 Senoner, 33 Fungeia, 31 Costabella, 30 Dantercepies I+II, 40 Selva/Wolkenstein–Dantercepies–Colfosco, 34 Borest.
- Sens antihoraire (18 remontées) : 34 Borest, 36 Sodlisia, 39 Plans, 40 Frara, 42 Val Setus, 41 Cir, 29 Ciampinoi, 45 Piz Setëur 1, 46 Piz Setëur 2, 49 Città dei Sassi, 55 Sasso Levante, 105 Pian Frataces–Gherdecia, 107 Sass Becè, 127 Alpenrose, 8 Arabba Fly, 5 Burz, 6 Le Pale, 23 Costoratta.
- Quatre vallées (Val Gardena, Alta Badia, Arabba/Marmolada, Val di Fassa/Carezza) ; **tronçons en skibus « à pagamento »** (payants) signalés sur la carte.
- D'après les pages touristiques : environ 40 à 44 km (page officielle : 44 km dont 21 km en remontées), 5 à 6 h, départ conseillé avant 10 h, dernier passage clé vers 15 h 30, niveau « intermédiaire » avec bonne condition ; le sens vert est souvent présenté comme plus facile (sources divergentes) ([page officielle](https://www.dolomitisuperski.com/en/experiences/winteractivities/ski-circuits/sellaronda), [Südtirol](https://suedtirolerland.it/en/leisure-activities/winter-sports/dolomiti-superski/sellaronda), [Val Gardena](https://www.val-gardena.com/en/winter/sella-ronda/)).
**Great War Tour** : tour autour du Col di Lana via Lagazuoi (≈ 2 750–2 800 m), Cinque Torri, passo Giau, Arabba ; 78 à 100 km selon les sources dont ≈ 25–41 km à ski et 29–36 km en skibus ; 6,5 à 8 h ; fenêtre de saison (ex. 23 janvier – 23 mars 2025) ; forfait Dolomiti Superski ; descente phare de Lagazuoi à Armentarola (8,5 km) ([Südtirol](https://suedtirolerland.it/en/leisure-activities/winter-sports/dolomiti-superski/great-war-ski-tour), [Grande Guerra](https://grandeguerra.dolomiti.org/en/arabba/winter/great-war-ski-tour)).
*Limite : la page officielle des circuits était inaccessible depuis mon environnement (protection anti-robot) ; j'ai donc utilisé la carte jointe et des pages partenaires.*

**Ce qu'on en retient** : un parcours est une **liste ordonnée d'étapes nommées**, avec un sens, un niveau annoncé, des conseils d'horaire (départ, « point de non-retour »), des échappatoires (bus), une saison, et une identité de marque.

### 3.2 Adaptation à Alpe d'Huez
Il n'existe pas ici de boucle unique équivalente connue : on propose des **parcours préparés**, composés de tronçons de notre réseau, **relus par un humain** :
| Format | Exemple de promesse | Estimation par le planificateur actuel (non validée, non nommée) |
|---|---|---|
| Demi-journée « Découverte » (niveau facile à 4/10) | boucle autour de la station, 1 pause | ≈ 3 h · 24 km skiés · 23 descentes · 12 remontées · 3 270 m de dénivelé |
| Journée « Grand domaine » (jusqu'à 6,5/10) | grandes descentes + 1 déjeuner | ≈ 4 h 20 · 33 km · 31 descentes · 17 remontées · 5 150 m |
| Journée « Sportive » (3 à 8,5/10) | Pic Blanc, Villard-Reculas, Oz | ≈ 6 h 20 · 52 km · 46 descentes · 29 remontées · 9 600 m ; atteint Villard-Reculas et Oz |
| 3 jours | Alpe d'Huez → Auris/Villard → Oz/Vaujany | à rédiger |
| Semaine (5 à 7 jours) | un thème par jour (panoramas, grandes descentes, village…) | à rédiger |
Ces chiffres sortent du planificateur (paramètres : départ Signal, vitesse moyenne) : ils montrent que le réseau permet ces formats, pas que les parcours sont bons.

### 3.3 Modèle de données et intégration
Un parcours = `{ id, titre, format, niveau min/max (sur 10 + couleurs), sens, étapes ordonnées (tronçons du graphe), points d'intérêt, pauses possibles, durée, distance, dénivelé, horaires clés (départ conseillé, dernier point de décision, dernières remontées), échappatoires, saison, version, relu par/le }`, en JSON dans l'appli (consultable hors ligne).
Interface : dans **Itinéraire**, deux entrées au même niveau : « Parcours prêts » et « Sur mesure ». Choisir un parcours ouvre **le même écran de résultat** (résumé, carte, « Ouvrir le GPS », hors ligne). Si une remontée est fermée, le planificateur propose une variante (il sait déjà exclure les remontées fermées). Multi-jours : progression par jour, « reprendre à l'étape ».
Alerte de niveau : comparer à Mon profil (1–10) avant de démarrer.

### 3.4 Contraintes
Fermetures et attentes (flux officiel, déjà en place) ; horaires des remontées (plages du flux officiel) ; **navettes de retour : aucune donnée** ; un parcours présenté comme « officiel » exige l'accord de la station ; points de non-retour à documenter sur le terrain.

### 3.5 Version minimale
6 parcours rédigés (2 demi-journées, 2 journées, 1 trois-jours, 1 programme de 5 jours) générés par le planificateur, **puis relus et nommés** par une personne connaissant le domaine ; aucun serveur.

---

## 4. Risque d'avalanche

### 4.1 Sources officielles
| Source | Couverture | Mise à jour | Accès |
|---|---|---|---|
| **BRA Météo-France** (bulletin d'estimation du risque d'avalanche) | **36 massifs** France (Alpes, Corse, Pyrénées), dont l'Oisans | quotidienne, vers 16 h, de début novembre à fin mai/début juin | API du portail Météo-France (« DonneesPubliquesBRA », authentification), formats PDF/XML ; archive depuis 2018 sur data.gouv.fr ([catalogue](https://donneespubliques.meteofrance.fr/client/pdf/catalogue.php), [description XML](https://donneespubliques.meteofrance.fr/client/document/descriptif_bulletinrisqueavalanche_formatxml_20231026_309.pdf), [archive](https://www.data.gouv.fr/datasets/archive-des-bulletins-avalanches/informations)) |
| **EAWS** et services nationaux/régionaux (Italie, Suisse SLF, Tyrol/Alto Adige…) | 29 services, 16 pays | quotidienne en saison | format CAAML v6 (JSON/XML) ; **licences à vérifier** service par service ([EAWS](https://www.slf.ch/en/avalanches/avalanche-warning/working-group-of-the-european-avalanche-warning-services-eaws/)) |
**[À VÉRIFIER]** : identifiant du massif Oisans, conditions d'usage (licence), évolution du schéma depuis octobre 2023, quotas.

### 4.2 Présentation sans fausse sécurité
- Toujours : « Risque **n/5** pour le massif Oisans — bulletin émis le … à … , valable pour … » + pente/altitude/orientation sensibles quand elles sont fournies + lien vers le **bulletin complet officiel**.
- Jamais de couleur « verte rassurante » ni de mot « sûr » ; le niveau 1 se dit « faible », pas « sans danger ».
- Absence de bulletin (hors saison, panne, périmé) : **« Information indisponible. Cela ne signifie pas qu'il n'y a pas de danger. »**
- Distinguer deux blocs : **information générale (massif entier, jour donné)** — ce que fournit le bulletin — et **évaluation locale d'un parcours** — que l'appli **ne fait pas** : seul un professionnel sur place peut l'établir. Un calcul de pentes > 30° à partir du relief serait une indication de « terrain potentiellement avalancheux », jamais une évaluation.
- Pistes balisées ouvertes : gérées par la station (déclenchements préventifs) : ne pas confondre avec le hors-piste.

### 4.3 Alertes
Sans serveur, pas de notification appli fermée. **V1** : bandeau dans l'appli à l'ouverture et dans Météo, avec la date du bulletin. **V2** : notre relais (Python, déjà conçu pour le flux ATEN) interroge le bulletin et publie un petit JSON ; notifications push possibles avec un service d'envoi (non fourni aujourd'hui).

---

## 5. Restaurants, cafés et bars

### 5.1 Ce que contient déjà notre fond de carte (mesuré)
Dans la zone du fond de carte (OpenStreetMap via Protomaps) : **66 restaurants, 11 fast-foods, 10 bars, 6 pubs, 4 cafés, 10 boulangeries**, quasiment tous nommés. Le fichier ne contient **ni horaires, ni téléphone, ni avis** (seulement nom et type) : les horaires (`opening_hours`) demanderaient une extraction OpenStreetMap supplémentaire, dont la complétude est **[À VÉRIFIER]**.

### 5.2 Avis Google : intégration possible mais contrainte
- **API** : Places API (New). Tarifs publiés (vérifier la page à jour) : Place Details *Enterprise* ≈ 20 $ / 1 000 appels (1 000 gratuits/mois) ; avec les champs « Atmosphere » (avis) ≈ 25 $ / 1 000 ; Text Search Enterprise ≈ 35 $ (40 $ avec Atmosphere) ([tarifs Google](https://developers.google.com/maps/billing-and-pricing/pricing)). Les seuils gratuits par SKU depuis mars 2025 (10 000 / 5 000 / 1 000) viennent d'une source tierce **[À VÉRIFIER]**.
- **Conditions** ([règles Places API](https://developers.google.com/maps/documentation/places/web-service/policies)) : pas de pré-chargement ni de stockage du contenu (sauf l'identifiant du lieu) ; logo Google et attributions visibles ; **les résultats affichés sur une carte doivent l'être sur une carte Google**.
- **Problème pour nous** : notre carte est une carte vectorielle OpenStreetMap maison. Afficher des avis Google sur des repères de notre carte **est probablement incompatible** avec ces règles **[À VÉRIFIER — hypothèse bloquante]**.
- Une clé API Google ne doit pas être exposée telle quelle dans l'appli : il faut un petit service intermédiaire (serveur).

### 5.3 Options
| Option | Avis | Carte | Coût | Verdict |
|---|---|---|---|---|
| **A. OpenStreetMap + avis internes** (même mécanisme que les notes de pistes) | internes, dès les premiers utilisateurs | notre carte | nul | **V1 recommandée** |
| **B. A + lien « voir les avis sur Google Maps »** (lien sortant, sans reprendre les notes) | consultés chez Google | notre carte | nul | à ajouter en V1 |
| C. Google Places dans une **fiche texte** (note, nombre d'avis, horaires), hors carte | Google, avec attribution | liste, pas de repère sur notre carte | selon usage, ≈ 20–25 $ / 1 000 fiches | possible en V2 si les règles le confirment, avec serveur |
| D. Tripadvisor / Foursquare | à étudier | à étudier | à étudier | non évalué |

### 5.4 Fonctionnement proposé
- **Repères sur la carte** : icônes tasse/couverts, visibles à partir d'un certain zoom, filtrables.
- **Accessible depuis les pistes ou dans la station** : calculé par la distance au réseau pistes/remontées (≤ 150 m d'un tronçon et altitude hors village → « sur les pistes » ; sinon « en station »), contrôlé à la main pour les 20 à 30 établissements d'altitude.
- **Ajouter une pause** : V1 = bouton « Ajouter une pause » sur la fiche (durée choisie 30–90 min) qui insère une pause dans le budget de durée de l'itinéraire et affiche l'établissement le plus proche du parcours avec sa distance ; V2 = insertion réelle d'un détour (accès à ski ou à pied) respectant les horaires d'ouverture.
- Fiche : nom, type, horaires (si connus, avec date), téléphone, site, accès (à ski / à pied), avis internes.

### 5.5 Contraintes
Licence ODbL (attribution déjà affichée) ; avis internes à modérer (insultes, faux avis) ; horaires souvent incomplets ou périmés → afficher « horaires non confirmés » ; données personnelles des auteurs d'avis ; mise à jour saisonnière.

---

## Hypothèses à vérifier — récapitulatif
1. Règles Google Places : affichage sur carte non Google ; tarifs applicables.
2. Accès et licence de l'API BRA ; identifiant Oisans ; licences EAWS par pays.
3. Texte en vigueur : CGCT (frais de secours), Code du sport, arrêtés des 5 communes, charte du Parc des Écrins, règles italiennes et autrichiennes.
4. Disponibilité du relief 5 m (ou 1 m) pour les ombres portées ; taille des tables précalculées.
5. Navettes de retour entre villages et horaires ; validation de la station pour des parcours « officiels ».
6. Complétude des horaires OpenStreetMap pour les établissements.
7. Tout l'avis juridique listé en 2.6.
