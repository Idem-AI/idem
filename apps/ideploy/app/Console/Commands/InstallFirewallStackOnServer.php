<?php

namespace App\Console\Commands;

use App\Models\Server;
use App\Jobs\Server\InstallCrowdSecJob;
use App\Jobs\ConfigureTraefikLoggingJob;
use App\Jobs\Security\DeployTrafficLoggerJob;
use App\Jobs\Security\EnableTraefikHeaderLoggingJob;
use App\Jobs\Security\ConfigureCrowdSecTraefikLogsJob;
use Illuminate\Console\Command;

class InstallFirewallStackOnServer extends Command
{
    protected $signature = 'firewall:install-stack {server_id} {--force}';
    protected $description = 'Install complete firewall security stack on a server';

    public function handle()
    {
        $serverId = $this->argument('server_id');
        $force = $this->option('force');
        
        $server = Server::find($serverId);
        
        if (!$server) {
            $this->error("Server #{$serverId} not found");
            return 1;
        }
        
        $this->info("🛡️  Installing COMPLETE FIREWALL STACK on server: {$server->name} (ID: {$server->id})");
        $this->line('');
        
        // Check current installation status
        $this->info('Current installation status:');
        $this->line("  CrowdSec: " . ($server->crowdsec_installed ? '✅ Installed' : '❌ Not installed'));
        $this->line("  Traefik Logging: " . ($server->traefik_logging_enabled ? '✅ Enabled' : '❌ Not enabled'));
        $this->line("  Traffic Logger: " . ($server->traffic_logger_installed ? '✅ Installed' : '❌ Not installed'));
        $this->line('');
        
        // Check if components are already installed
        $hasComponents = $server->crowdsec_installed && $server->traefik_logging_enabled && $server->traffic_logger_installed;
        
        if ($hasComponents && !$force) {
            $this->warn('⚠️  Most components are already installed on this server');
            
            if (!$this->confirm('Do you want to reinstall the complete stack?', false)) {
                $this->info('Installation cancelled');
                return 0;
            }
        }
        
        // Check server connectivity
        $this->info('Checking server connectivity...');
        
        if (!$server->ip || !$server->port) {
            $this->error('Server is not properly configured (missing IP or port)');
            return 1;
        }
        
        $this->info("  IP: {$server->ip}");
        $this->info("  Port: {$server->port}");
        $this->info("  User: {$server->user}");
        $this->line('');
        
        // Dispatch all components with proper timing
        $this->info('🚀 Dispatching COMPLETE FIREWALL STACK installation jobs...');
        $this->line('');
        
        $baseDelay = now()->addSeconds(10);
        
        // 1. CrowdSec (Base firewall)
        $this->line('1. 🔥 CrowdSec (Firewall + AppSec) - Immediate');
        InstallCrowdSecJob::dispatch($server)
            ->delay($baseDelay)
            ->onQueue('security');
        
        // 2. Traefik Logging
        $this->line('2. 📊 Traefik JSON Logging - 30s');
        ConfigureTraefikLoggingJob::dispatch($server)
            ->delay($baseDelay->addSeconds(30))
            ->onQueue('security');
        
        // 3. Header Logging
        $this->line('3. 🔍 Traefik Header Logging (Bot Protection) - 45s');
        EnableTraefikHeaderLoggingJob::dispatch($server)
            ->delay($baseDelay->addSeconds(45))
            ->onQueue('security');
        
        // 4. CrowdSec-Traefik Integration
        $this->line('4. 🔗 CrowdSec-Traefik Logs Integration - 1min');
        ConfigureCrowdSecTraefikLogsJob::dispatch($server)
            ->delay($baseDelay->addMinutes(1))
            ->onQueue('security');
        
        // 5. Traffic Logger
        $this->line('5. ⚡ Traffic Logger (Metrics + ForwardAuth) - 2min');
        DeployTrafficLoggerJob::dispatch($server)
            ->delay($baseDelay->addMinutes(2))
            ->onQueue('security');
        
        // 6. Validation
        $this->line('6. ✅ Complete Stack Validation - 6min');
        \App\Jobs\Security\ValidateServerInstallationJob::dispatch($server)
            ->delay($baseDelay->addMinutes(6))
            ->onQueue('security');
        
        $this->line('');
        $this->info('✅ COMPLETE FIREWALL STACK installation jobs dispatched!');
        $this->line('');
        $this->line('🛡️  Components being installed:');
        $this->line('  • CrowdSec (WAF + AppSec + IP blocking)');
        $this->line('  • Traefik JSON Logging (for CrowdSec parsing)');
        $this->line('  • Header Logging (User-Agent, Referer for bot detection)');
        $this->line('  • CrowdSec-Traefik Integration (log analysis)');
        $this->line('  • Traffic Logger (real-time metrics + ForwardAuth)');
        $this->line('  • Automatic validation and health checks');
        $this->line('');
        $this->line('⏱️  Complete installation will take ~6-8 minutes.');
        $this->line('🔍 You can check the progress with:');
        $this->line('  docker exec idem-ideploy-dev tail -f storage/logs/laravel.log');
        $this->line('');
        
        return 0;
    }
}
