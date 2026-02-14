<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineConfig;
use App\Models\PipelineToolConfig;
use Livewire\Component;

class Settings extends Component
{
    public Application $application;
    public ?PipelineConfig $pipelineConfig = null;
    public array $parameters = [];

    // General
    public string $pipelineName = 'Main Pipeline';
    public string $triggerBranches = 'main, develop';
    public bool $autoCancel = true;
    
    // Auto-Trigger Settings
    public bool $autoTriggerOnPush = false;
    public bool $autoTriggerOnPr = false;
    public string $watchPaths = '';

    // SonarQube
    public bool $sonarqubeEnabled = false;
    public string $sonarqubeUrl = '';
    public string $sonarqubeToken = '';
    public string $sonarqubeOrganization = '';

    // Trivy
    public bool $trivyEnabled = false;
    public array $trivyScanTypes = ['vuln', 'secret', 'config'];
    public array $trivySeverity = ['CRITICAL', 'HIGH', 'MEDIUM'];
    public bool $failOnCritical = false;

    // Notifications
    public array $notificationsEnabled = [
        'slack' => false,
        'discord' => false,
        'email' => false,
    ];
    public array $notifications = [
        'slack' => ['webhook_url' => '', 'channel' => ''],
        'discord' => ['webhook_url' => ''],
        'email' => ['recipients' => ''],
    ];
    public array $notifyOn = ['failure'];

    // Advanced
    public int $timeout = 60;
    public int $concurrency = 1;
    public bool $retryOnFailure = false;

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

        // Load existing config if exists
        $this->pipelineConfig = PipelineConfig::where('application_id', $this->application->id)->first();
        
        if ($this->pipelineConfig) {
            $this->autoTriggerOnPush = $this->pipelineConfig->auto_trigger_on_push ?? false;
            $this->autoTriggerOnPr = $this->pipelineConfig->auto_trigger_on_pr ?? false;
            $this->watchPaths = is_array($this->pipelineConfig->watch_paths) 
                ? implode("\n", $this->pipelineConfig->watch_paths) 
                : '';
        }
        
        // Load SonarQube config
        $sonarConfig = PipelineToolConfig::where('tool_name', 'sonarqube')
            ->whereNull('application_id')
            ->first();
        
        if ($sonarConfig) {
            $this->sonarqubeEnabled = $sonarConfig->enabled;
            $this->sonarqubeUrl = $sonarConfig->config['url'] ?? '';
            $this->sonarqubeToken = $sonarConfig->config['token'] ?? '';
            $this->sonarqubeOrganization = $sonarConfig->config['organization'] ?? '';
        }
        
        // Load Trivy config
        $trivyConfig = PipelineToolConfig::where('tool_name', 'trivy')
            ->whereNull('application_id')
            ->first();
        
        if ($trivyConfig) {
            $this->trivyEnabled = $trivyConfig->enabled;
            $this->trivyScanTypes = $trivyConfig->config['scan_types'] ?? ['vuln', 'secret', 'config'];
            $this->trivySeverity = $trivyConfig->config['severity'] ?? ['CRITICAL', 'HIGH', 'MEDIUM'];
            $this->failOnCritical = $trivyConfig->config['fail_on_critical'] ?? false;
        }
    }

    public function saveSettings()
    {
        // Validate
        $this->validate([
            'autoTriggerOnPush' => 'boolean',
            'autoTriggerOnPr' => 'boolean',
            'watchPaths' => 'nullable|string',
            'sonarqubeEnabled' => 'boolean',
            'sonarqubeUrl' => 'nullable|url',
            'sonarqubeToken' => 'nullable|string',
            'trivyEnabled' => 'boolean',
        ]);
        
        // Parse watch paths (one per line)
        $watchPathsArray = array_filter(
            array_map('trim', explode("\n", $this->watchPaths))
        );
        
        // Create or update pipeline config
        if (!$this->pipelineConfig) {
            $this->pipelineConfig = PipelineConfig::create([
                'application_id' => $this->application->id,
                'enabled' => true,
                'auto_trigger_on_push' => $this->autoTriggerOnPush,
                'auto_trigger_on_pr' => $this->autoTriggerOnPr,
                'watch_paths' => $watchPathsArray,
                'stages' => [],
            ]);
        } else {
            $this->pipelineConfig->update([
                'auto_trigger_on_push' => $this->autoTriggerOnPush,
                'auto_trigger_on_pr' => $this->autoTriggerOnPr,
                'watch_paths' => $watchPathsArray,
            ]);
        }
        
        // Save SonarQube config
        PipelineToolConfig::updateOrCreate(
            [
                'tool_name' => 'sonarqube',
                'application_id' => null,
            ],
            [
                'type' => 'scanner',
                'enabled' => $this->sonarqubeEnabled,
                'config' => [
                    'url' => $this->sonarqubeUrl,
                    'token' => $this->sonarqubeToken,
                    'organization' => $this->sonarqubeOrganization,
                ],
            ]
        );
        
        // Save Trivy config
        PipelineToolConfig::updateOrCreate(
            [
                'tool_name' => 'trivy',
                'application_id' => null,
            ],
            [
                'type' => 'scanner',
                'enabled' => $this->trivyEnabled,
                'config' => [
                    'scan_types' => $this->trivyScanTypes,
                    'severity' => $this->trivySeverity,
                    'fail_on_critical' => $this->failOnCritical,
                ],
            ]
        );
        
        $this->dispatch('success', 'Pipeline settings saved successfully!');
    }

    public function resetSettings()
    {
        // TODO: Reset to defaults
        $this->dispatch('notify', 'Settings reset to defaults');
    }

    public function render()
    {
        return view('livewire.project.application.pipeline.settings');
    }
}
