<?php

namespace App\Jobs\Pipeline\Stages;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Jobs\ApplicationDeploymentJob;

class DeployStageJob
{
    protected PipelineExecution $execution;
    protected Application $application;
    protected array $stage;

    public function __construct(PipelineExecution $execution, Application $application, array $stage)
    {
        $this->execution = $execution;
        $this->application = $application;
        $this->stage = $stage;
    }

    public function handle(): array
    {
        try {
            $this->log("Deploying application: {$this->application->name}");

            // Use existing iDeploy deployment system
            $deployMethod = $this->stage['config']['deploy_method'] ?? 'ideploy';

            if ($deployMethod === 'ideploy') {
                return $this->deployWithIDeploy();
            }

            return ['success' => true, 'message' => 'Deploy stage skipped'];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
            ];
        }
    }

    protected function deployWithIDeploy(): array
    {
        try {
            $this->log("Using iDeploy deployment system");

            // Check deployment configuration
            $zeroDowntime = $this->stage['config']['zero_downtime'] ?? true;
            $healthCheck = $this->stage['config']['health_check'] ?? true;

            $this->log("Configuration:");
            $this->log("  - Zero downtime: " . ($zeroDowntime ? 'enabled' : 'disabled'));
            $this->log("  - Health checks: " . ($healthCheck ? 'enabled' : 'disabled'));

            // Trigger actual deployment using existing system
            // This would integrate with ApplicationDeploymentJob::deploy()
            
            $this->log("Starting deployment...");

            // The actual deployment logic would:
            // 1. Stop old containers (if not zero-downtime)
            // 2. Start new containers with built image
            // 3. Run health checks
            // 4. Switch traffic to new containers
            // 5. Remove old containers
            
            // Dispatch the deployment job
            dispatch(new ApplicationDeploymentJob(
                deployment_uuid: $this->application->uuid,
                application_deployment_queue_id: null,
                force_rebuild: false,
            ));

            $this->log("✅ Deployment initiated successfully");

            return [
                'success' => true,
                'data' => [
                    'deployment_method' => 'ideploy',
                    'zero_downtime' => $zeroDowntime,
                ],
            ];

        } catch (\Exception $e) {
            $this->log("❌ Deployment failed: {$e->getMessage()}", 'error');
            return [
                'success' => false,
                'error' => 'Deployment failed: ' . $e->getMessage(),
            ];
        }
    }

    protected function log(string $message, string $level = 'info'): void
    {
        \App\Models\PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => $this->stage['id'],
            'stage_name' => $this->stage['name'],
            'level' => $level,
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
}
