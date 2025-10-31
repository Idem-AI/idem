#!/bin/bash

# Script pour exécuter Ideploy localement sans Docker
# Usage: ./scripts/run-local.sh

set -e

echo "🚀 Démarrage de Ideploy en mode local (sans Docker)"
echo "=================================================="

# Couleurs pour les logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "artisan" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet Ideploy${NC}"
    exit 1
fi

# Copier le fichier .env.local vers .env si .env n'existe pas
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Création du fichier .env depuis .env.local${NC}"
    cp .env.local .env
fi

# Vérifier les dépendances
echo -e "\n${BLUE}🔍 Vérification des dépendances...${NC}"

command -v php >/dev/null 2>&1 || { echo -e "${RED}❌ PHP n'est pas installé. Installez-le avec: brew install php@8.4${NC}"; exit 1; }
command -v composer >/dev/null 2>&1 || { echo -e "${RED}❌ Composer n'est pas installé. Installez-le avec: brew install composer${NC}"; exit 1; }

# Vérifier PostgreSQL (avec chemins alternatifs)
if ! command -v psql >/dev/null 2>&1; then
    if [ -f "/usr/local/opt/postgresql@15/bin/psql" ]; then
        export PATH="/usr/local/opt/postgresql@15/bin:$PATH"
        echo -e "${BLUE}📦 PostgreSQL trouvé dans /usr/local/opt/postgresql@15/bin${NC}"
    else
        echo -e "${RED}❌ PostgreSQL n'est pas installé. Installez-le avec: brew install postgresql@15${NC}"
        exit 1
    fi
fi

command -v redis-cli >/dev/null 2>&1 || { echo -e "${RED}❌ Redis n'est pas installé. Installez-le avec: brew install redis${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js n'est pas installé. Installez-le avec: brew install node${NC}"; exit 1; }

echo -e "${GREEN}✅ Toutes les dépendances sont installées${NC}"

# Vérifier la version de PHP
PHP_VERSION=$(php -r "echo PHP_VERSION;")
echo -e "${BLUE}📦 Version PHP: ${PHP_VERSION}${NC}"

# Démarrer PostgreSQL
echo -e "\n${BLUE}🐘 Démarrage de PostgreSQL...${NC}"
brew services start postgresql@15 2>/dev/null || echo "PostgreSQL déjà démarré"

# Démarrer Redis
echo -e "${BLUE}🔴 Démarrage de Redis...${NC}"
brew services start redis 2>/dev/null || echo "Redis déjà démarré"

# Attendre que les services soient prêts
sleep 2

# Créer la base de données si elle n'existe pas
echo -e "\n${BLUE}🗄️  Création de la base de données...${NC}"
DB_USER=$(whoami)
psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw ideploy || createdb -U $DB_USER ideploy
echo -e "${GREEN}✅ Base de données 'ideploy' prête${NC}"

# Installer les dépendances PHP
if [ ! -d "vendor" ]; then
    echo -e "\n${BLUE}📦 Installation des dépendances PHP...${NC}"
    composer install
else
    echo -e "\n${BLUE}📦 Mise à jour des dépendances PHP...${NC}"
    composer update
fi

# Installer les dépendances Node.js
if [ ! -d "node_modules" ]; then
    echo -e "\n${BLUE}📦 Installation des dépendances Node.js...${NC}"
    npm install
else
    echo -e "\n${BLUE}📦 Dépendances Node.js déjà installées${NC}"
fi

# Générer la clé d'application si elle n'existe pas
if ! grep -q "APP_KEY=base64:" .env; then
    echo -e "\n${BLUE}🔑 Génération de la clé d'application...${NC}"
    php artisan key:generate
fi

# Exécuter les migrations
echo -e "\n${BLUE}🔄 Exécution des migrations...${NC}"
php -d memory_limit=512M artisan migrate --force

# Seed database with initial data
echo -e "\n${BLUE}🌱 Seeding database with initial data...${NC}"
php -d memory_limit=512M artisan db:seed --force

# Créer un lien symbolique pour le storage
echo -e "\n${BLUE}🔗 Création du lien symbolique storage...${NC}"
php artisan storage:link

# Compiler les assets
echo -e "\n${BLUE}🎨 Compilation des assets frontend...${NC}"
npm run build

echo -e "\n${GREEN}✅ Configuration terminée!${NC}"
echo -e "\n${BLUE}=================================================="
echo -e "🎉 Ideploy est prêt à être lancé!"
echo -e "=================================================="
echo -e "\nPour démarrer les services, exécutez dans des terminaux séparés:"
echo -e "\n  ${GREEN}Terminal 1 - Serveur Web:${NC}"
echo -e "    php -d memory_limit=512M artisan serve --host=0.0.0.0 --port=8000"
echo -e "\n  ${GREEN}Terminal 2 - Queue Worker:${NC}"
echo -e "    php -d memory_limit=512M artisan queue:work --tries=3"
echo -e "\n  ${GREEN}Terminal 3 - Horizon (optionnel):${NC}"
echo -e "    php -d memory_limit=512M artisan horizon"
echo -e "\n  ${GREEN}Terminal 4 - Vite Dev Server (optionnel):${NC}"
echo -e "    npm run dev"
echo -e "\n${BLUE}Accédez à l'application:${NC} http://localhost:8000"
echo -e "=================================================="
