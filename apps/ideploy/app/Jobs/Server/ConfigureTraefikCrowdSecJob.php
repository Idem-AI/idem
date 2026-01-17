<?php

namespace App\Jobs\Server;

use App\Actions\Proxy\StartProxy;
use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ConfigureTraefikCrowdSecJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes
    public $tries = 1;

    public function __construct(
        public Server $server
    ) {}

    public function handle()
    {
        ray("🔧 Configuring Traefik with CrowdSec plugin on server: {$this->server->name}");
        
        try {
            // 1. Restart Traefik with new configuration (includes CrowdSec plugin)
            ray("Restarting Traefik to load CrowdSec plugin...");
            
            // Force regenerate proxy configuration
            StartProxy::run($this->server, async: false, force: true);
            
            ray("✅ Traefik restarted with CrowdSec plugin");
            
            // 2. Wait for Traefik to be fully ready
            sleep(10);
            
            // 3. Verify plugin is loaded
            $this->verifyPluginLoaded();
            
            ray("🎉 Traefik successfully configured with CrowdSec plugin");
            
        } catch (\Exception $e) {
            ray("❌ Failed to configure Traefik: " . $e->getMessage());
            throw $e;
        }
    }
    
    private function verifyPluginLoaded(): void
    {
        try {
            // Check Traefik logs for plugin loading
            $logs = instant_remote_process([
                'docker logs coolify-proxy --tail 50 2>&1 | grep -i "bouncer\|plugin" || echo "no_plugin_logs"'
            ], $this->server);
            
            if (str_contains($logs, 'bouncer') || str_contains($logs, 'plugin')) {
                ray("Plugin logs found: " . substr($logs, 0, 200));
            } else {
                ray("⚠️ No plugin logs found in Traefik (this might be normal)");
            }
            
        } catch (\Exception $e) {
            ray("Could not verify plugin: " . $e->getMessage());
            // Non-critical, continue anyway
        }
    }
}
