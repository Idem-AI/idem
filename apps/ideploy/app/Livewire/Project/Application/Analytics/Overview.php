<?php

namespace App\Livewire\Project\Application\Analytics;

use App\Models\Application;
use App\Services\Analytics\AnalyticsService;
use Livewire\Component;

class Overview extends Component
{
    public Application $application;
    
    public $parameters;
    
    public $period = '24h';
    public $overview = [];
    public $topPages = [];
    public $topCountries = [];
    public $hourlyTraffic = [];
    public $trafficSources = [];
    
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
        
        $this->loadAnalytics();
    }
    
    public function loadAnalytics()
    {
        $analyticsService = app(AnalyticsService::class);
        $data = $analyticsService->getOverview($this->application, $this->period);
        
        $this->overview = [
            'visitors' => $data['visitors'],
            'page_views' => $data['page_views'],
            'bounce_rate' => $data['bounce_rate'],
            'avg_session' => $data['avg_session_duration'],
        ];
        
        $this->topPages = $data['top_pages'];
        $this->topCountries = $data['top_countries'];
        $this->hourlyTraffic = $data['hourly_traffic'];
        $this->trafficSources = $data['traffic_sources'];
    }
    
    public function setPeriod($period)
    {
        $this->period = $period;
        $this->loadAnalytics();
    }
    
    public function render()
    {
        return view('livewire.project.application.analytics.overview');
    }
}
