<?php

namespace App\Services\Pipeline;

use App\Models\PipelineScanResult;
use App\Models\PipelineJob;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class SonarQubeService
{
    private string $sonarUrl;
    private string $sonarToken;

    public function __construct()
    {
        // Get SonarQube config from environment or database
        $this->sonarUrl = config('services.sonarqube.url', 'http://localhost:9000');
        $this->sonarToken = config('services.sonarqube.token', '');
    }

    /**
     * Run SonarQube analysis on a project
     */
    public function analyze(PipelineJob $job, string $projectPath, string $projectKey): PipelineScanResult
    {
        Log::info("Starting SonarQube analysis for project: {$projectKey}");

        $scanResult = PipelineScanResult::create([
            'pipeline_job_id' => $job->id,
            'pipeline_execution_id' => $job->pipeline_execution_id,
            'tool' => 'sonarqube',
            'status' => 'pending',
            'sonar_project_key' => $projectKey,
        ]);

        try {
            // Run sonar-scanner CLI
            $command = sprintf(
                'sonar-scanner ' .
                '-Dsonar.projectKey=%s ' .
                '-Dsonar.sources=. ' .
                '-Dsonar.host.url=%s ' .
                '-Dsonar.login=%s',
                escapeshellarg($projectKey),
                escapeshellarg($this->sonarUrl),
                escapeshellarg($this->sonarToken)
            );

            $result = Process::path($projectPath)
                ->timeout(600) // 10 minutes timeout
                ->run($command);

            if (!$result->successful()) {
                throw new \Exception("SonarQube scanner failed: " . $result->errorOutput());
            }

            // Extract task ID from scanner output
            $taskId = $this->extractTaskId($result->output());
            $scanResult->update(['sonar_task_id' => $taskId]);

            // Wait for analysis to complete
            $this->waitForAnalysis($taskId);

            // Fetch analysis results
            $metrics = $this->fetchMetrics($projectKey);

            // Update scan result with metrics
            $scanResult->update([
                'status' => 'success',
                'quality_gate_status' => $metrics['qualityGateStatus'],
                'bugs' => $metrics['bugs'],
                'vulnerabilities' => $metrics['vulnerabilities'],
                'code_smells' => $metrics['codeSmells'],
                'security_hotspots' => $metrics['securityHotspots'],
                'coverage' => $metrics['coverage'],
                'duplications' => $metrics['duplications'],
                'sonar_dashboard_url' => "{$this->sonarUrl}/dashboard?id={$projectKey}",
                'raw_data' => $metrics,
                'summary' => $this->generateSummary($metrics),
            ]);

            Log::info("SonarQube analysis completed successfully for {$projectKey}");

        } catch (\Exception $e) {
            Log::error("SonarQube analysis failed: " . $e->getMessage());
            
            $scanResult->update([
                'status' => 'failed',
                'summary' => 'Analysis failed: ' . $e->getMessage(),
            ]);
        }

        return $scanResult->fresh();
    }

    /**
     * Extract task ID from sonar-scanner output
     */
    private function extractTaskId(string $output): ?string
    {
        if (preg_match('/ceTaskId=([a-zA-Z0-9-]+)/', $output, $matches)) {
            return $matches[1];
        }
        return null;
    }

    /**
     * Wait for SonarQube analysis to complete
     */
    private function waitForAnalysis(string $taskId, int $maxWaitSeconds = 300): void
    {
        $startTime = time();

        while (time() - $startTime < $maxWaitSeconds) {
            $response = Http::withBasicAuth($this->sonarToken, '')
                ->get("{$this->sonarUrl}/api/ce/task", ['id' => $taskId]);

            if ($response->successful()) {
                $task = $response->json('task');
                $status = $task['status'] ?? 'PENDING';

                if ($status === 'SUCCESS') {
                    return;
                }

                if ($status === 'FAILED' || $status === 'CANCELED') {
                    throw new \Exception("SonarQube analysis task failed with status: {$status}");
                }
            }

            sleep(5); // Wait 5 seconds before checking again
        }

        throw new \Exception("SonarQube analysis timeout after {$maxWaitSeconds} seconds");
    }

    /**
     * Fetch metrics from SonarQube API
     */
    private function fetchMetrics(string $projectKey): array
    {
        $metricKeys = [
            'bugs',
            'vulnerabilities',
            'code_smells',
            'security_hotspots',
            'coverage',
            'duplicated_lines_density',
        ];

        $response = Http::withBasicAuth($this->sonarToken, '')
            ->get("{$this->sonarUrl}/api/measures/component", [
                'component' => $projectKey,
                'metricKeys' => implode(',', $metricKeys),
            ]);

        if (!$response->successful()) {
            throw new \Exception("Failed to fetch SonarQube metrics");
        }

        $measures = $response->json('component.measures', []);
        $metrics = [];

        foreach ($measures as $measure) {
            $metrics[$measure['metric']] = $measure['value'] ?? 0;
        }

        // Fetch quality gate status
        $qgResponse = Http::withBasicAuth($this->sonarToken, '')
            ->get("{$this->sonarUrl}/api/qualitygates/project_status", [
                'projectKey' => $projectKey,
            ]);

        $qualityGateStatus = $qgResponse->json('projectStatus.status', 'NONE');

        return [
            'qualityGateStatus' => $qualityGateStatus,
            'bugs' => (int) ($metrics['bugs'] ?? 0),
            'vulnerabilities' => (int) ($metrics['vulnerabilities'] ?? 0),
            'codeSmells' => (int) ($metrics['code_smells'] ?? 0),
            'securityHotspots' => (int) ($metrics['security_hotspots'] ?? 0),
            'coverage' => (float) ($metrics['coverage'] ?? 0),
            'duplications' => (float) ($metrics['duplicated_lines_density'] ?? 0),
        ];
    }

    /**
     * Generate human-readable summary
     */
    private function generateSummary(array $metrics): string
    {
        $lines = [];
        
        $lines[] = "Quality Gate: {$metrics['qualityGateStatus']}";
        $lines[] = "Bugs: {$metrics['bugs']}";
        $lines[] = "Vulnerabilities: {$metrics['vulnerabilities']}";
        $lines[] = "Code Smells: {$metrics['codeSmells']}";
        $lines[] = "Security Hotspots: {$metrics['securityHotspots']}";
        $lines[] = "Coverage: {$metrics['coverage']}%";
        $lines[] = "Duplications: {$metrics['duplications']}%";

        return implode("\n", $lines);
    }

    /**
     * Test SonarQube connection
     */
    public function testConnection(): bool
    {
        try {
            $response = Http::withBasicAuth($this->sonarToken, '')
                ->timeout(5)
                ->get("{$this->sonarUrl}/api/system/status");

            return $response->successful();
        } catch (\Exception $e) {
            Log::error("SonarQube connection test failed: " . $e->getMessage());
            return false;
        }
    }
}
