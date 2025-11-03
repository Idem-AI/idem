#!/bin/bash

# Script pour vérifier l'état de l'internationalisation
# Usage: ./scripts/check-i18n.sh

echo "🌍 Vérification de l'internationalisation"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Compteurs
total_html=0
with_i18n=0
without_i18n=0

echo "📁 Analyse des fichiers HTML..."
echo ""

# Trouver tous les fichiers HTML dans src/app
while IFS= read -r file; do
    ((total_html++))
    
    # Vérifier si le fichier contient i18n
    if grep -q "i18n" "$file"; then
        ((with_i18n++))
        echo -e "${GREEN}✓${NC} $file"
    else
        ((without_i18n++))
        echo -e "${RED}✗${NC} $file"
    fi
done < <(find src/app -name "*.html" -type f)

echo ""
echo "📊 Statistiques"
echo "==============="
echo -e "Total de fichiers HTML: ${YELLOW}$total_html${NC}"
echo -e "Avec i18n: ${GREEN}$with_i18n${NC}"
echo -e "Sans i18n: ${RED}$without_i18n${NC}"

if [ $without_i18n -eq 0 ]; then
    echo -e "${GREEN}✓ Tous les fichiers HTML utilisent i18n !${NC}"
else
    percentage=$((with_i18n * 100 / total_html))
    echo -e "Progression: ${YELLOW}${percentage}%${NC}"
fi

echo ""
echo "📝 Fichiers de traduction"
echo "========================="

if [ -f "src/locale/messages.fr.json" ]; then
    echo -e "${GREEN}✓${NC} src/locale/messages.fr.json existe"
    
    # Compter le nombre de traductions
    translation_count=$(grep -o '"[^"]*":' src/locale/messages.fr.json | wc -l)
    echo -e "  Nombre de traductions: ${YELLOW}$translation_count${NC}"
else
    echo -e "${RED}✗${NC} src/locale/messages.fr.json n'existe pas"
fi

echo ""
echo "🔍 Textes en dur potentiels"
echo "==========================="

# Chercher des textes en dur (heuristique simple)
echo "Recherche de textes entre > et < sans i18n..."
suspicious_files=$(grep -r ">[A-Z][a-z]" src/app --include="*.html" | grep -v "i18n" | grep -v "routerLink" | grep -v "class=" | wc -l)

if [ $suspicious_files -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} $suspicious_files lignes suspectes trouvées"
    echo "Exécutez cette commande pour les voir:"
    echo "  grep -r \">\\[A-Z\\]\\[a-z\\]\" src/app --include=\"*.html\" | grep -v \"i18n\" | grep -v \"routerLink\" | grep -v \"class=\""
else
    echo -e "${GREEN}✓${NC} Aucun texte en dur évident trouvé"
fi

echo ""
echo "✅ Vérification terminée"
