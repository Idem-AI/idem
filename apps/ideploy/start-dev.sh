#!/bin/bash

# Script de démarrage pour ideploy en mode développement
# Usage: ./start-dev.sh [--with-vite]

echo "🚀 Starting ideploy development environment..."

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier si nous sommes dans le bon répertoire
if [ ! -f "artisan" ]; then
    echo -e "${RED}❌ Error: artisan file not found. Are you in the ideploy directory?${NC}"
    exit 1
fi

# Nettoyer les anciens processus
echo -e "${YELLOW}🧹 Cleaning up old processes...${NC}"
pkill -f "php artisan serve" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Supprimer le fichier hot si présent
if [ -f "public/hot" ]; then
    echo -e "${YELLOW}🔥 Removing public/hot file...${NC}"
    rm public/hot
fi

# Nettoyer les caches
echo -e "${YELLOW}🗑️  Clearing caches...${NC}"
php artisan optimize:clear > /dev/null 2>&1

# Vérifier si les dépendances sont installées
if [ ! -d "vendor" ]; then
    echo -e "${YELLOW}📦 Installing Composer dependencies...${NC}"
    composer install
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Node dependencies...${NC}"
    npm install
fi

# Build des assets si nécessaire
if [ ! -d "public/build" ] || [ ! -f "public/build/manifest.json" ]; then
    echo -e "${YELLOW}🔨 Building assets...${NC}"
    npm run build
fi

# Démarrer le serveur PHP
echo -e "${GREEN}✅ Starting PHP server on http://localhost:8000${NC}"
php artisan serve --host=0.0.0.0 --port=8000 &
PHP_PID=$!

# Démarrer Vite si demandé
if [ "$1" == "--with-vite" ]; then
    echo -e "${GREEN}✅ Starting Vite dev server${NC}"
    npm run dev &
    VITE_PID=$!
    echo -e "${YELLOW}⚠️  Using Vite dev server for hot reload${NC}"
else
    echo -e "${YELLOW}ℹ️  Using compiled assets (run with --with-vite for hot reload)${NC}"
fi

echo ""
echo -e "${GREEN}✨ Development environment started!${NC}"
echo -e "   📱 Application: http://localhost:8000"
if [ "$1" == "--with-vite" ]; then
    echo -e "   🔥 Vite HMR: http://localhost:5173"
fi
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Fonction pour nettoyer à la sortie
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping servers...${NC}"
    kill $PHP_PID 2>/dev/null || true
    if [ ! -z "$VITE_PID" ]; then
        kill $VITE_PID 2>/dev/null || true
    fi
    if [ -f "public/hot" ]; then
        rm public/hot
    fi
    echo -e "${GREEN}✅ Servers stopped${NC}"
    exit 0
}

# Capturer Ctrl+C
trap cleanup INT TERM

# Attendre
wait
