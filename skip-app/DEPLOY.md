# Mettre SKIP en ligne en privé (accès : toi et les personnes que tu invites)

L'appli est un site statique : aucun serveur à gérer. Le GPS exige une adresse `https` qui lui est propre (pas un aperçu intégré). Ce guide utilise **Cloudflare Pages + Cloudflare Access**, gratuit jusqu'à 50 personnes, et le dépôt peut rester **privé**.

## 1. Publier le dossier `skip-app/`
1. Crée un compte sur dash.cloudflare.com (gratuit).
2. *Workers & Pages → Create → Pages → Connect to Git*, choisis le dépôt `Simulateur-Patrimoine`.
3. Branche : `claude/ski-phone-app-5w6s9s` (ou `main` après fusion). *Build command* : vide. *Build output directory* : `skip-app`.
4. Valide : tu obtiens une adresse `https://<nom>.pages.dev`.

À chaque `git push` sur la branche choisie, le site se met à jour tout seul (1 à 2 minutes). Les téléphones récupèrent la nouvelle version à la prochaine ouverture avec du réseau.

## 2. Verrouiller l'accès (à faire AVANT de partager l'adresse)
1. *Zero Trust → Access → Applications → Add an application → Self-hosted*.
2. Domaine : `<nom>.pages.dev` (ajoute aussi `*.<nom>.pages.dev` pour couvrir les aperçus de branche).
3. Politique *Allow* : « Emails » = ton adresse et celles de tes invités. Chacun reçoit un code par e-mail pour entrer.
4. Pour inviter quelqu'un : ajoute son e-mail à la politique. Pour retirer un accès : supprime-le.

Tant que cette étape n'est pas faite, l'adresse est publique : ne la communique pas.

## Déjà prévu dans le dossier
- `_headers` : pas d'indexation, pas de référent, géolocalisation autorisée pour l'appli.
- `robots.txt` et `<meta name="robots">` : demandent aux moteurs de recherche de ne pas référencer le site.
- Aucune donnée personnelle ne quitte le téléphone : notes, profil et itinéraires sont stockés localement.

## Alternatives
- **GitHub Pages** : un dépôt privé exige une offre GitHub payante ; sinon le site est public.
- **Netlify** : même `_headers` ; protection par mot de passe payante.
- Le fichier `basemap/alpe.pmtiles` (5,4 Mo) est servi tel quel ; les plages d'octets sont gérées par Cloudflare.
