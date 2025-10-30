<?php

namespace App\Livewire\Idem;

use App\Models\Application;
use App\Models\Server;
use App\Services\IdemServerService;
use App\Services\IdemQuotaService;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;

class DeploymentChoice extends Component
{
    public Application $application;
    public bool $deployOnManaged = true;
    public string $serverStrategy = 'least_loaded';
    public ?int $personalServerId = null;
    public array $availableStrategies = [
        'least_loaded' => 'Least Loaded (Recommended)',
        'round_robin' => 'Round Robin',
        'random' => 'Random'
    ];

    public function mount(Application $application)
    {
        $this->application = $application;
        $this->deployOnManaged = $application->idem_deploy_on_managed ?? true;
        $this->serverStrategy = $application->idem_server_strategy ?? 'least_loaded';
        $this->personalServerId = $application->destination->server->id ?? null;
    }

    public function updatedDeployOnManaged($value)
    {
        if (!$value) {
            // Si l'utilisateur choisit serveurs personnels, vérifier les quotas
            $quotaService = app(IdemQuotaService::class);
            $team = Auth::user()->currentTeam();
            
            if (!$quotaService->canAddServer($team)) {
                $this->deployOnManaged = true;
                session()->flash('error', 'You have reached your server limit. Please upgrade your plan to add personal servers.');
                return;
            }
        }
    }

    public function saveChoice()
    {
        if ($this->deployOnManaged) {
            // Déploiement sur IDEM managed
            $serverService = app(IdemServerService::class);
            $server = $serverService->selectServer(Auth::user()->currentTeam(), $this->serverStrategy);
            
            if (!$server) {
                session()->flash('error', 'No IDEM managed servers available. Please contact support.');
                return;
            }

            $this->application->update([
                'idem_deploy_on_managed' => true,
                'idem_assigned_server_id' => $server->id,
                'idem_server_strategy' => $this->serverStrategy,
            ]);

            session()->flash('success', "Application configured to deploy on IDEM managed server: {$server->name}");
        } else {
            // Déploiement sur serveurs personnels
            if (!$this->personalServerId) {
                session()->flash('error', 'Please select a personal server.');
                return;
            }

            $server = Server::where('id', $this->personalServerId)
                ->where('team_id', Auth::user()->currentTeam()->id)
                ->where('idem_managed', false)
                ->first();

            if (!$server) {
                session()->flash('error', 'Invalid server selection.');
                return;
            }

            $this->application->update([
                'idem_deploy_on_managed' => false,
                'idem_assigned_server_id' => null,
                'idem_server_strategy' => null,
            ]);

            session()->flash('success', "Application configured to deploy on your personal server: {$server->name}");
        }

        $this->dispatch('deployment-choice-saved');
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
        $managedServers = Server::where('idem_managed', true)
            ->orderBy('idem_load_score', 'asc')
            ->get();

        $canAddServers = $quotaService->canAddServer($team);
        $quotas = $quotaService->getQuotaUsage($team);
        $serverQuota = $quotas['servers'];

        return view('livewire.idem.deployment-choice', [
            'personalServers' => $personalServers,
            'managedServers' => $managedServers,
            'canAddServers' => $canAddServers,
            'serverQuota' => $serverQuota,
        ]);
    }
}
