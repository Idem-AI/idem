<?php

namespace App\Jobs\Pipeline\Stages;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Services\Pipeline\Tools\TrivyService;

class TrivyStageJob
{
    protected PipelineExecution $execution;
    protected Application $application;
    protected array $stage;
    protected TrivyService $trivy;

    public function __construct(PipelineExecution $execution, Application $application, array $stage)
    {
        $this->execution = $execution;
        $this->application = $application;
        $this->stage = $stage;
        $this->trivy = new TrivyService();
    }

    public function handle(): array
    {
        try {
            // Determine scan type from stage config
            $scanType = $this->stage['config']['scan_target'] ?? 'filesystem';
            
            if ($scanType === 'image') {
                return $this->scanImage();
            } else {
                return $this->scanFilesystem();
            }
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
            ];
        }
    }

    protected function scanFilesystem(): array
    {
        $sourcePath = $this->getSourcePath();
        $this->log("Scanning filesystem: {$sourcePath}");

        $options = [
            'severity' => $this->stage['config']['severity'] ?? ['CRITICAL', 'HIGH'],
            'scan_types' => $this->stage['config']['scan_type'] ?? ['vuln', 'secret'],
            'ignore_unfixed' => $this->stage['config']['ignore_unfixed'] ?? false,
        ];

        $result = $this->trivy->scanFilesystem($sourcePath, $options);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'],
            ];
        }

        // Log summary
        $summary = $result['summary'];
        $this->log("Vulnerabilities found:");
        $this->log("  CRITICAL: {$summary['CRITICAL']}");
        $this->log("  HIGH: {$summary['HIGH']}");
        $this->log("  MEDIUM: {$summary['MEDIUM']}");
        $this->log("  LOW: {$summary['LOW']}");

        // Log secrets if found
        $secretsCount = count($result['secrets']);
        if ($secretsCount > 0) {
            $this->log("⚠️  {$secretsCount} secrets detected!", 'warning');
            foreach ($result['secrets'] as $secret) {
                $this->log("  - {$secret['category']}: {$secret['title']}", 'warning');
            }
        }

        // Check if scan passed based on severity thresholds
        $failOnSeverity = $options['severity'];
        $hasCriticalIssues = false;
        
        foreach ($failOnSeverity as $severity) {
            if ($summary[$severity] > 0) {
                $hasCriticalIssues = true;
                break;
            }
        }

        // Also fail if secrets detected
        if ($secretsCount > 0) {
            $hasCriticalIssues = true;
        }

        return [
            'success' => !$hasCriticalIssues,
            'error' => $hasCriticalIssues 
                ? "Found {$summary['CRITICAL']} CRITICAL and {$summary['HIGH']} HIGH vulnerabilities" 
                : null,
            'data' => [
                'vulnerabilities' => $result['vulnerabilities'],
                'secrets' => $result['secrets'],
                'summary' => $summary,
            ],
        ];
    }

    protected function scanImage(): array
    {
        // Get image name from application or stage config
        $imageName = $this->stage['config']['image_name'] ?? $this->getImageName();
        $this->log("Scanning Docker image: {$imageName}");

        $options = [
            'severity' => $this->stage['config']['severity'] ?? ['CRITICAL', 'HIGH'],
            'ignore_unfixed' => $this->stage['config']['ignore_unfixed'] ?? false,
        ];

        $result = $this->trivy->scanImage($imageName, $options);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'],
            ];
        }

        // Log summary
        $summary = $result['summary'];
        $this->log("Image vulnerabilities:");
        $this->log("  CRITICAL: {$summary['CRITICAL']}");
        $this->log("  HIGH: {$summary['HIGH']}");
        $this->log("  MEDIUM: {$summary['MEDIUM']}");
        $this->log("  LOW: {$summary['LOW']}");

        $passed = $result['passed'];
        
        if (!$passed) {
            $this->log("❌ Image scan failed - vulnerabilities exceed threshold", 'error');
        } else {
            $this->log("✅ Image scan passed", 'success');
        }

        return [
            'success' => $passed,
            'error' => $passed ? null : "Image has {$summary['CRITICAL']} CRITICAL and {$summary['HIGH']} HIGH vulnerabilities",
            'data' => [
                'vulnerabilities' => $result['vulnerabilities'],
                'summary' => $summary,
            ],
        ];
    }

    protected function getSourcePath(): string
    {
        return "/tmp/pipeline-{$this->application->uuid}/source";
    }

    protected function getImageName(): string
    {
        return "ideploy/{$this->application->uuid}:latest";
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
