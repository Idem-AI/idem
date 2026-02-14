<?php

namespace App\Jobs\Pipeline;

use App\Models\PipelineExecution;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Legacy job - redirects to PipelineOrchestratorJob
 * 
 * This job is kept for backward compatibility with old code
 * that may still dispatch PipelineExecutionJob.
 * 
 * All new code should use PipelineOrchestratorJob directly.
 */
class PipelineExecutionJob implements ShouldQueue
{
    use Queueable;

    public $timeout = 3600;
    public $tries = 1;

    protected PipelineExecution $execution;

    public function __construct(PipelineExecution $execution)
    {
        $this->execution = $execution;
    }

    /**
     * Execute the job - delegates to PipelineOrchestratorJob
     */
    public function handle(): void
    {
        // Delegate to the new orchestrator
        $orchestrator = new PipelineOrchestratorJob($this->execution);
        $orchestrator->handle();
    }
}
