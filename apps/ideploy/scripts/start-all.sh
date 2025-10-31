#!/bin/bash

# Script pour démarrer tous les services Ideploy en arrière-plan
# Usage: ./scripts/start-all.sh

set -e

echo "🚀 Démarrage de tous les services Ideploy..."

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Créer un répertoire pour les logs
mkdir -p storage/logs/services

# Démarrer le serveur web
echo -e "${BLUE}🌐 Démarrage du serveur web...${NC}"
php -d memory_limit=512M artisan serve --host=0.0.0.0 --port=8000 > storage/logs/services/web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > storage/logs/services/web.pid
echo -e "${GREEN}✅ Serveur web démarré (PID: $WEB_PID)${NC}"

# Démarrer le queue worker
echo -e "${BLUE}⚙️  Démarrage du queue worker...${NC}"
php -d memory_limit=512M artisan queue:work --tries=3 > storage/logs/services/queue.log 2>&1 &
QUEUE_PID=$!
echo $QUEUE_PID > storage/logs/services/queue.pid
echo -e "${GREEN}✅ Queue worker démarré (PID: $QUEUE_PID)${NC}"

# Démarrer Horizon (optionnel)
echo -e "${BLUE}🔭 Démarrage de Horizon...${NC}"
php -d memory_limit=512M artisan horizon > storage/logs/services/horizon.log 2>&1 &
HORIZON_PID=$!
echo $HORIZON_PID > storage/logs/services/horizon.pid
echo -e "${GREEN}✅ Horizon démarré (PID: $HORIZON_PID)${NC}"

# Démarrer Vite en mode dev (optionnel)
if [ "$1" = "--dev" ]; then
    echo -e "${BLUE}⚡ Démarrage de Vite dev server...${NC}"
    npm run dev > storage/logs/services/vite.log 2>&1 &
    VITE_PID=$!
    echo $VITE_PID > storage/logs/services/vite.pid
    echo -e "${GREEN}✅ Vite démarré (PID: $VITE_PID)${NC}"
fi

echo -e "\n${GREEN}=================================================="
echo -e "✅ Tous les services sont démarrés!"
echo -e "=================================================="
echo -e "\n${BLUE}URLs:${NC}"
echo -e "  Application: http://localhost:8000"
echo -e "  Horizon:     http://localhost:8000/horizon"
echo -e "\n${BLUE}Logs:${NC}"
echo -e "  Web:         tail -f storage/logs/services/web.log"
echo -e "  Queue:       tail -f storage/logs/services/queue.log"
echo -e "  Horizon:     tail -f storage/logs/services/horizon.log"
if [ "$1" = "--dev" ]; then
    echo -e "  Vite:        tail -f storage/logs/services/vite.log"
fi
echo -e "\n${BLUE}Pour arrêter tous les services:${NC}"
echo -e "  ./scripts/stop-all.sh"
echo -e "=================================================="
