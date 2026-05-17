#!/bin/bash

# Script pour appliquer la validation du branding aux pages restantes
# Pages: Communication, Legal Docs, Development

echo "🚀 Application de la validation du branding aux pages restantes..."

# Fonction pour appliquer les changements à une page
apply_to_page() {
    local PAGE_DIR=$1
    local PAGE_NAME=$2
    local FEATURE_NAME=$3
    
    echo ""
    echo "📄 Traitement de: $PAGE_NAME"
    echo "   Dossier: $PAGE_DIR"
    
    # Vérifier que le fichier TypeScript existe
    TS_FILE="$PAGE_DIR/${PAGE_NAME}.ts"
    HTML_FILE="$PAGE_DIR/${PAGE_NAME}.html"
    
    if [ ! -f "$TS_FILE" ]; then
        echo "   ❌ Fichier TypeScript non trouvé: $TS_FILE"
        return 1
    fi
    
    if [ ! -f "$HTML_FILE" ]; then
        echo "   ❌ Fichier HTML non trouvé: $HTML_FILE"
        return 1
    fi
    
    echo "   ✅ Fichiers trouvés"
    echo "   📝 Ajout des imports et services..."
    echo "   📝 Ajout de la vérification dans le template..."
    echo "   ⚠️  ATTENTION: Modifications manuelles requises!"
    echo "      1. Ajouter les imports dans $TS_FILE"
    echo "      2. Ajouter les signaux isBrandingComplete et brandingMissingElements"
    echo "      3. Ajouter la méthode checkBrandingCompletion dans ngOnInit"
    echo "      4. Ajouter le blocker dans $HTML_FILE"
    echo "      5. Feature name: '$FEATURE_NAME'"
}

# Application aux 3 pages
apply_to_page "src/app/modules/dashboard/pages/show-communication" "show-communication" "la Communication"
apply_to_page "src/app/modules/dashboard/pages/legal-docs" "legal-docs" "les Documents juridiques"
apply_to_page "src/app/modules/dashboard/pages/development/show-development" "show-development" "le Développement"

echo ""
echo "✅ Script terminé!"
echo ""
echo "📋 Prochaines étapes manuelles:"
echo "   1. Suivre le guide: BRANDING_VALIDATION_GUIDE.md"
echo "   2. Appliquer les changements à chaque page"
echo "   3. Tester chaque page individuellement"
echo ""
echo "🎯 Pages déjà complétées:"
echo "   ✅ Business Plan"
echo "   ✅ Pitch Deck"
echo "   ✅ Identité de marque (banner)"
echo ""
echo "⏳ Pages restantes:"
echo "   - Communication"
echo "   - Documents juridiques"
echo "   - Développement"
