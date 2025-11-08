#!/bin/bash

# Script de vérification de la configuration Ideploy
# Usage: ./scripts/verify-setup.sh

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔍 Vérification de la configuration Ideploy${NC}"
echo "=================================================="

# Vérifier le fichier .env
echo -e "\n${BLUE}1. Vérification du fichier .env...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ Fichier .env trouvé${NC}"
    
    # Vérifier les variables critiques
    if grep -q "^APP_KEY=base64:" .env; then
        echo -e "${GREEN}✅ APP_KEY configurée${NC}"
    else
        echo -e "${RED}❌ APP_KEY manquante ou invalide${NC}"
        echo -e "${YELLOW}   Exécutez: php artisan key:generate${NC}"
    fi
    
    if grep -q "^DB_DATABASE=" .env; then
        DB_NAME=$(grep "^DB_DATABASE=" .env | cut -d '=' -f2)
        echo -e "${GREEN}✅ Base de données configurée: ${DB_NAME}${NC}"
    else
        echo -e "${RED}❌ DB_DATABASE non configurée${NC}"
    fi
else
    echo -e "${RED}❌ Fichier .env manquant${NC}"
    echo -e "${YELLOW}   Copiez .env.example vers .env ou exécutez ./scripts/run-local.sh${NC}"
    exit 1
fi

# Vérifier la connexion à la base de données
echo -e "\n${BLUE}2. Vérification de la connexion à la base de données...${NC}"
if php artisan tinker --execute="DB::connection()->getPdo();" 2>/dev/null >/dev/null; then
    echo -e "${GREEN}✅ Connexion à la base de données réussie${NC}"
else
    echo -e "${RED}❌ Impossible de se connecter à la base de données${NC}"
    echo -e "${YELLOW}   Vérifiez que PostgreSQL est démarré: brew services start postgresql@15${NC}"
    exit 1
fi

# Vérifier les migrations
echo -e "\n${BLUE}3. Vérification des migrations...${NC}"
MIGRATION_COUNT=$(php artisan migrate:status 2>/dev/null | grep -c "Ran" || echo "0")
if [ "$MIGRATION_COUNT" -gt "0" ]; then
    echo -e "${GREEN}✅ Migrations exécutées (${MIGRATION_COUNT} migrations)${NC}"
else
    echo -e "${RED}❌ Aucune migration exécutée${NC}"
    echo -e "${YELLOW}   Exécutez: php artisan migrate${NC}"
    exit 1
fi

# Vérifier InstanceSettings
echo -e "\n${BLUE}4. Vérification de InstanceSettings...${NC}"
INSTANCE_SETTINGS=$(php artisan tinker --execute="echo App\Models\InstanceSettings::find(0) ? 'EXISTS' : 'MISSING';" 2>/dev/null | grep -o "EXISTS\|MISSING" || echo "ERROR")

if [ "$INSTANCE_SETTINGS" = "EXISTS" ]; then
    echo -e "${GREEN}✅ InstanceSettings initialisé${NC}"
    
    # Afficher quelques détails
    echo -e "${BLUE}   Détails:${NC}"
    php artisan tinker --execute="
        \$settings = App\Models\InstanceSettings::find(0);
        echo '   - Registration: ' . (\$settings->is_registration_enabled ? 'Enabled' : 'Disabled') . PHP_EOL;
        echo '   - API: ' . (\$settings->is_api_enabled ? 'Enabled' : 'Disabled') . PHP_EOL;
        echo '   - SMTP Host: ' . (\$settings->smtp_host ?? 'Not configured') . PHP_EOL;
    " 2>/dev/null
elif [ "$INSTANCE_SETTINGS" = "MISSING" ]; then
    echo -e "${RED}❌ InstanceSettings manquant (ID: 0)${NC}"
    echo -e "${YELLOW}   Exécutez: php artisan db:seed --class=InstanceSettingsSeeder${NC}"
    echo -e "${YELLOW}   Ou: php artisan migrate:fresh --seed${NC}"
    exit 1
else
    echo -e "${RED}❌ Erreur lors de la vérification de InstanceSettings${NC}"
    exit 1
fi

# Vérifier Redis
echo -e "\n${BLUE}5. Vérification de Redis...${NC}"
if redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✅ Redis est actif${NC}"
else
    echo -e "${YELLOW}⚠️  Redis n'est pas actif${NC}"
    echo -e "${YELLOW}   Démarrez Redis: brew services start redis${NC}"
fi

# Vérifier les dépendances Composer
echo -e "\n${BLUE}6. Vérification des dépendances Composer...${NC}"
if [ -d "vendor" ]; then
    echo -e "${GREEN}✅ Dépendances Composer installées${NC}"
else
    echo -e "${RED}❌ Dépendances Composer manquantes${NC}"
    echo -e "${YELLOW}   Exécutez: composer install${NC}"
    exit 1
fi

# Vérifier les dépendances Node.js
echo -e "\n${BLUE}7. Vérification des dépendances Node.js...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ Dépendances Node.js installées${NC}"
else
    echo -e "${YELLOW}⚠️  Dépendances Node.js manquantes${NC}"
    echo -e "${YELLOW}   Exécutez: npm install${NC}"
fi

# Vérifier le lien symbolique storage
echo -e "\n${BLUE}8. Vérification du lien symbolique storage...${NC}"
if [ -L "public/storage" ]; then
    echo -e "${GREEN}✅ Lien symbolique storage créé${NC}"
else
    echo -e "${YELLOW}⚠️  Lien symbolique storage manquant${NC}"
    echo -e "${YELLOW}   Exécutez: php artisan storage:link${NC}"
fi

# Résumé
echo -e "\n${GREEN}=================================================="
echo -e "✅ Vérification terminée avec succès!"
echo -e "==================================================${NC}"
echo -e "\n${BLUE}Vous pouvez maintenant démarrer les services:${NC}"
echo -e "  ./scripts/start-all.sh"
echo -e "\n${BLUE}Ou démarrer manuellement:${NC}"
echo -e "  php -d memory_limit=512M artisan serve --host=0.0.0.0 --port=8000"
echo -e "\n${BLUE}Accès à l'application:${NC}"
echo -e "  http://localhost:8000"
echo ""
