<?php

namespace App\Console\Commands;

use App\Services\IdemAuthService;
use Illuminate\Console\Command;

class TestIdemAuth extends Command
{
    protected $signature = 'idem:test-auth {session-cookie? : The session cookie to test}';
    protected $description = 'Test IDEM authentication with a session cookie';

    public function handle(): int
    {
        $this->info('🔍 Testing IDEM Authentication Configuration');
        $this->newLine();

        // Test 1: Configuration
        $this->info('1️⃣  Checking configuration...');
        $apiUrl = config('idem.api_url');
        
        if (!$apiUrl) {
            $this->error('❌ IDEM_API_URL is not configured in .env');
            return Command::FAILURE;
        }
        
        $this->info("   ✓ API URL: {$apiUrl}");
        $this->newLine();

        // Test 2: API Connectivity
        $this->info('2️⃣  Testing API connectivity...');
        
        try {
            $response = \Illuminate\Support\Facades\Http::get("{$apiUrl}/health");
            
            if ($response->successful()) {
                $this->info('   ✓ API is reachable');
            } else {
                $this->warn("   ⚠️  API returned status: {$response->status()}");
            }
        } catch (\Exception $e) {
            $this->error("   ❌ Cannot reach API: {$e->getMessage()}");
            $this->warn('   Make sure the API is running: cd apps/api && npm run dev');
            return Command::FAILURE;
        }
        
        $this->newLine();

        // Test 3: Database
        $this->info('3️⃣  Checking database...');
        
        try {
            $userCount = \App\Models\User::count();
            $idemUserCount = \App\Models\User::whereNotNull('idem_uid')->count();
            
            $this->info("   ✓ Total users: {$userCount}");
            $this->info("   ✓ IDEM users: {$idemUserCount}");
        } catch (\Exception $e) {
            $this->error("   ❌ Database error: {$e->getMessage()}");
            $this->warn('   Run migrations: php artisan migrate');
            return Command::FAILURE;
        }
        
        $this->newLine();

        // Test 4: Session Cookie Test (optional)
        $sessionCookie = $this->argument('session-cookie');
        
        if ($sessionCookie) {
            $this->info('4️⃣  Testing session cookie...');
            
            try {
                $authService = app(IdemAuthService::class);
                $userData = $authService->verifySession($sessionCookie);
                
                if ($userData) {
                    $this->info('   ✓ Session is valid');
                    $this->info("   ✓ User UID: {$userData['uid']}");
                    $this->info("   ✓ Email: {$userData['email']}");
                    
                    // Try to sync user
                    $user = $authService->syncUser($userData);
                    
                    if ($user) {
                        $this->info("   ✓ User synced to database (ID: {$user->id})");
                    } else {
                        $this->error('   ❌ Failed to sync user to database');
                    }
                } else {
                    $this->error('   ❌ Session is invalid or expired');
                }
            } catch (\Exception $e) {
                $this->error("   ❌ Error testing session: {$e->getMessage()}");
                $this->line("   Trace: {$e->getTraceAsString()}");
            }
            
            $this->newLine();
        } else {
            $this->info('4️⃣  Session cookie test skipped');
            $this->line('   To test a session cookie, run:');
            $this->line('   php artisan idem:test-auth "your-session-cookie-value"');
            $this->newLine();
        }

        // Summary
        $this->info('✅ Configuration test complete!');
        $this->newLine();
        
        $this->line('Next steps:');
        $this->line('1. Make sure the API is running: cd apps/api && npm run dev');
        $this->line('2. Login to the main IDEM app to get a session cookie');
        $this->line('3. Access ideploy and check logs: tail -f storage/logs/laravel.log | grep "IDEM"');
        
        return Command::SUCCESS;
    }
}
