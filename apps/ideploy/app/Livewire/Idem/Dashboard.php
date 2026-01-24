<?php

namespace App\Livewire\Idem;

use App\Models\Application;
use App\Models\Server;
use App\Services\IdemSubscriptionService;
use App\Services\IdemQuotaService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Dashboard extends Component
{
    public array $stats = [];

    public function mount()
    {
        $this->loadStats();
    }

    public function loadStats()
    {
        $team = Auth::user()->currentTeam();
        $subscriptionService = app(IdemSubscriptionService::class);
        $quotaService = app(IdemQuotaService::class);

        $subscription = $subscriptionService->getSubscriptionDetails($team);
        $quotas = $quotaService->getQuotaUsage($team);

        // Applications stats - via Team relation
        $apps = $team->applications;
        $appsOnIdem = $apps->where('idem_deploy_on_managed', true)->count();
        $appsOnPersonal = $apps->where('idem_deploy_on_managed', false)->count();

        // Servers stats - via Team relation
        $personalServers = $team->servers()
            ->where('idem_managed', false)
            ->count();

        $this->stats = [
            'subscription' => $subscription,
            'quotas' => $quotas,
            'apps' => [
                'total' => $apps->count(),
                'on_idem' => $appsOnIdem,
                'on_personal' => $appsOnPersonal,
            ],
            'servers' => [
                'personal' => $personalServers,
            ],
        ];
    }

    public function render()
    {
        return view('livewire.idem.dashboard', [
            'stats' => $this->stats,
        ]);
    }
}
