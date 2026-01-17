<?php

namespace App\Jobs\Pipeline;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Models\PipelineLog;
use App\Jobs\Pipeline\Stages\SonarQubeStageJob;
use App\Jobs\Pipeline\Stages\TrivyStageJob;
use App\Jobs\Pipeline\Stages\TestStageJob;
use App\Jobs\Pipeline\Stages\BuildStageJob;
use App\Jobs\Pipeline\Stages\DeployStageJob;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Event;

class PipelineExecutionJob implements ShouldQueue
{
    use Queueable;

    public $timeout = 3600; // 1 hour
    public $tries = 1; // No retry for pipeline execution

    protected PipelineExecution $execution;
    protected Application $application;

    /**
     * Create a new job instance.
     */
    public function __construct(PipelineExecution $execution)
    {
        $this->execution = $execution;
        $this->application = $execution->application;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $this->logInfo('Pipeline execution started');
            
            // Update status to running
            $this->execution->update([
                'status' => 'running',
                'started_at' => now(),
            ]);

            // Get enabled stages from config
            $config = $this->execution->pipelineConfig;
            $stages = collect($config->stages ?? [])
                ->filter(fn($stage) => $stage['enabled'] ?? false)
                ->sortBy('order')
                ->values()
                ->toArray();

            if (empty($stages)) {
                $this->logWarning('No enabled stages found in pipeline');
                $this->completeExecution('success', 'No stages to execute');
                return;
            }

            $this->logInfo('Executing ' . count($stages) . ' stages');

            // Execute each stage sequentially
            foreach ($stages as $stage) {
                $result = $this->executeStage($stage);

                // Check if stage is blocking and failed
                if (!$result['success'] && ($stage['blocking'] ?? false)) {
                    $this->logError('Blocking stage failed: ' . $stage['name']);
                    $this->completeExecution('failed', 'Stage "' . $stage['name'] . '" failed: ' . $result['error']);
                    return;
                }
            }

            // All stages completed successfully
            $this->completeExecution('success');
            
        } catch (\Exception $e) {
            Log::error('Pipeline execution failed with exception', [
                'execution_id' => $this->execution->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            $this->completeExecution('failed', 'Exception: ' . $e->getMessage());
        }
    }

    /**
     * Execute a single stage
     */
    protected function executeStage(array $stage): array
    {
        $stageId = $stage['id'];
        $stageName = $stage['name'];
        $tool = $stage['tool'] ?? 'unknown';

        $this->logInfo("Starting stage: {$stageName}", $stageId, $stageName);
        $this->execution->updateStageStatus($stageId, 'running');

        try {
            // Dispatch appropriate job based on tool
            $result = match(strtolower($tool)) {
                'sonarqube' => $this->executeSonarQubeStage($stage),
                'trivy' => $this->executeTrivyStage($stage),
                'jest', 'pytest', 'phpunit', 'go test', 'auto-detected' => $this->executeTestStage($stage),
                'docker', 'buildpacks', 'nixpacks', 'ideploy builder' => $this->executeBuildStage($stage),
                'ideploy', 'kubernetes' => $this->executeDeployStage($stage),
                default => $this->executeGenericStage($stage),
            };

            if ($result['success']) {
                $this->logSuccess("Stage completed: {$stageName}", $stageId, $stageName);
                $this->execution->updateStageStatus($stageId, 'success');
            } else {
                $this->logError("Stage failed: {$stageName} - {$result['error']}", $stageId, $stageName);
                $this->execution->updateStageStatus($stageId, 'failed', $result['error']);
            }

            return $result;
            
        } catch (\Exception $e) {
            $error = 'Stage exception: ' . $e->getMessage();
            $this->logError($error, $stageId, $stageName);
            $this->execution->updateStageStatus($stageId, 'failed', $error);
            
            return ['success' => false, 'error' => $error];
        }
    }

    /**
     * Execute SonarQube stage
     */
    protected function executeSonarQubeStage(array $stage): array
    {
        $job = new SonarQubeStageJob($this->execution, $this->application, $stage);
        return $job->handle();
    }

    /**
     * Execute Trivy stage
     */
    protected function executeTrivyStage(array $stage): array
    {
        $job = new TrivyStageJob($this->execution, $this->application, $stage);
        return $job->handle();
    }

    /**
     * Execute Test stage
     */
    protected function executeTestStage(array $stage): array
    {
        $job = new TestStageJob($this->execution, $this->application, $stage);
        return $job->handle();
    }

    /**
     * Execute Build stage
     */
    protected function executeBuildStage(array $stage): array
    {
        $job = new BuildStageJob($this->execution, $this->application, $stage);
        return $job->handle();
    }

    /**
     * Execute Deploy stage
     */
    protected function executeDeployStage(array $stage): array
    {
        $job = new DeployStageJob($this->execution, $this->application, $stage);
        return $job->handle();
    }

    /**
     * Execute generic stage (fallback)
     */
    protected function executeGenericStage(array $stage): array
    {
        $this->logWarning('Generic stage execution - tool not implemented: ' . ($stage['tool'] ?? 'unknown'));
        return ['success' => true, 'message' => 'Skipped - not implemented'];
    }

    /**
     * Complete execution with final status
     */
    protected function completeExecution(string $status, ?string $errorMessage = null): void
    {
        $duration = now()->diffInSeconds($this->execution->started_at);
        
        $this->execution->update([
            'status' => $status,
            'finished_at' => now(),
            'duration_seconds' => $duration,
            'error_message' => $errorMessage,
        ]);

        $this->logInfo("Pipeline execution completed with status: {$status} (Duration: {$duration}s)");
        
        // Dispatch event for notifications
        Event::dispatch('pipeline.completed', [
            'execution' => $this->execution,
            'status' => $status,
        ]);
    }

    /**
     * Log info message
     */
    protected function logInfo(string $message, ?string $stageId = null, ?string $stageName = null): void
    {
        $this->createLog('info', $message, $stageId, $stageName);
    }

    /**
     * Log success message
     */
    protected function logSuccess(string $message, ?string $stageId = null, ?string $stageName = null): void
    {
        $this->createLog('success', $message, $stageId, $stageName);
    }

    /**
     * Log warning message
     */
    protected function logWarning(string $message, ?string $stageId = null, ?string $stageName = null): void
    {
        $this->createLog('warning', $message, $stageId, $stageName);
    }

    /**
     * Log error message
     */
    protected function logError(string $message, ?string $stageId = null, ?string $stageName = null): void
    {
        $this->createLog('error', $message, $stageId, $stageName);
    }

    /**
     * Create log entry
     */
    protected function createLog(string $level, string $message, ?string $stageId = null, ?string $stageName = null): void
    {
        PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => $stageId ?? 'pipeline',
            'stage_name' => $stageName ?? 'Pipeline',
            'level' => $level,
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
}
