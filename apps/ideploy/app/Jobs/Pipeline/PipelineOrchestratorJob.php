<?php

namespace App\Jobs\Pipeline;

use App\Jobs\ApplicationDeploymentJob;
use App\Models\PipelineExecution;
use App\Models\PipelineLog;
use App\Services\Pipeline\LanguageDetectorService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Orchestrateur principal du pipeline
 * Coordonne l'exécution de toutes les étapes : Clone, Détection, Scans, Déploiement
 */
class PipelineOrchestratorJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 3600; // 1 hour
    public $tries = 1;

    public function __construct(
        public PipelineExecution $execution
    ) {}

    public function handle(): void
    {
        // Refresh execution to get latest status
        $this->execution->refresh();
        
        // Check if execution is already completed/failed/cancelled
        if (in_array($this->execution->status, ['success', 'failed', 'cancelled'])) {
            Log::info("Pipeline execution already completed with status: {$this->execution->status}", [
                'execution_uuid' => $this->execution->uuid,
            ]);
            return;
        }
        
        $this->log('info', '🚀 Pipeline execution started');
        $this->log('info', "📋 Execution ID: {$this->execution->uuid}");
        $this->log('info', "📦 Application: {$this->execution->application->name}");
        $this->log('info', '');
        
        try {
            // Update execution status
            $this->execution->update([
                'status' => 'running',
                'started_at' => now(),
            ]);
            
            // ========================================
            // STAGE 1: Git Clone
            // ========================================
            $this->updateStageStatus('git_clone', 'running');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('info', '📥 STAGE 1: Git Clone');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            $cloneJob = new GitCloneStageJob($this->execution);
            $cloneResult = $cloneJob->handle();
            
            if (!$cloneResult['success']) {
                $this->updateStageStatus('git_clone', 'failed', $cloneResult['error'] ?? 'Unknown error');
                throw new \Exception('Git clone failed: ' . ($cloneResult['error'] ?? 'Unknown error'));
            }
            
            $this->updateStageStatus('git_clone', 'success');
            $workspacePath = $cloneResult['workspace_path'];
            
            // Refresh execution to get updated source_path
            $this->execution->refresh();
            
            // ========================================
            // STAGE 2: Language Detection
            // ========================================
            $this->updateStageStatus('language_detection', 'running');
            $this->log('info', '');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('info', '🔍 STAGE 2: Language Detection');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            $detectedLanguage = $this->detectLanguage($workspacePath);
            $this->updateStageStatus('language_detection', 'success');
            
            // ========================================
            // STAGE 3: SonarQube Analysis (Optional)
            // ========================================
            $this->updateStageStatus('sonarqube', 'running');
            $this->log('info', '');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('info', '📊 STAGE 3: SonarQube Analysis');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            $sonarJob = new SonarQubeStageJob($this->execution, $detectedLanguage);
            $sonarResult = $sonarJob->handle();
            
            if ($sonarResult['skipped'] ?? false) {
                $this->updateStageStatus('sonarqube', 'skipped');
            } elseif (!$sonarResult['success']) {
                $this->updateStageStatus('sonarqube', 'failed', $sonarResult['error'] ?? 'Unknown error');
                // Continue even if SonarQube fails (non-blocking)
                $this->log('warning', '⚠️  SonarQube failed but pipeline continues...');
            } else {
                $this->updateStageStatus('sonarqube', 'success');
            }
            
            // ========================================
            // STAGE 4: Trivy Security Scan (Optional)
            // ========================================
            $this->updateStageStatus('trivy', 'running');
            $this->log('info', '');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('info', '🔒 STAGE 4: Trivy Security Scan');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            $trivyJob = new TrivyStageJob($this->execution);
            $trivyResult = $trivyJob->handle();
            
            if ($trivyResult['skipped'] ?? false) {
                $this->updateStageStatus('trivy', 'skipped');
            } elseif (!$trivyResult['success']) {
                $this->updateStageStatus('trivy', 'failed', $trivyResult['error'] ?? 'Unknown error');
                // Continue even if Trivy fails (non-blocking)
                $this->log('warning', '⚠️  Trivy failed but pipeline continues...');
            } else {
                $this->updateStageStatus('trivy', 'success');
                
                // Check if security scan passed thresholds
                if (!($trivyResult['scan_passed'] ?? true)) {
                    $this->log('warning', '⚠️  Security scan found critical issues!');
                    
                    // Check if deployment should be blocked
                    $config = $this->execution->pipelineConfig;
                    if ($config && ($config->config['block_on_security_issues'] ?? false)) {
                        $this->log('error', '🚫 Deployment blocked due to security issues');
                        throw new \Exception('Deployment blocked: Critical security issues found');
                    }
                }
            }
            
            // ========================================
            // STAGE 5: Deployment
            // ========================================
            // Refresh execution to check current status
            $this->execution->refresh();
            
            // Only deploy if pipeline is still running
            if ($this->execution->status !== 'running') {
                $this->log('warning', '⚠️  Pipeline status is not running, skipping deployment');
                $this->log('info', "   Current status: {$this->execution->status}");
                $this->updateStageStatus('deploy', 'skipped');
                return;
            }
            
            $this->updateStageStatus('deploy', 'running');
            $this->log('info', '');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('info', '🚀 STAGE 5: Deployment');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            $this->deployApplication();
            $this->updateStageStatus('deploy', 'success');
            
            // ========================================
            // Pipeline Success
            // ========================================
            $this->execution->update([
                'status' => 'success',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($this->execution->started_at),
            ]);
            
            $this->log('info', '');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('success', '✅ PIPELINE COMPLETED SUCCESSFULLY!');
            $this->log('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('info', "⏱️  Duration: " . $this->execution->duration_seconds . " seconds");
            $this->log('info', '');
            
            Log::info("Pipeline execution completed successfully: {$this->execution->uuid}");
            
        } catch (\Exception $e) {
            Log::error("Pipeline execution failed: " . $e->getMessage(), [
                'execution_uuid' => $this->execution->uuid,
                'exception' => $e,
            ]);
            
            // Mark remaining stages as skipped
            $this->markRemainingStagesAsSkipped();
            
            $this->execution->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_seconds' => $this->execution->started_at ? now()->diffInSeconds($this->execution->started_at) : 0,
                'error_message' => $e->getMessage(),
            ]);
            
            $this->log('error', '');
            $this->log('error', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('error', '❌ PIPELINE FAILED');
            $this->log('error', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->log('error', "Error: {$e->getMessage()}");
            $this->log('error', '');
            
            throw $e;
        } finally {
            // Cleanup workspace
            $this->cleanup();
        }
    }
    
    private function detectLanguage(string $workspacePath): string
    {
        $this->log('info', '🔍 Detecting project language...');
        
        $server = $this->execution->application->destination->server;
        
        // Get list of files to analyze
        $filesOutput = instant_remote_process([
            "cd {$workspacePath}",
            "find . -type f -name '*.php' -o -name '*.js' -o -name '*.py' -o -name '*.java' -o -name '*.go' -o -name 'package.json' -o -name 'composer.json' -o -name 'requirements.txt' -o -name 'pom.xml' | head -20",
        ], $server, false);
        
        $detectedLanguage = 'Unknown';
        
        if ($filesOutput) {
            if (str_contains($filesOutput, 'composer.json') || str_contains($filesOutput, '.php')) {
                $detectedLanguage = 'PHP';
            } elseif (str_contains($filesOutput, 'package.json') || str_contains($filesOutput, '.js')) {
                $detectedLanguage = 'JavaScript';
            } elseif (str_contains($filesOutput, 'requirements.txt') || str_contains($filesOutput, '.py')) {
                $detectedLanguage = 'Python';
            } elseif (str_contains($filesOutput, 'pom.xml') || str_contains($filesOutput, '.java')) {
                $detectedLanguage = 'Java';
            } elseif (str_contains($filesOutput, '.go')) {
                $detectedLanguage = 'Go';
            }
        }
        
        $this->log('info', "✅ Detected language: {$detectedLanguage}");
        
        return $detectedLanguage;
    }
    
    private function deployApplication(): void
    {
        $this->log('info', '🚀 Triggering application deployment...');
        
        $application = $this->execution->application;
        
        // Use existing iDeploy deployment system
        // This integrates with the ApplicationDeploymentJob
        $this->log('info', "📦 Application: {$application->name}");
        $this->log('info', "🌿 Branch: {$this->execution->branch}");
        
        if ($this->execution->commit_sha) {
            $this->log('info', "📝 Commit: {$this->execution->commit_sha}");
        }
        
        // Dispatch deployment job
        $deploymentResult = queue_application_deployment(
            application: $application,
            deployment_uuid: $this->execution->uuid,
            force_rebuild: true,
            commit: $this->execution->commit_sha ?? 'HEAD',
            git_type: 'commit'
        );
        
        if ($deploymentResult && isset($deploymentResult['deployment_uuid'])) {
            $this->log('success', "✅ Deployment {$deploymentResult['status']}: {$deploymentResult['deployment_uuid']}");
            $this->log('info', '📊 Monitor deployment progress in the Deployments tab');
        } else {
            throw new \Exception('Failed to queue deployment');
        }
    }
    
    private function cleanup(): void
    {
        try {
            if ($this->execution->source_path) {
                $server = $this->execution->application->destination->server;
                $workspacePath = $this->execution->source_path;
                
                $this->log('info', '🧹 Cleaning up workspace...');
                instant_remote_process([
                    "rm -rf {$workspacePath}",
                ], $server, false);
                
                $this->log('info', '✅ Workspace cleaned');
            }
        } catch (\Exception $e) {
            Log::warning("Failed to cleanup workspace: " . $e->getMessage());
        }
    }
    
    private function updateStageStatus(string $stageId, string $status, ?string $error = null): void
    {
        $stages = $this->execution->stages_status ?? [];
        $stages[$stageId] = [
            'status' => $status,
            'started_at' => $stages[$stageId]['started_at'] ?? now()->toIso8601String(),
            'finished_at' => in_array($status, ['success', 'failed', 'skipped']) ? now()->toIso8601String() : null,
            'error' => $error,
        ];
        
        $this->execution->update(['stages_status' => $stages]);
    }
    
    private function markRemainingStagesAsSkipped(): void
    {
        $allStages = ['git_clone', 'language_detection', 'sonarqube', 'trivy', 'deploy'];
        $stages = $this->execution->stages_status ?? [];
        
        foreach ($allStages as $stageId) {
            // Gérer les deux formats: string ou array
            $stageData = $stages[$stageId] ?? [];
            
            if (is_string($stageData)) {
                $currentStatus = $stageData;
                $startedAt = now()->toIso8601String();
            } else {
                $currentStatus = $stageData['status'] ?? 'pending';
                $startedAt = $stageData['started_at'] ?? now()->toIso8601String();
            }
            
            // Skip stages that are still pending or running
            if (in_array($currentStatus, ['pending', 'running'])) {
                $stages[$stageId] = [
                    'status' => 'skipped',
                    'started_at' => $startedAt,
                    'finished_at' => now()->toIso8601String(),
                    'error' => 'Skipped due to previous stage failure',
                ];
            }
        }
        
        $this->execution->update(['stages_status' => $stages]);
    }
    
    private function log(string $level, string $message): void
    {
        PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => 'orchestrator',
            'stage_name' => 'Pipeline',
            'level' => $level,
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
    
    public function failed(\Throwable $exception): void
    {
        Log::error("Pipeline orchestrator job failed", [
            'execution_uuid' => $this->execution->uuid,
            'exception' => $exception->getMessage(),
        ]);
        
        // Refresh pour avoir les dernières données
        $this->execution->refresh();
        
        // Marquer les stages restants comme skipped
        $this->markRemainingStagesAsSkipped();
        
        // Calculer la durée
        $durationSeconds = 0;
        if ($this->execution->started_at) {
            $durationSeconds = now()->diffInSeconds($this->execution->started_at);
        }
        
        // Mettre à jour le status
        $this->execution->update([
            'status' => 'failed',
            'finished_at' => now(),
            'duration_seconds' => $durationSeconds,
            'error_message' => $exception->getMessage(),
        ]);
        
        // Logger l'échec
        $this->log('error', '❌ Pipeline failed: ' . $exception->getMessage());
    }
}
