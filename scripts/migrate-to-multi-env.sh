#!/bin/bash

# Script de migration vers l'architecture multi-environnements

set -e

echo "🔄 Migration vers l'architecture multi-environnements..."

# Vérifier si l'ancien docker-compose.yml existe
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Fichier docker-compose.yml non trouvé"
    echo "ℹ️  Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi

# Créer une sauvegarde
echo "💾 Création d'une sauvegarde..."
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Sauvegarde créée: docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)"

# Arrêter les services existants
echo "🛑 Arrêt des services existants..."
read -p "Voulez-vous arrêter les services actuels ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose down
    echo "✅ Services arrêtés"
else
    echo "⚠️  Services non arrêtés - ils continueront à fonctionner"
fi

# Créer les répertoires nécessaires
echo "📁 Création des répertoires..."
mkdir -p logs/nginx logs/certbot logs/prod logs/staging
mkdir -p data/certbot/conf data/certbot/www

# Créer les réseaux Docker
echo "🌐 Création des réseaux Docker..."
docker network create idem-shared 2>/dev/null || echo "Réseau idem-shared existe déjà"
docker network create idem 2>/dev/null || echo "Réseau idem existe déjà"
docker network create idem-staging 2>/dev/null || echo "Réseau idem-staging existe déjà"

# Rendre les scripts exécutables
echo "🔐 Configuration des permissions..."
chmod +x staging-letsencrypt.sh
chmod +x scripts/deploy-staging.sh
chmod +x scripts/setup-environments.sh

# Vérifier les fichiers d'environnement
echo "📝 Vérification des fichiers d'environnement..."
if [ ! -f .env.staging ]; then
    echo "⚠️  Fichier .env.staging manquant"
    echo "🔧 Création du fichier .env.staging avec des valeurs par défaut..."
    echo "# Veuillez configurer ces valeurs pour l'environnement de staging" > .env.staging
    echo "NODE_ENV=staging" >> .env.staging
    echo "PORT=3002" >> .env.staging
    echo "# Copiez et adaptez les valeurs de votre .env principal" >> .env.staging
fi

# Instructions post-migration
echo ""
echo "✅ Migration terminée avec succès!"
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1. 🔧 Configurez .env.staging avec vos valeurs:"
echo "   nano .env.staging"
echo ""
echo "2. 🚀 Déployez l'environnement de production avec la nouvelle structure:"
echo "   docker-compose -f docker-compose.nginx.yml up -d"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "3. 🧪 Déployez l'environnement de staging:"
echo "   ./scripts/deploy-staging.sh"
echo ""
echo "4. 🔒 Configurez les certificats SSL pour staging:"
echo "   ./staging-letsencrypt.sh"
echo ""
echo "5. 🌐 Configurez les DNS pour les nouveaux domaines staging:"
echo "   - staging.idem-ai.com"
echo "   - staging-api.idem-ai.com"
echo "   - staging-webgen.idem-ai.com"
echo "   - staging-appgen.idem-ai.com"
echo "   - staging-chart.idem-ai.com"
echo ""
echo "⚠️  Important:"
echo "   - Votre ancien docker-compose.yml a été sauvegardé"
echo "   - Les services de production utilisent maintenant docker-compose.prod.yml"
echo "   - Les workflows CI/CD ont été mis à jour automatiquement"
echo ""
echo "📖 Consultez MULTI_ENV_DEPLOYMENT.md pour plus de détails"
