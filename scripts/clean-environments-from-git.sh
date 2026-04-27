#!/bin/bash

# Script pour supprimer les fichiers environment.ts de l'historique Git
# ATTENTION : Ce script réécrit l'historique Git - coordonnez avec votre équipe avant de l'exécuter

set -e

echo "🔍 Vérification des prérequis..."

# Vérifier si nous sommes dans un repo Git
if [ ! -d .git ]; then
    echo "❌ Erreur : Ce script doit être exécuté depuis la racine du repo Git"
    exit 1
fi

# Vérifier si git-filter-repo est installé
if ! command -v git-filter-repo &> /dev/null; then
    echo "⚠️  git-filter-repo n'est pas installé"
    echo ""
    echo "Installation :"
    echo "  macOS:   brew install git-filter-repo"
    echo "  Linux:   pip install git-filter-repo"
    echo ""
    read -p "Voulez-vous continuer avec git filter-branch (plus lent) ? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    USE_FILTER_BRANCH=true
else
    USE_FILTER_BRANCH=false
fi

echo ""
echo "⚠️  ATTENTION : Ce script va réécrire l'historique Git"
echo ""
echo "Fichiers qui seront supprimés de l'historique :"
echo "  - apps/main-dashboard/src/environments/environment.ts"
echo "  - apps/main-dashboard/src/environments/environment.development.ts"
echo "  - apps/landing/src/environments/environment.ts"
echo "  - apps/landing/src/environments/environment.development.ts"
echo ""
echo "⚠️  Après cette opération, vous devrez faire un force push :"
echo "     git push --force --all"
echo ""
read -p "Êtes-vous sûr de vouloir continuer ? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Opération annulée"
    exit 1
fi

# Créer une sauvegarde
echo ""
echo "📦 Création d'une sauvegarde..."
BACKUP_DIR="../idem-backup-$(date +%Y%m%d-%H%M%S)"
cp -r . "$BACKUP_DIR"
echo "✅ Sauvegarde créée : $BACKUP_DIR"

echo ""
echo "🧹 Nettoyage de l'historique Git..."

if [ "$USE_FILTER_BRANCH" = true ]; then
    # Méthode avec git filter-branch (plus lente mais disponible partout)
    echo "Utilisation de git filter-branch..."
    
    git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch \
            apps/main-dashboard/src/environments/environment.ts \
            apps/main-dashboard/src/environments/environment.development.ts \
            apps/landing/src/environments/environment.ts \
            apps/landing/src/environments/environment.development.ts' \
        --prune-empty --tag-name-filter cat -- --all
else
    # Méthode avec git-filter-repo (recommandée)
    echo "Utilisation de git-filter-repo..."
    
    git filter-repo --force \
        --path apps/main-dashboard/src/environments/environment.ts --invert-paths \
        --path apps/main-dashboard/src/environments/environment.development.ts --invert-paths \
        --path apps/landing/src/environments/environment.ts --invert-paths \
        --path apps/landing/src/environments/environment.development.ts --invert-paths
fi

echo ""
echo "🗑️  Nettoyage des références..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Nettoyage terminé !"
echo ""
echo "📋 Prochaines étapes :"
echo ""
echo "1. Vérifier que tout fonctionne :"
echo "   git log --all --full-history -- '**/environments/environment*.ts'"
echo "   (ne devrait rien afficher)"
echo ""
echo "2. Force push (ATTENTION : coordonnez avec l'équipe) :"
echo "   git push --force --all"
echo "   git push --force --tags"
echo ""
echo "3. Informer l'équipe de faire :"
echo "   git fetch --all"
echo "   git reset --hard origin/main  # ou leur branche"
echo ""
echo "💾 Sauvegarde disponible dans : $BACKUP_DIR"
echo ""
