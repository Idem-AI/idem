#!/bin/bash

# ============================================
# IDEM SaaS - Tests automatiques Docker
# ============================================

set -e

echo "🐳 IDEM SaaS - Tests Docker"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
CONTAINER="${CONTAINER:-coolify}"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name=$1
    local command=$2
    
    echo -e "${BLUE}🔹 Test: $test_name${NC}"
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}  ❌ FAIL${NC}"
        ((TESTS_FAILED++))
    fi
    
    echo ""
}

# Docker exec helper
docker_exec() {
    docker compose -f "$COMPOSE_FILE" exec -T "$CONTAINER" "$@"
}

echo "🚀 Démarrage des tests Docker..."
echo ""

# Section 1: Infrastructure Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Infrastructure Docker${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "Services Docker actifs" \
    "docker compose -f $COMPOSE_FILE ps | grep -q 'Up'"

run_test "Conteneur coolify accessible" \
    "docker compose -f $COMPOSE_FILE exec -T coolify echo 'ok'"

run_test "Conteneur postgres accessible" \
    "docker compose -f $COMPOSE_FILE exec -T postgres echo 'ok'"

run_test "Conteneur redis accessible" \
    "docker compose -f $COMPOSE_FILE exec -T redis echo 'ok'"

# Section 2: Database Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Base de Données${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "Connexion PostgreSQL" \
    "docker_exec php artisan db:show"

run_test "Table users existe" \
    "docker compose -f $COMPOSE_FILE exec -T postgres psql -U coolify -c '\d users'"

run_test "Table teams existe" \
    "docker compose -f $COMPOSE_FILE exec -T postgres psql -U coolify -c '\d teams'"

run_test "Table servers existe" \
    "docker compose -f $COMPOSE_FILE exec -T postgres psql -U coolify -c '\d servers'"

run_test "Table idem_subscription_plans existe" \
    "docker compose -f $COMPOSE_FILE exec -T postgres psql -U coolify -c '\d idem_subscription_plans'"

# Section 3: IDEM Database Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Schéma IDEM${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "Colonne users.idem_role existe" \
    "docker compose -f $COMPOSE_FILE exec -T postgres psql -U coolify -c '\d users' | grep -q 'idem_role'"

run_test "Colonne teams.idem_subscription_plan existe" \
    "docker compose -f $COMPOSE_FILE exec -T postgres psql -U coolify -c '\d teams' | grep -q 'idem_subscription_plan'"

run_test "Colonne servers.idem_managed existe" \
    "docker compose -f $COMPOSE_FILE exec -T postgres psql -U coolify -c '\d servers' | grep -q 'idem_managed'"

run_test "4 plans d'abonnement présents" \
    "test \$(docker compose -f $COMPOSE_FILE exec -T postgres psql -U coolify -t -c 'SELECT COUNT(*) FROM idem_subscription_plans;' | tr -d ' \n') -eq 4"

# Section 4: IDEM Services Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Services IDEM${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "IdemServiceProvider chargé" \
    "docker_exec php artisan tinker --execute=\"app(App\\\\Services\\\\IdemQuotaService::class);\""

run_test "IdemQuotaService disponible" \
    "docker_exec php artisan tinker --execute=\"echo class_exists('App\\\\Services\\\\IdemQuotaService') ? 'OK' : 'FAIL';\" 2>&1 | grep -q 'OK'"

run_test "IdemServerService disponible" \
    "docker_exec php artisan tinker --execute=\"echo class_exists('App\\\\Services\\\\IdemServerService') ? 'OK' : 'FAIL';\" 2>&1 | grep -q 'OK'"

run_test "IdemSubscriptionService disponible" \
    "docker_exec php artisan tinker --execute=\"echo class_exists('App\\\\Services\\\\IdemSubscriptionService') ? 'OK' : 'FAIL';\" 2>&1 | grep -q 'OK'"

# Section 5: Middleware Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Middleware IDEM${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "Middleware IdemAdminAuth existe" \
    "docker_exec php artisan tinker --execute=\"echo class_exists('App\\\\Http\\\\Middleware\\\\IdemAdminAuth') ? 'OK' : 'FAIL';\" 2>&1 | grep -q 'OK'"

run_test "Middleware CheckIdemQuota existe" \
    "docker_exec php artisan tinker --execute=\"echo class_exists('App\\\\Http\\\\Middleware\\\\CheckIdemQuota') ? 'OK' : 'FAIL';\" 2>&1 | grep -q 'OK'"

run_test "Middleware SharedJwtAuth existe" \
    "docker_exec php artisan tinker --execute=\"echo class_exists('App\\\\Http\\\\Middleware\\\\SharedJwtAuth') ? 'OK' : 'FAIL';\" 2>&1 | grep -q 'OK'"

# Section 6: Artisan Commands Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Commandes Artisan${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "Commande idem:stats" \
    "docker_exec php artisan idem:stats"

run_test "Commande idem:sync-quotas" \
    "docker_exec php artisan idem:sync-quotas"

run_test "Liste commandes idem" \
    "docker_exec php artisan list idem | grep -q 'idem:'"

# Section 7: Configuration Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Configuration${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "Config idem.php chargée" \
    "docker_exec php artisan tinker --execute=\"echo config('idem.default_plan');\" 2>&1 | grep -q 'free'"

run_test "JWT_SECRET configuré" \
    "docker_exec php artisan tinker --execute=\"echo config('idem.jwt.secret') ? 'OK' : 'FAIL';\" 2>&1 | grep -q 'OK'"

run_test "Plans d'abonnement configurés" \
    "docker_exec php artisan tinker --execute=\"echo count(config('idem.subscription_plans')) > 0 ? 'OK' : 'FAIL';\" 2>&1 | grep -q 'OK'"

# Section 8: Redis Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Redis${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "Connexion Redis" \
    "docker compose -f $COMPOSE_FILE exec -T redis redis-cli ping | grep -q 'PONG'"

run_test "Laravel connecté à Redis" \
    "docker_exec php artisan tinker --execute=\"Redis::ping();\" 2>&1 | grep -q 'PONG'"

# Section 9: API Health Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests API${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "API accessible (health)" \
    "curl -sf http://localhost:8000/api/health"

run_test "Application répond" \
    "curl -sf http://localhost:8000"

# Final Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Résumé des tests${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""
echo -e "Tests réussis: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests échoués: ${RED}$TESTS_FAILED${NC}"
echo -e "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les tests Docker sont passés!${NC}"
    echo ""
    echo -e "${BLUE}📊 Statistiques IDEM:${NC}"
    docker_exec php artisan idem:stats
    exit 0
else
    echo -e "${RED}❌ $TESTS_FAILED test(s) ont échoué${NC}"
    echo ""
    echo -e "${YELLOW}💡 Conseils de dépannage:${NC}"
    echo "1. Vérifier les logs: docker compose -f $COMPOSE_FILE logs"
    echo "2. Reconstruire: docker compose -f $COMPOSE_FILE build"
    echo "3. Redémarrer: docker compose -f $COMPOSE_FILE restart"
    echo "4. Voir le guide: IDEM_DOCKER_GUIDE.md"
    exit 1
fi
