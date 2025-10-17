#!/bin/bash

# Script pour mettre à jour le projet selon le style guide Angular 20
# - Renomme les fichiers .component.ts en .ts
# - Modifie les noms de classes pour enlever le suffixe "Component"
# - Met à jour les imports dans tous les fichiers

echo "🚀 Mise à jour du projet selon le style guide Angular 20"
echo "========================================================="

# Dossier racine du projet
PROJECT_DIR="/Users/admin/Documents/pharaon/personal/lexi"
APP_DIR="$PROJECT_DIR/src/app"

# Fonction pour gérer les erreurs
handle_error() {
  echo "❌ Erreur: $1"
  exit 1
}

# Fonction pour capitaliser la première lettre
capitalize() {
  echo "$(tr '[:lower:]' '[:upper:]' <<< ${1:0:1})${1:1}"
}

# 1. Trouver tous les fichiers .component.ts
echo "🔍 Recherche des fichiers de composants..."
COMPONENT_FILES=$(find $APP_DIR -name "*.component.ts" | sort)

if [ -z "$COMPONENT_FILES" ]; then
  handle_error "Aucun fichier .component.ts trouvé!"
fi

echo "✅ Trouvé $(echo "$COMPONENT_FILES" | wc -l | tr -d ' ') fichiers de composants."

# 2. Pour chaque fichier, créer les commandes de renommage et de modification
echo "🔄 Traitement des fichiers..."

for COMPONENT_FILE in $COMPONENT_FILES; do
  # Chemins des fichiers
  DIR=$(dirname "$COMPONENT_FILE")
  FILENAME=$(basename "$COMPONENT_FILE")
  BASE_NAME=${FILENAME%.component.ts}
  
  # Nouveaux noms de fichiers
  NEW_TS="$DIR/$BASE_NAME.ts"
  
  # Si les fichiers HTML et CSS existent, les renommer aussi
  OLD_HTML="$DIR/$BASE_NAME.component.html"
  NEW_HTML="$DIR/$BASE_NAME.html"
  
  OLD_CSS="$DIR/$BASE_NAME.component.css"
  NEW_CSS="$DIR/$BASE_NAME.css"
  
  OLD_SCSS="$DIR/$BASE_NAME.component.scss"
  NEW_SCSS="$DIR/$BASE_NAME.scss"
  
  OLD_SPEC="$DIR/$BASE_NAME.component.spec.ts"
  NEW_SPEC="$DIR/$BASE_NAME.spec.ts"
  
  # Extraction du nom de classe pour modification
  CLASS_NAME="$(capitalize $BASE_NAME)Component" # Première lettre en majuscule + "Component"
  NEW_CLASS_NAME="$(capitalize $BASE_NAME)"      # Juste la première lettre en majuscule
  
  echo "🔄 Traitement de $FILENAME..."
  echo "  • Classe: $CLASS_NAME -> $NEW_CLASS_NAME"
  
  # 3. Renommer les fichiers
  mv "$COMPONENT_FILE" "$NEW_TS" || handle_error "Impossible de renommer $COMPONENT_FILE"
  echo "  ✓ Renommé: $COMPONENT_FILE -> $NEW_TS"
  
  # Renommer HTML si existant
  if [ -f "$OLD_HTML" ]; then
    mv "$OLD_HTML" "$NEW_HTML" || handle_error "Impossible de renommer $OLD_HTML"
    echo "  ✓ Renommé: $OLD_HTML -> $NEW_HTML"
  fi
  
  # Renommer CSS si existant
  if [ -f "$OLD_CSS" ]; then
    mv "$OLD_CSS" "$NEW_CSS" || handle_error "Impossible de renommer $OLD_CSS"
    echo "  ✓ Renommé: $OLD_CSS -> $NEW_CSS"
  fi
  
  # Renommer SCSS si existant
  if [ -f "$OLD_SCSS" ]; then
    mv "$OLD_SCSS" "$NEW_SCSS" || handle_error "Impossible de renommer $OLD_SCSS"
    echo "  ✓ Renommé: $OLD_SCSS -> $NEW_SCSS"
  fi
  
  # Renommer SPEC si existant
  if [ -f "$OLD_SPEC" ]; then
    mv "$OLD_SPEC" "$NEW_SPEC" || handle_error "Impossible de renommer $OLD_SPEC"
    echo "  ✓ Renommé: $OLD_SPEC -> $NEW_SPEC"
  fi
  
  # 4. Modifier le contenu du fichier pour changer le nom de la classe
  sed -i "" "s/$CLASS_NAME/$NEW_CLASS_NAME/g" "$NEW_TS" || handle_error "Impossible de modifier le nom de classe dans $NEW_TS"
  echo "  ✓ Nom de classe modifié: $CLASS_NAME -> $NEW_CLASS_NAME dans $NEW_TS"
  
  # 5. Mettre à jour les références au template et au style
  if [ -f "$NEW_TS" ]; then
    sed -i "" "s/templateUrl: '.\\/$BASE_NAME.component.html'/templateUrl: '.\\/$BASE_NAME.html'/g" "$NEW_TS" || handle_error "Impossible de mettre à jour templateUrl"
    
    # Mettre à jour styleUrl (pour CSS ou SCSS)
    sed -i "" "s/styleUrl: '.\\/$BASE_NAME.component.css'/styleUrl: '.\\/$BASE_NAME.css'/g" "$NEW_TS"
    sed -i "" "s/styleUrl: '.\\/$BASE_NAME.component.scss'/styleUrl: '.\\/$BASE_NAME.scss'/g" "$NEW_TS"
    
    echo "  ✓ Références aux templates et styles mises à jour dans $NEW_TS"
  fi
done

# 6. Mettre à jour tous les imports dans tous les fichiers TS
echo "🔄 Mise à jour des imports dans tous les fichiers..."

# Trouver tous les fichiers TypeScript
TS_FILES=$(find $APP_DIR -name "*.ts" | sort)

for TS_FILE in $TS_FILES; do
  # Mettre à jour les chemins d'import .component vers le nouveau format
  sed -i "" "s/\.component';/';/g" "$TS_FILE"
  
  # Mettre à jour les noms de classes Component -> sans Component
  for COMPONENT_FILE in $COMPONENT_FILES; do
    FILENAME=$(basename "$COMPONENT_FILE")
    BASE_NAME=${FILENAME%.component.ts}
    CLASS_NAME="$(capitalize $BASE_NAME)Component"
    NEW_CLASS_NAME="$(capitalize $BASE_NAME)"
    
    # Remplacer dans les imports et les références
    sed -i "" "s/$CLASS_NAME/$NEW_CLASS_NAME/g" "$TS_FILE"
  done
done

echo "✅ Mise à jour des imports terminée."

# 7. Mise à jour des routes dans app.routes.ts
echo "🔄 Mise à jour des routes dans app.routes.ts..."

ROUTES_FILE="$APP_DIR/app.routes.ts"

if [ -f "$ROUTES_FILE" ]; then
  # Mettre à jour les chemins d'import dans les routes
  sed -i "" "s/\.component'/.'/g" "$ROUTES_FILE"
  echo "  ✓ Chemins d'import mis à jour dans app.routes.ts"
  
  # Mettre à jour les références m => m.XXXComponent
  for COMPONENT_FILE in $COMPONENT_FILES; do
    FILENAME=$(basename "$COMPONENT_FILE")
    BASE_NAME=${FILENAME%.component.ts}
    CLASS_NAME="$(capitalize $BASE_NAME)Component"
    NEW_CLASS_NAME="$(capitalize $BASE_NAME)"
    
    # Remplacer les références dans les routes
    sed -i "" "s/m => m.$CLASS_NAME/m => m.$NEW_CLASS_NAME/g" "$ROUTES_FILE"
    sed -i "" "s/m: $CLASS_NAME/m: $NEW_CLASS_NAME/g" "$ROUTES_FILE"
    sed -i "" "s/(m) => m.$CLASS_NAME/(m) => m.$NEW_CLASS_NAME/g" "$ROUTES_FILE"
  done
  
  echo "  ✓ Références aux composants mises à jour dans app.routes.ts"
fi

# 8. Mise à jour des références dans les fichiers HTML
echo "🔄 Mise à jour des références dans les fichiers HTML..."

HTML_FILES=$(find $APP_DIR -name "*.html" | sort)

for HTML_FILE in $HTML_FILES; do
  # Les sélecteurs de composants sont définis dans @Component et ne changent
  # pas nécessairement avec le nom de fichier ou de classe
  echo "" > /dev/null
done

echo "🎉 Mise à jour terminée selon le style guide Angular 20!"
echo "========================================================="
echo "N'oubliez pas de vérifier manuellement le projet pour s'assurer que tout fonctionne correctement."
echo "Vous pourriez avoir besoin d'ajuster certaines références spécifiques."
