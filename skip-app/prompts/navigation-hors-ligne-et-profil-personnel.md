# Prompt gardé de côté : navigation sur itinéraire téléchargé + profil personnel

À réutiliser tel quel quand il faudra relancer ce chantier.

---

Je souhaite maintenant améliorer deux éléments de l’application : la navigation sur un itinéraire téléchargé et l’utilisation du profil personnel pour calculer les parcours.
La priorité est d’obtenir une navigation lisible, précise et simple à utiliser sur les pistes. Travaille dans le projet existant et implémente les améliorations réalisables, plutôt que de te limiter à une proposition théorique.

## 1. Une véritable navigation sur l’itinéraire
Je souhaite une expérience inspirée de Google Maps, Citymapper ou Waze : une carte claire, un parcours identifiable et un marqueur indiquant la position actuelle du skieur.
Ces applications constituent des références d’expérience utilisateur, pas une demande de reproduire exactement leur interface ou de supposer que toutes leurs fonctionnalités sont disponibles dans notre projet.
La navigation doit permettre de :

* Visualiser clairement l’itinéraire à suivre.
* Identifier sa position actuelle sur la carte.
* Suivre sa progression le long du parcours.
* Distinguer les portions déjà parcourues de celles restantes.
* Comprendre quelle piste, remontée ou liaison prendre ensuite.
* Recentrer facilement la carte sur sa position.

Différencie visuellement les descentes, les remontées mécaniques et les liaisons, sans surcharger la carte.
Si la position est imprécise ou temporairement indisponible, indique-le clairement. Ne donne pas une impression de précision que les données de localisation ne permettent pas.

## 2. Télécharger un itinéraire pour l’utiliser sans connexion
Ajoute la possibilité de préparer et de télécharger un itinéraire lorsque l’utilisateur dispose d’une connexion, puis de consulter le parcours et de suivre sa position lorsqu’il n’a plus accès à Internet.
Ne te limite pas à télécharger une image ou un résumé : examine ce qui est nécessaire pour rendre le parcours réellement utilisable hors ligne, notamment :

* Le tracé de l’itinéraire.
* Le fond de carte de la zone nécessaire au parcours.
* Les pistes, remontées et points utiles associés.
* Les instructions de navigation.
* Les informations indispensables pour identifier les étapes.

Vérifie ce que permettent la technologie du projet, le fournisseur cartographique et ses conditions d’utilisation. Explique les éventuelles restrictions avant de choisir une solution.
Dans l’interface, prévois :

* Un bouton « Télécharger pour une utilisation hors ligne ».
* Un indicateur de progression et une confirmation de téléchargement complet.
* Un statut permettant de savoir si l’itinéraire est disponible hors ligne.
* La date de dernière mise à jour des informations téléchargées.
* Un message explicite si des éléments nécessaires n’ont pas pu être téléchargés.

Distingue les fonctions disponibles hors ligne de celles qui nécessitent une connexion. Ne présente pas les données téléchargées sur les ouvertures, la météo ou les temps d’attente comme des informations actualisées en direct.
Précise également si le recalcul d’itinéraire peut fonctionner hors ligne. Si ce n’est pas possible, explique ce qui se passe lorsque le skieur quitte le parcours prévu et propose un comportement adapté, sans promettre un recalcul inexistant.

## 3. Repenser la carte et les indications écrites
La carte actuelle me paraît trop imprécise et trop brouillonne. Reprends sa présentation pour mieux articuler la carte et les instructions écrites.
Je souhaite :

* Un tracé principal immédiatement identifiable.
* Un marqueur de position qui ne se confond pas avec les autres éléments.
* Moins d’informations secondaires affichées simultanément.
* Des noms de pistes et de remontées lisibles au niveau de zoom pertinent.
* Une instruction principale visible sans masquer une grande partie de la carte.
* Une liste détaillée des étapes accessible à la demande.

Par exemple, l’écran pourrait associer :

1. La carte avec le parcours et la position du skieur.
2. Un bandeau indiquant la prochaine étape.
3. Un panneau dépliable présentant l’ensemble des instructions.

Les indications écrites doivent correspondre exactement au tracé affiché. Lorsqu’un utilisateur sélectionne une étape dans la liste, mets en évidence la portion correspondante sur la carte.
Distingue aussi deux problèmes : la lisibilité de l’interface et la précision des données cartographiques. Si les données actuelles sont insuffisantes, explique-le : une amélioration graphique ne doit pas masquer une géométrie erronée ou un réseau de pistes incomplet.

## 4. Ajouter l’option « Profil personnel » aux filtres d’itinéraire
Lors de la sélection des filtres d’itinéraire, ajoute une option intitulée « Profil personnel ».
Cette option doit permettre de calculer directement un parcours à partir des informations déjà renseignées par l’utilisateur, sans lui demander de saisir une seconde fois les mêmes préférences.
Réutilise les données effectivement présentes dans son profil, par exemple :

* Son niveau de ski.
* La difficulté souhaitée.
* Ses préférences de pistes.
* Ses autres critères de parcours déjà enregistrés.

N’invente pas de champs ou de préférences qui n’existent pas dans le projet : identifie d’abord ce qui est disponible.
Lorsque l’option est activée :

* Applique automatiquement les paramètres du profil au calcul d’itinéraire.
* Affiche un résumé compréhensible des critères utilisés.
* Permets à l’utilisateur d’ajuster certains critères pour cette sortie.
* Ne modifie pas son profil permanent sans une action explicite de sa part.

Si le profil est incomplet, demande uniquement les informations indispensables qui manquent. S’il n’existe pas encore, propose de le compléter ou de poursuivre avec des filtres manuels.
Évite toute ambiguïté entre les préférences enregistrées et les ajustements temporaires : l’utilisateur doit comprendre quels paramètres sont utilisés pour le parcours demandé.

## 5. Mise en œuvre et vérification
Commence par examiner la carte actuelle, le calcul d’itinéraire, la gestion de la localisation et le stockage du profil.
Puis :

1. Identifie les causes de l’imprécision et de la surcharge visuelle.
2. Présente brièvement les changements prévus.
3. Implémente les améliorations réalisables dans l’architecture existante.
4. Signale les dépendances externes, les restrictions et les fonctionnalités encore bloquées.

Vérifie notamment les situations suivantes :

* Itinéraire téléchargé, puis perte de connexion.
* Localisation refusée, imprécise ou interrompue.
* Téléchargement incomplet.
* Sortie du parcours prévu.
* Profil personnel complet, incomplet ou absent.
* Modification temporaire des filtres sans modification du profil enregistré.

À la fin, indique ce qui fonctionne réellement, les fichiers modifiés, les tests effectués et les limites restantes. Ne présente pas une maquette, une simulation ou une fonctionnalité non testée comme une navigation opérationnelle.
