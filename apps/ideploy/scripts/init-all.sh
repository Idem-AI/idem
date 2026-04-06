#!/bin/bash

# Script d'initialisation complète de l'environnement Ideploy (Ideploy)
# Usage: ./scripts/init-all.sh [--no-build]
# Option --no-build : saute npm run build (utile pour un setup rapide)

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "artisan" ]; then
    error "Ce script doit être exécuté depuis la racine de apps/ideploy"
    exit 1
fi

info "🚀 Initialisation de l'environnement Ideploy..."

# Créer .env si nécessaire
if [ ! -f ".env" ]; then
    if [ -f ".env.local" ]; then
        info "Création du fichier .env depuis .env.local"
        cp .env.local .env
    elif [ -f ".env.example" ]; then
        info "Création du fichier .env depuis .env.example"
        cp .env.example .env
    else
        warning ".env introuvable et aucun template disponible"
    fi
else
    info "Fichier .env déjà présent"
fi

# Vérification des dépendances système essentielles
info "Vérification des dépendances système"
command -v php >/dev/null 2>&1     || { error "PHP n'est pas installé"; exit 1; }
command -v composer >/dev/null 2>&1 || { error "Composer n'est pas installé"; exit 1; }
command -v npm >/dev/null 2>&1      || { error "npm n'est pas installé"; exit 1; }
command -v node >/dev/null 2>&1     || { error "Node.js n'est pas installé"; exit 1; }
command -v psql >/dev/null 2>&1     || warning "psql introuvable, assurez-vous que la base est accessible"
command -v redis-cli >/dev/null 2>&1 || warning "redis-cli introuvable, assurez-vous que Redis est accessible"
success "Dépendances système OK"

# Installer les dépendances PHP
info "Installation des dépendances PHP (composer install)"
COMPOSER_MEMORY_LIMIT=-1 composer install --no-interaction --prefer-dist
success "Dépendances PHP installées"

# Installer les dépendances Node.js
if [ ! -d "node_modules" ]; then
    info "Installation des dépendances Node.js"
else
    info "Mise à jour des dépendances Node.js"
fi
npm install
success "Dépendances Node.js prêtes"

# Générer la clé d'application si nécessaire
if ! grep -q "^APP_KEY=base64:" .env 2>/dev/null; then
    info "Génération de la clé d'application Laravel"
    php artisan key:generate
    success "Clé d'application générée"
else
    info "Clé d'application déjà générée"
fi

# Exécuter les migrations
info "Exécution des migrations"
if php -d memory_limit=512M artisan migrate --force; then
    success "Migrations exécutées"
else
    warning "Les migrations ont rencontré un problème"
fi

# Seed de la base de données
info "Lancement des seeders"
if php -d memory_limit=512M artisan db:seed --force; then
    success "Seeders exécutés"
else
    warning "Les seeders ont échoué ou sont absents"
fi

# Créer le lien storage
info "Création du lien symbolique storage"
if php artisan storage:link >/dev/null 2>&1; then
    success "storage:link exécuté"
else
    warning "storage:link a échoué (probablement déjà créé)"
fi

# Nettoyage et génération des caches Laravel
info "Nettoyage des caches Laravel"
php -d memory_limit=512M artisan cache:clear >/dev/null 2>&1 || warning "cache:clear a échoué"
php -d memory_limit=512M artisan config:clear >/dev/null 2>&1 || warning "config:clear a échoué"
php -d memory_limit=512M artisan route:clear >/dev/null 2>&1 || warning "route:clear a échoué"
php -d memory_limit=512M artisan view:clear >/dev/null 2>&1 || warning "view:clear a échoué"
php -d memory_limit=512M artisan optimize >/dev/null 2>&1 || warning "optimize a échoué"

# Compilation des assets (sauf si --no-build)
if [ "$1" != "--no-build" ]; then
    info "Compilation des assets frontend (npm run build)"
    if npm run build; then
        success "Compilation des assets terminée"
    else
        warning "npm run build a échoué"
    fi
else
    info "Option --no-build détectée, saut de npm run build"
fi

success "🎉 Initialisation terminée !"

echo ""
info "Étapes suivantes suggérées :"
echo "  1. ./scripts/start-all.sh        # démarrer les services"
echo "  2. ./scripts/clean-all.sh        # nettoyer si besoin"
echo ""
