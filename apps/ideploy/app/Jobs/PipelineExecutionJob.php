<?php

namespace App\Jobs;

use App\Models\PipelineExecution;
use App\Jobs\Pipeline\PipelineOrchestratorJob;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Legacy job - redirects to Pipeline\PipelineOrchestratorJob
 * 
 * This job is kept for backward compatibility with old code.
 * All new code should use App\Jobs\Pipeline\PipelineOrchestratorJob directly.
 */
class PipelineExecutionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 3600;
    public $tries = 1;

    public function __construct(
        public PipelineExecution $execution
    ) {}

    public function handle(): void
    {
        // Delegate to the new PipelineOrchestratorJob
        $orchestrator = new PipelineOrchestratorJob($this->execution);
        $orchestrator->handle();
    }
}
