<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Models\PipelineLog;
use App\Models\PipelineScanResult;
use Livewire\Component;

class ExecutionDetail extends Component
{
    public Application $application;
    public $execution = null;
    public array $parameters = [];
    public ?string $selectedStage = null;
    public $execution_uuid;

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

        $this->execution_uuid = request()->route('execution_uuid');
        $this->loadExecution();
        
        // Select first stage by default
        $this->selectedStage = 'sonarqube';
    }
    
    /**
     * Load execution from database
     */
    public function loadExecution()
    {
        // Charger l'exécution réelle depuis la DB
        // Vérifier si c'est un ID numérique ou un UUID
        if (is_numeric($this->execution_uuid)) {
            // Si c'est un nombre, chercher par ID
            $execution = PipelineExecution::where('id', $this->execution_uuid)
                ->with(['logs', 'scanResults'])
                ->first();
        } else {
            // Si c'est un UUID, chercher par UUID
            $execution = PipelineExecution::where('uuid', $this->execution_uuid)
                ->with(['logs', 'scanResults'])
                ->first();
        }
        
        if (!$execution) {
            $this->dispatch('error', 'Pipeline execution not found');
            return redirect()->route('project.application.pipeline', $this->parameters);
        }
        
        // Récupérer les scan results
        $scanResults = $execution->scanResults;
        $sonarResult = $scanResults->where('tool', 'sonarqube')->first();
        $trivyResult = $scanResults->where('tool', 'trivy')->first();
        
        // Formater les données pour la vue
        $this->execution = (object)[
            'id' => $execution->id,
            'uuid' => $execution->uuid,
            'status' => $execution->status,
            'branch' => $execution->branch ?? 'main',
            'commit_message' => $execution->commit_message ?? 'No commit message',
            'commit_sha' => $execution->commit_sha ? substr($execution->commit_sha, 0, 8) : null,
            'trigger_user' => $execution->trigger_user ?? $execution->trigger_type,
            'started_at' => $execution->started_at,
            'finished_at' => $execution->finished_at,
            'duration_seconds' => $execution->duration_seconds,
            'stages' => $execution->stages_status ?? [],
            'sonarqube_results' => $sonarResult ? [
                'bugs' => $sonarResult->bugs ?? 0,
                'vulnerabilities' => $sonarResult->vulnerabilities ?? 0,
                'code_smells' => $sonarResult->code_smells ?? 0,
                'coverage' => $sonarResult->coverage ?? 0,
            ] : null,
            'trivy_results' => $trivyResult && $trivyResult->raw_data ? [
                'critical' => $trivyResult->raw_data['critical'] ?? 0,
                'high' => $trivyResult->raw_data['high'] ?? 0,
                'medium' => $trivyResult->raw_data['medium'] ?? 0,
                'low' => $trivyResult->raw_data['low'] ?? 0,
            ] : null,
            'logs' => $this->formatLogs($execution->logs),
        ];
    }
    
    /**
     * Format logs by stage
     */
    private function formatLogs($logs)
    {
        $formatted = [];
        
        foreach ($logs as $log) {
            $stageId = $log->stage_id ?? 'general';
            
            if (!isset($formatted[$stageId])) {
                $formatted[$stageId] = '';
            }
            
            $timestamp = $log->logged_at ? $log->logged_at->format('H:i:s') : '';
            $level = strtoupper($log->level);
            $formatted[$stageId] .= "[{$timestamp}] [{$level}] {$log->message}\n";
        }
        
        return $formatted;
    }

    public function selectStage($stageName)
    {
        $this->selectedStage = $stageName;
    }

    public function cancelExecution()
    {
        try {
            // Vérifier si c'est un ID numérique ou un UUID
            if (is_numeric($this->execution_uuid)) {
                $execution = PipelineExecution::where('id', $this->execution_uuid)->first();
            } else {
                $execution = PipelineExecution::where('uuid', $this->execution_uuid)->first();
            }
            
            if (!$execution) {
                $this->dispatch('error', 'Execution not found');
                return;
            }
            
            if ($execution->status !== 'running') {
                $this->dispatch('error', 'Can only cancel running executions');
                return;
            }
            
            $execution->update([
                'status' => 'cancelled',
                'finished_at' => now(),
            ]);
            
            $this->loadExecution();
            $this->dispatch('success', 'Pipeline execution cancelled');
        } catch (\Exception $e) {
            \Log::error("Failed to cancel execution: " . $e->getMessage());
            $this->dispatch('error', 'Failed to cancel execution');
        }
    }

    public function rerunExecution()
    {
        try {
            // Vérifier si c'est un ID numérique ou un UUID
            if (is_numeric($this->execution_uuid)) {
                $execution = PipelineExecution::where('id', $this->execution_uuid)->first();
            } else {
                $execution = PipelineExecution::where('uuid', $this->execution_uuid)->first();
            }
            
            if (!$execution) {
                $this->dispatch('error', 'Execution not found');
                return;
            }
            
            // Create new execution with same parameters
            $newExecution = PipelineExecution::create([
                'uuid' => (string) \Illuminate\Support\Str::uuid(),
                'pipeline_config_id' => $execution->pipeline_config_id,
                'application_id' => $execution->application_id,
                'trigger_type' => 'manual',
                'trigger_user' => auth()->user()->name ?? 'System',
                'branch' => $execution->branch,
                'commit_sha' => null,
                'commit_message' => 'Re-run of pipeline #' . $execution->id,
                'status' => 'pending',
                'started_at' => now(),
                'stages_status' => [],
            ]);
            
            // Dispatch pipeline orchestrator
            dispatch(new \App\Jobs\Pipeline\PipelineOrchestratorJob($newExecution));
            
            $this->dispatch('success', 'Pipeline restarted successfully');
            
            // Redirect to new execution
            return redirect()->route('project.application.pipeline.execution.detail', array_merge($this->parameters, ['execution_uuid' => $newExecution->uuid]));
            
        } catch (\Exception $e) {
            \Log::error("Failed to rerun execution: " . $e->getMessage());
            $this->dispatch('error', 'Failed to restart pipeline');
        }
    }

    public function render()
    {
        return view('livewire.project.application.pipeline.execution-detail');
    }
}
