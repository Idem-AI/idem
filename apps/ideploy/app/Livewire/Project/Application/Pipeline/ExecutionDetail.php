<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Models\PipelineJob;
use App\Jobs\PipelineExecutionJob;
use Livewire\Component;

class ExecutionDetail extends Component
{
    public Application $application;
    public $execution = null;
    public array $parameters = [];
    public ?string $selectedStage = null;
    public $execution_uuid;

    public function mount()
    {
        $project = currentTeam()->load(['projects'])->projects->where('uuid', request()->route('project_uuid'))->first();
        if (!$project) {
            return redirect()->route('dashboard');
        }

        $environment = $project->environments()->where('uuid', request()->route('environment_uuid'))->first();
        if (!$environment) {
            return redirect()->route('dashboard');
        }

        $this->application = $environment->applications()->where('uuid', request()->route('application_uuid'))->first();
        if (!$this->application) {
            return redirect()->route('dashboard');
        }

        $this->parameters = [
            'project_uuid' => $project->uuid,
            'environment_uuid' => $environment->uuid,
            'application_uuid' => $this->application->uuid,
        ];

        // Load execution with fake data for demo
        $this->execution_uuid = request()->route('execution_uuid');
        $this->loadExecution();
        
        // Select first stage by default
        $this->selectedStage = 'sonarqube';
    }
    
    /**
     * Load execution with fake data for demo
     */
    public function loadExecution()
    {
        // Fake data pour la démo - basé sur l'ID
        $executions = [
            2314 => [
                'id' => 2314,
                'status' => 'success',
                'branch' => 'main',
                'commit_message' => "Merge branch 'staging' into 'main'",
                'commit_sha' => '1a30f31c',
                'trigger_user' => 'Romuald DJETEJE',
                'started_at' => now()->subMinutes(5),
                'finished_at' => now()->subMinutes(2),
                'duration_seconds' => 163,
                'stages' => [
                    'sonarqube' => ['status' => 'success', 'duration' => 92],
                    'trivy' => ['status' => 'success', 'duration' => 45],
                    'deploy' => ['status' => 'success', 'duration' => 26],
                ],
                'sonarqube_results' => [
                    'bugs' => 0,
                    'vulnerabilities' => 2,
                    'code_smells' => 15,
                    'coverage' => 87,
                ],
                'trivy_results' => [
                    'critical' => 0,
                    'high' => 1,
                    'medium' => 5,
                    'low' => 12,
                ],
                'logs' => [
                    'sonarqube' => "[INFO] Starting SonarQube analysis...\n[INFO] Analyzing 247 files\n[INFO] Quality gate: PASSED\n[SUCCESS] Analysis completed successfully",
                    'trivy' => "[INFO] Starting Trivy security scan...\n[WARN] Found 1 HIGH severity vulnerability\n[INFO] Scan completed\n[INFO] Generating report...",
                    'deploy' => "[INFO] Starting deployment...\n[INFO] Building Docker image\n[INFO] Pushing to registry\n[SUCCESS] Deployment completed",
                ],
            ],
            2313 => [
                'id' => 2313,
                'status' => 'failed',
                'branch' => 'develop',
                'commit_message' => 'Fix authentication bug',
                'commit_sha' => '9b2c4d1e',
                'trigger_user' => 'Webhook',
                'started_at' => now()->subHours(2),
                'finished_at' => now()->subHours(2)->addMinutes(1),
                'duration_seconds' => 72,
                'stages' => [
                    'sonarqube' => ['status' => 'success', 'duration' => 48],
                    'trivy' => ['status' => 'failed', 'duration' => 24],
                    'deploy' => ['status' => 'pending', 'duration' => null],
                ],
                'sonarqube_results' => [
                    'bugs' => 3,
                    'vulnerabilities' => 1,
                    'code_smells' => 8,
                    'coverage' => 72,
                ],
                'trivy_results' => [
                    'critical' => 2,
                    'high' => 5,
                    'medium' => 8,
                    'low' => 15,
                ],
                'logs' => [
                    'sonarqube' => "[INFO] Starting SonarQube analysis...\n[WARN] Found 3 bugs\n[INFO] Quality gate: PASSED",
                    'trivy' => "[INFO] Starting Trivy security scan...\n[ERROR] Found 2 CRITICAL vulnerabilities\n[ERROR] Security gate: FAILED\n[ERROR] Pipeline stopped",
                    'deploy' => "[INFO] Skipped due to previous stage failure",
                ],
            ],
            2312 => [
                'id' => 2312,
                'status' => 'running',
                'branch' => 'feature/new-ui',
                'commit_message' => 'Update pipeline UI with GitLab style',
                'commit_sha' => '7f8e9a2b',
                'trigger_user' => 'Romuald DJETEJE',
                'started_at' => now()->subMinutes(1),
                'finished_at' => null,
                'duration_seconds' => 45,
                'stages' => [
                    'sonarqube' => ['status' => 'success', 'duration' => 38],
                    'trivy' => ['status' => 'running', 'duration' => null],
                    'deploy' => ['status' => 'pending', 'duration' => null],
                ],
                'sonarqube_results' => [
                    'bugs' => 0,
                    'vulnerabilities' => 0,
                    'code_smells' => 5,
                    'coverage' => 92,
                ],
                'trivy_results' => null,
                'logs' => [
                    'sonarqube' => "[INFO] Starting SonarQube analysis...\n[INFO] Analyzing 312 files\n[INFO] Quality gate: PASSED\n[SUCCESS] Analysis completed",
                    'trivy' => "[INFO] Starting Trivy security scan...\n[INFO] Scanning dependencies...\n[INFO] Progress: 67%",
                    'deploy' => "[INFO] Waiting for previous stages...",
                ],
            ],
        ];
        
        $this->execution = (object)($executions[$this->execution_uuid] ?? $executions[2314]);
    }

    public function selectStage($stageName)
    {
        $this->selectedStage = $stageName;
    }

    public function cancelExecution()
    {
        $this->dispatch('success', 'Pipeline execution cancelled (demo mode)');
    }

    public function rerunExecution()
    {
        $this->dispatch('success', 'Pipeline restarted successfully (demo mode)');
    }

    public function render()
    {
        return view('livewire.project.application.pipeline.execution-detail');
    }
}
