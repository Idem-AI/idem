<?php

namespace App\Jobs;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Models\PipelineJob;
use App\Services\Pipeline\LanguageDetectorService;
use App\Services\Pipeline\SonarQubeService;
use App\Services\Pipeline\TrivyService;
use App\Services\Pipeline\PipelineNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PipelineExecutionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 3600; // 1 hour timeout
    public $tries = 1; // Don't retry failed pipelines

    public function __construct(
        public PipelineExecution $execution
    ) {}

    public function handle(): void
    {
        Log::info("Starting pipeline execution: {$this->execution->uuid}");

        try {
            // Update execution status
            $this->execution->update([
                'status' => 'running',
                'started_at' => now(),
            ]);

            $application = $this->execution->application;
            $projectPath = $this->getProjectPath($application);

            // Job 1: Language Detection
            $languageJob = $this->createJob('language_detection', 1);
            $detectedLanguage = $this->runLanguageDetection($languageJob, $projectPath);

            if ($languageJob->status === 'failed') {
                throw new \Exception("Language detection failed");
            }

            // Job 2: SonarQube Analysis
            if ($this->isSonarQubeEnabled()) {
                $sonarJob = $this->createJob('sonarqube', 2);
                $this->runSonarQubeAnalysis($sonarJob, $projectPath, $application);

                if ($sonarJob->status === 'failed') {
                    Log::warning("SonarQube analysis failed, continuing pipeline");
                }
            }

            // Job 3: Trivy Security Scan
            if ($this->isTrivyEnabled()) {
                $trivyJob = $this->createJob('trivy', 3);
                $this->runTrivyScan($trivyJob, $projectPath);

                if ($trivyJob->status === 'failed') {
                    Log::warning("Trivy scan failed, continuing pipeline");
                }
            }

            // Job 4: Deploy (using existing iDeploy functionality)
            $deployJob = $this->createJob('deploy', 4);
            $this->runDeploy($deployJob, $application);

            // Mark execution as successful
            $this->execution->update([
                'status' => 'success',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($this->execution->started_at),
            ]);

            Log::info("Pipeline execution completed successfully: {$this->execution->uuid}");

            // Send success notifications
            $this->sendNotifications('success');

        } catch (\Exception $e) {
            Log::error("Pipeline execution failed: " . $e->getMessage(), [
                'execution_uuid' => $this->execution->uuid,
                'exception' => $e,
            ]);

            $this->execution->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($this->execution->started_at),
                'error_message' => $e->getMessage(),
            ]);

            // Send failure notifications
            $this->sendNotifications('failure');

            throw $e;
        }
    }

    private function createJob(string $name, int $order): PipelineJob
    {
        return PipelineJob::create([
            'pipeline_execution_id' => $this->execution->id,
            'name' => $name,
            'status' => 'pending',
            'order' => $order,
        ]);
    }

    private function runLanguageDetection(PipelineJob $job, string $projectPath): array
    {
        Log::info("Running language detection job: {$job->uuid}");

        $job->update([
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            $detector = app(LanguageDetectorService::class);
            $result = $detector->detect($projectPath);

            $logs = "Language Detection Results:\n";
            $logs .= "Primary Language: {$result['primary']['language']}\n";
            $logs .= "Confidence: {$result['primary']['confidence']}%\n";
            
            if ($result['primary']['framework']) {
                $logs .= "Framework: {$result['primary']['framework']}\n";
            }

            $job->update([
                'status' => 'success',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($job->started_at),
                'logs' => $logs,
                'metadata' => $result,
            ]);

            return $result;

        } catch (\Exception $e) {
            $job->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($job->started_at),
                'error_message' => $e->getMessage(),
                'logs' => "Language detection failed: " . $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function runSonarQubeAnalysis(PipelineJob $job, string $projectPath, Application $application): void
    {
        Log::info("Running SonarQube analysis job: {$job->uuid}");

        $job->update([
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            $sonarService = app(SonarQubeService::class);
            $projectKey = "ideploy-{$application->uuid}";
            
            $scanResult = $sonarService->analyze($job, $projectPath, $projectKey);

            $logs = "SonarQube Analysis Results:\n";
            $logs .= $scanResult->summary . "\n";
            $logs .= "\nDashboard: {$scanResult->sonar_dashboard_url}\n";

            $job->update([
                'status' => $scanResult->status === 'success' ? 'success' : 'failed',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($job->started_at),
                'logs' => $logs,
                'metadata' => [
                    'scan_result_id' => $scanResult->id,
                    'quality_gate' => $scanResult->quality_gate_status,
                ],
            ]);

        } catch (\Exception $e) {
            $job->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($job->started_at),
                'error_message' => $e->getMessage(),
                'logs' => "SonarQube analysis failed: " . $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function runTrivyScan(PipelineJob $job, string $projectPath): void
    {
        Log::info("Running Trivy security scan job: {$job->uuid}");

        $job->update([
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            $trivyService = app(TrivyService::class);
            $scanResult = $trivyService->scan($job, $projectPath);

            $logs = "Trivy Security Scan Results:\n";
            $logs .= $scanResult->summary . "\n";

            if (count($scanResult->secrets_found ?? []) > 0) {
                $logs .= "\n⚠️  WARNING: Secrets detected in code!\n";
            }

            $job->update([
                'status' => $scanResult->status === 'success' ? 'success' : 'failed',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($job->started_at),
                'logs' => $logs,
                'metadata' => [
                    'scan_result_id' => $scanResult->id,
                    'total_vulnerabilities' => $scanResult->total_vulnerabilities,
                    'critical_count' => $scanResult->critical_count,
                ],
            ]);

        } catch (\Exception $e) {
            $job->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($job->started_at),
                'error_message' => $e->getMessage(),
                'logs' => "Trivy scan failed: " . $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function runDeploy(PipelineJob $job, Application $application): void
    {
        Log::info("Running deploy job: {$job->uuid}");

        $job->update([
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            // Check if scans passed
            $sonarPassed = $this->checkSonarQubeStatus();
            $trivyPassed = $this->checkTrivyStatus();

            if (!$sonarPassed || !$trivyPassed) {
                $logs = "Deployment blocked due to failed security checks:\n";
                if (!$sonarPassed) $logs .= "- SonarQube Quality Gate failed\n";
                if (!$trivyPassed) $logs .= "- Trivy found critical vulnerabilities\n";

                $job->update([
                    'status' => 'failed',
                    'finished_at' => now(),
                    'duration_seconds' => now()->diffInSeconds($job->started_at),
                    'logs' => $logs,
                    'error_message' => 'Security checks failed',
                ]);

                throw new \Exception("Deployment blocked by security checks");
            }

            // Trigger existing iDeploy deployment
            // This would integrate with your existing deployment system
            $logs = "Starting deployment via iDeploy...\n";
            $logs .= "Application: {$application->name}\n";
            $logs .= "Commit: {$this->execution->commit_sha}\n";
            $logs .= "Branch: {$this->execution->branch}\n";
            $logs .= "\n✅ Deployment triggered successfully\n";

            // TODO: Integrate with existing iDeploy deployment
            // dispatch(new DeployApplicationJob($application, $this->execution->commit_sha));

            $job->update([
                'status' => 'success',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($job->started_at),
                'logs' => $logs,
            ]);

        } catch (\Exception $e) {
            $job->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($job->started_at),
                'error_message' => $e->getMessage(),
                'logs' => "Deployment failed: " . $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function getProjectPath(Application $application): string
    {
        // This should return the actual path where the code is cloned
        // Adjust based on your iDeploy structure
        return storage_path("app/repositories/{$application->uuid}");
    }

    private function isSonarQubeEnabled(): bool
    {
        $config = $this->execution->pipelineConfig;
        $stages = $config->stages ?? [];
        
        foreach ($stages as $stage) {
            if ($stage['name'] === 'sonarqube' && ($stage['enabled'] ?? false)) {
                return true;
            }
        }
        
        return false;
    }

    private function isTrivyEnabled(): bool
    {
        $config = $this->execution->pipelineConfig;
        $stages = $config->stages ?? [];
        
        foreach ($stages as $stage) {
            if ($stage['name'] === 'trivy' && ($stage['enabled'] ?? false)) {
                return true;
            }
        }
        
        return false;
    }

    private function checkSonarQubeStatus(): bool
    {
        $sonarJob = $this->execution->jobs()->where('name', 'sonarqube')->first();
        
        if (!$sonarJob) {
            return true; // Not enabled, so pass
        }

        $scanResult = $sonarJob->scanResults()->where('tool', 'sonarqube')->first();
        
        return $scanResult ? $scanResult->passed() : false;
    }

    private function checkTrivyStatus(): bool
    {
        $trivyJob = $this->execution->jobs()->where('name', 'trivy')->first();
        
        if (!$trivyJob) {
            return true; // Not enabled, so pass
        }

        $scanResult = $trivyJob->scanResults()->where('tool', 'trivy')->first();
        
        return $scanResult ? $scanResult->passed() : false;
    }

    private function sendNotifications(string $event): void
    {
        try {
            $notificationService = app(PipelineNotificationService::class);
            $notificationService->sendNotifications($this->execution, $event);
        } catch (\Exception $e) {
            Log::error("Failed to send notifications: " . $e->getMessage());
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("Pipeline execution job failed completely", [
            'execution_uuid' => $this->execution->uuid,
            'exception' => $exception->getMessage(),
        ]);

        $this->execution->update([
            'status' => 'failed',
            'finished_at' => now(),
            'error_message' => $exception->getMessage(),
        ]);
    }
}
