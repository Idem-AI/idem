<?php

namespace App\Console\Commands;

use App\Models\PipelineExecution;
use Illuminate\Console\Command;

class CleanupStuckPipelines extends Command
{
    protected $signature = 'pipeline:cleanup-stuck {--timeout=60 : Timeout in minutes}';
    protected $description = 'Mark stuck pipeline executions as failed';

    public function handle()
    {
        $timeout = (int) $this->option('timeout');
        
        $this->info("Looking for pipelines stuck for more than {$timeout} minutes...");
        
        $stuckPipelines = PipelineExecution::where('status', 'running')
            ->where('started_at', '<', now()->subMinutes($timeout))
            ->get();
        
        if ($stuckPipelines->isEmpty()) {
            $this->info('✅ No stuck pipelines found');
            return 0;
        }
        
        $this->warn("Found {$stuckPipelines->count()} stuck pipeline(s)");
        
        foreach ($stuckPipelines as $pipeline) {
            $duration = $pipeline->started_at->diffInMinutes(now());
            
            $this->line("  Pipeline {$pipeline->uuid} - stuck for {$duration} minutes");
            
            // Mark remaining stages as skipped
            $stages = $pipeline->stages_status ?? [];
            foreach ($stages as $stageId => $stageData) {
                $status = is_array($stageData) ? ($stageData['status'] ?? 'pending') : $stageData;
                
                if (in_array($status, ['pending', 'running'])) {
                    $stages[$stageId] = [
                        'status' => 'skipped',
                        'started_at' => $stageData['started_at'] ?? now()->toIso8601String(),
                        'finished_at' => now()->toIso8601String(),
                        'error' => 'Skipped due to pipeline timeout',
                    ];
                }
            }
            
            // Update pipeline
            $pipeline->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_seconds' => now()->diffInSeconds($pipeline->started_at),
                'error_message' => "Pipeline timeout after {$duration} minutes",
                'stages_status' => $stages,
            ]);
            
            $this->info("  ✅ Marked as failed");
        }
        
        $this->info("\n✅ Cleanup completed: {$stuckPipelines->count()} pipeline(s) fixed");
        
        return 0;
    }
}
