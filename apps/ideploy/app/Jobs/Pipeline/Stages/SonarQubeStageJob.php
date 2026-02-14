<?php

namespace App\Jobs\Pipeline\Stages;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Models\PipelineToolConfig;
use App\Services\Pipeline\Tools\SonarQubeService;
use Illuminate\Support\Facades\Process;

class SonarQubeStageJob
{
    protected PipelineExecution $execution;
    protected Application $application;
    protected array $stage;
    protected SonarQubeService $sonar;

    public function __construct(PipelineExecution $execution, Application $application, array $stage)
    {
        $this->execution = $execution;
        $this->application = $application;
        $this->stage = $stage;
        
        // Load SonarQube config from database
        $config = PipelineToolConfig::where('tool_name', 'sonarqube')->first();
        $url = $config?->config['url'] ?? null;
        $token = $config?->config['token'] ?? null;
        
        $this->sonar = new SonarQubeService($url, $token);
    }

    public function handle(): array
    {
        try {
            // Check if SonarQube is available
            if (!$this->sonar->ping()) {
                return [
                    'success' => false,
                    'error' => 'SonarQube server is not available',
                ];
            }

            $projectKey = $this->generateProjectKey();
            $projectName = $this->application->name;

            // Create project in SonarQube
            $this->log("Creating SonarQube project: {$projectKey}");
            $createResult = $this->sonar->createProject($projectKey, $projectName);

            if (!$createResult['success']) {
                // Project might already exist, continue anyway
                $this->log("Project creation result: " . ($createResult['error'] ?? 'already exists'));
            }

            // Generate analysis token
            $this->log("Generating analysis token");
            $tokenResult = $this->sonar->generateToken($projectKey);

            if (!$tokenResult['success']) {
                return [
                    'success' => false,
                    'error' => 'Failed to generate SonarQube token: ' . ($tokenResult['error'] ?? 'unknown error'),
                ];
            }

            $token = $tokenResult['token'];

            // Get application source path (from git_repository or build context)
            $sourcePath = $this->getSourcePath();

            // Run analysis
            $this->log("Running SonarQube analysis on: {$sourcePath}");
            $analysisResult = $this->sonar->runAnalysis($sourcePath, $projectKey, $token, [
                'exclusions' => $this->stage['config']['exclusions'] ?? '**/node_modules/**,**/vendor/**',
            ]);

            if (!$analysisResult['success']) {
                return [
                    'success' => false,
                    'error' => 'Analysis failed: ' . ($analysisResult['error'] ?? 'unknown error'),
                ];
            }

            // Execute sonar-scanner command
            $this->log("Executing: " . $analysisResult['command']);
            $result = Process::timeout(600)->run($analysisResult['command']);

            if (!$result->successful()) {
                return [
                    'success' => false,
                    'error' => 'SonarScanner execution failed: ' . $result->errorOutput(),
                ];
            }

            // Wait a bit for analysis to complete
            sleep(5);

            // Check quality gate
            $this->log("Checking quality gate status");
            $qgResult = $this->sonar->getQualityGateStatus($projectKey);

            if (!$qgResult['success']) {
                return [
                    'success' => false,
                    'error' => 'Failed to get quality gate status',
                ];
            }

            $status = $qgResult['status'];
            $this->log("Quality gate status: {$status}");

            // Get project measures
            $measures = $this->sonar->getProjectMeasures($projectKey);
            if ($measures['success']) {
                foreach ($measures['measures'] as $measure) {
                    $this->log("  {$measure['metric']}: {$measure['value'] ?? 'N/A'}");
                }
            }

            // Check if quality gate passed
            $qualityGatePassed = $status === 'OK';

            return [
                'success' => $qualityGatePassed,
                'error' => $qualityGatePassed ? null : "Quality gate failed with status: {$status}",
                'data' => [
                    'project_key' => $projectKey,
                    'quality_gate' => $status,
                    'measures' => $measures['measures'] ?? [],
                ],
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
            ];
        }
    }

    protected function generateProjectKey(): string
    {
        return 'ideploy-' . $this->application->uuid;
    }

    protected function getSourcePath(): string
    {
        // Default to /tmp/build-{app-uuid} or application workdir
        return "/tmp/pipeline-{$this->application->uuid}/source";
    }

    protected function log(string $message): void
    {
        \App\Models\PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => $this->stage['id'],
            'stage_name' => $this->stage['name'],
            'level' => 'info',
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
}
