/* Données de DÉMONSTRATION : noms, notes, votes et positions sont illustratifs.
   En production, elles viendraient d'un serveur (plans officiels + votes communautaires). */
const DATA = {
  stations: {
    alpe: {
      id: 'alpe', name: "Alpe d'Huez", base: 'base',
      nodes: {
        base:  { name: 'Rond-point des pistes', alt: 1800, lat: 45.0920, lng: 6.0680, x: 60,  y: 250 },
        jeux:  { name: 'Les Jeux',              alt: 2100, lat: 45.0860, lng: 6.0840, x: 150, y: 150 },
        alp:   { name: "Station de l'Alpette",  alt: 2100, lat: 45.0800, lng: 6.0720, x: 230, y: 215 },
        alp2:  { name: "Bas de l'Alpette",      alt: 1950, lat: 45.0850, lng: 6.0700, x: 150, y: 270 },
        top:   { name: 'Sommet 2700',           alt: 2700, lat: 45.0760, lng: 6.0980, x: 290, y: 50 }
      },
      lifts: [
        { id: 'tc_alpe',  name: "Télécabine de l'Alpe d'Huez", type: 'Télécabine', from: 'base', to: 'top',  min: 13, wait: 5 },
        { id: 'tc_pout',  name: 'Télécabine du Poutran',       type: 'Télécabine', from: 'base', to: 'jeux', min: 15, wait: 4,
          note: "Descendre au 2e arrêt intermédiaire seulement." },
        { id: 'ts_rous',  name: 'Télésiège des Rousses',       type: 'Télésiège',  from: 'jeux', to: 'top',  min: 9,  wait: 3 },
        { id: 'tp_alp',   name: "Téléphérique de l'Alpette",   type: 'Téléphérique', from: 'alp', to: 'top', min: 8,  wait: 7 }
      ],
      pistes: [
        { id: 'rousses',   name: 'Les Rousses',          color: 'red',   from: 'top',  to: 'alp',  km: 3,  min: 10, comm: 6.5, votes: 98,  hearts: 120, slope: 22, maxSlope: 34, width: 35, snow: 'Damée tôt le matin', crowd: 0.5 },
        { id: 'combe',     name: 'La Combe Rouge',       color: 'red',   from: 'top',  to: 'jeux', km: 4,  min: 11, comm: 6.8, votes: 126, hearts: 243, slope: 24, maxSlope: 38, width: 30, snow: 'Souvent poudreuse après chute', crowd: 0.3 },
        { id: 'sarenne',   name: 'La Sarenne',           color: 'black', from: 'top',  to: 'base', km: 16, min: 45, comm: 7.8, votes: 340, hearts: 612, slope: 15, maxSlope: 40, width: 25, snow: 'Variable, exposée sud en bas', crowd: 0.4 },
        { id: 'couloir',   name: 'Le Couloir',           color: 'black', from: 'top',  to: 'alp',  km: 2.5,min: 9,  comm: 9.3, votes: 52,  hearts: 88,  slope: 36, maxSlope: 50, width: 15, snow: 'Bosses, peu damée', crowd: 0.1 },
        { id: 'chamois',   name: 'Les Chamois',          color: 'blue',  from: 'top',  to: 'jeux', km: 3.5,min: 12, comm: 4.6, votes: 74,  hearts: 65,  slope: 15, maxSlope: 24, width: 40, snow: 'Bien damée', crowd: 0.3 },
        { id: 'carrelets', name: 'Les Carrelets',        color: 'green', from: 'alp',  to: 'alp2', km: 1,  min: 3,  comm: 2.0, votes: 60,  hearts: 31,  slope: 8,  maxSlope: 12, width: 45, snow: 'Damée', crowd: 0.3 },
        { id: 'alpette',   name: "Piste de l'Alpette",   color: 'red',   from: 'alp2', to: 'base', km: 5,  min: 15, comm: 6.0, votes: 88,  hearts: 54,  slope: 20, maxSlope: 30, width: 28, snow: 'Transformée en fin de journée', crowd: 0.4 },
        { id: 'jeux',      name: 'Les Jeux',             color: 'green', from: 'jeux', to: 'base', km: 1.5,min: 7,  comm: 2.5, votes: 142, hearts: 77,  slope: 9,  maxSlope: 14, width: 50, snow: 'Damée', crowd: 0.85 },
        { id: 'marmottes', name: 'Les Marmottes',        color: 'green', from: 'jeux', to: 'base', km: 2,  min: 9,  comm: 1.8, votes: 90,  hearts: 102, slope: 7,  maxSlope: 11, width: 55, snow: 'Damée, large', crowd: 0.7 },
        { id: 'ecureuils', name: 'Les Écureuils',        color: 'blue',  from: 'jeux', to: 'base', km: 2,  min: 8,  comm: 3.8, votes: 66,  hearts: 38,  slope: 14, maxSlope: 22, width: 35, snow: 'Damée', crowd: 0.4 }
      ]
    },
    arcs: {
      id: 'arcs', name: 'Les Arcs', base: 'a18',
      nodes: {
        a18:  { name: 'Arc 1800',        alt: 1800, lat: 45.5710, lng: 6.8000, x: 50,  y: 250 },
        a20:  { name: 'Arc 2000',        alt: 2000, lat: 45.5780, lng: 6.8280, x: 160, y: 180 },
        mid:  { name: 'Mi-pente 2400',   alt: 2400, lat: 45.5870, lng: 6.8400, x: 230, y: 120 },
        sum:  { name: 'Aiguille Rouge',  alt: 3200, lat: 45.5990, lng: 6.8500, x: 290, y: 40 }
      },
      lifts: [
        { id: 'a_tc20',  name: 'Télécabine Arc 2000',        type: 'Télécabine', from: 'a18', to: 'a20', min: 7,  wait: 3 },
        { id: 'a_tscab', name: 'Télésiège de la Cabane',     type: 'Télésiège',  from: 'a20', to: 'mid', min: 8,  wait: 4 },
        { id: 'a_tcaig', name: "Télécabine de l'Aiguille",   type: 'Télécabine', from: 'mid', to: 'sum', min: 10, wait: 6 }
      ],
      pistes: [
        { id: 'a_cascade', name: 'La Cascade',     color: 'green', from: 'a20', to: 'a18', km: 2.5, min: 9,  comm: 2.2, votes: 70, hearts: 40, slope: 10, maxSlope: 15, width: 45, snow: 'Damée', crowd: 0.6 },
        { id: 'a_melezes', name: 'Les Mélèzes',    color: 'green', from: 'a20', to: 'a18', km: 2,   min: 8,  comm: 1.9, votes: 55, hearts: 33, slope: 8,  maxSlope: 12, width: 50, snow: 'Damée', crowd: 0.7 },
        { id: 'a_cabris',  name: 'Les Cabris',     color: 'blue',  from: 'mid', to: 'a20', km: 3,   min: 10, comm: 4.0, votes: 61, hearts: 49, slope: 14, maxSlope: 22, width: 40, snow: 'Bien damée', crowd: 0.3 },
        { id: 'a_belv',    name: 'Le Belvédère',   color: 'blue',  from: 'mid', to: 'a18', km: 5,   min: 15, comm: 3.9, votes: 48, hearts: 71, slope: 13, maxSlope: 21, width: 35, snow: 'Panorama, damée', crowd: 0.2 },
        { id: 'a_aig',     name: 'Les Aiguilles',  color: 'red',   from: 'sum', to: 'mid', km: 4,   min: 12, comm: 6.9, votes: 83, hearts: 96, slope: 23, maxSlope: 36, width: 30, snow: 'Variable', crowd: 0.3 },
        { id: 'a_noire',   name: 'Piste Aiguille Rouge', color: 'black', from: 'sum', to: 'mid', km: 3, min: 9, comm: 8.7, votes: 120, hearts: 210, slope: 32, maxSlope: 48, width: 18, snow: 'Raide, parfois verglacée', crowd: 0.1 }
      ]
    }
  }
};
if (typeof module !== 'undefined') module.exports = DATA;
