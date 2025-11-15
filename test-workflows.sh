#!/bin/bash
# Script de test des workflows CI/CD

echo "🧪 Testing GitHub Actions Workflows"
echo "===================================="
echo ""

PASSED=0
FAILED=0
WORKFLOWS_DIR=".github/workflows"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Validation YAML
echo "1️⃣ Testing YAML Syntax..."
echo "------------------------"

for workflow in $WORKFLOWS_DIR/*.yml; do
    filename=$(basename "$workflow")
    
    # Ignorer les fichiers de backup
    if [[ "$filename" == *".bak"* ]] || [[ "$filename" == *"~"* ]]; then
        continue
    fi
    
    echo -n "  Testing $filename... "
    
    if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
        echo -e "${GREEN}✅ Valid${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ Invalid YAML${NC}"
        FAILED=$((FAILED + 1))
        python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>&1 | head -5
    fi
done

echo ""

# Test 2: Vérification des Dockerfiles référencés
echo "2️⃣ Testing Referenced Dockerfiles..."
echo "-----------------------------------"

DOCKERFILES=(
    "Dockerfile.landing"
    "Dockerfile.main-dashboard"
    "Dockerfile.api"
    "Dockerfile.chart"
    "Dockerfile.appgen"
)

for dockerfile in "${DOCKERFILES[@]}"; do
    echo -n "  Checking $dockerfile... "
    
    if [ -f "$dockerfile" ]; then
        echo -e "${GREEN}✅ Exists${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ Missing${NC}"
        FAILED=$((FAILED + 1))
    fi
done

echo ""

# Test 3: Vérification des services dans docker-compose
echo "3️⃣ Testing docker-compose.yml..."
echo "-------------------------------"

SERVICES=(
    "idem-landing"
    "idem"
    "idem-api"
    "idem-chart"
    "idem-webgen"
)

if [ -f "docker-compose.yml" ]; then
    for service in "${SERVICES[@]}"; do
        echo -n "  Checking service $service... "
        
        if grep -q "$service:" docker-compose.yml; then
            echo -e "${GREEN}✅ Defined${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}⚠️  Not found${NC}"
        fi
    done
else
    echo -e "${RED}❌ docker-compose.yml not found${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""

# Test 4: Vérification des secrets nécessaires
echo "4️⃣ Testing Required Secrets..."
echo "----------------------------"

REQUIRED_SECRETS=(
    "SERVER_HOST"
    "SERVER_USER"
    "SSH_PRIVATE_KEY"
    "GITHUB_TOKEN"
)

echo -e "${YELLOW}ℹ️  Required GitHub Secrets:${NC}"
for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "    - $secret"
done

echo ""

# Test 5: Vérification de la structure des workflows
echo "5️⃣ Testing Workflow Structure..."
echo "-------------------------------"

DEPLOY_WORKFLOWS=(
    "deploy-landing.yml"
    "deploy-main-dashboard.yml"
    "deploy-api.yml"
    "deploy-chart.yml"
    "deploy-appgen.yml"
)

for workflow in "${DEPLOY_WORKFLOWS[@]}"; do
    workflow_path="$WORKFLOWS_DIR/$workflow"
    
    if [ ! -f "$workflow_path" ]; then
        echo -e "  ${RED}❌ $workflow not found${NC}"
        FAILED=$((FAILED + 1))
        continue
    fi
    
    echo "  Testing $workflow:"
    
    # Vérifier la présence du job build-and-deploy
    if grep -q "build-and-deploy:" "$workflow_path"; then
        echo -e "    ${GREEN}✅ build-and-deploy job found${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "    ${RED}❌ build-and-deploy job missing${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    # Vérifier la présence de appleboy/ssh-action
    if grep -q "appleboy/ssh-action" "$workflow_path"; then
        echo -e "    ${GREEN}✅ SSH action configured${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "    ${RED}❌ SSH action missing${NC}"
        FAILED=$((FAILED + 1))
    fi
done

echo ""

# Test 6: Vérification du workflow CI
echo "6️⃣ Testing CI Workflow..."
echo "-----------------------"

CI_WORKFLOW="$WORKFLOWS_DIR/ci.yml"

if [ -f "$CI_WORKFLOW" ]; then
    echo "  Testing ci.yml:"
    
    # Vérifier les jobs
    REQUIRED_JOBS=(
        "detect-changes"
        "quality"
        "deploy-landing"
        "deploy-main-dashboard"
        "deploy-api"
        "summary"
    )
    
    for job in "${REQUIRED_JOBS[@]}"; do
        if grep -q "$job:" "$CI_WORKFLOW"; then
            echo -e "    ${GREEN}✅ $job job found${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "    ${YELLOW}⚠️  $job job missing${NC}"
        fi
    done
else
    echo -e "  ${RED}❌ ci.yml not found${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "===================================="
echo "📊 Test Results"
echo "===================================="
echo ""
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All workflow tests passed!${NC}"
    echo ""
    echo "✅ Ready for deployment"
    echo ""
    echo "Next steps:"
    echo "  1. Resolve merge conflicts in workflows"
    echo "  2. Commit and push changes"
    echo "  3. Monitor GitHub Actions: https://github.com/Idem-AI/idem/actions"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    echo ""
    echo "Please fix the issues above before deploying."
    exit 1
fi
