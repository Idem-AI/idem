<?php

namespace App\Jobs\Security;

use App\Models\FirewallTrafficLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class CleanOldTrafficLogsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 1;
    public $timeout = 120;

    public function __construct(
        public int $daysToKeep = 30
    ) {}

    public function handle(): void
    {
        $cutoffDate = now()->subDays($this->daysToKeep);
        
        $deleted = FirewallTrafficLog::where('timestamp', '<', $cutoffDate)
            ->delete();
        
        ray("Cleaned {$deleted} old traffic logs (older than {$this->daysToKeep} days)");
    }
}
