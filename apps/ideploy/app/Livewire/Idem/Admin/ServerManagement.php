<?php

namespace App\Livewire\Idem\Admin;

use App\Models\Server;
use Livewire\Component;
use Livewire\WithPagination;

class ServerManagement extends Component
{
    use WithPagination;

    public $search = '';
    public $filterType = 'all'; // all, managed, client

    public function render()
    {
        $query = Server::with(['team'])->orderBy('created_at', 'desc');

        // Filter by type
        if ($this->filterType === 'managed') {
            $query->where('idem_managed', true);
        } elseif ($this->filterType === 'client') {
            $query->where('idem_managed', false);
        }

        // Search
        if ($this->search) {
            $query->where(function ($q) {
                $q->where('name', 'like', "%{$this->search}%")
                  ->orWhere('ip', 'like', "%{$this->search}%");
            });
        }

        $servers = $query->paginate(20);

        // Statistics
        $stats = [
            'total' => Server::count(),
            'managed' => Server::where('idem_managed', true)->count(),
            'client' => Server::where('idem_managed', false)->count(),
            'reachable' => Server::whereHas('settings', fn($q) => $q->where('is_reachable', true))->count(),
        ];

        return view('livewire.idem.admin.server-management', [
            'servers' => $servers,
            'stats' => $stats,
        ]);
    }

    public function setFilter($type)
    {
        $this->filterType = $type;
        $this->resetPage();
    }

    public function updatingSearch()
    {
        $this->resetPage();
    }
}
