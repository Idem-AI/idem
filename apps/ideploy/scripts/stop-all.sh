#!/bin/bash

# Script pour arrêter tous les services Coolify
# Usage: ./scripts/stop-all.sh

set -e

echo "🛑 Arrêt de tous les services Coolify..."

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PID_DIR="storage/logs/services"

# Fonction pour arrêter un service
stop_service() {
    local service_name=$1
    local pid_file="$PID_DIR/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${BLUE}🛑 Arrêt de ${service_name} (PID: $pid)...${NC}"
            kill $pid 2>/dev/null || true
            sleep 1
            # Force kill si toujours actif
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 $pid 2>/dev/null || true
            fi
            echo -e "${GREEN}✅ ${service_name} arrêté${NC}"
        else
            echo -e "${BLUE}ℹ️  ${service_name} n'est pas en cours d'exécution${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${BLUE}ℹ️  Aucun PID trouvé pour ${service_name}${NC}"
    fi
}

# Arrêter tous les services
stop_service "web"
stop_service "queue"
stop_service "horizon"
stop_service "vite"

echo -e "\n${GREEN}✅ Tous les services ont été arrêtés${NC}"
