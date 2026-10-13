#!/bin/sh
# Régénère basemap/alpe.pmtiles : extrait de la zone d'Alpe d'Huez dans la construction quotidienne de Protomaps.
# Données © contributeurs OpenStreetMap (ODbL) ; le fichier est servi tel quel, sans appel à un serveur de tuiles tiers.
# Prérequis : l'outil `pmtiles` (https://github.com/protomaps/go-pmtiles/releases). Usage : sh tools/build_basemap.sh [AAAAMMJJ]
set -e
DAY=${1:-$(date -u -d yesterday +%Y%m%d)}
cd "$(dirname "$0")/.."
pmtiles extract "https://build.protomaps.com/$DAY.pmtiles" basemap/alpe.pmtiles --bbox=5.98,45.02,6.22,45.21 --maxzoom=15
pmtiles show basemap/alpe.pmtiles | head -12
ls -l basemap/alpe.pmtiles
