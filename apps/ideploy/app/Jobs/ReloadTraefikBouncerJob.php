<?php

namespace App\Jobs;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Reload Traefik Bouncer to pick up new CrowdSec decisions
 * 
 * NOTE: With UpdateIntervalSeconds=10, the plugin checks LAPI every 10s.
 * This job is only needed for immediate blocking (e.g., critical threats).
 * For normal operation, wait 10-60s for automatic sync.
 */
class ReloadTraefikBouncerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public Server $server,
        public bool $forceRestart = false
    ) {}

    public function handle(): void
    {
        try {
            if ($this->forceRestart) {
                // Full restart (causes brief downtime)
                $command = 'docker restart coolify-proxy';
                
                instant_remote_process(
                    [$command],
                    $this->server,
                    false
                );
                
                ray("⚠️ Traefik RESTARTED (forced) for server: {$this->server->name}");
            } else {
                // Graceful: just wait for UpdateIntervalSeconds to sync
                // No action needed, plugin will poll LAPI automatically
                ray("✅ Bouncer will sync automatically within 10-60s: {$this->server->name}");
            }
            
        } catch (\Throwable $e) {
            ray()->exception($e);
            throw $e;
        }
    }
}
