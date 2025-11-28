#!/bin/bash

# Script pour copier les assets de ngx-extended-pdf-viewer
# À exécuter depuis la racine du monorepo

set -e

echo "🔄 Copie des assets ngx-extended-pdf-viewer..."

# Vérifier que nous sommes à la racine du monorepo
if [ ! -f "package.json" ] || [ ! -d "apps/main-dashboard" ]; then
    echo "❌ Ce script doit être exécuté depuis la racine du monorepo"
    exit 1
fi

# Créer le dossier de destination
mkdir -p apps/main-dashboard/src/assets/ngx-extended-pdf-viewer

# Copier les assets
if [ -d "node_modules/ngx-extended-pdf-viewer/assets" ]; then
    cp -r node_modules/ngx-extended-pdf-viewer/assets/* apps/main-dashboard/src/assets/ngx-extended-pdf-viewer/
    echo "✅ Assets copiés avec succès"

    # Afficher la taille des assets copiés
    echo "📊 Taille des assets :"
    du -sh apps/main-dashboard/src/assets/ngx-extended-pdf-viewer/
else
    echo "❌ Dossier node_modules/ngx-extended-pdf-viewer/assets introuvable"
    echo "💡 Exécutez 'npm install' d'abord"
    exit 1
fi

echo "🎉 Copie terminée !"
