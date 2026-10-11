/* Données de l'Espace Alpe d'Huez : GÉNÉRÉ par tools/import_alpe.py, ne pas modifier à la main.
   Source : flux public ATEN de l'Espace Alpe d'Huez (live.aten-altitude.com/alpehuez), repris du site skipass.alpedhuez.com.
   Contient nom, couleur, longueur et altitudes des pistes ; type, durée, altitudes et débit des remontées.
   Complété par tools/official_notes.json (page officielle « Les pistes mythiques »).
   Ne contient pas : les connexions piste <-> remontée, les durées de descente, ni aucune note ou vote.
   Les notes et coups de cœur démarrent à zéro : seule la communauté les remplit. */
const DATA = { stations: { alpe: {
 "id": "alpe",
 "name": "Espace Alpe d'Huez",
 "updated": "11/10/2026 20:21",
 "site": {
  "km": 250,
  "pistes": 111,
  "colors": {
   "green": 34,
   "blue": 31,
   "red": 30,
   "black": 16
  },
  "min": 1300,
  "max": 3330
 },
 "sectors": {
  "2": "Alpe d'Huez · Bergers-Marmotte",
  "11": "Alpe d'Huez · Débutants",
  "1": "Alpe d'Huez · Jeux - Lac Blanc",
  "5": "Alpe d'Huez · Pic Blanc",
  "24": "Alpe d'Huez · Première Glisse",
  "7": "Alpe d'Huez · Signal 2100",
  "6": "Alpe d'Huez · Village",
  "3": "Auris-en-Oisans Station",
  "23": "Oz 3300 · Vaujany",
  "4": "Villard Reculas Station"
 },
 "lifts": [
  {
   "name": "Alpauris",
   "type": "Télésiège débrayable",
   "altFrom": 1800,
   "altTo": 2293,
   "min": 5.0,
   "debit": 2400,
   "denivele": 493,
   "hours": "09:00 - 16:30",
   "sectors": [
    "3"
   ],
   "id": "l-alpauris"
  },
  {
   "name": "Alpe Express",
   "type": "Télécabine",
   "altFrom": null,
   "altTo": null,
   "min": 10.0,
   "debit": 2400,
   "denivele": null,
   "hours": "09:00 - 16:30",
   "sectors": [
    "6"
   ],
   "id": "l-alpe-express"
  },
  {
   "name": "Alpette",
   "type": "Télécabine",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 1600,
   "denivele": 676,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-alpette"
  },
  {
   "name": "Alpette",
   "type": "Téléski",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 720,
   "denivele": 123,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-alpette-2"
  },
  {
   "name": "Alpette-Rousses",
   "type": "Téléphérique",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 1920,
   "denivele": 755,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-alpette-rousses"
  },
  {
   "name": "Ascenseur de l'Eau d'Olle Express",
   "type": "Remontée",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": null,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-ascenseur-de-l-eau-d-olle-express"
  },
  {
   "name": "Ascenseur villard",
   "type": "Ascenseur",
   "altFrom": 1490,
   "altTo": 1510,
   "min": 2.0,
   "debit": 600,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "l-ascenseur-villard"
  },
  {
   "name": "Auris Express",
   "type": "Télésiège débrayable",
   "altFrom": 1600,
   "altTo": 1867,
   "min": 6.0,
   "debit": 2000,
   "denivele": 267,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-auris-express"
  },
  {
   "name": "Babars",
   "type": "Téléski",
   "altFrom": 1855,
   "altTo": 1955,
   "min": 4.0,
   "debit": 650,
   "denivele": 145,
   "hours": null,
   "sectors": [
    "7",
    "24"
   ],
   "id": "l-babars"
  },
  {
   "name": "Bambins",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": 8,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-bambins"
  },
  {
   "name": "Bauchets",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": 24,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-bauchets"
  },
  {
   "name": "Bergers",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": null,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2",
    "11",
    "24"
   ],
   "id": "l-bergers"
  },
  {
   "name": "Chalvet",
   "type": "Télésiège débrayable",
   "altFrom": 1550,
   "altTo": 2176,
   "min": 7.0,
   "debit": 2400,
   "denivele": 585,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2"
   ],
   "id": "l-chalvet"
  },
  {
   "name": "Champ Clotury",
   "type": "Téléski",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": null,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-champ-clotury"
  },
  {
   "name": "Clos du Pre",
   "type": "Téléski",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 600,
   "denivele": 52,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-clos-du-pre"
  },
  {
   "name": "Clos Giraud",
   "type": "Télémix",
   "altFrom": 1820,
   "altTo": 2054,
   "min": 11.0,
   "debit": 1200,
   "denivele": 234,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-clos-giraud"
  },
  {
   "name": "Cloudit",
   "type": "Téléski",
   "altFrom": 1470,
   "altTo": 1543,
   "min": 1.0,
   "debit": 900,
   "denivele": 73,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "l-cloudit"
  },
  {
   "name": "Eau d'Olle Express",
   "type": "Télécabine",
   "altFrom": 728,
   "altTo": 1384,
   "min": 8.0,
   "debit": 1100,
   "denivele": 656,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-eau-d-olle-express"
  },
  {
   "name": "Ecole 1",
   "type": "Téléski",
   "altFrom": 1870,
   "altTo": 1900,
   "min": 1.0,
   "debit": 450,
   "denivele": 17,
   "hours": "09:00 - 16:30",
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "l-ecole-1"
  },
  {
   "name": "Ecole 2",
   "type": "Téléski",
   "altFrom": 1870,
   "altTo": 1890,
   "min": 4.0,
   "debit": 450,
   "denivele": 40,
   "hours": null,
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "l-ecole-2"
  },
  {
   "name": "Enversin",
   "type": "Télécabine",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-enversin"
  },
  {
   "name": "Escargots",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 1000,
   "denivele": 10,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "l-escargots"
  },
  {
   "name": "Fontfroide",
   "type": "Télésiège débrayable",
   "altFrom": 1703,
   "altTo": 2156,
   "min": 4.0,
   "debit": 2700,
   "denivele": 453,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-fontfroide"
  },
  {
   "name": "Forêt",
   "type": "Téléski",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 700,
   "denivele": 72,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-foret"
  },
  {
   "name": "Grande Sure",
   "type": "Télésiège",
   "altFrom": 1764,
   "altTo": 2114,
   "min": 8.0,
   "debit": 480,
   "denivele": 350,
   "hours": null,
   "sectors": [
    "7"
   ],
   "id": "l-grande-sure"
  },
  {
   "name": "Grenouilles",
   "type": "Tapis",
   "altFrom": 1860,
   "altTo": 1870,
   "min": 2.0,
   "debit": 900,
   "denivele": 9,
   "hours": null,
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "l-grenouilles"
  },
  {
   "name": "Herpie",
   "type": "Télésiège",
   "altFrom": 2735,
   "altTo": 3061,
   "min": 7.0,
   "debit": 2000,
   "denivele": 326,
   "hours": "09:00 - 16:30",
   "sectors": [
    "5"
   ],
   "id": "l-herpie"
  },
  {
   "name": "Huez Express",
   "type": "Télécabine",
   "altFrom": 1485,
   "altTo": 1780,
   "min": 4.5,
   "debit": 2400,
   "denivele": 295,
   "hours": "09:00 - 16:30",
   "sectors": [
    "6"
   ],
   "id": "l-huez-express"
  },
  {
   "name": "Jeux",
   "type": "Télémix",
   "altFrom": 1864,
   "altTo": 2098,
   "min": 4.0,
   "debit": 3900,
   "denivele": 235,
   "hours": null,
   "sectors": [
    "1",
    "24"
   ],
   "id": "l-jeux"
  },
  {
   "name": "Lac Blanc",
   "type": "Télésiège",
   "altFrom": 2533,
   "altTo": 2637,
   "min": 2.0,
   "debit": 2000,
   "denivele": 104,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "l-lac-blanc"
  },
  {
   "name": "Lama",
   "type": "Téléski",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 700,
   "denivele": 20,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-lama"
  },
  {
   "name": "Langaret",
   "type": "Téléski",
   "altFrom": 1562,
   "altTo": 1715,
   "min": 3.0,
   "debit": 900,
   "denivele": 153,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "l-langaret"
  },
  {
   "name": "Lièvre Blanc",
   "type": "Télésiège",
   "altFrom": 2100,
   "altTo": 2530,
   "min": 11.0,
   "debit": 1800,
   "denivele": 447,
   "hours": "09:00 - 16:30",
   "sectors": [
    "1"
   ],
   "id": "l-lievre-blanc"
  },
  {
   "name": "Lombards",
   "type": "Télésiège",
   "altFrom": 1574,
   "altTo": 1831,
   "min": 6.0,
   "debit": 2000,
   "denivele": 256,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-lombards"
  },
  {
   "name": "Louvets",
   "type": "Télésiège débrayable",
   "altFrom": 1790,
   "altTo": 1953,
   "min": 3.0,
   "debit": 2000,
   "denivele": 163,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-louvets"
  },
  {
   "name": "Marmottes 1",
   "type": "Télémix",
   "altFrom": 1809,
   "altTo": 2337,
   "min": 13.0,
   "debit": 3300,
   "denivele": 528,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2"
   ],
   "id": "l-marmottes-1"
  },
  {
   "name": "Marmottes 2",
   "type": "Télécabine",
   "altFrom": 2325,
   "altTo": 2753,
   "min": 5.0,
   "debit": 1650,
   "denivele": 428,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2"
   ],
   "id": "l-marmottes-2"
  },
  {
   "name": "Marmottes 3",
   "type": "Remontée",
   "altFrom": 2774,
   "altTo": 3065,
   "min": 4.0,
   "debit": 1050,
   "denivele": 291,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2"
   ],
   "id": "l-marmottes-3"
  },
  {
   "name": "Maronne",
   "type": "Télésiège",
   "altFrom": 1450,
   "altTo": 1787,
   "min": 7.0,
   "debit": 900,
   "denivele": 337,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-maronne"
  },
  {
   "name": "Montfrais",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": 19,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-montfrais"
  },
  {
   "name": "Montfrais",
   "type": "Télésiège",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 1500,
   "denivele": 296,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-montfrais-2"
  },
  {
   "name": "Montfrais 1",
   "type": "Téléski",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 720,
   "denivele": 44,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-montfrais-1"
  },
  {
   "name": "Moutons",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": null,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2",
    "11",
    "24"
   ],
   "id": "l-moutons"
  },
  {
   "name": "Olmet",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": 15,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-olmet"
  },
  {
   "name": "Olmet",
   "type": "Téléski",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 800,
   "denivele": 45,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-olmet-2"
  },
  {
   "name": "Petit Prince",
   "type": "Téléski",
   "altFrom": 1865,
   "altTo": 2109,
   "min": 4.0,
   "debit": 720,
   "denivele": 245,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "l-petit-prince"
  },
  {
   "name": "Pic Blanc",
   "type": "Téléphérique",
   "altFrom": 2622,
   "altTo": 3318,
   "min": 5.0,
   "debit": 1015,
   "denivele": 696,
   "hours": "09:00 - 16:30",
   "sectors": [
    "5"
   ],
   "id": "l-pic-blanc"
  },
  {
   "name": "Pic Blanc 1 et 2",
   "type": "Télécabine",
   "altFrom": 1860,
   "altTo": 2700,
   "min": 14.0,
   "debit": 3000,
   "denivele": 753,
   "hours": "09:00 - 16:30",
   "sectors": [
    "1",
    "5"
   ],
   "id": "l-pic-blanc-1-et-2"
  },
  {
   "name": "Piégut",
   "type": "Téléski",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 700,
   "denivele": 49,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-piegut"
  },
  {
   "name": "Poutran",
   "type": "Téléski",
   "altFrom": 1880,
   "altTo": 1996,
   "min": 4.0,
   "debit": 720,
   "denivele": 116,
   "hours": null,
   "sectors": [
    "7"
   ],
   "id": "l-poutran"
  },
  {
   "name": "Poutran",
   "type": "Télécabine",
   "altFrom": 1350,
   "altTo": 2107,
   "min": 8.0,
   "debit": 2400,
   "denivele": 756,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-poutran-2"
  },
  {
   "name": "Rif Nel",
   "type": "Télécabine",
   "altFrom": 1813,
   "altTo": 2098,
   "min": 6.0,
   "debit": 3045,
   "denivele": 285,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2",
    "11",
    "24"
   ],
   "id": "l-rif-nel"
  },
  {
   "name": "Rif Nel 1",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": null,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2",
    "11",
    "24"
   ],
   "id": "l-rif-nel-1"
  },
  {
   "name": "Rif Nel 2",
   "type": "Tapis",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": null,
   "denivele": null,
   "hours": "09:00 - 16:30",
   "sectors": [
    "2",
    "11",
    "24"
   ],
   "id": "l-rif-nel-2"
  },
  {
   "name": "Romains",
   "type": "Télésiège débrayable",
   "altFrom": 1800,
   "altTo": 2148,
   "min": 4.0,
   "debit": 3200,
   "denivele": 337,
   "hours": null,
   "sectors": [
    "2",
    "24"
   ],
   "id": "l-romains"
  },
  {
   "name": "Sagnes",
   "type": "Téléski",
   "altFrom": 1874,
   "altTo": 1885,
   "min": 1.0,
   "debit": 450,
   "denivele": 13,
   "hours": null,
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "l-sagnes"
  },
  {
   "name": "Signal",
   "type": "Télémix",
   "altFrom": 1860,
   "altTo": 2112,
   "min": 2.2,
   "debit": 3360,
   "denivele": 252,
   "hours": "09:00 - 16:30",
   "sectors": [
    "7",
    "24"
   ],
   "id": "l-signal"
  },
  {
   "name": "Stade",
   "type": "Téléski",
   "altFrom": 1871,
   "altTo": 2070,
   "min": 3.0,
   "debit": 900,
   "denivele": 204,
   "hours": null,
   "sectors": [
    "7"
   ],
   "id": "l-stade"
  },
  {
   "name": "Sures",
   "type": "Télémix",
   "altFrom": 1600,
   "altTo": 1871,
   "min": null,
   "debit": null,
   "denivele": 274,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "l-sures"
  },
  {
   "name": "Tortue",
   "type": "Téléski",
   "altFrom": 1562,
   "altTo": 1600,
   "min": 1.0,
   "debit": 600,
   "denivele": 38,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "l-tortue"
  },
  {
   "name": "Télécentre",
   "type": "Télécabine",
   "altFrom": 1783,
   "altTo": 1860,
   "min": 11.0,
   "debit": 960,
   "denivele": 77,
   "hours": "09:00 - 16:30",
   "sectors": [
    "6"
   ],
   "id": "l-telecentre"
  },
  {
   "name": "Vallonets",
   "type": "Télésiège",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 1500,
   "denivele": 377,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-vallonets"
  },
  {
   "name": "Vaujany-Alpette",
   "type": "Téléphérique",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 1532,
   "denivele": 812,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "l-vaujany-alpette"
  },
  {
   "name": "Vaujany-Montfrais",
   "type": "Télécabine",
   "altFrom": null,
   "altTo": null,
   "min": null,
   "debit": 1500,
   "denivele": 424,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "l-vaujany-montfrais"
  },
  {
   "name": "Villarais",
   "type": "Télésiège débrayable",
   "altFrom": 1560,
   "altTo": 2103,
   "min": 6.0,
   "debit": 2000,
   "denivele": 543,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "l-villarais"
  }
 ],
 "pistes": [
  {
   "name": "Balcons",
   "color": "black",
   "km": 1.39,
   "altFrom": 2770,
   "altTo": 2520,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "balcons-black"
  },
  {
   "name": "Balme",
   "color": "black",
   "km": 3.46,
   "altFrom": 2450,
   "altTo": 1930,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "balme-black"
  },
  {
   "name": "Bergeries",
   "color": "black",
   "km": 1.67,
   "altFrom": 2150,
   "altTo": 1790,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "bergeries-black"
  },
  {
   "name": "Brèche",
   "color": "black",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "breche-black"
  },
  {
   "name": "Cassini",
   "color": "black",
   "km": 1.44,
   "altFrom": 3150,
   "altTo": 2925,
   "denivele": null,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "cassini-black"
  },
  {
   "name": "Clocher de Macle",
   "color": "black",
   "km": 1.13,
   "altFrom": 2770,
   "altTo": 2520,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "clocher-de-macle-black"
  },
  {
   "name": "Col de Cluy",
   "color": "black",
   "km": 5.25,
   "altFrom": 2150,
   "altTo": 1650,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "col-de-cluy-black"
  },
  {
   "name": "Combe Charbonnière",
   "color": "black",
   "km": 5.35,
   "altFrom": 2770,
   "altTo": 1980,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "combe-charbonniere-black"
  },
  {
   "name": "Cristaux",
   "color": "black",
   "km": 2.8,
   "altFrom": 3010,
   "altTo": 2600,
   "denivele": null,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "cristaux-black"
  },
  {
   "name": "Forêt",
   "color": "black",
   "km": 1.84,
   "altFrom": 2025,
   "altTo": 1495,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "foret-black"
  },
  {
   "name": "Glacier",
   "color": "black",
   "km": 1.1,
   "altFrom": 3195,
   "altTo": 2950,
   "denivele": null,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "glacier-black"
  },
  {
   "name": "La Fare",
   "color": "black",
   "km": 4.7,
   "altFrom": 1850,
   "altTo": 1130,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "la-fare-black",
   "official": [
    "Longueur : 4,7 km",
    "Dénivelé : 720 m",
    "Exposition nord"
   ],
   "info": "La grande noire du secteur Oz-Vaujany : une longue descente technique au cœur des sapins."
  },
  {
   "name": "La Fuma",
   "color": "black",
   "km": 1.5,
   "altFrom": 1775,
   "altTo": 1595,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "la-fuma-black"
  },
  {
   "name": "Roche Noire",
   "color": "black",
   "km": null,
   "altFrom": 1620,
   "altTo": 1370,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "roche-noire-black"
  },
  {
   "name": "Sarenne",
   "color": "black",
   "km": 16.0,
   "altFrom": 3320,
   "altTo": 1650,
   "denivele": null,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "sarenne-black",
   "official": [
    "Altitude de départ : 3 330 m (Pic Blanc)",
    "Longueur : 16 km",
    "Dénivelé : 1 820 m depuis le sommet du Pic Blanc"
   ],
   "info": "La plus longue piste noire d'Europe. Une première partie engagée en haute montagne, avant une longue descente jusqu'aux gorges de Sarenne. Destinée aux skieurs confirmés."
  },
  {
   "name": "Tunnel",
   "color": "black",
   "km": 3.33,
   "altFrom": 3250,
   "altTo": 2530,
   "denivele": null,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "tunnel-black",
   "official": [
    "Altitude de départ : environ 3 000 m",
    "200 m de traversée à l'intérieur de la montagne",
    "Pente jusqu'à 35°"
   ],
   "info": "Sortie directe sur l'un des champs de bosses les plus raides du domaine. Piste noire engagée, réservée aux skieurs très expérimentés."
  },
  {
   "name": "Ancolies",
   "color": "blue",
   "km": 2.08,
   "altFrom": 2325,
   "altTo": 2125,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "ancolies-blue"
  },
  {
   "name": "Bergers",
   "color": "blue",
   "km": 1.75,
   "altFrom": 2335,
   "altTo": 1810,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "bergers-blue"
  },
  {
   "name": "Boulevard des Lacs",
   "color": "blue",
   "km": 1.85,
   "altFrom": 2150,
   "altTo": 2025,
   "denivele": null,
   "hours": null,
   "sectors": [
    "1"
   ],
   "id": "boulevard-des-lacs-blue"
  },
  {
   "name": "Boulevard des Marmottes",
   "color": "blue",
   "km": 0.5,
   "altFrom": 2360,
   "altTo": 2335,
   "denivele": null,
   "hours": null,
   "sectors": [
    "1"
   ],
   "id": "boulevard-des-marmottes-blue"
  },
  {
   "name": "Brebis",
   "color": "blue",
   "km": 0.9,
   "altFrom": 1720,
   "altTo": 1550,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "brebis-blue"
  },
  {
   "name": "Cascade",
   "color": "blue",
   "km": null,
   "altFrom": 1900,
   "altTo": 1830,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "cascade-blue"
  },
  {
   "name": "Chalets",
   "color": "blue",
   "km": null,
   "altFrom": 2050,
   "altTo": 1810,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "chalets-blue"
  },
  {
   "name": "Champclotury",
   "color": "blue",
   "km": null,
   "altFrom": 1880,
   "altTo": 1350,
   "denivele": null,
   "hours": "09:00 - 16:30",
   "sectors": [
    "23"
   ],
   "id": "champclotury-blue"
  },
  {
   "name": "Chevreuils",
   "color": "blue",
   "km": null,
   "altFrom": 1750,
   "altTo": 1380,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "chevreuils-blue"
  },
  {
   "name": "Col",
   "color": "blue",
   "km": 0.9,
   "altFrom": 1865,
   "altTo": 1595,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "col-blue"
  },
  {
   "name": "Couloir",
   "color": "blue",
   "km": 3.66,
   "altFrom": 2620,
   "altTo": 2100,
   "denivele": null,
   "hours": null,
   "sectors": [
    "1"
   ],
   "id": "couloir-blue"
  },
  {
   "name": "Cristallière",
   "color": "blue",
   "km": 1.6,
   "altFrom": 3070,
   "altTo": 2735,
   "denivele": null,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "cristalliere-blue"
  },
  {
   "name": "Edelweiss",
   "color": "blue",
   "km": null,
   "altFrom": 2010,
   "altTo": 1650,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "edelweiss-blue"
  },
  {
   "name": "Eteaux",
   "color": "blue",
   "km": null,
   "altFrom": 1905,
   "altTo": 1830,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "eteaux-blue"
  },
  {
   "name": "Eterlous",
   "color": "blue",
   "km": 1.95,
   "altFrom": 1695,
   "altTo": 1865,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "eterlous-blue"
  },
  {
   "name": "Etourneaux",
   "color": "blue",
   "km": null,
   "altFrom": 1905,
   "altTo": 1715,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "etourneaux-blue"
  },
  {
   "name": "Farcis",
   "color": "blue",
   "km": 0.95,
   "altFrom": 1700,
   "altTo": 1435,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "farcis-blue"
  },
  {
   "name": "Gentianes",
   "color": "blue",
   "km": 1.2,
   "altFrom": 1875,
   "altTo": 1700,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "gentianes-blue"
  },
  {
   "name": "Gua",
   "color": "blue",
   "km": 3.0,
   "altFrom": 1800,
   "altTo": 1650,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "gua-blue"
  },
  {
   "name": "Herpie",
   "color": "blue",
   "km": 2.0,
   "altFrom": 3060,
   "altTo": 2825,
   "denivele": null,
   "hours": null,
   "sectors": [
    "5"
   ],
   "id": "herpie-blue"
  },
  {
   "name": "Le Gua Sarenne",
   "color": "blue",
   "km": 1.8,
   "altFrom": 1650,
   "altTo": 1525,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "le-gua-sarenne-blue"
  },
  {
   "name": "Les Agneaux",
   "color": "blue",
   "km": 1.91,
   "altFrom": 1940,
   "altTo": 1820,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2",
    "24"
   ],
   "id": "les-agneaux-blue"
  },
  {
   "name": "Les Vallons",
   "color": "blue",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "les-vallons-blue"
  },
  {
   "name": "Lys",
   "color": "blue",
   "km": 1.5,
   "altFrom": 1830,
   "altTo": 1575,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "lys-blue"
  },
  {
   "name": "Myrtilles",
   "color": "blue",
   "km": null,
   "altFrom": 1900,
   "altTo": 1730,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "myrtilles-blue"
  },
  {
   "name": "Petit Prince",
   "color": "blue",
   "km": 1.57,
   "altFrom": 2100,
   "altTo": 1855,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "petit-prince-blue"
  },
  {
   "name": "Poutran",
   "color": "blue",
   "km": null,
   "altFrom": 2080,
   "altTo": 1840,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "poutran-blue"
  },
  {
   "name": "Pré-rond",
   "color": "blue",
   "km": 1.35,
   "altFrom": 2150,
   "altTo": 1705,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "pre-rond-blue"
  },
  {
   "name": "Travers",
   "color": "blue",
   "km": null,
   "altFrom": 1830,
   "altTo": 1720,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "travers-blue"
  },
  {
   "name": "Village",
   "color": "blue",
   "km": 2.1,
   "altFrom": 1840,
   "altTo": 1470,
   "denivele": null,
   "hours": null,
   "sectors": [
    "6"
   ],
   "id": "village-blue"
  },
  {
   "name": "Villard",
   "color": "blue",
   "km": 2.28,
   "altFrom": 2100,
   "altTo": 1560,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "villard-blue"
  },
  {
   "name": "Allouettes",
   "color": "green",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "allouettes-green"
  },
  {
   "name": "Altiport",
   "color": "green",
   "km": 1.5,
   "altFrom": 1935,
   "altTo": 1860,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2",
    "24"
   ],
   "id": "altiport-green"
  },
  {
   "name": "Ascenceur",
   "color": "green",
   "km": 0.98,
   "altFrom": 1530,
   "altTo": 1490,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "ascenceur-green"
  },
  {
   "name": "Babars",
   "color": "green",
   "km": 1.23,
   "altFrom": 2020,
   "altTo": 1860,
   "denivele": null,
   "hours": "09:00 - 17:00",
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "babars-green"
  },
  {
   "name": "Canetons",
   "color": "green",
   "km": null,
   "altFrom": 1365,
   "altTo": 1350,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "canetons-green"
  },
  {
   "name": "Carrelet",
   "color": "green",
   "km": null,
   "altFrom": 2050,
   "altTo": 1930,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "carrelet-green"
  },
  {
   "name": "Chardons",
   "color": "green",
   "km": 1.8,
   "altFrom": 2020,
   "altTo": 1895,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "chardons-green"
  },
  {
   "name": "Chemin des Demoiselles",
   "color": "green",
   "km": 0.6,
   "altFrom": 1865,
   "altTo": 1700,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "chemin-des-demoiselles-green"
  },
  {
   "name": "Chevreaux",
   "color": "green",
   "km": 0.7,
   "altFrom": 1720,
   "altTo": 1570,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "chevreaux-green"
  },
  {
   "name": "Chez Roger",
   "color": "green",
   "km": 3.03,
   "altFrom": 2155,
   "altTo": 1810,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2",
    "24"
   ],
   "id": "chez-roger-green"
  },
  {
   "name": "Clarines",
   "color": "green",
   "km": 0.61,
   "altFrom": 1920,
   "altTo": 1815,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2",
    "11",
    "24"
   ],
   "id": "clarines-green"
  },
  {
   "name": "Clos du Pré",
   "color": "green",
   "km": null,
   "altFrom": 1400,
   "altTo": 1320,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "clos-du-pre-green"
  },
  {
   "name": "Cloudit",
   "color": "green",
   "km": 0.9,
   "altFrom": 1560,
   "altTo": 1480,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "cloudit-green"
  },
  {
   "name": "Crocus",
   "color": "green",
   "km": 1.5,
   "altFrom": 1645,
   "altTo": 1595,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "crocus-green"
  },
  {
   "name": "Dolines",
   "color": "green",
   "km": null,
   "altFrom": 1765,
   "altTo": 1715,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "dolines-green"
  },
  {
   "name": "Eclose",
   "color": "green",
   "km": 0.25,
   "altFrom": 1820,
   "altTo": 1790,
   "denivele": null,
   "hours": null,
   "sectors": [
    "6"
   ],
   "id": "eclose-green"
  },
  {
   "name": "Ecole",
   "color": "green",
   "km": 0.48,
   "altFrom": 1915,
   "altTo": 1860,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "ecole-green"
  },
  {
   "name": "Ecureuils",
   "color": "green",
   "km": null,
   "altFrom": 1715,
   "altTo": 1650,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "ecureuils-green"
  },
  {
   "name": "Epicéas",
   "color": "green",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "epiceas-green"
  },
  {
   "name": "Erables",
   "color": "green",
   "km": 0.39,
   "altFrom": 1540,
   "altTo": 1490,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "erables-green"
  },
  {
   "name": "Grenouilles",
   "color": "green",
   "km": 0.31,
   "altFrom": 1860,
   "altTo": 1855,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "11"
   ],
   "id": "grenouilles-green"
  },
  {
   "name": "Jeux",
   "color": "green",
   "km": 2.44,
   "altFrom": 2080,
   "altTo": 1965,
   "denivele": null,
   "hours": null,
   "sectors": [
    "1",
    "24"
   ],
   "id": "jeux-green"
  },
  {
   "name": "Lac Blanc",
   "color": "green",
   "km": 2.33,
   "altFrom": 1995,
   "altTo": 1860,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2",
    "24"
   ],
   "id": "lac-blanc-green"
  },
  {
   "name": "Les bûcherons",
   "color": "green",
   "km": 1.8,
   "altFrom": 1875,
   "altTo": 1640,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "les-bucherons-green"
  },
  {
   "name": "Les Moutons",
   "color": "green",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2",
    "11",
    "24"
   ],
   "id": "les-moutons-green"
  },
  {
   "name": "Les Sagnes",
   "color": "green",
   "km": null,
   "altFrom": 1860,
   "altTo": 1860,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "les-sagnes-green"
  },
  {
   "name": "Loup Blanc",
   "color": "green",
   "km": 1.52,
   "altFrom": 2000,
   "altTo": 1820,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2",
    "24"
   ],
   "id": "loup-blanc-green"
  },
  {
   "name": "Lutins",
   "color": "green",
   "km": null,
   "altFrom": 1875,
   "altTo": 1840,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "lutins-green"
  },
  {
   "name": "Léo de l'Alpe",
   "color": "green",
   "km": 1.14,
   "altFrom": 1860,
   "altTo": 1790,
   "denivele": null,
   "hours": null,
   "sectors": [
    "6"
   ],
   "id": "leo-de-l-alpe-green"
  },
  {
   "name": "Marcel's Farm",
   "color": "green",
   "km": 1.95,
   "altFrom": 2110,
   "altTo": 1860,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "24"
   ],
   "id": "marcel-s-farm-green"
  },
  {
   "name": "Mélèzes",
   "color": "green",
   "km": 0.85,
   "altFrom": 1860,
   "altTo": 1800,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2",
    "24"
   ],
   "id": "melezes-green"
  },
  {
   "name": "Piste de Bob",
   "color": "green",
   "km": 1.5,
   "altFrom": 2100,
   "altTo": 1870,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "11",
    "24"
   ],
   "id": "piste-de-bob-green"
  },
  {
   "name": "Premier",
   "color": "green",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "1",
    "24"
   ],
   "id": "premier-green"
  },
  {
   "name": "Rif Nel",
   "color": "green",
   "km": 1.0,
   "altFrom": 1865,
   "altTo": 1805,
   "denivele": null,
   "hours": null,
   "sectors": [
    "1",
    "11",
    "24"
   ],
   "id": "rif-nel-green"
  },
  {
   "name": "Stade Débutant Villard",
   "color": "green",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "stade-debutant-villard-green"
  },
  {
   "name": "Stade Débutants Alpette",
   "color": "green",
   "km": null,
   "altFrom": 2070,
   "altTo": 2050,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "stade-debutants-alpette-green"
  },
  {
   "name": "Violettes",
   "color": "green",
   "km": 1.68,
   "altFrom": 2010,
   "altTo": 1880,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "24"
   ],
   "id": "violettes-green"
  },
  {
   "name": "Alpette",
   "color": "red",
   "km": null,
   "altFrom": 2050,
   "altTo": 1620,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "alpette-red"
  },
  {
   "name": "Anémones",
   "color": "red",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "24"
   ],
   "id": "anemones-red"
  },
  {
   "name": "Bartavelles",
   "color": "red",
   "km": null,
   "altFrom": 2110,
   "altTo": 2000,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "bartavelles-red"
  },
  {
   "name": "Belvédère",
   "color": "red",
   "km": null,
   "altFrom": 2810,
   "altTo": 2540,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "belvedere-red"
  },
  {
   "name": "Campanules",
   "color": "red",
   "km": 3.68,
   "altFrom": 2220,
   "altTo": 2225,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "campanules-red"
  },
  {
   "name": "Chamois",
   "color": "red",
   "km": 3.16,
   "altFrom": 2595,
   "altTo": 1985,
   "denivele": null,
   "hours": null,
   "sectors": [
    "1"
   ],
   "id": "chamois-red"
  },
  {
   "name": "Chavanus",
   "color": "red",
   "km": null,
   "altFrom": null,
   "altTo": null,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "chavanus-red"
  },
  {
   "name": "Dahut",
   "color": "red",
   "km": 1.0,
   "altFrom": 2335,
   "altTo": 2250,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "dahut-red"
  },
  {
   "name": "Déversoir",
   "color": "red",
   "km": 1.85,
   "altFrom": 2765,
   "altTo": 2325,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "deversoir-red"
  },
  {
   "name": "Dôme",
   "color": "red",
   "km": null,
   "altFrom": 2810,
   "altTo": 2620,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "dome-red"
  },
  {
   "name": "Escapade",
   "color": "red",
   "km": 1.8,
   "altFrom": 1980,
   "altTo": 1700,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "escapade-red"
  },
  {
   "name": "Fontfroide",
   "color": "red",
   "km": 2.4,
   "altFrom": 2150,
   "altTo": 1700,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "fontfroide-red"
  },
  {
   "name": "Hermine",
   "color": "red",
   "km": 1.3,
   "altFrom": 3065,
   "altTo": 2800,
   "denivele": null,
   "hours": "09:10 - 16:30",
   "sectors": [
    "5"
   ],
   "id": "hermine-red"
  },
  {
   "name": "Huez",
   "color": "red",
   "km": 2.1,
   "altFrom": 1780,
   "altTo": 1605,
   "denivele": null,
   "hours": null,
   "sectors": [
    "6"
   ],
   "id": "huez-red"
  },
  {
   "name": "Le Rosai",
   "color": "red",
   "km": 1.97,
   "altFrom": 2145,
   "altTo": 1590,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "le-rosai-red"
  },
  {
   "name": "Lièvre Blanc",
   "color": "red",
   "km": 1.0,
   "altFrom": 2530,
   "altTo": 2370,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "lievre-blanc-red"
  },
  {
   "name": "Mur",
   "color": "red",
   "km": 0.59,
   "altFrom": 1905,
   "altTo": 1555,
   "denivele": null,
   "hours": null,
   "sectors": [
    "4"
   ],
   "id": "mur-red"
  },
  {
   "name": "Olmet",
   "color": "red",
   "km": null,
   "altFrom": 1880,
   "altTo": 1350,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "olmet-red"
  },
  {
   "name": "Olympique",
   "color": "red",
   "km": 3.58,
   "altFrom": 2300,
   "altTo": 1945,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "olympique-red"
  },
  {
   "name": "Petite Sure",
   "color": "red",
   "km": 2.1,
   "altFrom": 2100,
   "altTo": 1840,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7",
    "24"
   ],
   "id": "petite-sure-red"
  },
  {
   "name": "Poutat",
   "color": "red",
   "km": 1.0,
   "altFrom": 2335,
   "altTo": 2180,
   "denivele": null,
   "hours": null,
   "sectors": [
    "2"
   ],
   "id": "poutat-red"
  },
  {
   "name": "Rhodos",
   "color": "red",
   "km": 1.2,
   "altFrom": 1870,
   "altTo": 1660,
   "denivele": null,
   "hours": null,
   "sectors": [
    "3"
   ],
   "id": "rhodos-red"
  },
  {
   "name": "Rousses",
   "color": "red",
   "km": null,
   "altFrom": 2525,
   "altTo": 2050,
   "denivele": null,
   "hours": "09:10 - 16:45",
   "sectors": [
    "23"
   ],
   "id": "rousses-red"
  },
  {
   "name": "Signal",
   "color": "red",
   "km": 1.5,
   "altFrom": 2110,
   "altTo": 1865,
   "denivele": null,
   "hours": "10:00 - 15:00",
   "sectors": [
    "7",
    "24"
   ],
   "id": "signal-red"
  },
  {
   "name": "Stade Désiré Lacroix",
   "color": "red",
   "km": 0.89,
   "altFrom": 2110,
   "altTo": 1860,
   "denivele": null,
   "hours": null,
   "sectors": [
    "7"
   ],
   "id": "stade-desire-lacroix-red"
  },
  {
   "name": "Stade Montfrais",
   "color": "red",
   "km": null,
   "altFrom": null,
   "altTo": 1900,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "stade-montfrais-red"
  },
  {
   "name": "Vaujaniate",
   "color": "red",
   "km": null,
   "altFrom": 1660,
   "altTo": 1295,
   "denivele": null,
   "hours": null,
   "sectors": [
    "23"
   ],
   "id": "vaujaniate-red"
  }
 ]
} } };
if (typeof module !== 'undefined') module.exports = DATA;
