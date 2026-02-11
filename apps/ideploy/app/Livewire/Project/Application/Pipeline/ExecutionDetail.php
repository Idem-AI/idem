<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Models\PipelineJob;
use App\Jobs\PipelineExecutionJob;
use Livewire\Component;

class ExecutionDetail extends Component
{
    public Application $application;
    public ?PipelineExecution $execution = null;
    public array $parameters = [];
    public ?int $selectedJobId = null;
    public string $execution_uuid;

    public function mount()
    {
        $project = currentTeam()->load(['projects'])->projects->where('uuid', request()->route('project_uuid'))->first();
        if (!$project) {
            return redirect()->route('dashboard');
        }

        $environment = $project->environments()->where('uuid', request()->route('environment_uuid'))->first();
        if (!$environment) {
            return redirect()->route('dashboard');
        }

        $this->application = $environment->applications()->where('uuid', request()->route('application_uuid'))->first();
        if (!$this->application) {
            return redirect()->route('dashboard');
        }

        $this->parameters = [
            'project_uuid' => $project->uuid,
            'environment_uuid' => $environment->uuid,
            'application_uuid' => $this->application->uuid,
        ];

        // Load execution with jobs and scan results
        $this->execution_uuid = request()->route('execution_uuid');
        $this->execution = PipelineExecution::with(['jobs.scanResults', 'application'])
            ->where('uuid', $this->execution_uuid)
            ->firstOrFail();
        
        // Select first job by default
        $firstJob = $this->execution->jobs->first();
        if ($firstJob) {
            $this->selectedJobId = $firstJob->id;
        }
    }

    public function selectJob($jobId)
    {
        $this->selectedJobId = $jobId;
    }

    public function getSelectedJobProperty()
    {
        if (!$this->selectedJobId) {
            return null;
        }
        
        return $this->execution->jobs->firstWhere('id', $this->selectedJobId);
    }

    public function cancelExecution()
    {
        if ($this->execution->isRunning()) {
            $this->execution->update([
                'status' => 'cancelled',
                'finished_at' => now(),
            ]);
            
            $this->dispatch('success', 'Pipeline execution cancelled');
        }
    }

    public function rerunExecution()
    {
        try {
            // Create new execution with same config
            $newExecution = PipelineExecution::create([
                'pipeline_config_id' => $this->execution->pipeline_config_id,
                'application_id' => $this->execution->application_id,
                'trigger_type' => 'manual',
                'trigger_user' => auth()->user()->name ?? 'unknown',
                'commit_sha' => $this->execution->commit_sha,
                'commit_message' => $this->execution->commit_message,
                'branch' => $this->execution->branch,
                'status' => 'pending',
                'started_at' => now(),
            ]);

            // Dispatch pipeline job
            dispatch(new PipelineExecutionJob($newExecution));

            $this->dispatch('success', 'Pipeline restarted successfully');
            
            // Redirect to new execution
            return redirect()->route('project.application.pipeline.execution.detail', [
                ...$this->parameters,
                'execution_uuid' => $newExecution->uuid,
            ]);

        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to restart pipeline: ' . $e->getMessage());
        }
    }

    public function showTrivyDetails()
    {
        // This will be handled by the frontend to show a modal
        $this->dispatch('show-trivy-modal');
    }

    public function render()
    {
        return view('livewire.project.application.pipeline.execution-detail');
    }
}
