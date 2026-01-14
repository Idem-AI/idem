<?php

namespace App\Jobs;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class UpdateServerLoadScoreJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public ?int $serverId;

    /**
     * Create a new job instance.
     * If serverId is null, update all servers
     */
    public function __construct(?int $serverId = null)
    {
        $this->serverId = $serverId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        if ($this->serverId) {
            // Update specific server
            $server = Server::find($this->serverId);
            if ($server) {
                $server->calculateAndUpdateLoadScore();
            }
        } else {
            // Update all active servers
            Server::whereHas('settings', fn($q) => $q->where('is_reachable', true))
                ->chunk(10, function ($servers) {
                    foreach ($servers as $server) {
                        $server->calculateAndUpdateLoadScore();
                    }
                });
        }
    }
}
