<?php

namespace App\Listeners\Server;

use App\Events\ServerValidated;
use App\Jobs\Server\InstallTrafficLoggerJob;
use App\Models\Server;
use Illuminate\Contracts\Queue\ShouldQueue;

class InstallTrafficLoggerListener implements ShouldQueue
{
    public function handle(ServerValidated $event): void
    {
        if (!$event->serverUuid) return;
        
        $server = Server::where('uuid', $event->serverUuid)->first();
        if (!$server || $server->traffic_logger_installed) return;
        
        // Install after CrowdSec (60s delay)
        InstallTrafficLoggerJob::dispatch($server)->delay(now()->addSeconds(60));
        
        ray("✅ Traffic Logger installation scheduled for {$server->name}");
    }
}
