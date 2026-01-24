<?php

namespace App\Livewire\Idem;

use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use Livewire\Component;
use Livewire\WithPagination;

class AdminPanel extends Component
{
    use WithPagination;

    public string $activeTab = 'servers';
    public string $searchTerm = '';

    protected $queryString = ['activeTab', 'searchTerm'];

    public function updatedSearchTerm()
    {
        $this->resetPage();
    }

    public function switchTab($tab)
    {
        $this->activeTab = $tab;
        $this->searchTerm = '';
        $this->resetPage();
    }

    public function promoteUser($userId)
    {
        $user = User::findOrFail($userId);
        $user->update(['idem_role' => 'admin']);
        
        $this->dispatch('success', 'User promoted to admin successfully');
    }

    public function demoteUser($userId)
    {
        $user = User::findOrFail($userId);
        $user->update(['idem_role' => 'member']);
        
        $this->dispatch('success', 'User demoted to member successfully');
    }

    public function render()
    {
        $data = [];

        switch ($this->activeTab) {
            case 'servers':
                // Serveurs IDEM managed
                $data['servers'] = Server::where('idem_managed', true)
                    ->when($this->searchTerm, function ($query) {
                        $query->where('name', 'like', '%' . $this->searchTerm . '%');
                    })
                    ->orderBy('idem_load_score', 'asc')
                    ->paginate(20);
                break;

            case 'client-servers':
                // Serveurs des clients (non IDEM managed)
                $data['clientServers'] = Server::where('idem_managed', false)
                    ->when($this->searchTerm, function ($query) {
                        $query->where('name', 'like', '%' . $this->searchTerm . '%');
                    })
                    ->with('team')
                    ->paginate(20);
                break;

            case 'teams':
                $data['teams'] = Team::when($this->searchTerm, function ($query) {
                    $query->where('name', 'like', '%' . $this->searchTerm . '%');
                })
                ->withCount('members')
                ->paginate(20);
                break;

            case 'users':
                $data['users'] = User::when($this->searchTerm, function ($query) {
                    $query->where('name', 'like', '%' . $this->searchTerm . '%')
                          ->orWhere('email', 'like', '%' . $this->searchTerm . '%');
                })
                ->with('currentTeam')
                ->paginate(20);
                break;
        }

        return view('livewire.idem.admin-panel', $data);
    }
}
