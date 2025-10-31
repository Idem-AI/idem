#!/bin/bash

# ============================================
# IDEM SaaS - Frontend Setup Script
# ============================================

set -e

echo "🎨 IDEM SaaS - Frontend Setup"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Update .env (manual reminder)
echo -e "${BLUE}📝 Step 1: Configuration${NC}"
echo ""
echo -e "${YELLOW}⚠️  Please manually update your .env file:${NC}"
echo ""
echo "APP_NAME=\"IDEM SaaS\""
echo ""
echo -e "Press ENTER after you've updated .env file, or Ctrl+C to cancel..."
read

# Step 2: Clear cache
echo -e "${BLUE}🧹 Step 2: Clearing cache...${NC}"
php artisan config:clear
php artisan cache:clear
php artisan view:clear
echo -e "${GREEN}✅ Cache cleared${NC}"
echo ""

# Step 3: Create directories
echo -e "${BLUE}📁 Step 3: Creating directories...${NC}"
mkdir -p resources/views/subscription
mkdir -p resources/views/admin/idem
mkdir -p resources/views/components/idem
echo -e "${GREEN}✅ Directories created${NC}"
echo ""

# Step 4: Information about views to create
echo -e "${BLUE}📄 Step 4: Views to create${NC}"
echo ""
echo "The following Blade views need to be created:"
echo "  - resources/views/subscription/index.blade.php"
echo "  - resources/views/subscription/plans.blade.php"
echo "  - resources/views/subscription/checkout.blade.php"
echo "  - resources/views/admin/idem/dashboard.blade.php"
echo "  - resources/views/admin/idem/teams.blade.php"
echo "  - resources/views/admin/idem/servers.blade.php"
echo ""
echo "  Components:"
echo "  - resources/views/components/idem/navbar.blade.php"
echo "  - resources/views/components/idem/plan-card.blade.php"
echo ""
echo -e "${YELLOW}These files will be created in the next steps${NC}"
echo ""

# Step 5: Create test data
echo -e "${BLUE}🗄️  Step 5: Creating test data (optional)...${NC}"
echo "Would you like to create test users and data? (y/n)"
read CREATE_TEST_DATA

if [ "$CREATE_TEST_DATA" = "y" ]; then
    echo "Creating test users..."
    php artisan tinker --execute="
    if (App\\Models\\User::where('email', 'admin@idem.local')->count() == 0) {
        \$admin = App\\Models\\User::create([
            'name' => 'IDEM Admin',
            'email' => 'admin@idem.local',
            'password' => Hash::make('password'),
            'idem_role' => 'admin'
        ]);
        echo 'Admin created: admin@idem.local / password\n';
    }

    if (App\\Models\\User::where('email', 'client@idem.local')->count() == 0) {
        \$client = App\\Models\\User::create([
            'name' => 'Test Client',
            'email' => 'client@idem.local',
            'password' => Hash::make('password'),
            'idem_role' => 'member'
        ]);
        echo 'Client created: client@idem.local / password\n';
    }
    "
    echo -e "${GREEN}✅ Test users created${NC}"
else
    echo "Skipping test data creation"
fi

echo ""

# Final summary
echo -e "${GREEN}═══════════════════════════════════${NC}"
echo -e "${GREEN}   Frontend Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo ""
echo "1. Create the Blade view files (see IDEM_FRONTEND_CUSTOMIZATION.md)"
echo "2. Add routes to routes/web.php (see guide)"
echo "3. Restart your dev server:"
echo "   docker compose -f docker-compose.dev.yml restart ideploy"
echo ""
echo "4. Test the new pages:"
echo "   http://localhost:8000/subscription"
echo "   http://localhost:8000/admin/idem/dashboard"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "  - IDEM_FRONTEND_CUSTOMIZATION.md - Full customization guide"
echo "  - Section 'Scénario de Test Complet' for testing steps"
echo ""
echo -e "${GREEN}✨ Frontend is ready for IDEM SaaS!${NC}"
