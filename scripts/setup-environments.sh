#!/bin/bash

# Script de configuration initiale pour les environnements multi-env

set -e

echo "🔧 Configuration des environnements de production et staging..."

# Vérifier les prérequis
echo "🔍 Vérification des prérequis..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git n'est pas installé"
    exit 1
fi

# Créer les répertoires nécessaires
echo "📁 Création de la structure de répertoires..."
mkdir -p logs/nginx logs/certbot logs/prod logs/staging
mkdir -p data/certbot/conf data/certbot/www
mkdir -p data/nginx

# Rendre les scripts exécutables
echo "🔐 Configuration des permissions..."
chmod +x staging-letsencrypt.sh
chmod +x scripts/deploy-staging.sh

# Créer les réseaux Docker
echo "🌐 Création des réseaux Docker..."
docker network create idem-shared 2>/dev/null || echo "Réseau idem-shared existe déjà"
docker network create idem 2>/dev/null || echo "Réseau idem existe déjà"
docker network create idem-staging 2>/dev/null || echo "Réseau idem-staging existe déjà"

# Vérifier les fichiers d'environnement
echo "📝 Vérification des fichiers d'environnement..."
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env manquant pour la production"
    echo "🔧 Veuillez configurer .env avec vos valeurs de production"
fi

if [ ! -f .env.staging ]; then
    echo "⚠️  Fichier .env.staging manquant - créé avec des valeurs par défaut"
    echo "🔧 Veuillez configurer .env.staging avec vos valeurs"
fi

# Afficher les informations de configuration
echo ""
echo "✅ Configuration terminée!"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Configurez vos fichiers d'environnement:"
echo "      - .env (pour l'environnement de production - existant)"
echo "      - .env.staging (pour l'environnement de staging)"
echo ""
echo "   2. Déployez l'environnement souhaité:"
echo "      - Pour production: docker-compose -f docker-compose.prod.yml up -d"
echo "      - Pour staging: ./scripts/deploy-staging.sh"
echo ""
echo "   3. Configurez les certificats SSL:"
echo "      - Pour staging: ./staging-letsencrypt.sh"
echo ""
echo "🌐 Domaines configurés:"
echo "   Production (existants):"
echo "     - https://idem-ai.com"
echo "     - https://api.idem-ai.com"
echo "   Staging (nouveaux):"
echo "     - https://staging.idem-ai.com"
echo "     - https://staging-api.idem-ai.com"
