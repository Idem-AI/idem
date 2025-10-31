#!/bin/bash

# ============================================
# IDEM SaaS - Script de tests automatiques
# ============================================

set -e

echo "🧪 IDEM SaaS - Tests automatiques"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COOLIFY_URL="${COOLIFY_URL:-http://localhost:8000}"
API_TOKEN="${API_TOKEN:-}"

if [ -z "$API_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  Variable API_TOKEN non définie${NC}"
    echo "Utilisez: export API_TOKEN=your-token"
    echo ""
fi

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name=$1
    local url=$2
    local method=${3:-GET}
    local data=${4:-}
    
    echo -e "${BLUE}🔹 Test: $test_name${NC}"
    
    local cmd="curl -s -X $method \"${COOLIFY_URL}${url}\""
    
    if [ ! -z "$API_TOKEN" ]; then
        cmd="$cmd -H \"Authorization: Bearer ${API_TOKEN}\""
    fi
    
    cmd="$cmd -H \"Accept: application/json\""
    
    if [ ! -z "$data" ]; then
        cmd="$cmd -H \"Content-Type: application/json\" -d '$data'"
    fi
    
    # Execute
    response=$(eval $cmd)
    
    # Check if contains "success": true or valid JSON
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
            echo -e "${GREEN}  ✅ PASS${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}  ❌ FAIL: $(echo "$response" | jq -r '.message')${NC}"
            ((TESTS_FAILED++))
        fi
    elif echo "$response" | jq -e '.' > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ PASS (Valid JSON)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}  ❌ FAIL: Invalid response${NC}"
        echo "$response"
        ((TESTS_FAILED++))
    fi
    
    echo ""
}

echo "🚀 Démarrage des tests..."
echo ""

# Section 1: Client API Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests API Client${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

run_test "Get subscription" "/api/v1/idem/subscription"
run_test "Get available plans" "/api/v1/idem/plans"
run_test "Get quotas" "/api/v1/idem/quotas"
run_test "Check can deploy" "/api/v1/idem/check/deploy"
run_test "Check can add server" "/api/v1/idem/check/server"
run_test "Get upgrade suggestions" "/api/v1/idem/upgrade-suggestions"

# Section 2: Admin API Tests (if admin token)
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo -e "${BLUE}═══════════════════════════════════${NC}"
    echo -e "${BLUE}   Tests API Admin${NC}"
    echo -e "${BLUE}═══════════════════════════════════${NC}"
    echo ""
    
    # Temporarily switch to admin token
    ORIGINAL_TOKEN=$API_TOKEN
    API_TOKEN=$ADMIN_TOKEN
    
    run_test "Admin dashboard" "/api/v1/idem/admin/dashboard"
    run_test "Get managed servers" "/api/v1/idem/admin/servers/managed"
    run_test "Get teams" "/api/v1/idem/admin/teams"
    run_test "Export data (teams)" "/api/v1/idem/admin/export?type=teams"
    
    # Restore original token
    API_TOKEN=$ORIGINAL_TOKEN
fi

# Section 3: Artisan Commands Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Commandes Artisan${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}🔹 Test: idem:stats${NC}"
if php artisan idem:stats > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}  ❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${BLUE}🔹 Test: idem:sync-quotas${NC}"
if php artisan idem:sync-quotas > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}  ❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Section 4: Database Tests
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}   Tests Base de données${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}🔹 Test: Users table has idem_role${NC}"
if php artisan tinker --execute="Schema::hasColumn('users', 'idem_role') ? print('OK') : print('FAIL');" 2>&1 | grep -q "OK"; then
    echo -e "${GREEN}  ✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}  ❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${BLUE}🔹 Test: Teams table has idem fields${NC}"
if php artisan tinker --execute="Schema::hasColumn('teams', 'idem_subscription_plan') ? print('OK') : print('FAIL');" 2>&1 | grep -q "OK"; then
    echo -e "${GREEN}  ✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}  ❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${BLUE}🔹 Test: IdemSubscriptionPlan table exists${NC}"
if php artisan tinker --execute="Schema::hasTable('idem_subscription_plans') ? print('OK') : print('FAIL');" 2>&1 | grep -q "OK"; then
    echo -e "${GREEN}  ✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}  ❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi
echo ""

echo -e "${BLUE}🔹 Test: 4 plans exist in database${NC}"
if php artisan tinker --execute="\$count = App\Models\IdemSubscriptionPlan::count(); print(\$count == 4 ? 'OK' : 'FAIL');" 2>&1 | grep -q "OK"; then
    echo -e "${GREEN}  ✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}  ❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi
echo ""

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
    echo -e "${GREEN}🎉 Tous les tests sont passés!${NC}"
    exit 0
else
    echo -e "${RED}❌ Certains tests ont échoué${NC}"
    exit 1
fi
