#!/bin/bash

# ===================================================
# SCRIPT DE TEST DES MIGRATIONS IDEPLOY
# ===================================================
# Ce script teste que toutes les tables peuvent être 
# recréées uniquement à partir des migrations

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to run Laravel commands in container
run_artisan() {
    docker exec idem-ideploy-dev php artisan "$@"
}

# Function to run SQL in container
run_sql() {
    docker exec idem-ideploy-dev php artisan tinker --execute="
    use Illuminate\Support\Facades\DB;
    $1
    "
}

# Function to check if table exists
table_exists() {
    local table_name="$1"
    result=$(run_sql "
    \$exists = DB::select('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = ?', ['$table_name']);
    echo \$exists[0]->count > 0 ? 'YES' : 'NO';
    " | tail -1)
    echo "$result"
}

# Function to count tables
count_tables() {
    result=$(run_sql "
    \$tables = DB::select('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?', ['public']);
    echo \$tables[0]->count;
    " | tail -1)
    echo "$result"
}

main() {
    log_info "🧪 TEST COMPLET DES MIGRATIONS IDEPLOY"
    echo ""
    
    # Step 1: Backup current state
    log_info "📋 État initial de la base de données"
    initial_tables=$(count_tables)
    log_info "Nombre de tables actuelles: $initial_tables"
    
    # Step 2: Check critical tables before reset
    log_info "🔍 Vérification des tables critiques existantes"
    
    critical_tables=(
        "users" 
        "teams" 
        "servers" 
        "applications"
        "firewall_configs"
        "firewall_rules"
        "firewall_traffic_logs"
        "firewall_alerts"
    )
    
    for table in "${critical_tables[@]}"; do
        exists=$(table_exists "$table")
        if [ "$exists" = "YES" ]; then
            log_success "✅ Table '$table' existe"
        else
            log_warning "⚠️ Table '$table' n'existe pas"
        fi
    done
    
    echo ""
    log_warning "🚨 ATTENTION: Je vais maintenant SUPPRIMER toutes les tables et les recréer via migrations"
    log_warning "Ceci va effacer toutes les données de développement !"
    echo ""
    read -p "Continuer ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Opération annulée"
        exit 0
    fi
    
    # Step 3: Reset database completely
    log_info "🗑️ Suppression de toutes les tables..."
    
    # Drop all tables using cascade
    run_sql "
    \$tables = DB::select('SELECT tablename FROM pg_tables WHERE schemaname = ?', ['public']);
    foreach (\$tables as \$table) {
        if (\$table->tablename !== 'migrations') {
            DB::statement('DROP TABLE IF EXISTS ' . \$table->tablename . ' CASCADE');
            echo 'Dropped: ' . \$table->tablename . PHP_EOL;
        }
    }
    echo 'Tables supprimées' . PHP_EOL;
    "
    
    after_drop_tables=$(count_tables)
    log_success "Tables restantes après suppression: $after_drop_tables"
    
    # Step 4: Reset migrations table
    log_info "🔄 Réinitialisation de la table migrations"
    run_artisan migrate:reset --force
    
    # Step 5: Run all migrations from scratch
    log_info "🚀 Exécution de toutes les migrations..."
    run_artisan migrate --force
    
    # Step 6: Verify all critical tables were created
    log_info "✅ Vérification des tables après migration"
    
    final_tables=$(count_tables)
    log_info "Nombre de tables après migration: $final_tables"
    
    missing_tables=()
    for table in "${critical_tables[@]}"; do
        exists=$(table_exists "$table")
        if [ "$exists" = "YES" ]; then
            log_success "✅ Table '$table' créée avec succès"
        else
            log_error "❌ Table '$table' MANQUANTE"
            missing_tables+=("$table")
        fi
    done
    
    # Step 7: Check firewall-specific columns
    log_info "🔍 Vérification colonnes firewall dans servers"
    
    firewall_columns=(
        "crowdsec_installed"
        "crowdsec_available"
        "crowdsec_lapi_url"
        "crowdsec_api_key"
        "crowdsec_bouncer_key"
        "traffic_logger_installed"
        "traefik_logging_enabled"
        "traffic_logger_url"
        "traffic_logger_token"
    )
    
    missing_columns=()
    for column in "${firewall_columns[@]}"; do
        exists=$(run_sql "
        \$exists = DB::select('SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = ? AND column_name = ?', ['servers', '$column']);
        echo \$exists[0]->count > 0 ? 'YES' : 'NO';
        " | tail -1)
        
        if [ "$exists" = "YES" ]; then
            log_success "✅ Colonne 'servers.$column' existe"
        else
            log_error "❌ Colonne 'servers.$column' MANQUANTE"
            missing_columns+=("$column")
        fi
    done
    
    # Step 8: Final report
    echo ""
    log_info "📊 RAPPORT FINAL"
    log_info "Tables avant: $initial_tables"
    log_info "Tables après: $final_tables"
    
    if [ ${#missing_tables[@]} -eq 0 ] && [ ${#missing_columns[@]} -eq 0 ]; then
        log_success "🎉 SUCCÈS ! Toutes les migrations fonctionnent correctement"
        log_success "La base de données peut être reconstruite entièrement via migrations"
    else
        log_error "❌ ÉCHEC ! Éléments manquants:"
        if [ ${#missing_tables[@]} -gt 0 ]; then
            log_error "Tables manquantes: ${missing_tables[*]}"
        fi
        if [ ${#missing_columns[@]} -gt 0 ]; then
            log_error "Colonnes manquantes: ${missing_columns[*]}"
        fi
        exit 1
    fi
    
    # Step 9: Seed basic data for development
    log_info "🌱 Seed des données de base pour le développement..."
    
    # Create a test user and team
    run_sql "
    // Create test user if not exists
    \$user = DB::table('users')->where('email', 'admin@idem.test')->first();
    if (!\$user) {
        \$userId = DB::table('users')->insertGetId([
            'name' => 'Admin Test',
            'email' => 'admin@idem.test',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        echo 'User créé avec ID: ' . \$userId . PHP_EOL;
        
        // Create test team
        \$teamId = DB::table('teams')->insertGetId([
            'name' => 'Équipe Test',
            'description' => 'Équipe de test pour développement',
            'personal_team' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        echo 'Team créée avec ID: ' . \$teamId . PHP_EOL;
        
        // Link user to team
        DB::table('team_user')->insert([
            'team_id' => \$teamId,
            'user_id' => \$userId,
            'role' => 'admin',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        echo 'User lié à l\'équipe' . PHP_EOL;
    } else {
        echo 'User test existe déjà' . PHP_EOL;
    }
    "
    
    log_success "✅ Test terminé avec succès !"
    log_info "Connexion test: admin@idem.test / password"
}

# Run main function
main "$@"
