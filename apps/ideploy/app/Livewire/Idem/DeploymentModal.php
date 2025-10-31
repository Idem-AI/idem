<?php

namespace App\Livewire\Idem;

use App\Models\Server;
use App\Services\IdemQuotaService;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;

class DeploymentModal extends Component
{
    public bool $showModal = false;
    public bool $deployOnManaged = true;
    public string $serverStrategy = 'least_loaded';
    public ?int $personalServerId = null;
    
    public array $availableStrategies = [
        'least_loaded' => 'Least Loaded (Recommended)',
        'round_robin' => 'Round Robin',
        'random' => 'Random'
    ];

    protected $listeners = ['openDeploymentModal' => 'open'];

    public function mount()
    {
        $this->deployOnManaged = true;
        $this->serverStrategy = 'least_loaded';
    }

    public function open()
    {
        $this->showModal = true;
    }

    public function close()
    {
        $this->showModal = false;
    }

    public function updatedDeployOnManaged($value)
    {
        if (!$value) {
            // Si l'utilisateur choisit serveurs personnels, vérifier les quotas
            $quotaService = app(IdemQuotaService::class);
            $team = Auth::user()->currentTeam();
            
            if (!$quotaService->canAddServer($team)) {
                $this->deployOnManaged = true;
                $this->dispatch('error', 'You have reached your server limit. Please upgrade your plan to add personal servers.');
                return;
            }
        }
    }

    public function confirm()
    {
        $this->dispatch('deployment-choice-confirmed', [
            'deployOnManaged' => $this->deployOnManaged,
            'serverStrategy' => $this->serverStrategy,
            'personalServerId' => $this->personalServerId,
        ]);
        
        $this->close();
    }

    public function render()
    {
        $team = Auth::user()->currentTeam();
        $quotaService = app(IdemQuotaService::class);
        
        // Serveurs personnels de l'utilisateur (non gérés par IDEM)
        $personalServers = Server::where('team_id', $team->id)
            ->where('idem_managed', false)
            ->get();

        // Serveurs IDEM disponibles (pour info)
        $managedServersCount = Server::where('idem_managed', true)->count();

        $canAddServers = $quotaService->canAddServer($team);
        $quotas = $quotaService->getQuotaUsage($team);
        $serverQuota = $quotas['servers'];

        return view('livewire.idem.deployment-modal', [
            'personalServers' => $personalServers,
            'managedServersCount' => $managedServersCount,
            'canAddServers' => $canAddServers,
            'serverQuota' => $serverQuota,
        ]);
    }
}
