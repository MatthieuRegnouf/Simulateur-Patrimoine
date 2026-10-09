/* Données stations. RÈGLE : on n'écrit ici que des informations sourcées.
   - "source: 'deck'"  = tirée de la présentation SKIP (itinéraire exemple de Léa)
   - "source: 'web'"   = confirmée par une source publique (voir `src`), sans tracé complet
   Aucune note, aucun vote, aucun coup de cœur : tout démarre à zéro, c'est la communauté qui remplit.
   Une piste sans from/to/min n'entre pas encore dans les itinéraires.
   Pour compléter la station : ajouter des nœuds, remontées et pistes au même format (voir README). */
const DATA = {
  stations: {
    alpe: {
      id: 'alpe', name: "Alpe d'Huez", base: 'base',
      nodes: {
        base:     { short: "Alpe d'Huez", name: "Rond-point des pistes (Alpe d'Huez)", alt: 1800, x: 45,  y: 285 },
        top:      { short: "Sommet", name: 'Arrivée du 2e tronçon de la télécabine', alt: 2700, x: 285, y: 45 },
        alpette:  { short: "Alpette", name: "Station du téléphérique de l'Alpette", alt: null, x: 275, y: 150 },
        carrelets:{ short: "Bas des Carrelets", name: "Bas des Carrelets (départ de la piste de l'Alpette)", alt: null, x: 215, y: 232 },
        poutran:  { short: "Départ Poutran", name: 'Départ de la télécabine du Poutran', alt: null, x: 135, y: 292 },
        jeux:     { short: "Les Jeux", name: 'Secteur Les Jeux', alt: 2100, x: 105, y: 135 }
      },
      lifts: [
        { id: 'tc_alpe',    name: "Télécabine de l'Alpe d'Huez", type: 'Télécabine', from: 'base',    to: 'top',  min: 13, source: 'deck',
          note: "Part du rond-point des pistes (1800 m) et monte au 2e tronçon (2700 m)." },
        { id: 'tc_poutran', name: 'Télécabine du Poutran',       type: 'Télécabine', from: 'poutran', to: 'jeux', min: 15, source: 'deck',
          note: "Descends au 2e arrêt seulement : il y a deux arrêts intermédiaires." }
      ],
      pistes: [
        { id: 'rousses',   name: 'Les Rousses',        color: 'red',   from: 'top',       to: 'alpette',   km: 3,   min: 10, source: 'deck' },
        { id: 'carrelets', name: 'Les Carrelets',      color: 'green', from: 'alpette',   to: 'carrelets', km: 1,   min: 3,  source: 'deck' },
        { id: 'alpette',   name: "Piste de l'Alpette", color: 'red',   from: 'carrelets', to: 'poutran',   km: 5,   min: 15, source: 'deck' },
        { id: 'jeux',      name: 'Les Jeux',           color: 'green', from: 'jeux',      to: 'base',      km: 1.5, min: 7,  source: 'deck' },
        // Pistes confirmées par des sources publiques, sans tracé ni durée : à compléter avec le plan officiel
        { id: 'sarenne',   name: 'La Sarenne',  color: 'black', km: 16, source: 'web', info: "Départ du Pic Blanc (3 330 m). La plus longue piste noire d'Europe ; seul le haut est vraiment noir.", src: 'Lyon Capitale, remontees-mecaniques.net' },
        { id: 'tunnel',    name: 'Le Tunnel',   color: 'black', source: 'web', info: 'Traverse la montagne par un tunnel puis démarre sur un mur de bosses très raide.', src: 'Presse / forums de skieurs' },
        { id: 'signal',    name: 'Le Signal',   color: 'red',   source: 'web', info: 'Piste raide, éclairée la nuit, qui finit au front de neige des Jeux.', src: 'Presse / forums de skieurs' },
        { id: 'petitesure',name: 'La Petite Sûre', color: 'red', source: 'web', info: 'Devient vite raide après la gare amont du télésiège de la Grande Sûre.', src: 'Presse / forums de skieurs' },
        { id: 'marcel',    name: 'La Marcel',   color: 'green', source: 'web', info: 'Piste débutante qui revient au front de neige des Jeux.', src: 'Presse / forums de skieurs' }
      ]
    }
  }
};
if (typeof module !== 'undefined') module.exports = DATA;
