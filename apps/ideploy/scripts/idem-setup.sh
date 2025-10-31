#!/bin/bash

# ============================================
# IDEM SaaS - Script d'installation automatique
# ============================================

set -e

echo "🚀 IDEM SaaS - Installation automatique"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ] && [ "$1" != "--no-root-check" ]; then 
  echo -e "${YELLOW}⚠️  Ce script doit être exécuté avec sudo ou en root${NC}"
  echo "Si vous êtes sûr, relancez avec --no-root-check"
  exit 1
fi

# Step 1: Check prerequisites
echo -e "${BLUE}📋 Vérification des prérequis...${NC}"

if ! command -v php &> /dev/null; then
    echo -e "${RED}❌ PHP n'est pas installé${NC}"
    exit 1
fi

if ! command -v composer &> /dev/null; then
    echo -e "${RED}❌ Composer n'est pas installé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prérequis OK${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${BLUE}📦 Installation des dépendances...${NC}"

# Check if stripe/stripe-php is installed
if ! composer show stripe/stripe-php &> /dev/null; then
    echo "Installation de Stripe SDK..."
    composer require stripe/stripe-php --no-interaction
fi

echo -e "${GREEN}✅ Dépendances installées${NC}"
echo ""

# Step 3: Configure environment
echo -e "${BLUE}⚙️  Configuration de l'environnement...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env introuvable${NC}"
    exit 1
fi

# Add IDEM config to .env if not present
if ! grep -q "JWT_SECRET" .env; then
    echo "Ajout de la configuration IDEM au .env..."
    cat .env.idem.example >> .env
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/JWT_SECRET=your-shared-jwt-secret-key-here/JWT_SECRET=${JWT_SECRET}/" .env
    
    echo -e "${GREEN}✅ Configuration ajoutée avec JWT_SECRET généré${NC}"
else
    echo -e "${YELLOW}⚠️  Configuration IDEM déjà présente dans .env${NC}"
fi

echo ""

# Step 4: Run migrations
echo -e "${BLUE}🗄️  Exécution des migrations...${NC}"
php artisan migrate --force

echo -e "${GREEN}✅ Migrations exécutées${NC}"
echo ""

# Step 5: Create first admin
echo -e "${BLUE}👤 Configuration du premier administrateur...${NC}"

read -p "Email de l'administrateur (ou laissez vide pour utiliser le premier utilisateur): " ADMIN_EMAIL

if [ -z "$ADMIN_EMAIL" ]; then
    # Use first user
    php artisan tinker --execute="User::first()->update(['idem_role' => 'admin']); echo 'Admin créé: ' . User::first()->email;"
else
    # Find user by email
    php artisan tinker --execute="(\$user = User::where('email', '${ADMIN_EMAIL}')->first()) ? \$user->update(['idem_role' => 'admin']) : print('Utilisateur non trouvé'); echo \$user ? 'Admin créé: ' . \$user->email : 'Erreur';"
fi

echo -e "${GREEN}✅ Administrateur configuré${NC}"
echo ""

# Step 6: Sync quotas
echo -e "${BLUE}🔄 Synchronisation des quotas...${NC}"
php artisan idem:sync-quotas

echo -e "${GREEN}✅ Quotas synchronisés${NC}"
echo ""

# Step 7: Display stats
echo -e "${BLUE}📊 Statistiques de la plateforme:${NC}"
php artisan idem:stats

echo ""
echo -e "${GREEN}🎉 Installation terminée avec succès!${NC}"
echo ""
echo -e "${BLUE}📝 Prochaines étapes:${NC}"
echo "1. Vérifiez votre configuration dans .env"
echo "2. Configurez Stripe si nécessaire (IDEM_STRIPE_ENABLED=true)"
echo "3. Créez des serveurs IDEM gérés:"
echo "   php artisan idem:create-server \"IDEM-1\" \"192.168.1.100\""
echo "4. Testez l'API:"
echo "   curl -H \"Authorization: Bearer YOUR_TOKEN\" http://localhost:8000/api/v1/idem/subscription"
echo ""
echo -e "${GREEN}✨ IDEM SaaS est prêt à l'emploi!${NC}"
