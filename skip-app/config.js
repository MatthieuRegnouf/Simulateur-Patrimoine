/* Configuration de déploiement. Laisser `relay` vide tant qu'aucun relais n'est hébergé : l'appli le signale et fonctionne sans.
   relay : adresse du relais, par exemple 'https://relais.exemple.org' (voir relay/README.md)
   liveUrl : adresse complète de live.json si elle diffère de <relay>/live.json
   vapidKey : clé publique VAPID pour les notifications poussées (non implémentées, voir relay/README.md) */
window.SKIP_CONFIG = { relay: '', liveUrl: '', vapidKey: '' };
