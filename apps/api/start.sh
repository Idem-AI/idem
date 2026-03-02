#!/bin/bash

set -e

echo "🚀 IDEM API - Démarrage complet"
echo "================================"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    echo "Installez Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose n'est pas installé${NC}"
    echo "Installez Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Fichier .env non trouvé${NC}"
    echo "Création du fichier .env depuis .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✅ Fichier .env créé${NC}"
    echo -e "${YELLOW}⚠️  Veuillez configurer vos variables d'environnement dans .env${NC}"
fi

echo ""
echo "📦 Étape 1/4: Démarrage des services Docker"
echo "-------------------------------------------"
docker-compose up -d

echo ""
echo "⏳ Attente du démarrage des services (30s)..."
sleep 30

echo ""
echo "🔍 Étape 2/4: Vérification des services"
echo "---------------------------------------"

# Vérifier Casdoor
if curl -s http://localhost:8000 > /dev/null; then
    echo -e "${GREEN}✅ Casdoor: http://localhost:8000${NC}"
else
    echo -e "${RED}❌ Casdoor n'est pas accessible${NC}"
fi

# Vérifier MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null; then
    echo -e "${GREEN}✅ MinIO API: http://localhost:9000${NC}"
    echo -e "${GREEN}✅ MinIO Console: http://localhost:9001${NC}"
else
    echo -e "${RED}❌ MinIO n'est pas accessible${NC}"
fi

# Vérifier MongoDB
if docker exec idem-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB: mongodb://localhost:27017${NC}"
else
    echo -e "${RED}❌ MongoDB n'est pas accessible${NC}"
fi

echo ""
echo "📚 Étape 3/4: Installation des dépendances"
echo "------------------------------------------"
npm install

echo ""
echo "🚀 Étape 4/4: Démarrage de l'API"
echo "--------------------------------"
echo ""
echo -e "${GREEN}✅ Tous les services sont prêts!${NC}"
echo ""
echo "📋 Services disponibles:"
echo "  • API:            http://localhost:3001"
echo "  • Casdoor:        http://localhost:8000 (admin / 123)"
echo "  • MinIO Console:  http://localhost:9001 (minioadmin / minioadmin123)"
echo "  • MongoDB:        mongodb://localhost:27017"
echo ""
echo "📖 Documentation:"
echo "  • Migration:      CASDOOR_MINIO_MIGRATION.md"
echo "  • MongoDB:        MONGODB_ONLY.md"
echo ""
echo "🔧 Commandes utiles:"
echo "  • Logs Docker:    docker-compose logs -f"
echo "  • Arrêter:        docker-compose down"
echo "  • Redémarrer:     docker-compose restart"
echo ""
echo "Démarrage de l'API en mode développement..."
echo ""

npm run dev
