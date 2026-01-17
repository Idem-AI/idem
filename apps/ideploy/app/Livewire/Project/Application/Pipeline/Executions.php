<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineExecution;
use Livewire\Component;
use Livewire\WithPagination;

class Executions extends Component
{
    use WithPagination;

    public Application $application;
    public $parameters;
    
    // Selected execution for detail view
    public ?int $selectedExecutionId = null;
    public ?PipelineExecution $selectedExecution = null;
    
    // Filters
    public string $statusFilter = 'all';

    public function mount()
    {
        $project = currentTeam()
            ->projects()
            ->where('uuid', request()->route('project_uuid'))
            ->firstOrFail();
        $environment = $project->environments()
            ->where('uuid', request()->route('environment_uuid'))
            ->firstOrFail();
        $this->application = $environment->applications()
            ->where('uuid', request()->route('application_uuid'))
            ->firstOrFail();
            
        $this->parameters = [
            'project_uuid' => $project->uuid,
            'environment_uuid' => $environment->uuid,
            'application_uuid' => $this->application->uuid,
        ];
    }

    public function viewExecution(int $executionId)
    {
        $this->selectedExecutionId = $executionId;
        $this->loadSelectedExecution();
    }

    public function closeDetail()
    {
        $this->selectedExecutionId = null;
        $this->selectedExecution = null;
    }

    public function refreshExecution()
    {
        if ($this->selectedExecutionId) {
            $this->loadSelectedExecution();
        }
    }

    protected function loadSelectedExecution()
    {
        $this->selectedExecution = PipelineExecution::with('logs')
            ->find($this->selectedExecutionId);
    }

    public function getExecutionsProperty()
    {
        $query = PipelineExecution::where('application_id', $this->application->id)
            ->orderBy('created_at', 'desc');

        if ($this->statusFilter !== 'all') {
            $query->where('status', $this->statusFilter);
        }

        return $query->paginate(20);
    }

    public function getStatusBadgeClass($status): string
    {
        return match($status) {
            'pending' => 'bg-gray-500/20 text-gray-400 border-gray-500/50',
            'running' => 'bg-blue-500/20 text-blue-400 border-blue-500/50',
            'success' => 'bg-green-500/20 text-green-400 border-green-500/50',
            'failed' => 'bg-red-500/20 text-red-400 border-red-500/50',
            'cancelled' => 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
            default => 'bg-gray-500/20 text-gray-400 border-gray-500/50',
        };
    }

    public function getStageStatusIcon($status): string
    {
        return match($status) {
            'pending' => '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>',
            'running' => '<svg class="w-6 h-6 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>',
            'success' => '<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            'failed' => '<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            'skipped' => '<svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>',
            default => '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>',
        };
    }

    public function getLogLevelColor($level): string
    {
        return match($level) {
            'success' => 'text-green-400',
            'error' => 'text-red-400',
            'warning' => 'text-yellow-400',
            'info' => 'text-blue-400',
            default => 'text-gray-400',
        };
    }

    public function render()
    {
        return view('livewire.project.application.pipeline.executions', [
            'executions' => $this->executions,
        ]);
    }
}
