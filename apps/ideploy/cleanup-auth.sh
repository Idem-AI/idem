#!/bin/bash

# Script de nettoyage après migration vers authentification client-side
# Supprime le package shared-auth-php et les fichiers obsolètes

set -e

echo "🧹 Nettoyage après migration vers authentification client-side..."
echo ""

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour supprimer un fichier/dossier
remove_if_exists() {
    if [ -e "$1" ]; then
        rm -rf "$1"
        echo -e "${GREEN}✓${NC} Supprimé: $1"
    else
        echo -e "${YELLOW}⊘${NC} N'existe pas: $1"
    fi
}

echo "📦 Suppression du package shared-auth-php..."
remove_if_exists "../../packages/shared-auth-php"

echo ""
echo "📄 Suppression des fichiers de routes obsolètes..."
remove_if_exists "routes/test-auth.php"

echo ""
echo "📚 Suppression de la documentation obsolète..."
remove_if_exists "INTEGRATION_SHARED_AUTH.md"
remove_if_exists "INSTALLATION_COMPLETE.md"
remove_if_exists "CLEANUP_AUTH.md"
remove_if_exists "CLEANUP_COMPLETE.md"
remove_if_exists "SUCCESS.md"
remove_if_exists "TEST_GUIDE.md"
remove_if_exists "QUICK_START.md"
remove_if_exists "AUTH_IMPLEMENTATION_SUMMARY.md"

echo ""
echo "🔧 Nettoyage de Composer..."
if [ -f "vendor/autoload.php" ]; then
    composer dump-autoload
    echo -e "${GREEN}✓${NC} Autoload régénéré"
else
    echo -e "${YELLOW}⊘${NC} Vendor non installé, exécutez 'composer install'"
fi

echo ""
echo "🗑️  Nettoyage du cache Laravel..."
php artisan config:clear 2>/dev/null || echo -e "${YELLOW}⊘${NC} Config cache non trouvé"
php artisan route:clear 2>/dev/null || echo -e "${YELLOW}⊘${NC} Route cache non trouvé"
php artisan view:clear 2>/dev/null || echo -e "${YELLOW}⊘${NC} View cache non trouvé"

echo ""
echo -e "${GREEN}✅ Nettoyage terminé !${NC}"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Exécuter: composer install"
echo "  2. Exécuter: php artisan migrate"
echo "  3. Exécuter: npm run build (ou npm run dev)"
echo "  4. Tester: http://localhost:8000"
echo ""
echo "📖 Documentation: CLIENT_SIDE_AUTH_MIGRATION.md"
