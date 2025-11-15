#!/bin/bash

# Script pour consulter les logs des services

set -e

# Couleurs
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Fonction d'aide
show_help() {
    echo "Usage: $0 [OPTIONS] [SERVICE]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV     Environment (production, staging, nginx)"
    echo "  -f, --follow      Follow logs (tail -f)"
    echo "  -t, --tail N      Show last N lines (default: 100)"
    echo "  -h, --help        Show this help"
    echo ""
    echo "Services disponibles:"
    echo "  Production: idem, idem-landing, idem-api, idem-webgen, idem-chart"
    echo "  Staging: idem-staging, idem-landing-staging, idem-api-staging, idem-webgen-staging, idem-chart-staging"
    echo "  Infrastructure: nginx, certbot"
    echo ""
    echo "Exemples:"
    echo "  $0 -e production idem-api"
    echo "  $0 -e staging -f idem-api-staging"
    echo "  $0 -e nginx nginx"
    echo "  $0 --tail 50 idem-api"
}

# Variables par défaut
ENVIRONMENT=""
SERVICE=""
FOLLOW=false
TAIL_LINES=100

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -t|--tail)
            TAIL_LINES="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            echo "Option inconnue: $1"
            show_help
            exit 1
            ;;
        *)
            SERVICE="$1"
            shift
            ;;
    esac
done

# Déterminer le fichier docker-compose
case $ENVIRONMENT in
    "production"|"prod")
        COMPOSE_FILE="docker-compose.prod.yml"
        ;;
    "staging")
        COMPOSE_FILE="docker-compose.staging.yml"
        ;;
    "nginx"|"infrastructure")
        COMPOSE_FILE="docker-compose.nginx.yml"
        ;;
    "")
        if [ -z "$SERVICE" ]; then
            echo "Erreur: Environnement ou service requis"
            show_help
            exit 1
        fi
        # Essayer de deviner l'environnement basé sur le nom du service
        if [[ "$SERVICE" == *"-staging" ]]; then
            COMPOSE_FILE="docker-compose.staging.yml"
            ENVIRONMENT="staging"
        elif [[ "$SERVICE" == "nginx" ]] || [[ "$SERVICE" == "certbot" ]]; then
            COMPOSE_FILE="docker-compose.nginx.yml"
            ENVIRONMENT="infrastructure"
        else
            COMPOSE_FILE="docker-compose.prod.yml"
            ENVIRONMENT="production"
        fi
        ;;
    *)
        echo "Environnement non reconnu: $ENVIRONMENT"
        show_help
        exit 1
        ;;
esac

echo -e "${YELLOW}📋 Consultation des logs${NC}"
echo "Environment: $ENVIRONMENT"
echo "Compose file: $COMPOSE_FILE"

# Si aucun service spécifié, lister les services disponibles
if [ -z "$SERVICE" ]; then
    echo -e "\n${GREEN}Services disponibles dans $ENVIRONMENT:${NC}"
    docker-compose -f "$COMPOSE_FILE" config --services
    echo ""
    echo "Utilisez: $0 -e $ENVIRONMENT [SERVICE_NAME]"
    exit 0
fi

echo "Service: $SERVICE"
echo "=================================="

# Construire la commande docker-compose logs
LOGS_CMD="docker-compose -f $COMPOSE_FILE logs"

if [ "$FOLLOW" = true ]; then
    LOGS_CMD="$LOGS_CMD -f"
fi

LOGS_CMD="$LOGS_CMD --tail $TAIL_LINES $SERVICE"

echo "Commande: $LOGS_CMD"
echo ""

# Exécuter la commande
eval $LOGS_CMD
