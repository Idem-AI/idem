<?php

namespace App\Listeners\Server;

use App\Events\ServerValidated;
use App\Jobs\Server\InstallCrowdSecJob;
use App\Models\Server;
use Illuminate\Contracts\Queue\ShouldQueue;

class InstallCrowdSecListener implements ShouldQueue
{
    /**
     * Handle the event.
     */
    public function handle(ServerValidated $event): void
    {
        if (!$event->serverUuid) {
            ray('⚠️ ServerValidated event without serverUuid');
            return;
        }
        
        // Récupérer le serveur
        $server = Server::where('uuid', $event->serverUuid)->first();
        
        if (!$server) {
            ray('⚠️ Server not found: ' . $event->serverUuid);
            return;
        }
        
        ray("🎯 ServerValidated event received for: {$server->name}");
        
        // Skip si CrowdSec déjà installé
        if ($server->crowdsec_installed) {
            ray("⏭️ CrowdSec already installed on {$server->name}");
            return;
        }
        
        // Attendre un peu que le proxy soit démarré (Traefik)
        // CrowdSec sera installé après le proxy
        ray("⏱️ Waiting 30s for proxy to be ready before installing CrowdSec...");
        
        // Dispatch avec delay de 30 secondes
        InstallCrowdSecJob::dispatch($server)->delay(now()->addSeconds(30));
        
        ray("✅ CrowdSec installation scheduled for {$server->name} (in 30s)");
    }
}
