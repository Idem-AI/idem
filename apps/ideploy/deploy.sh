#!/bin/bash

# ===================================================
# SCRIPT DE DÉPLOIEMENT PRODUCTION iDeploy
# ===================================================
# Utilise uniquement les outils Laravel standard
# Approche DevOps production-ready

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

main() {
    log_info "🚀 DÉPLOIEMENT iDeploy - PRODUCTION"
    
    # 1. Run migrations
    log_info "📦 Exécution des migrations..."
    php artisan migrate --force
    
    # 2. Run essential seeders (only InstanceSettings)
    log_info "🌱 Initialisation des données critiques..."
    php artisan db:seed --class=InstanceSettingsSeeder --force
    
    # 3. Clear caches
    log_info "🧹 Nettoyage des caches..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    
    log_success "✅ Déploiement terminé avec succès !"
    log_info "L'application iDeploy est prête pour la production"
}

main "$@"
