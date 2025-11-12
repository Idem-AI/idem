#!/bin/bash

# ============================================
# IDEM SaaS - Frontend Installation Complete
# ============================================

set -e

echo "🎨 IDEM SaaS - Frontend Installation"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Update .env
echo -e "${BLUE}📝 Step 1: Updating configuration...${NC}"
echo ""
echo -e "${YELLOW}Please manually update your .env file:${NC}"
echo "Change: APP_NAME=\"Coolify Development\""
echo "To:     APP_NAME=\"IDEM SaaS\""
echo ""
echo -e "Press ENTER after you've updated .env, or Ctrl+C to cancel..."
read

# Step 2: Include IDEM routes
echo -e "${BLUE}📍 Step 2: Configuring routes...${NC}"

# Check if routes/idem.php is already included in web.php
if ! grep -q "routes/idem.php" routes/web.php; then
    echo "Adding IDEM routes to routes/web.php..."
    
    # Find the line before the catch-all route
    LINE_NUM=$(grep -n "Route::any('/{any}'" routes/web.php | head -1 | cut -d: -f1)
    
    if [ -z "$LINE_NUM" ]; then
        # If catch-all not found, append at end
        cat >> routes/web.php << 'EOF'

// ============================================
// IDEM SaaS Routes
// ============================================
require __DIR__.'/idem.php';

EOF
    else
        # Insert before catch-all route
        {
            head -n $((LINE_NUM - 1)) routes/web.php
            echo ""
            echo "// ============================================"
            echo "// IDEM SaaS Routes  "
            echo "// ============================================"
            echo "require __DIR__.'/idem.php';"
            echo ""
            tail -n +$LINE_NUM routes/web.php
        } > routes/web.php.tmp
        mv routes/web.php.tmp routes/web.php
    fi
    
    echo -e "${GREEN}✅ Routes configured${NC}"
else
    echo -e "${GREEN}✅ Routes already configured${NC}"
fi

echo ""

# Step 3: Create test users
echo -e "${BLUE}👥 Step 3: Creating test users (optional)...${NC}"
echo "Would you like to create test admin and client users? (y/n)"
read CREATE_USERS

if [ "$CREATE_USERS" = "y" ]; then
    echo "Creating test users..."
    php artisan tinker --execute="
    // Admin user
    if (App\\Models\\User::where('email', 'admin@idem.test')->count() == 0) {
        \$admin = App\\Models\\User::create([
            'name' => 'IDEM Admin',
            'email' => 'admin@idem.test',
            'password' => Hash::make('password123'),
            'idem_role' => 'admin'
        ]);
        
        // Create team for admin
        \$adminTeam = App\\Models\\Team::create(['name' => 'Admin Team']);
        \$adminTeam->members()->attach(\$admin->id, ['role' => 'owner']);
        \$admin->update(['current_team_id' => \$adminTeam->id]);
        
        echo 'Admin created: admin@idem.test / password123\n';
    } else {
        echo 'Admin already exists: admin@idem.test\n';
    }
    
    // Client user
    if (App\\Models\\User::where('email', 'client@idem.test')->count() == 0) {
        \$client = App\\Models\\User::create([
            'name' => 'Test Client',
            'email' => 'client@idem.test',
            'password' => Hash::make('password123'),
            'idem_role' => 'member'
        ]);
        
        // Create team for client
        \$clientTeam = App\\Models\\Team::create(['name' => 'Client Team']);
        \$clientTeam->members()->attach(\$client->id, ['role' => 'owner']);
        \$client->update(['current_team_id' => \$clientTeam->id]);
        
        echo 'Client created: client@idem.test / password123\n';
    } else {
        echo 'Client already exists: client@idem.test\n';
    }
    "
    
    echo -e "${GREEN}✅ Test users created${NC}"
else
    echo "Skipping test users creation"
fi

echo ""

# Step 4: Clear cache
echo -e "${BLUE}🧹 Step 4: Clearing cache...${NC}"
php artisan config:clear
php artisan route:clear
php artisan view:clear
echo -e "${GREEN}✅ Cache cleared${NC}"
echo ""

# Step 5: Verify setup
echo -e "${BLUE}🔍 Step 5: Verifying installation...${NC}"
echo ""

# Check routes
echo "Checking routes..."
if php artisan route:list | grep -q "idem.subscription"; then
    echo -e "${GREEN}✅ IDEM routes registered${NC}"
else
    echo -e "${RED}❌ IDEM routes not found${NC}"
fi

# Check views
echo "Checking views..."
if [ -f "resources/views/idem/subscription.blade.php" ]; then
    echo -e "${GREEN}✅ Subscription view exists${NC}"
else
    echo -e "${RED}❌ Subscription view missing${NC}"
fi

if [ -f "resources/views/idem/plans.blade.php" ]; then
    echo -e "${GREEN}✅ Plans view exists${NC}"
else
    echo -e "${RED}❌ Plans view missing${NC}"
fi

if [ -f "resources/views/idem/admin/dashboard.blade.php" ]; then
    echo -e "${GREEN}✅ Admin dashboard view exists${NC}"
else
    echo -e "${RED}❌ Admin dashboard view missing${NC}"
fi

# Check Livewire components
echo "Checking Livewire components..."
if [ -f "app/Livewire/Idem/SubscriptionDashboard.php" ]; then
    echo -e "${GREEN}✅ SubscriptionDashboard component exists${NC}"
else
    echo -e "${YELLOW}⚠️  SubscriptionDashboard component missing (should have been created in Phase 2)${NC}"
fi

if [ -f "app/Livewire/Idem/AdminDashboard.php" ]; then
    echo -e "${GREEN}✅ AdminDashboard component exists${NC}"
else
    echo -e "${YELLOW}⚠️  AdminDashboard component missing (should have been created in Phase 2)${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════${NC}"
echo -e "${GREEN}   Frontend Installation Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}🌐 Access Points:${NC}"
echo ""
echo "  Subscription Dashboard:"
echo "  http://localhost:8000/idem/subscription"
echo ""
echo "  Plans Page:"
echo "  http://localhost:8000/idem/plans"
echo ""
echo "  Admin Dashboard (admin only):"
echo "  http://localhost:8000/idem/admin/dashboard"
echo ""
echo -e "${BLUE}👤 Test Accounts:${NC}"
echo ""
if [ "$CREATE_USERS" = "y" ]; then
    echo "  Admin:  admin@idem.test / password123"
    echo "  Client: client@idem.test / password123"
fi
echo ""
echo -e "${BLUE}📧 Mailpit (for testing emails):${NC}"
echo "  http://localhost:8025"
echo ""
echo -e "${BLUE}📚 Next Steps:${NC}"
echo ""
echo "1. Access the application: http://localhost:8000"
echo "2. Login with test account"
echo "3. Navigate to Subscription page to see the new IDEM UI"
echo "4. Follow IDEM_WEB_TEST_SCENARIO.md for complete testing"
echo ""
echo -e "${GREEN}✨ IDEM SaaS Frontend is ready!${NC}"
