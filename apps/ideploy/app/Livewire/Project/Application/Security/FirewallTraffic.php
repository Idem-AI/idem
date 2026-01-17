<?php

namespace App\Livewire\Project\Application\Security;

use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallTrafficLog;
use Livewire\Component;
use Livewire\WithPagination;

class FirewallTraffic extends Component
{
    use WithPagination;
    
    public Application $application;
    public ?FirewallConfig $config = null;
    
    public $parameters;
    public $logs = [];
    
    // Filters
    public $filterDecision = 'all'; // all, block, allow
    public $filterIp = '';
    public $filterTimeRange = '24h'; // 1h, 24h, 7d, 30d
    public $perPage = 50;
    
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
        
        // Load config
        $this->config = $this->application->firewallConfig;
    }
    
    public function loadLogs()
    {
        if (!$this->config) {
            return collect();
        }
        
        $query = $this->config->trafficLogs();
        
        // Filter by decision
        if ($this->filterDecision !== 'all') {
            $query->where('decision', $this->filterDecision);
        }
        
        // Filter by IP
        if (!empty($this->filterIp)) {
            $query->where('ip_address', 'LIKE', '%' . $this->filterIp . '%');
        }
        
        // Filter by time range
        $hours = match($this->filterTimeRange) {
            '1h' => 1,
            '24h' => 24,
            '7d' => 24 * 7,
            '30d' => 24 * 30,
            default => 24,
        };
        
        $query->where('timestamp', '>=', now()->subHours($hours));
        
        return $query->latest('timestamp')
            ->paginate($this->perPage);
    }
    
    public function applyFilters()
    {
        $this->resetPage();
    }
    
    public function clearFilters()
    {
        $this->filterDecision = 'all';
        $this->filterIp = '';
        $this->filterTimeRange = '24h';
        $this->resetPage();
    }
    
    public function changeTimeRange($range)
    {
        $this->filterTimeRange = $range;
        $this->resetPage();
    }
    
    public function exportLogs()
    {
        // TODO: Implement CSV export
        $this->dispatch('info', 'Export feature coming soon');
    }
    
    public function render()
    {
        return view('livewire.project.application.security.firewall-traffic', [
            'logs' => $this->loadLogs(),
        ]);
    }
}
