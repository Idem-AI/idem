#!/bin/bash

# Script de vérification de santé des services

set -e

echo "🏥 Vérification de santé des services IDEM..."

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour vérifier un service HTTP
check_http_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Vérification de $name ($url)... "
    
    if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$url" | grep -q "$expected_status"; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ ERREUR${NC}"
        return 1
    fi
}

# Fonction pour vérifier un conteneur Docker
check_docker_service() {
    local container_name=$1
    
    echo -n "Vérification du conteneur $container_name... "
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        echo -e "${GREEN}✅ Running${NC}"
        return 0
    else
        echo -e "${RED}❌ Stopped/Error${NC}"
        return 1
    fi
}

# Variables
ERRORS=0
ENVIRONMENT=${1:-"both"}

echo "Environment à vérifier: $ENVIRONMENT"
echo "=================================="

# Vérification de l'infrastructure partagée
echo -e "\n${YELLOW}🌐 Infrastructure partagée${NC}"
check_docker_service "idem-nginx-shared" || ((ERRORS++))
check_docker_service "idem-certbot" || ((ERRORS++))

# Vérification des services de production
if [ "$ENVIRONMENT" = "production" ] || [ "$ENVIRONMENT" = "both" ]; then
    echo -e "\n${YELLOW}🏭 Services de production${NC}"
    
    # Conteneurs
    check_docker_service "idem" || ((ERRORS++))
    check_docker_service "idem-landing" || ((ERRORS++))
    check_docker_service "idem-api" || ((ERRORS++))
    check_docker_service "idem-webgen" || ((ERRORS++))
    check_docker_service "idem-chart" || ((ERRORS++))
    
    # Services HTTP (si les domaines sont configurés)
    echo -e "\n${YELLOW}🌍 Services HTTP Production${NC}"
    check_http_service "Landing Page" "https://idem-ai.com" || ((ERRORS++))
    check_http_service "API Health" "https://api.idem-ai.com/health" || ((ERRORS++))
fi

# Vérification des services de staging
if [ "$ENVIRONMENT" = "staging" ] || [ "$ENVIRONMENT" = "both" ]; then
    echo -e "\n${YELLOW}🧪 Services de staging${NC}"
    
    # Conteneurs
    check_docker_service "idem-staging" || ((ERRORS++))
    check_docker_service "idem-landing-staging" || ((ERRORS++))
    check_docker_service "idem-api-staging" || ((ERRORS++))
    check_docker_service "idem-webgen-staging" || ((ERRORS++))
    check_docker_service "idem-chart-staging" || ((ERRORS++))
    
    # Services HTTP (si les domaines sont configurés)
    echo -e "\n${YELLOW}🌍 Services HTTP Staging${NC}"
    check_http_service "Staging Landing" "https://staging.idem-ai.com" || ((ERRORS++))
    check_http_service "Staging API Health" "https://staging-api.idem-ai.com/health" || ((ERRORS++))
fi

# Vérification des ressources système
echo -e "\n${YELLOW}💻 Ressources système${NC}"
echo -n "Utilisation disque... "
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✅ OK ($DISK_USAGE%)${NC}"
else
    echo -e "${RED}❌ Critique ($DISK_USAGE%)${NC}"
    ((ERRORS++))
fi

echo -n "Utilisation mémoire... "
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEM_USAGE" -lt 90 ]; then
    echo -e "${GREEN}✅ OK ($MEM_USAGE%)${NC}"
else
    echo -e "${RED}❌ Critique ($MEM_USAGE%)${NC}"
    ((ERRORS++))
fi

# Résumé
echo -e "\n=================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les services sont opérationnels!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $ERRORS erreur(s) détectée(s)${NC}"
    echo -e "\n${YELLOW}💡 Actions recommandées:${NC}"
    echo "1. Vérifiez les logs: docker-compose logs [service-name]"
    echo "2. Redémarrez les services en erreur: docker-compose restart [service-name]"
    echo "3. Vérifiez la configuration DNS pour les domaines"
    exit 1
fi
