<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\PipelineExecution;
use Livewire\Component;
use Livewire\WithPagination;

class PipelineExecutions extends Component
{
    use WithPagination;
    
    public $application;
    public $searchTerm = '';
    public $filterStatus = 'all'; // all, running, completed, failed
    public $sortBy = 'latest'; // latest, oldest
    
    protected $queryString = ['searchTerm', 'filterStatus', 'sortBy', 'page'];
    protected $paginationTheme = 'tailwind';
    
    public function mount($application)
    {
        $this->application = $application;
    }
    
    public function render()
    {
        $query = PipelineExecution::where('application_id', $this->application->id);
        
        // Filter by status
        if ($this->filterStatus !== 'all') {
            $query->where('status', $this->filterStatus);
        }
        
        // Search in commit message or branch
        if ($this->searchTerm) {
            $query->where(function($q) {
                $q->where('branch', 'like', '%' . $this->searchTerm . '%')
                  ->orWhere('commit_sha', 'like', '%' . $this->searchTerm . '%')
                  ->orWhere('commit_message', 'like', '%' . $this->searchTerm . '%');
            });
        }
        
        // Sort
        if ($this->sortBy === 'latest') {
            $query->latest('created_at');
        } else {
            $query->oldest('created_at');
        }
        
        $executions = $query->paginate(15);
        
        return view('livewire.project.application.pipeline.executions', [
            'executions' => $executions,
        ]);
    }
    
    public function updatedFilterStatus()
    {
        $this->resetPage();
    }
    
    public function updatedSearchTerm()
    {
        $this->resetPage();
    }
    
    public function updatedSortBy()
    {
        $this->resetPage();
    }
    
    public function getStatusColor($status)
    {
        return match($status) {
            'running' => 'blue',
            'completed' => 'green',
            'failed' => 'red',
            'cancelled' => 'gray',
            default => 'gray',
        };
    }
    
    public function getStatusLabel($status)
    {
        return match($status) {
            'running' => '🔄 En cours',
            'completed' => '✅ Succès',
            'failed' => '❌ Échec',
            'cancelled' => '⏹️ Annulé',
            default => '❓ Inconnu',
        };
    }
}
