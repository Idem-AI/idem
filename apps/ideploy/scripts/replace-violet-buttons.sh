#!/bin/bash

# Script pour remplacer les boutons avec bg-violet-600 par la classe inner-button
# Usage: ./scripts/replace-violet-buttons.sh

set -e

VIEWS_DIR="resources/views"
BACKUP_DIR="backups/violet-buttons-replacement-$(date +%Y%m%d-%H%M%S)"

echo "🔍 Recherche des boutons avec bg-violet-600..."
echo ""

# Créer un backup
mkdir -p "$BACKUP_DIR"
echo "📦 Création du backup dans $BACKUP_DIR..."

# Trouver tous les fichiers .blade.php avec des boutons bg-violet-600
FILES=$(grep -rl 'bg-violet-600' "$VIEWS_DIR" --include="*.blade.php" 2>/dev/null || true)

if [ -z "$FILES" ]; then
    echo "✅ Aucun bouton avec bg-violet-600 trouvé!"
    exit 0
fi

echo "📝 Fichiers trouvés:"
echo "$FILES" | while read -r file; do
    echo "  - $file"
done
echo ""

# Backup des fichiers
echo "$FILES" | while read -r file; do
    if [ -f "$file" ]; then
        backup_path="$BACKUP_DIR/$file"
        mkdir -p "$(dirname "$backup_path")"
        cp "$file" "$backup_path"
    fi
done

echo "✅ Backup créé"
echo ""
echo "🔄 Remplacement des boutons par inner-button..."
echo ""

# Fonction pour remplacer dans un fichier
replace_in_file() {
    local file=$1
    local modified=0
    
    # Pattern 1: Bouton avec bg-violet-600 hover:bg-violet-500 (bouton principal)
    if grep -q 'bg-violet-600 hover:bg-violet-500' "$file" 2>/dev/null; then
        # Remplacer le pattern complet du bouton par inner-button
        sed -i '' 's/inline-flex items-center gap-2\.5 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-500\/20 transition-all hover:-translate-y-px active:translate-y-0/inner-button/g' "$file"
        sed -i '' 's/inline-flex items-center gap-2 px-6 py-2\.5 text-sm font-semibold rounded-xl transition-all duration-200[[:space:]]*bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500\/20 hover:-translate-y-px active:translate-y-0/inner-button/g' "$file"
        modified=1
    fi
    
    # Pattern 2: Select avec bg-violet-600/20 (garder tel quel, c'est un select pas un bouton)
    # On ne touche pas aux selects
    
    # Pattern 3: Remplacer les classes individuelles restantes pour les vrais boutons
    if grep -q 'bg-violet-600' "$file" 2>/dev/null; then
        # Vérifier si c'est dans un bouton ou un lien avec classe button-like
        if grep -q '<a.*bg-violet-600.*class=' "$file" 2>/dev/null || grep -q '<button.*bg-violet-600.*class=' "$file" 2>/dev/null; then
            # Pour les boutons/liens, remplacer par primary
            sed -i '' 's/bg-violet-600/bg-primary/g' "$file"
            sed -i '' 's/hover:bg-violet-500/hover:bg-primary-600/g' "$file"
            sed -i '' 's/shadow-violet-500\/20/shadow-primary\/20/g' "$file"
            modified=1
        fi
    fi
    
    echo "$modified"
}

# Remplacer dans chaque fichier
total_modified=0
echo "$FILES" | while read -r file; do
    if [ -f "$file" ]; then
        result=$(replace_in_file "$file")
        if [ "$result" -eq 1 ]; then
            echo "  ✓ $file"
            ((total_modified++))
        fi
    fi
done

echo ""
echo "✅ Remplacement terminé!"
echo ""
echo "📊 Résumé:"
echo "  - Fichiers traités: $(echo "$FILES" | wc -l | tr -d ' ')"
echo "  - Backup: $BACKUP_DIR"
echo ""
echo "🔍 Pour vérifier les boutons restants:"
echo "  grep -r 'bg-violet-600' $VIEWS_DIR --include='*.blade.php' --color=always"
echo ""
echo "♻️  Pour restaurer le backup:"
echo "  cp -r $BACKUP_DIR/$VIEWS_DIR/* $VIEWS_DIR/"
