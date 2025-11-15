#!/bin/bash

# Script de déploiement pour l'environnement de staging

set -e

echo "🚀 Déploiement de l'environnement de staging..."

# Vérifier que Docker et Docker Compose sont installés
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    exit 1
fi

# Créer les répertoires nécessaires
echo "📁 Création des répertoires..."
mkdir -p logs/nginx logs/certbot data/certbot/conf data/certbot/www

# Créer les réseaux Docker si nécessaire
echo "🌐 Création des réseaux Docker..."
docker network create idem-shared 2>/dev/null || echo "Réseau idem-shared existe déjà"
docker network create idem 2>/dev/null || echo "Réseau idem existe déjà"
docker network create idem-staging 2>/dev/null || echo "Réseau idem-staging existe déjà"

# Démarrer nginx et certbot d'abord (s'ils ne sont pas déjà en cours d'exécution)
echo "🌐 Vérification de nginx et certbot..."
if ! docker-compose -f docker-compose.nginx.yml ps | grep -q "Up"; then
    echo "🌐 Démarrage de nginx et certbot..."
    docker-compose -f docker-compose.nginx.yml up -d
    echo "⏳ Attente du démarrage de nginx..."
    sleep 10
fi

# Construire et démarrer les services de staging
echo "🔨 Construction et démarrage des services de staging..."
docker-compose -f docker-compose.staging.yml build --no-cache
docker-compose -f docker-compose.staging.yml up -d

# Vérifier le statut des services
echo "✅ Vérification du statut des services..."
docker-compose -f docker-compose.nginx.yml ps
docker-compose -f docker-compose.staging.yml ps

echo "🎉 Déploiement de l'environnement de staging terminé!"
echo ""
echo "📋 Services disponibles:"
echo "   - Frontend Staging: https://staging.idem-ai.com"
echo "   - API Staging: https://staging-api.idem-ai.com"
echo "   - WebGen Staging: https://staging-webgen.idem-ai.com"
echo "   - AppGen Staging: https://staging-appgen.idem-ai.com"
echo "   - Chart Staging: https://staging-chart.idem-ai.com"
echo ""
echo "⚠️  N'oubliez pas de configurer les certificats SSL avec:"
echo "   ./staging-letsencrypt.sh"
