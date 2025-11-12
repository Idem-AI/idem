#!/bin/bash

# ============================================
# IDEM SaaS - Installation Docker automatique
# ============================================

set -e

echo "🐳 IDEM SaaS - Installation Docker"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"

# Step 1: Check prerequisites
echo -e "${BLUE}📋 Vérification des prérequis...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose n'est pas installé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker et Docker Compose OK${NC}"
echo ""

# Step 2: Check .env
echo -e "${BLUE}⚙️  Vérification de la configuration...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env introuvable${NC}"
    exit 1
fi

if ! grep -q "IDEM_" .env; then
    echo -e "${YELLOW}⚠️  Variables IDEM manquantes dans .env${NC}"
    echo "Ajout des variables IDEM..."
    cat .env.idem.example >> .env
    echo -e "${GREEN}✅ Variables IDEM ajoutées${NC}"
fi

# Generate JWT_SECRET if needed
if grep -q "JWT_SECRET=your-shared-jwt-secret-key-here" .env; then
    echo "Génération JWT_SECRET..."
    JWT_SECRET=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/JWT_SECRET=your-shared-jwt-secret-key-here/JWT_SECRET=$JWT_SECRET/" .env
    else
        sed -i "s/JWT_SECRET=your-shared-jwt-secret-key-here/JWT_SECRET=$JWT_SECRET/" .env
    fi
    echo -e "${GREEN}✅ JWT_SECRET généré${NC}"
fi

echo -e "${GREEN}✅ Configuration OK${NC}"
echo ""

# Step 3: Build and start containers
echo -e "${BLUE}🏗️  Construction des images Docker...${NC}"

docker compose -f "$COMPOSE_FILE" build

echo -e "${GREEN}✅ Images construites${NC}"
echo ""

echo -e "${BLUE}🚀 Démarrage des conteneurs...${NC}"

docker compose -f "$COMPOSE_FILE" up -d

# Wait for services to be ready
echo "Attente du démarrage des services..."
sleep 10

echo -e "${GREEN}✅ Conteneurs démarrés${NC}"
echo ""

# Step 4: Install Stripe SDK
echo -e "${BLUE}📦 Installation de Stripe SDK...${NC}"

if docker compose -f "$COMPOSE_FILE" exec -T coolify composer show stripe/stripe-php &> /dev/null; then
    echo -e "${YELLOW}⚠️  Stripe SDK déjà installé${NC}"
else
    docker compose -f "$COMPOSE_FILE" exec -T coolify composer require stripe/stripe-php --no-interaction
    echo -e "${GREEN}✅ Stripe SDK installé${NC}"
fi

echo ""

# Step 5: Run migrations
echo -e "${BLUE}🗄️  Exécution des migrations...${NC}"

docker compose -f "$COMPOSE_FILE" exec -T coolify php artisan migrate --force

echo -e "${GREEN}✅ Migrations exécutées${NC}"
echo ""

# Step 6: Create first admin
echo -e "${BLUE}👤 Configuration du premier administrateur...${NC}"

# Check if any user exists
USER_COUNT=$(docker compose -f "$COMPOSE_FILE" exec -T coolify php artisan tinker --execute="echo App\\Models\\User::count();" 2>&1 | grep -o '[0-9]' | head -1)

if [ "$USER_COUNT" -gt 0 ]; then
    echo "Promotion du premier utilisateur en admin..."
    docker compose -f "$COMPOSE_FILE" exec -T coolify php artisan tinker --execute="App\\Models\\User::first()->update(['idem_role' => 'admin']);"
    
    ADMIN_EMAIL=$(docker compose -f "$COMPOSE_FILE" exec -T coolify php artisan tinker --execute="echo App\\Models\\User::first()->email;" 2>&1 | grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    
    echo -e "${GREEN}✅ Admin créé: $ADMIN_EMAIL${NC}"
else
    echo -e "${YELLOW}⚠️  Aucun utilisateur trouvé. Créez un compte via l'interface web puis relancez ce script.${NC}"
fi

echo ""

# Step 7: Sync quotas
echo -e "${BLUE}🔄 Synchronisation des quotas...${NC}"

docker compose -f "$COMPOSE_FILE" exec -T coolify php artisan idem:sync-quotas

echo -e "${GREEN}✅ Quotas synchronisés${NC}"
echo ""

# Step 8: Display stats
echo -e "${BLUE}📊 Statistiques de la plateforme:${NC}"
echo ""

docker compose -f "$COMPOSE_FILE" exec coolify php artisan idem:stats

echo ""
echo -e "${GREEN}🎉 Installation Docker terminée avec succès!${NC}"
echo ""
echo -e "${BLUE}📝 Informations utiles:${NC}"
echo ""
echo "🌐 Application: http://localhost:8000"
echo "📧 Mailpit: http://localhost:8025"
echo "📦 MinIO Console: http://localhost:9001"
echo ""
echo -e "${BLUE}🧪 Tester l'installation:${NC}"
echo "  ./scripts/idem-test-docker.sh"
echo ""
echo -e "${BLUE}🔧 Commandes utiles:${NC}"
echo "  # Voir les logs"
echo "  docker compose -f $COMPOSE_FILE logs -f"
echo ""
echo "  # Accéder au conteneur"
echo "  docker compose -f $COMPOSE_FILE exec coolify bash"
echo ""
echo "  # Stats IDEM"
echo "  docker compose -f $COMPOSE_FILE exec coolify php artisan idem:stats"
echo ""
echo "  # Arrêter"
echo "  docker compose -f $COMPOSE_FILE down"
echo ""
echo -e "${GREEN}✨ IDEM SaaS est prêt à l'emploi avec Docker!${NC}"
