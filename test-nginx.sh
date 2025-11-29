#!/bin/bash

# Test rapide de la configuration nginx

echo "🔧 Test de la configuration nginx..."

# Vérifier la syntaxe nginx
echo "📝 Vérification de la syntaxe nginx..."
docker run --rm -v "$(pwd)/apps/main-dashboard/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuration nginx valide"
else
    echo "❌ Erreur dans la configuration nginx"
    exit 1
fi

echo "🎉 Test nginx terminé avec succès !"
