<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineConfig;
use App\Models\PipelineExecution;
use App\Jobs\Pipeline\PipelineOrchestratorJob;
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
     * Load pipeline executions from database
     */
    public function loadExecutions()
    {
        if (!$this->pipelineConfig) {
            $this->executions = collect([]);
            $this->totalExecutions = 0;
            return;
        }

        // Load real executions from database
        $query = PipelineExecution::where('pipeline_config_id', $this->pipelineConfig->id)
            ->orderBy('created_at', 'desc')
            ->limit(10);

        // Apply status filter
        if (!empty($this->statusFilter)) {
            $query->where('status', $this->statusFilter);
        }

        // Apply search
        if (!empty($this->search)) {
            $query->where(function($q) {
                $q->where('branch', 'like', '%' . $this->search . '%')
                  ->orWhere('commit_message', 'like', '%' . $this->search . '%')
                  ->orWhere('commit_sha', 'like', '%' . $this->search . '%')
                  ->orWhere('trigger_user', 'like', '%' . $this->search . '%');
            });
        }

        $this->executions = $query->get()->map(function($execution) {
            // Calculate duration
            $duration = null;
            if ($execution->started_at) {
                $endTime = $execution->finished_at ?? now();
                $diff = $execution->started_at->diffInSeconds($endTime);
                $minutes = floor($diff / 60);
                $seconds = $diff % 60;
                $duration = sprintf('%d:%02d', $minutes, $seconds);
            }

            return (object)[
                'id' => $execution->id,
                'uuid' => $execution->uuid ?? $execution->id,
                'status' => $execution->status,
                'branch' => $execution->branch,
                'commit_message' => $execution->commit_message ?? 'No commit message',
                'commit_sha' => $execution->commit_sha ? substr($execution->commit_sha, 0, 8) : 'N/A',
                'triggered_by' => $execution->trigger_user ?? $execution->trigger_type,
                'created_at' => $execution->created_at,
                'duration' => $duration,
                'stages' => $execution->stages_status ?? [],
                'stages_status' => $execution->stages_status ?? [], // Add for blade compatibility
            ];
        });
        
        $this->totalExecutions = PipelineExecution::where('pipeline_config_id', $this->pipelineConfig->id)->count();
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
            // Get application's git branch (default to git_branch or 'main')
            $branch = $this->application->git_branch ?? 'main';
            
            // Create pipeline execution
            $execution = PipelineExecution::create([
                'pipeline_config_id' => $this->pipelineConfig->id,
                'application_id' => $this->application->id,
                'trigger_type' => 'manual',
                'trigger_user' => auth()->user()->name ?? 'System',
                'branch' => $branch,
                'commit_sha' => null, // Will be filled by GitCloneStageJob
                'commit_message' => 'Manual pipeline execution',
                'status' => 'pending',
                'started_at' => now(),
                'stages_status' => [
                    'git_clone' => 'pending',
                    'language_detection' => 'pending',
                    'sonarqube' => 'pending',
                    'trivy' => 'pending',
                    'deployment' => 'pending',
                ],
            ]);

            // Dispatch pipeline orchestrator job (runs all stages)
            dispatch(new PipelineOrchestratorJob($execution));

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
