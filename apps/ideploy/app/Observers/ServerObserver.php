<?php

namespace App\Observers;

use App\Models\Server;
use App\Jobs\Security\InstallCrowdSecJob;
use App\Jobs\ConfigureTraefikLoggingJob;
use App\Jobs\Security\DeployTrafficLoggerJob;

class ServerObserver
{
    /**
     * Handle the Server "created" event.
     * 
     * Quand un nouveau serveur est ajouté à la plateforme,
     * on installe automatiquement les outils de sécurité:
     * - CrowdSec (firewall)
     * - Traffic Logger (métriques temps réel)
     * - Traefik Logging (logs JSON)
     */
    public function created(Server $server): void
    {
        ray("🆕 Nouveau serveur créé: {$server->name}");
        
        // Attendre que le serveur soit validé et accessible
        // On dispatch les jobs avec un délai pour laisser le temps à l'utilisateur
        // de configurer le serveur (clés SSH, etc.)
        
        // Installation CrowdSec (délai 2 minutes)
        if (!$server->crowdsec_installed) {
            ray("📅 Scheduling CrowdSec installation for: {$server->name}");
            
            InstallCrowdSecJob::dispatch($server)
                ->delay(now()->addMinutes(2))
                ->onQueue('low'); // Queue basse priorité pour ne pas bloquer
        }
        
        // Configuration Traefik Logging (délai 5 minutes, après CrowdSec)
        if (!$server->traefik_logging_enabled) {
            ray("📅 Scheduling Traefik logging configuration for: {$server->name}");
            
            ConfigureTraefikLoggingJob::dispatch($server)
                ->delay(now()->addMinutes(5))
                ->onQueue('low');
        }
        
        // Déploiement Traffic Logger (délai 7 minutes, après Traefik)
        if (!$server->traffic_logger_installed) {
            ray("📅 Scheduling Traffic Logger deployment for: {$server->name}");
            
            DeployTrafficLoggerJob::dispatch($server)
                ->delay(now()->addMinutes(7))
                ->onQueue('low');
        }
        
        // Validation finale (délai 10 minutes, après tous les composants)
        ray("📅 Scheduling installation validation for: {$server->name}");
        \App\Jobs\Security\ValidateServerInstallationJob::dispatch($server)
            ->delay(now()->addMinutes(10))
            ->onQueue('low');
        
        ray("✅ Security tools scheduled for installation on: {$server->name}");
    }
    
    /**
     * Handle the Server "updated" event.
     * 
     * Si le serveur devient disponible (validation réussie),
     * on peut installer les outils immédiatement
     */
    public function updated(Server $server): void
    {
        // Si le serveur vient d'être validé
        if ($server->wasChanged('validation_logs') && $server->isUsable()) {
            ray("✅ Serveur validé: {$server->name}");
            
            // Installer CrowdSec immédiatement si pas déjà fait
            if (!$server->crowdsec_installed && !$server->crowdsec_available) {
                ray("🚀 Installing CrowdSec immediately on validated server");
                
                InstallCrowdSecJob::dispatch($server)
                    ->delay(now()->addSeconds(30))
                    ->onQueue('high'); // Haute priorité car serveur validé
            }
        }
    }
}
