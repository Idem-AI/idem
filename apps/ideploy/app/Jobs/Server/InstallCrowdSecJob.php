<?php

namespace App\Jobs\Server;

use App\Models\Server;
use App\Services\Security\CrowdSecDeploymentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class InstallCrowdSecJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes
    public $tries = 3;
    public $backoff = [60, 300, 900]; // 1min, 5min, 15min
    public $maxExceptions = 3;

    public function __construct(
        public Server $server
    ) {}

    public function handle()
    {
        ray("🚀 Installing CrowdSec on server: {$this->server->name} (ID: {$this->server->id}) - Attempt {$this->attempts()}/{$this->tries}");
        
        try {
            // Use the new deployment service for robust installation
            $deploymentService = app(CrowdSecDeploymentService::class);
            
            $result = $deploymentService->deployToServer($this->server);
            
            ray("✅ CrowdSec installation completed successfully: {$result['message']}");
            
            // Configure additional webhook for traffic logging
            $this->configureWebhook();
            
            // Schedule validation job to run after installation
            \App\Jobs\Security\ValidateServerInstallationJob::dispatch($this->server)
                ->delay(now()->addMinutes(2));
            
            ray("🎉 CrowdSec fully installed and configured on {$this->server->name}");
            
        } catch (\Exception $e) {
            ray("❌ Failed to install CrowdSec (attempt {$this->attempts()}): " . $e->getMessage());
            
            // Mark as failed only if this was the last attempt
            if ($this->attempts() >= $this->tries) {
                $this->server->update([
                    'crowdsec_installed' => false,
                    'crowdsec_available' => false,
                ]);
                ray("🚫 Maximum retry attempts reached, marking server as failed");
            }
            
            throw $e;
        }
    }
    
    /**
     * Configure webhook for traffic logging
     */
    private function configureWebhook(): void
    {
        ray("🔗 Configuring CrowdSec webhook for traffic logging");
        
        try {
            $webhookToken = config('crowdsec.webhook_token');
            
            if (empty($webhookToken)) {
                ray("⚠️ No webhook token configured, skipping webhook setup");
                return;
            }
            
            $appUrl = config('app.url');
            $webhookUrl = "{$appUrl}/api/crowdsec/traffic-log";
            
            // Configure webhook in CrowdSec
            $containerName = config('crowdsec.docker.container_name');
            
            instant_remote_process([
                "docker exec {$containerName} cscli notifications add webhook ideploy-webhook" .
                " --url {$webhookUrl}" .
                " --header \"Authorization: Bearer {$webhookToken}\"" .
                " --header \"Content-Type: application/json\"" .
                " --format webhook_default || true" // Don't fail if already exists
            ], $this->server);
            
            ray("✅ Webhook configured: {$webhookUrl}");
            
        } catch (\Exception $e) {
            ray("⚠️ Webhook configuration failed (non-critical): " . $e->getMessage());
            // Non-critical, continue installation
        }
    }
    
    /**
     * Handle failed job
     */
    public function failed(\Throwable $exception): void
    {
        ray("💥 InstallCrowdSecJob permanently failed for {$this->server->name}: {$exception->getMessage()}");
        
        // Mark server as failed
        $this->server->update([
            'crowdsec_installed' => false,
            'crowdsec_available' => false,
        ]);
        
        // Send notification to administrators
        // TODO: Implement admin notification
    }
    
    /**
     * Determine the time at which the job should timeout.
     */
    public function retryUntil()
    {
        return now()->addMinutes(60); // Give up after 1 hour total
    }
}
