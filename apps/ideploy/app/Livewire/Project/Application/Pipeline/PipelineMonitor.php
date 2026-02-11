<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineExecution;
use Livewire\Component;

class PipelineMonitor extends Component
{
    public Application $application;
    public ?PipelineExecution $execution = null;
    public array $logs = [];
    public bool $autoScroll = true;
    public string $selectedTab = 'overview'; // 'overview', 'logs', 'stages'

    public function mount($application_uuid, $execution_uuid = null)
    {
        // Load application by UUID
        $this->application = Application::where('uuid', $application_uuid)->firstOrFail();
        
        // Load execution by UUID if provided
        if ($execution_uuid) {
            $this->execution = PipelineExecution::where('uuid', $execution_uuid)->firstOrFail();
        }
        
        if ($this->execution) {
            $this->loadLogs();
        }
    }

    public function render()
    {
        return view('livewire.project.application.pipeline.monitor', [
            'currentExecution' => $this->execution,
            'statuses' => [
                'pending' => ['label' => 'Pending', 'color' => 'yellow', 'icon' => '⏳'],
                'running' => ['label' => 'Running', 'color' => 'blue', 'icon' => '🔄'],
                'success' => ['label' => 'Success', 'color' => 'green', 'icon' => '✅'],
                'failed' => ['label' => 'Failed', 'color' => 'red', 'icon' => '❌'],
                'cancelled' => ['label' => 'Cancelled', 'color' => 'gray', 'icon' => '⏹️'],
            ],
        ]);
    }

    public function loadLogs()
    {
        if (!$this->execution) {
            return;
        }

        // Load logs from database (simulated)
        $this->logs = $this->execution->logs ?? [];
    }

    public function selectExecution(PipelineExecution $execution)
    {
        $this->execution = $execution;
        $this->loadLogs();
        $this->selectedTab = 'overview';
    }

    public function toggleAutoScroll()
    {
        $this->autoScroll = !$this->autoScroll;
    }

    public function selectTab(string $tab)
    {
        $this->selectedTab = $tab;
    }

    public function retryExecution()
    {
        if (!$this->execution) {
            return;
        }

        // Create a new execution with the same configuration
        // This would be implemented in a service
        // For now, just dispatch an event
        $this->dispatch('execution:retry', executionId: $this->execution->id);
    }

    public function cancelExecution()
    {
        if (!$this->execution) {
            return;
        }

        $this->dispatch('execution:cancel', executionId: $this->execution->id);
    }
}
