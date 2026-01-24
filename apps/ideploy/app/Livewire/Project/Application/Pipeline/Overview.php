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
    
    // Search
    public $searchQuery = '';
    
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
                'id' => 'code-quality',
                'name' => 'Code Quality',
                'icon' => 'code',
                'enabled' => false,
                'tool' => 'SonarQube',
                'description' => 'Auto-detect language and analyze code quality',
                'order' => 1,
                'blocking' => false,
                'config' => [
                    'auto_detect' => true,
                    'quality_gate' => 'default',
                ],
            ],
            [
                'id' => 'security-scan',
                'name' => 'Security Scan',
                'icon' => 'shield',
                'enabled' => true,
                'tool' => 'Trivy',
                'description' => 'Scan vulnerabilities in code, dependencies and secrets',
                'order' => 2,
                'blocking' => true,
                'config' => [
                    'severity' => ['CRITICAL', 'HIGH'],
                    'scan_type' => ['vuln', 'secret', 'config'],
                ],
            ],
            [
                'id' => 'tests',
                'name' => 'Automated Tests',
                'icon' => 'test-tube',
                'enabled' => false,
                'tool' => 'Auto-detected',
                'description' => 'Run tests based on detected framework (pytest, jest, phpunit, etc.)',
                'order' => 3,
                'blocking' => false,
                'config' => [
                    'auto_detect' => true,
                    'coverage' => false,
                ],
            ],
            [
                'id' => 'build',
                'name' => 'Build Image',
                'icon' => 'cog',
                'enabled' => true,
                'tool' => 'iDeploy Builder',
                'description' => 'Build Docker image using iDeploy build system',
                'order' => 4,
                'blocking' => true,
                'config' => [
                    'use_cache' => true,
                    'buildpack' => 'auto',
                ],
            ],
            [
                'id' => 'container-scan',
                'name' => 'Container Scan',
                'icon' => 'cube',
                'enabled' => true,
                'tool' => 'Trivy',
                'description' => 'Scan built Docker image for vulnerabilities',
                'order' => 5,
                'blocking' => true,
                'config' => [
                    'severity' => ['CRITICAL', 'HIGH'],
                    'ignore_unfixed' => false,
                ],
            ],
            [
                'id' => 'deploy',
                'name' => 'Deploy',
                'icon' => 'rocket',
                'enabled' => true,
                'tool' => 'iDeploy',
                'description' => 'Deploy to configured destination (Docker/Swarm)',
                'order' => 6,
                'blocking' => true,
                'config' => [
                    'zero_downtime' => true,
                    'health_check' => true,
                ],
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
        return route('api.pipeline.webhook', [
            'applicationUuid' => $this->application->uuid,
        ]);
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
