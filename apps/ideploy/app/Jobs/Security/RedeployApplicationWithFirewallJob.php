<?php

namespace App\Jobs\Security;

use App\Jobs\ApplicationDeploymentJob;
use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Visus\Cuid2\Cuid2;

class RedeployApplicationWithFirewallJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes
    public $tries = 1;

    public function __construct(
        public Application $application,
        public string $reason = 'firewall_activation'
    ) {}

    public function handle()
    {
        ray("🔄 Redeploying application with firewall: {$this->application->name}");
        ray("Reason: {$this->reason}");
        
        try {
            // Generate new deployment UUID
            $deployment_uuid = new Cuid2;
            
            ray("Generated deployment UUID: {$deployment_uuid}");
            
            // Dispatch application deployment job
            ApplicationDeploymentJob::dispatch(
                deployment_uuid: $deployment_uuid,
                application_id: $this->application->id,
                deployment_pull_request_id: 0,
                force_rebuild: false,
                commit: null,
                git_type: null,
                only_this_server: false,
                rollback_commit: null,
                restart_only: false
            );
            
            ray("✅ Deployment job dispatched for {$this->application->name}");
            
            // Mark application as deploying
            $this->application->update([
                'status' => 'deploying',
            ]);
            
        } catch (\Exception $e) {
            ray("❌ Failed to redeploy application: " . $e->getMessage());
            throw $e;
        }
    }
}
