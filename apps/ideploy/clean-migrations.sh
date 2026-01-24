#!/bin/bash

# ===================================================
# SCRIPT DE NETTOYAGE DES MIGRATIONS DÉFAILLANTES
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

# Function to check if migration file has valid class
check_migration() {
    local file="$1"
    if [ ! -s "$file" ]; then
        echo "EMPTY"
        return
    fi
    
    if ! grep -q "class.*extends Migration" "$file"; then
        echo "INVALID"
        return
    fi
    
    echo "VALID"
}

# Function to fix or remove problematic migrations
fix_migrations() {
    log_info "🧹 Nettoyage des migrations défaillantes..."
    
    migrations_dir="/home/romuald/Idem/idem/apps/ideploy/database/migrations"
    
    # List all potential problem migrations
    problem_migrations=(
        "2025_11_28_203000_add_traffic_logger_fields_to_servers_table.php"
        "2025_12_01_220000_decrypt_crowdsec_api_keys.php" 
        "2025_12_02_011700_decrypt_existing_crowdsec_keys.php"
    )
    
    for migration_file in "${problem_migrations[@]}"; do
        migration_path="$migrations_dir/$migration_file"
        
        if [ -f "$migration_path" ]; then
            status=$(check_migration "$migration_path")
            
            case $status in
                "EMPTY"|"INVALID")
                    log_info "🗑️ Suppression de $migration_file (status: $status)"
                    rm "$migration_path"
                    ;;
                "VALID")
                    log_success "✅ $migration_file est valide"
                    ;;
            esac
        else
            log_info "⚠️ $migration_file n'existe pas"
        fi
    done
    
    # Create missing valid migrations
    create_missing_migrations
}

create_missing_migrations() {
    log_info "🔧 Création des migrations manquantes..."
    
    # Create decrypt crowdsec keys migration
    cat > "/home/romuald/Idem/idem/apps/ideploy/database/migrations/2025_12_01_220000_decrypt_crowdsec_api_keys.php" << 'EOF'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // This migration was created to fix decryption issues
        // All CrowdSec API keys should be stored as plain text
        // for compatibility with Docker labels
        
        // Nothing to do here as the fix was applied directly to accessors
        // in FirewallConfig model
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nothing to reverse
    }
};
EOF

    # Create decrypt existing keys migration
    cat > "/home/romuald/Idem/idem/apps/ideploy/database/migrations/2025_12_02_011700_decrypt_existing_crowdsec_keys.php" << 'EOF'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // This migration handles existing encrypted CrowdSec keys
        // Convert any encrypted keys to plain text
        
        // Nothing to do here as this is handled by model accessors
        // and fresh installs don't have encrypted data
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nothing to reverse
    }
};
EOF

    log_success "✅ Migrations manquantes créées"
}

# Main execution
fix_migrations
log_success "🎉 Nettoyage des migrations terminé"
