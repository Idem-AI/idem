<?php

namespace App\Jobs\Security;

use App\Models\Application;
use App\Services\Security\FirewallConfigService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ReloadCrowdSecConfigJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 60;

    public function __construct(
        public Application $application
    ) {}

    public function handle(FirewallConfigService $configService): void
    {
        $config = $this->application->firewallConfig;
        
        if (!$config || !$config->enabled) {
            ray('Firewall not enabled for application: ' . $this->application->name);
            return;
        }
        
        try {
            // Redeploy configuration files
            $configService->deployConfiguration($config);
            
            ray("CrowdSec configuration reloaded for {$this->application->name}");
            
        } catch (\Exception $e) {
            ray("Failed to reload CrowdSec config: {$e->getMessage()}");
            throw $e;
        }
    }
    
    public function failed(\Throwable $exception): void
    {
        ray("ReloadCrowdSecConfigJob failed for {$this->application->name}: {$exception->getMessage()}");
    }
}
