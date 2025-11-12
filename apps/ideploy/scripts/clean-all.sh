#!/bin/bash

# Script pour nettoyer l'environnement de développement Coolify (Ideploy)
# Usage: ./scripts/clean-all.sh [--no-artisan]

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

PID_DIR="storage/logs/services"
LOG_DIR="storage/logs"
FRAMEWORK_CACHE_DIR="storage/framework/cache"
FRAMEWORK_VIEW_DIR="storage/framework/views"
FRAMEWORK_SESSIONS_DIR="storage/framework/sessions"
FRAMEWORK_TESTING_DIR="storage/framework/testing"
BOOTSTRAP_CACHE_DIR="bootstrap/cache"

clean_directory_contents() {
    local dir=$1
    local label=$2

    if [ -d "$dir" ]; then
        info "$label"
        find "$dir" -mindepth 1 -not -name '.gitignore' -exec rm -rf {} + 2>/dev/null || true
        success "$label terminé"
    else
        warning "${dir} introuvable, saut de ${label}"
    fi
}

info "🧹 Nettoyage de l'environnement Coolify..."

# Supprimer les logs et PID générés par start-all.sh
if [ -d "$PID_DIR" ]; then
    info "Suppression des logs et PID des services"
    rm -f "$PID_DIR"/*.pid 2>/dev/null || true
    rm -f "$PID_DIR"/*.log 2>/dev/null || true
    find "$PID_DIR" -mindepth 1 -exec rm -rf {} + 2>/dev/null || true
    rmdir "$PID_DIR" 2>/dev/null || true
    success "Logs et PID des services supprimés"
else
    warning "Aucun dossier de services trouvé (${PID_DIR})"
fi

# Nettoyer les logs Laravel générés lors des tests locaux
clean_directory_contents "$LOG_DIR" "Nettoyage des logs Laravel"

# Vider le cache framework (sans supprimer les dossiers)
clean_directory_contents "$FRAMEWORK_CACHE_DIR" "Nettoyage du cache framework"
clean_directory_contents "$FRAMEWORK_VIEW_DIR" "Nettoyage des vues compilées"
clean_directory_contents "$FRAMEWORK_SESSIONS_DIR" "Nettoyage des sessions Laravel"
clean_directory_contents "$FRAMEWORK_TESTING_DIR" "Nettoyage du cache de tests"
clean_directory_contents "$BOOTSTRAP_CACHE_DIR" "Nettoyage du cache bootstrap"

# Nettoyage additionnel des fichiers .log partout dans storage
info "Recherche et suppression des fichiers .log résiduels"
find storage -type f -name "*.log" -delete 2>/dev/null || true
success "Fichiers .log résiduels supprimés"

# Lancer les commandes artisan d'optimisation (sauf si --no-artisan)
if [ "$1" != "--no-artisan" ]; then
    if [ -f "artisan" ]; then
        info "Exécution des commandes Artisan de nettoyage"
        if php -d memory_limit=512M artisan cache:clear >/dev/null 2>&1; then
            success "cache:clear exécuté"
        else
            warning "cache:clear a échoué"
        fi

        if php -d memory_limit=512M artisan config:clear >/dev/null 2>&1; then
            success "config:clear exécuté"
        else
            warning "config:clear a échoué"
        fi

        if php -d memory_limit=512M artisan route:clear >/dev/null 2>&1; then
            success "route:clear exécuté"
        else
            warning "route:clear a échoué"
        fi

        if php -d memory_limit=512M artisan view:clear >/dev/null 2>&1; then
            success "view:clear exécuté"
        else
            warning "view:clear a échoué"
        fi

        if php -d memory_limit=512M artisan optimize:clear >/dev/null 2>&1; then
            success "optimize:clear exécuté"
        else
            warning "optimize:clear a échoué"
        fi
    else
        warning "Fichier artisan introuvable, saut de l'étape optimize:clear"
    fi
else
    info "Option --no-artisan détectée, saut des commandes artisan"
fi

success "🎉 Nettoyage terminé !"

echo ""
info "Conseil: exécutez ./scripts/stop-all.sh avant ce script pour arrêter correctement les services."
