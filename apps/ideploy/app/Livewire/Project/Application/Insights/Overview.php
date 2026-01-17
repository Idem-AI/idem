<?php

namespace App\Livewire\Project\Application\Insights;

use App\Models\Application;
use Livewire\Component;

class Overview extends Component
{
    public Application $application;
    
    public $parameters;
    
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
    }
    
    public function render()
    {
        return view('livewire.project.application.insights.overview');
    }
}
