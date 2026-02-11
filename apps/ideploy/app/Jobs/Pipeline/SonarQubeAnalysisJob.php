<?php

namespace App\Jobs\Pipeline;

use App\Models\PipelineJob;
use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;

class SonarQubeAnalysisJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public PipelineJob $job,
        public Application $application,
        public string $sourceCode
    ) {}

    public function handle(): void
    {
        $this->job->update([
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            $projectKey = "ideploy-{$this->application->uuid}";
            $sonarUrl = config('services.sonarqube.url', 'http://localhost:9000');
            
            // 1. Auto-detect language and run scanner
            $language = $this->detectLanguage();
            $scannerCommand = $this->getScannerCommand($projectKey, $language);
            
            // 2. Execute SonarQube scanner in Docker
            $result = Process::timeout(300)->run($scannerCommand);
            
            if ($result->failed()) {
                throw new \Exception("SonarQube scan failed: " . $result->errorOutput());
            }

            // 3. Wait for analysis and get metrics
            sleep(10); // Wait for processing
            $metrics = $this->fetchMetrics($projectKey);

            $this->job->update([
                'status' => $this->getStatusFromMetrics($metrics),
                'completed_at' => now(),
                'output' => $result->output(),
                'report_data' => ['sonar' => $metrics],
            ]);

        } catch (\Exception $e) {
            $this->job->update([
                'status' => 'failed',
                'completed_at' => now(),
                'output' => $e->getMessage(),
            ]);
        }
    }

    private function detectLanguage(): string
    {
        // Simple detection - extend based on build_pack
        return match($this->application->build_pack) {
            'nixpacks' => 'javascript', // Default for Node.js
            default => 'generic'
        };
    }

    private function getScannerCommand(string $projectKey, string $language): string
    {
        $sonarUrl = config('services.sonarqube.url');
        $sonarToken = config('services.sonarqube.token');
        
        return "docker run --rm " .
               "--network coolify " .
               "-v {$this->sourceCode}:/usr/src " .
               "sonarsource/sonar-scanner-cli:latest " .
               "-Dsonar.projectKey={$projectKey} " .
               "-Dsonar.host.url={$sonarUrl} " .
               "-Dsonar.login={$sonarToken} " .
               "-Dsonar.sources=/usr/src " .
               "-Dsonar.language={$language}";
    }

    private function fetchMetrics(string $projectKey): array
    {
        $sonarUrl = config('services.sonarqube.url');
        $sonarToken = config('services.sonarqube.token');

        $metrics = [
            'bugs', 'vulnerabilities', 'code_smells', 
            'coverage', 'duplicated_lines_density',
            'reliability_rating', 'security_rating', 'sqale_rating'
        ];

        $response = Http::get("{$sonarUrl}/api/measures/component", [
            'component' => $projectKey,
            'metricKeys' => implode(',', $metrics)
        ])->json();

        $result = [];
        foreach ($response['component']['measures'] ?? [] as $measure) {
            $result[$measure['metric']] = $measure['value'] ?? '0';
        }

        return $result;
    }

    private function getStatusFromMetrics(array $metrics): string
    {
        // Quality Gate: fail if critical issues
        $bugs = (int)($metrics['bugs'] ?? 0);
        $vulnerabilities = (int)($metrics['vulnerabilities'] ?? 0);
        
        return ($bugs > 10 || $vulnerabilities > 0) ? 'failed' : 'success';
    }
}
