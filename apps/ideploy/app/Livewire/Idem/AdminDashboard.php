<?php

namespace App\Livewire\Idem;

use Livewire\Component;
use Livewire\WithPagination;
use App\Models\Team;
use App\Models\User;
use App\Models\Server;
use App\Services\IdemServerService;
use App\Services\IdemSubscriptionService;

class AdminDashboard extends Component
{
    use WithPagination;

    public $stats = [];
    public $selectedTab = 'overview';
    public $searchTerm = '';

    protected IdemServerService $serverService;
    protected IdemSubscriptionService $subscriptionService;

    public function boot(
        IdemServerService $serverService,
        IdemSubscriptionService $subscriptionService
    ) {
        $this->serverService = $serverService;
        $this->subscriptionService = $subscriptionService;
    }

    public function mount()
    {
        // Check if user is admin
        if (auth()->user()->idem_role !== 'admin') {
            abort(403, 'Accès refusé');
        }

        $this->loadStats();
    }

    public function loadStats()
    {
        $this->stats = [
            'users' => [
                'total' => User::count(),
                'admins' => User::where('idem_role', 'admin')->count(),
                'members' => User::where('idem_role', 'member')->count(),
                'recent' => User::where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'teams' => [
                'total' => Team::count(),
                'by_plan' => [
                    'free' => Team::where('idem_subscription_plan', 'free')->count(),
                    'basic' => Team::where('idem_subscription_plan', 'basic')->count(),
                    'pro' => Team::where('idem_subscription_plan', 'pro')->count(),
                    'enterprise' => Team::where('idem_subscription_plan', 'enterprise')->count(),
                ],
            ],
            'servers' => [
                'total' => Server::count(),
                'managed' => Server::where('idem_managed', true)->count(),
                'personal' => Server::where('idem_managed', false)->count(),
                'managed_stats' => $this->serverService->getManagedServerStats(),
            ],
            'revenue' => $this->calculateRevenue(),
        ];
    }

    public function switchTab($tab)
    {
        $this->selectedTab = $tab;
        $this->resetPage();
    }

    public function promoteUser($userId)
    {
        $user = User::find($userId);
        
        if (!$user) {
            $this->dispatch('error', 'Utilisateur introuvable');
            return;
        }

        $user->update(['idem_role' => 'admin']);
        $this->dispatch('success', "Utilisateur {$user->name} promu administrateur");
        $this->loadStats();
    }

    public function demoteUser($userId)
    {
        $user = User::find($userId);
        
        if (!$user) {
            $this->dispatch('error', 'Utilisateur introuvable');
            return;
        }

        if ($user->id === auth()->id()) {
            $this->dispatch('error', 'Vous ne pouvez pas vous rétrograder vous-même');
            return;
        }

        $user->update(['idem_role' => 'member']);
        $this->dispatch('success', "Utilisateur {$user->name} rétrogradé en membre");
        $this->loadStats();
    }

    public function changeTeamPlan($teamId, $newPlan)
    {
        $team = Team::find($teamId);
        
        if (!$team) {
            $this->dispatch('error', 'Équipe introuvable');
            return;
        }

        $result = $this->subscriptionService->changePlan($team, $newPlan);
        
        if ($result['success']) {
            $this->dispatch('success', $result['message']);
            $this->loadStats();
        } else {
            $this->dispatch('error', $result['message']);
        }
    }

    protected function calculateRevenue()
    {
        $revenue = 0;
        $plans = ['basic' => 19.99, 'pro' => 49.99, 'enterprise' => 199.99];

        foreach ($plans as $plan => $price) {
            $count = Team::where('idem_subscription_plan', $plan)->count();
            $revenue += $count * $price;
        }

        return [
            'monthly' => $revenue,
            'yearly' => $revenue * 12,
        ];
    }

    public function render()
    {
        $data = [];

        switch ($this->selectedTab) {
            case 'teams':
                $data['teams'] = Team::when($this->searchTerm, function ($query) {
                    $query->where('name', 'like', '%' . $this->searchTerm . '%');
                })->withCount('members')->paginate(20);
                break;

            case 'users':
                $data['users'] = User::when($this->searchTerm, function ($query) {
                    $query->where('name', 'like', '%' . $this->searchTerm . '%')
                          ->orWhere('email', 'like', '%' . $this->searchTerm . '%');
                })->paginate(20);
                break;

            case 'servers':
                $data['servers'] = Server::where('idem_managed', true)
                    ->when($this->searchTerm, function ($query) {
                        $query->where('name', 'like', '%' . $this->searchTerm . '%');
                    })
                    ->orderBy('idem_load_score', 'asc')
                    ->paginate(20);
                break;
        }

        return view('livewire.idem.admin-dashboard', $data);
    }
}
