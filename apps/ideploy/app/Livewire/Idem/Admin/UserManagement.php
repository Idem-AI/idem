<?php

namespace App\Livewire\Idem\Admin;

use App\Models\User;
use App\Models\Team;
use App\Services\UserManagementService;
use Livewire\Component;
use Livewire\WithPagination;

class UserManagement extends Component
{
    use WithPagination;

    public $showCreateModal = false;
    public $name = '';
    public $email = '';
    public $password = '';
    public $team_name = '';
    public $is_admin = false;
    public $search = '';

    protected $rules = [
        'name' => 'required|string|max:255',
        'email' => 'required|email|unique:users,email',
        'password' => 'required|string|min:8',
        'team_name' => 'nullable|string|max:255',
        'is_admin' => 'boolean',
    ];

    public function render()
    {
        $query = User::with(['teams', 'currentTeam'])
            ->orderBy('created_at', 'desc');

        if ($this->search) {
            $query->where(function ($q) {
                $q->where('name', 'like', "%{$this->search}%")
                  ->orWhere('email', 'like', "%{$this->search}%");
            });
        }

        $users = $query->paginate(20);

        return view('livewire.idem.admin.user-management', [
            'users' => $users,
        ]);
    }

    public function openCreateModal()
    {
        $this->showCreateModal = true;
        $this->reset(['name', 'email', 'password', 'team_name', 'is_admin']);
    }

    public function closeCreateModal()
    {
        $this->showCreateModal = false;
        $this->reset(['name', 'email', 'password', 'team_name', 'is_admin']);
        $this->resetErrorBag();
    }

    public function createUser()
    {
        $this->validate();

        $service = new UserManagementService();
        $result = $service->createUserWithTeam([
            'name' => $this->name,
            'email' => $this->email,
            'password' => $this->password,
            'team_name' => $this->team_name,
            'is_admin' => $this->is_admin,
        ]);

        if ($result['success']) {
            $this->dispatch('success', 'User created successfully');
            $this->closeCreateModal();
            $this->reset();
        } else {
            $this->dispatch('error', $result['message']);
        }
    }

    public function toggleStatus(User $user)
    {
        $service = new UserManagementService();
        $result = $service->toggleUserStatus($user);

        if ($result['success']) {
            $this->dispatch('success', $result['message']);
        } else {
            $this->dispatch('error', $result['message']);
        }
    }

    public function deleteUser(User $user)
    {
        try {
            $user->delete();
            $this->dispatch('success', 'User deleted successfully');
        } catch (\Exception $e) {
            $this->dispatch('error', 'Error deleting user: ' . $e->getMessage());
        }
    }

    public function updatingSearch()
    {
        $this->resetPage();
    }
}
