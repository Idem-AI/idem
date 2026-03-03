<?php

namespace App\Livewire;

use App\Models\PrivateKey;
use App\Models\Project;
use App\Models\Server;
use Illuminate\Support\Collection;
use Livewire\Component;

class Dashboard extends Component
{
    public Collection $projects;

    public Collection $servers;

    public Collection $privateKeys;

    public function mount()
    {
        $this->privateKeys = PrivateKey::ownedByCurrentTeam()->get();
        $this->servers = Server::ownedByCurrentTeam()->get();
        $this->projects = Project::ownedByCurrentTeam()
            ->with([
                'environments.applications',
                'environments.services', 
                'environments.postgresqls',
                'environments.mysqls',
                'environments.mariadbs',
                'environments.mongodbs',
                'environments.redis'
            ])
            ->get();
    }

    public function render()
    {
        return view('livewire.dashboard');
    }
}
