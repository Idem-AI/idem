<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineConfig;
use App\Models\PipelineExecution;
use App\Jobs\Pipeline\PipelineExecutionJob;
use App\Services\Pipeline\PipelineToolsService;
use Livewire\Component;

class Overview extends Component
{
    public Application $application;
    public ?PipelineConfig $pipelineConfig = null;
    
    public $parameters;
    
    public $pipelineEnabled = false;
    
    // Pipeline stages configuration
    public $stages = [];
    
    // Available tools
    public $availableTools = [];
    public $selectedCategory = 'all';
    
    // Modals
    public $showConfigModal = false;
    public $showAddToolModal = false;
    public $currentStage = null;
    
    // Search & Filters
    public $search = '';
    public $statusFilter = '';
    
    // Executions list
    public $executions = [];
    public $totalExecutions = 0;
    
    public function mount()
    {
        $project = currentTeam()
            ->projects()
            ->where('uuid', request()->route('project_uuid'))
            ->firstOrFail();
        $environment = $project->environments()
            ->where('uuid', request()->route('environment_uuid'))
            ->firstOrFail();
        $this->application = $environment->applications()
            ->where('uuid', request()->route('application_uuid'))
            ->firstOrFail();
            
        $this->parameters = [
            'project_uuid' => $project->uuid,
            'environment_uuid' => $environment->uuid,
            'application_uuid' => $this->application->uuid,
        ];
        
        $this->loadPipelineConfig();
        $this->loadAvailableTools();
        $this->loadExecutions();
    }
    
    /**
     * Load pipeline executions with fake data for demo
     */
    public function loadExecutions()
    {
        // Fake data pour la démo
        $this->executions = collect([
            (object)[
                'id' => 2314,
                'status' => 'success',
                'branch' => 'main',
                'commit_message' => "Merge branch 'staging' into 'main'",
                'commit_sha' => '1a30f31c',
                'triggered_by' => 'Romuald DJETEJE',
                'created_at' => now()->subMinutes(5),
                'duration' => '2:43',
                'stages' => [
                    'sonarqube' => 'success',
                    'trivy' => 'success',
                    'deploy' => 'success',
                ],
            ],
            (object)[
                'id' => 2313,
                'status' => 'failed',
                'branch' => 'develop',
                'commit_message' => 'Fix authentication bug',
                'commit_sha' => '9b2c4d1e',
                'triggered_by' => 'Webhook',
                'created_at' => now()->subHours(2),
                'duration' => '1:12',
                'stages' => [
                    'sonarqube' => 'success',
                    'trivy' => 'failed',
                    'deploy' => 'pending',
                ],
            ],
            (object)[
                'id' => 2312,
                'status' => 'running',
                'branch' => 'feature/new-ui',
                'commit_message' => 'Update pipeline UI with GitLab style',
                'commit_sha' => '7f8e9a2b',
                'triggered_by' => 'Romuald DJETEJE',
                'created_at' => now()->subMinutes(1),
                'duration' => '0:45',
                'stages' => [
                    'sonarqube' => 'success',
                    'trivy' => 'running',
                    'deploy' => 'pending',
                ],
            ],
            (object)[
                'id' => 2311,
                'status' => 'success',
                'branch' => 'main',
                'commit_message' => 'Add firewall security rules',
                'commit_sha' => '3c5d7e9f',
                'triggered_by' => 'Webhook',
                'created_at' => now()->subHours(5),
                'duration' => '3:21',
                'stages' => [
                    'sonarqube' => 'success',
                    'trivy' => 'success',
                    'deploy' => 'success',
                ],
            ],
            (object)[
                'id' => 2310,
                'status' => 'pending',
                'branch' => 'hotfix/urgent-fix',
                'commit_message' => 'Critical security patch',
                'commit_sha' => '2a4b6c8d',
                'triggered_by' => 'Romuald DJETEJE',
                'created_at' => now()->subSeconds(30),
                'duration' => null,
                'stages' => [
                    'sonarqube' => 'pending',
                    'trivy' => 'pending',
                    'deploy' => 'pending',
                ],
            ],
        ]);
        
        $this->totalExecutions = $this->executions->count();
    }
    
    public function loadAvailableTools()
    {
        $toolsService = app(PipelineToolsService::class);
        $this->availableTools = $toolsService->getAvailableTools();
    }
    
    public function loadPipelineConfig()
    {
        // Load or create pipeline config from database
        $this->pipelineConfig = PipelineConfig::firstOrCreate(
            ['application_id' => $this->application->id],
            [
                'enabled' => false,
                'stages' => $this->getDefaultStages(),
                'trigger_mode' => 'auto',
                'trigger_branches' => ['main', 'master'],
            ]
        );

        $this->pipelineEnabled = $this->pipelineConfig->enabled;
        $this->stages = $this->pipelineConfig->stages ?? $this->getDefaultStages();
    }

    protected function getDefaultStages(): array
    {
        return [
            [
                'id' => 'sonarqube',
                'name' => 'SonarQube Analysis',
                'icon' => '📊',
                'enabled' => true,
                'tool' => 'SonarQube',
                'description' => 'Code quality analysis - bugs, vulnerabilities, code smells',
                'order' => 1,
                'blocking' => false,
            ],
            [
                'id' => 'trivy',
                'name' => 'Trivy Security Scan',
                'icon' => '🛡️',
                'enabled' => true,
                'tool' => 'Trivy',
                'description' => 'Security vulnerabilities and secrets detection',
                'order' => 2,
                'blocking' => true,
            ],
            [
                'id' => 'deploy',
                'name' => 'Deploy',
                'icon' => '🚀',
                'enabled' => true,
                'tool' => 'iDeploy',
                'description' => 'Deploy to production',
                'order' => 3,
                'blocking' => true,
            ],
        ];
    }

    protected function savePipelineConfig(): void
    {
        $this->pipelineConfig->update([
            'enabled' => $this->pipelineEnabled,
            'stages' => $this->stages,
        ]);
    }
    
    public function togglePipeline()
    {
        $this->pipelineEnabled = !$this->pipelineEnabled;
        $this->savePipelineConfig();
        
        $this->dispatch('success', 'Pipeline ' . ($this->pipelineEnabled ? 'enabled' : 'disabled'));
    }
    
    public function toggleStage($stageId)
    {
        $stageIndex = collect($this->stages)->search(fn($s) => $s['id'] === $stageId);
        
        if ($stageIndex !== false) {
            $this->stages[$stageIndex]['enabled'] = !$this->stages[$stageIndex]['enabled'];
            $this->savePipelineConfig();
            
            $this->dispatch('success', 'Stage updated');
        }
    }
    
    public function configureStage($stageId)
    {
        $this->currentStage = collect($this->stages)->firstWhere('id', $stageId);
        $this->showConfigModal = true;
    }
    
    public function closeConfigModal()
    {
        $this->showConfigModal = false;
        $this->currentStage = null;
    }
    
    public function saveStageConfig()
    {
        // Update stage in stages array
        $stageIndex = collect($this->stages)->search(fn($s) => $s['id'] === $this->currentStage['id']);
        
        if ($stageIndex !== false) {
            $this->stages[$stageIndex] = $this->currentStage;
            $this->savePipelineConfig();
        }
        
        $this->dispatch('success', 'Stage configuration saved');
        $this->closeConfigModal();
    }
    
    public function openAddToolModal()
    {
        $this->showAddToolModal = true;
    }
    
    public function closeAddToolModal()
    {
        $this->showAddToolModal = false;
        $this->searchQuery = '';
    }
    
    public function addToolToStage($toolId, $categoryKey)
    {
        $toolsService = app(PipelineToolsService::class);
        $tool = $toolsService->getTool($toolId);
        
        if (!$tool) {
            $this->dispatch('error', 'Tool not found');
            return;
        }
        
        // Generate unique ID for stage
        $stageId = $toolId . '-' . uniqid();
        
        $newStage = [
            'id' => $stageId,
            'name' => $tool['name'],
            'icon' => $this->availableTools[$categoryKey]['icon'] ?? '🔧',
            'enabled' => true,
            'tool' => $tool['id'],
            'description' => $tool['description'],
            'order' => count($this->stages) + 1,
            'blocking' => true,
            'config' => $tool['config_template'] ?? [],
        ];
        
        $this->stages[] = $newStage;
        $this->savePipelineConfig();
        
        $this->dispatch('success', $tool['name'] . ' added to pipeline');
        $this->closeAddToolModal();
    }
    
    public function removeStage($stageId)
    {
        $this->stages = collect($this->stages)
            ->filter(fn($s) => $s['id'] !== $stageId)
            ->values()
            ->toArray();
        
        // Reorder
        $this->reorderStages();
        $this->savePipelineConfig();
        
        $this->dispatch('success', 'Stage removed');
    }
    
    public function moveStageUp($stageId)
    {
        $index = collect($this->stages)->search(fn($s) => $s['id'] === $stageId);
        
        if ($index > 0) {
            $temp = $this->stages[$index - 1];
            $this->stages[$index - 1] = $this->stages[$index];
            $this->stages[$index] = $temp;
            
            $this->reorderStages();
        }
    }
    
    public function moveStageDown($stageId)
    {
        $index = collect($this->stages)->search(fn($s) => $s['id'] === $stageId);
        
        if ($index !== false && $index < count($this->stages) - 1) {
            $temp = $this->stages[$index + 1];
            $this->stages[$index + 1] = $this->stages[$index];
            $this->stages[$index] = $temp;
            
            $this->reorderStages();
        }
    }
    
    protected function reorderStages()
    {
        foreach ($this->stages as $index => &$stage) {
            $stage['order'] = $index + 1;
        }
    }
    
    public function getFilteredTools()
    {
        if (empty($this->searchQuery)) {
            if ($this->selectedCategory === 'all') {
                return $this->availableTools;
            }
            
            return [
                $this->selectedCategory => $this->availableTools[$this->selectedCategory] ?? []
            ];
        }
        
        $toolsService = app(PipelineToolsService::class);
        $results = $toolsService->searchTools($this->searchQuery);
        
        // Group by category
        $grouped = [];
        foreach ($results as $tool) {
            $cat = $tool['category'];
            unset($tool['category']);
            
            if (!isset($grouped[$cat])) {
                $grouped[$cat] = $this->availableTools[$cat];
                $grouped[$cat]['tools'] = [];
            }
            
            $grouped[$cat]['tools'][] = $tool;
        }
        
        return $grouped;
    }
    
    /**
     * Manually trigger pipeline execution
     */
    public function runPipeline()
    {
        if (!$this->pipelineEnabled) {
            $this->dispatch('error', 'Pipeline is not enabled');
            return;
        }

        if (count(array_filter($this->stages, fn($s) => $s['enabled'])) === 0) {
            $this->dispatch('error', 'No stages enabled');
            return;
        }

        try {
            // Create pipeline execution
            $execution = PipelineExecution::create([
                'pipeline_config_id' => $this->pipelineConfig->id,
                'application_id' => $this->application->id,
                'trigger_type' => 'manual',
                'trigger_user' => auth()->user()->name ?? 'unknown',
                'branch' => 'manual',
                'status' => 'pending',
                'started_at' => now(),
            ]);

            // Dispatch pipeline job
            dispatch(new PipelineExecutionJob($execution));

            $this->dispatch('success', 'Pipeline started successfully');
            
            // Redirect to executions page to see progress
            return redirect()->route('project.application.pipeline.executions', $this->parameters);

        } catch (\Exception $e) {
            \Log::error("Failed to start pipeline: " . $e->getMessage());
            $this->dispatch('error', 'Failed to start pipeline: ' . $e->getMessage());
        }
    }

    /**
     * Get webhook URL for Git providers
     */
    public function getWebhookUrl(): string
    {
        $settings = instanceSettings();
        
        // Force HTTPS with FQDN if available
        if ($settings->fqdn) {
            $baseUrl = $settings->fqdn;
        } else {
            // Fallback to APP_URL from config
            $baseUrl = config('app.url');
        }
        
        // Ensure HTTPS
        $baseUrl = str_replace('http://', 'https://', $baseUrl);
        
        return $baseUrl . '/api/v1/deploy/webhook/' . $this->application->uuid;
    }

    /**
     * Copy webhook URL to clipboard
     */
    public function copyWebhookUrl()
    {
        $this->dispatch('success', 'Webhook URL copied to clipboard');
    }

    public function render()
    {
        return view('livewire.project.application.pipeline.overview');
    }
}
