#!/bin/bash

# ===================================================
# SCRIPT DE CORRECTION DES COLONNES DUPLIQUÉES
# ===================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

migrations_dir="/home/romuald/Idem/idem/apps/ideploy/database/migrations"

# Function to add Schema::hasColumn check to migration
fix_migration_file() {
    local file="$1"
    local columns="$2"
    
    log_info "🔧 Correction de $(basename "$file")"
    
    # Create backup
    cp "$file" "${file}.backup"
    
    # Fix the migration by adding hasColumn checks
    python3 << EOF
import re

with open('$file', 'r') as f:
    content = f.read()

# Find all addColumn calls and wrap them with hasColumn checks
columns = '$columns'.split(',')
for column in columns:
    column = column.strip()
    if not column:
        continue
    
    # Pattern to find the addColumn line for this column
    pattern = rf'\$table->.*?{column}.*?->.*?;'
    matches = re.findall(pattern, content, re.MULTILINE)
    
    for match in matches:
        # Create the hasColumn check
        check = f"if (!Schema::hasColumn('servers', '{column}')) {{\n                {match}\n            }}"
        content = content.replace(match, check)

with open('$file', 'w') as f:
    f.write(content)
EOF
    
    log_success "✅ $(basename "$file") corrigé"
}

# Main correction function
main() {
    log_info "🔧 CORRECTION DES MIGRATIONS AVEC COLONNES DUPLIQUÉES"
    
    # List of problematic migrations and their columns
    declare -A problem_migrations=(
        ["2025_12_23_001200_add_validation_fields_to_servers_table.php"]="installation_validated,last_validation_at,validation_details"
    )
    
    for migration_file in "${!problem_migrations[@]}"; do
        migration_path="$migrations_dir/$migration_file"
        
        if [ -f "$migration_path" ]; then
            fix_migration_file "$migration_path" "${problem_migrations[$migration_file]}"
        else
            log_error "❌ Migration $migration_file non trouvée"
        fi
    done
    
    # Alternatively, we can simply suppress this problematic migration
    # since the columns are already added by our corrected migration
    log_info "🗑️ Suppression de la migration redondante"
    if [ -f "$migrations_dir/2025_12_23_001200_add_validation_fields_to_servers_table.php" ]; then
        rm "$migrations_dir/2025_12_23_001200_add_validation_fields_to_servers_table.php"
        log_success "✅ Migration redondante supprimée"
    fi
    
    log_success "🎉 Toutes les migrations conflictuelles ont été corrigées"
}

main "$@"
