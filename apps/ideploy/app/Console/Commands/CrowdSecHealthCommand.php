<?php

namespace App\Console\Commands;

use App\Models\Server;
use App\Services\Security\CrowdSecDeploymentService;
use Illuminate\Console\Command;

class CrowdSecHealthCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'crowdsec:health 
                          {server_id? : The server ID to check (optional, checks all if not specified)}
                          {--fix : Attempt to fix issues automatically}
                          {--detailed : Show detailed diagnostic information}';

    /**
     * The console command description.
     */
    protected $description = 'Check CrowdSec health status on servers and diagnose issues';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $serverId = $this->argument('server_id');
        $fix = $this->option('fix');
        $detailed = $this->option('detailed');

        $this->info("🏥 CrowdSec Health Check");

        if ($serverId) {
            $server = Server::find($serverId);
            if (!$server) {
                $this->error("❌ Server with ID {$serverId} not found");
                return 1;
            }
            $servers = collect([$server]);
        } else {
            $servers = Server::where('crowdsec_installed', true)->get();
            if ($servers->isEmpty()) {
                $this->warn("⚠️ No servers with CrowdSec installed found");
                return 0;
            }
        }

        $this->line("Checking {$servers->count()} server(s)...");
        $this->line("");

        $deploymentService = app(CrowdSecDeploymentService::class);
        $healthyCount = 0;
        $issues = [];

        foreach ($servers as $server) {
            $this->info("🖥️ Server: {$server->name} (ID: {$server->id})");
            
            try {
                $status = $deploymentService->getHealthStatus($server);
                
                $this->displayServerHealth($server, $status, $detailed);
                
                if ($status['healthy']) {
                    $healthyCount++;
                } else {
                    $issues[] = [
                        'server' => $server,
                        'status' => $status,
                    ];
                }
                
                if ($fix && !$status['healthy']) {
                    $this->attemptFix($server, $status, $deploymentService);
                }
                
            } catch (\Exception $e) {
                $this->error("  ❌ Failed to check server: {$e->getMessage()}");
                $issues[] = [
                    'server' => $server,
                    'error' => $e->getMessage(),
                ];
            }
            
            $this->line("");
        }

        // Summary
        $this->displaySummary($servers->count(), $healthyCount, $issues);

        return empty($issues) ? 0 : 1;
    }

    /**
     * Display health status for a single server
     */
    private function displayServerHealth(Server $server, array $status, bool $detailed)
    {
        $overall = $status['healthy'] ? '✅ Healthy' : '❌ Issues detected';
        $this->line("  Status: {$overall}");
        
        if ($detailed) {
            $this->line("  Details:");
            $this->line("    Container Running: " . ($status['container_running'] ? '✅' : '❌'));
            $this->line("    LAPI Responding: " . ($status['lapi_responding'] ? '✅' : '❌'));
            $this->line("    Bouncer Configured: " . ($status['bouncer_configured'] ? '✅' : '❌'));
            
            if ($status['version']) {
                $this->line("    Version: {$status['version']}");
            }
            
            if ($status['error']) {
                $this->line("    Error: <fg=red>{$status['error']}</>");
            }
            
            // Show database status
            $this->line("    Database Status:");
            $this->line("      Installed: " . ($server->crowdsec_installed ? '✅' : '❌'));
            $this->line("      Available: " . ($server->crowdsec_available ? '✅' : '❌'));
            $this->line("      LAPI URL: " . ($server->crowdsec_lapi_url ?: 'Not set'));
            $this->line("      API Key: " . ($server->crowdsec_api_key ? '✅ Set' : '❌ Missing'));
        }
    }

    /**
     * Attempt to fix issues automatically
     */
    private function attemptFix(Server $server, array $status, CrowdSecDeploymentService $service)
    {
        $this->line("  🔧 Attempting automatic fixes...");
        
        try {
            if (!$status['container_running']) {
                $this->line("    → Restarting CrowdSec container...");
                // Try to restart the container
                instant_remote_process([
                    'cd ' . config('crowdsec.docker.config_path'),
                    'docker compose restart crowdsec || docker compose up -d crowdsec'
                ], $server);
                $this->line("    ✅ Container restart attempted");
            }
            
            if (!$status['bouncer_configured']) {
                $this->line("    → Recreating bouncer...");
                // This would need more complex logic to recreate bouncer
                $this->line("    ⚠️ Bouncer recreation requires manual intervention");
            }
            
            // Update server status
            $newStatus = $service->getHealthStatus($server);
            if ($newStatus['healthy']) {
                $this->line("  ✅ Fixes successful - server is now healthy");
            } else {
                $this->line("  ⚠️ Some issues remain - manual intervention may be required");
            }
            
        } catch (\Exception $e) {
            $this->line("  ❌ Auto-fix failed: {$e->getMessage()}");
        }
    }

    /**
     * Display summary of health check
     */
    private function displaySummary(int $total, int $healthy, array $issues)
    {
        $this->line("📊 Summary:");
        $this->line("  Total servers: {$total}");
        $this->line("  Healthy: {$healthy}");
        $this->line("  Issues: " . count($issues));
        
        if (!empty($issues)) {
            $this->line("");
            $this->error("🚨 Servers with issues:");
            
            foreach ($issues as $issue) {
                $server = $issue['server'];
                if (isset($issue['error'])) {
                    $this->line("  • {$server->name}: {$issue['error']}");
                } else {
                    $status = $issue['status'];
                    $problems = [];
                    if (!$status['container_running']) $problems[] = 'container stopped';
                    if (!$status['lapi_responding']) $problems[] = 'LAPI not responding';
                    if (!$status['bouncer_configured']) $problems[] = 'bouncer missing';
                    
                    $this->line("  • {$server->name}: " . implode(', ', $problems));
                }
            }
            
            $this->line("");
            $this->line("💡 Suggestions:");
            $this->line("  → Use --fix option to attempt automatic repairs");
            $this->line("  → Use --detailed option for more diagnostic information");
            $this->line("  → Check server logs: docker logs crowdsec");
            $this->line("  → Reinstall if needed: php artisan crowdsec:install {server_id} --force");
        }
    }
}
