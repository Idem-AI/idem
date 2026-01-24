<?php

namespace App\Livewire\Idem\Admin;

use App\Models\Team;
use App\Models\User;
use Livewire\Component;
use Livewire\WithPagination;

class TeamManagement extends Component
{
    use WithPagination;

    public $search = '';
    public $selectedTeam = null;
    public $showDetailsModal = false;

    public function render()
    {
        $query = Team::with(['members'])
            ->withCount(['members'])
            ->orderBy('created_at', 'desc');

        if ($this->search) {
            $query->where('name', 'like', "%{$this->search}%");
        }

        $teams = $query->paginate(20);

        return view('livewire.idem.admin.team-management', [
            'teams' => $teams,
        ]);
    }

    public function showDetails($teamId)
    {
        $this->selectedTeam = Team::with(['members', 'servers', 'projects'])->find($teamId);
        $this->showDetailsModal = true;
    }

    public function closeDetailsModal()
    {
        $this->showDetailsModal = false;
        $this->selectedTeam = null;
    }

    public function deleteTeam(Team $team)
    {
        try {
            // Cannot delete team if it has resources
            if ($team->servers()->count() > 0 || $team->projects()->count() > 0) {
                $this->dispatch('error', 'Cannot delete team with existing resources');
                return;
            }

            $team->delete();
            $this->dispatch('success', 'Team deleted successfully');
        } catch (\Exception $e) {
            $this->dispatch('error', 'Error deleting team: ' . $e->getMessage());
        }
    }

    public function updatingSearch()
    {
        $this->resetPage();
    }
}
