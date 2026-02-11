<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineConfig;
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

    // SonarQube
    public bool $sonarqubeEnabled = true;
    public ?int $sonarqubeServerId = null;
    public string $qualityGate = 'default';
    public bool $failOnQualityGate = true;

    // Trivy
    public bool $trivyEnabled = true;
    public array $trivyScanTypes = ['vuln', 'secret', 'config'];
    public array $trivySeverity = ['CRITICAL', 'HIGH'];
    public bool $failOnCritical = true;

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
        // TODO: Load from database
        // $this->pipelineConfig = PipelineConfig::where('application_id', $this->application->id)->first();
    }

    public function saveSettings()
    {
        // TODO: Validate and save to database
        $this->dispatch('notify', 'Settings saved successfully');
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
