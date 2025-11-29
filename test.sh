#!/bin/bash

# Script pour tester le build Docker de main-dashboard
# Vérifie que les assets PDF sont correctement copiés

set -e

echo "🐳 Test du build Docker main-dashboard..."

# Vérifier que nous sommes à la racine du monorepo
if [ ! -f "package.json" ] || [ ! -f "Dockerfile.main-dashboard" ]; then
    echo "❌ Ce script doit être exécuté depuis la racine du monorepo"
    exit 1
fi

# Build l'image Docker
echo "📦 Building Docker image..."
docker build -f Dockerfile.main-dashboard -t idem-main-dashboard:test .

# Créer un conteneur temporaire pour vérifier les assets
echo "🔍 Vérification des assets PDF dans l'image..."
CONTAINER_ID=$(docker create idem-main-dashboard:test)

# Vérifier que les assets PDF sont présents dans le build
echo "📁 Vérification de la structure des assets..."
docker cp $CONTAINER_ID:/usr/share/nginx/html/assets/ ./temp-assets/ 2>/dev/null || {
    echo "⚠️ Dossier assets non trouvé dans l'image"
}

if [ -d "./temp-assets" ]; then
    if [ -f "./temp-assets/pdf.worker-5.4.803.mjs" ] || [ -f "./temp-assets/viewer-5.4.803.mjs" ]; then
        echo "✅ Assets PDF trouvés dans l'image Docker !"
        ls -la ./temp-assets/ | grep -E "\.(mjs|js)$" | head -5
    else
        echo "❌ Assets PDF manquants dans l'image Docker"
        echo "📂 Contenu du dossier assets :"
        ls -la ./temp-assets/ || echo "Dossier assets vide"
    fi

    # Nettoyer
    rm -rf ./temp-assets/
else
    echo "❌ Impossible d'extraire les assets de l'image"
fi

# Nettoyer le conteneur
docker rm $CONTAINER_ID >/dev/null

echo "🎉 Test terminé !"
echo "💡 Pour tester l'application : docker run -p 8080:80 idem-main-dashboard:test"
