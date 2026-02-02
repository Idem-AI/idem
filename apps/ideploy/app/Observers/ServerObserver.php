<?php

namespace App\Observers;

use App\Models\Server;
use App\Jobs\Server\InstallCrowdSecJob;
use App\Jobs\ConfigureTraefikLoggingJob;
use App\Jobs\Security\DeployTrafficLoggerJob;
use App\Jobs\Security\EnableTraefikHeaderLoggingJob;
use App\Jobs\Security\ConfigureCrowdSecTraefikLogsJob;

class ServerObserver
{
    /**
     * Handle the Server "created" event.
     * 
     * Quand un nouveau serveur est ajouté à la plateforme,
     * on installe automatiquement TOUS les outils de sécurité EN MÊME TEMPS:
     * - CrowdSec (firewall + AppSec)
     * - Traefik Logging (logs JSON pour CrowdSec)
     * - Traefik Header Logging (User-Agent, Referer pour bot protection)
     * - Traffic Logger (métriques temps réel + ForwardAuth)
     * - CrowdSec-Traefik integration (logs parsing)
     * 
     * Installation synchronisée pour une sécurité complète immédiate
     */
    public function created(Server $server): void
    {
        ray("🆕 Nouveau serveur créé: {$server->name} - Installation sécurité complète");
        
        // Délai initial de 2 minutes pour laisser le temps à l'utilisateur 
        // de configurer le serveur (clés SSH, etc.)
        $baseDelay = now()->addMinutes(2);
        
        // 🔥 INSTALLATION SIMULTANÉE DE TOUS LES COMPOSANTS SÉCURITÉ
        
        // 1. CrowdSec (Firewall + AppSec) - PRIORITÉ HAUTE
        if (!$server->crowdsec_installed) {
            ray("🔥 Scheduling CrowdSec (Firewall+AppSec) installation for: {$server->name}");
            
            InstallCrowdSecJob::dispatch($server)
                ->delay($baseDelay)
                ->onQueue('security'); // Queue dédiée sécurité
        }
        
        // 2. Traefik Logging - EN PARALLÈLE (légèrement décalé pour éviter conflit)
        if (!$server->traefik_logging_enabled) {
            ray("📊 Scheduling Traefik logging configuration for: {$server->name}");
            
            ConfigureTraefikLoggingJob::dispatch($server)
                ->delay($baseDelay->addSeconds(30)) // 30s après CrowdSec
                ->onQueue('security');
        }
        
        // 3. Traefik Header Logging - ESSENTIEL pour bot protection
        ray("🔍 Scheduling Traefik header logging (User-Agent, Referer) for: {$server->name}");
        EnableTraefikHeaderLoggingJob::dispatch($server)
            ->delay($baseDelay->addSeconds(45)) // 45s après CrowdSec
            ->onQueue('security');
        
        // 4. CrowdSec-Traefik Logs Integration - Connexion logs JSON
        ray("🔗 Scheduling CrowdSec-Traefik logs integration for: {$server->name}");
        ConfigureCrowdSecTraefikLogsJob::dispatch($server)
            ->delay($baseDelay->addMinutes(1)) // 1min après CrowdSec
            ->onQueue('security');
        
        // 5. Traffic Logger - EN PARALLÈLE (optimisé pour métriques temps réel)
        if (!$server->traffic_logger_installed) {
            ray("⚡ Scheduling Traffic Logger deployment for: {$server->name}");
            
            DeployTrafficLoggerJob::dispatch($server)
                ->delay($baseDelay->addMinutes(2)) // 2min après CrowdSec
                ->onQueue('security');
        }
        
        // 6. Validation finale - APRÈS INSTALLATION COMPLÈTE
        ray("✅ Scheduling comprehensive security validation for: {$server->name}");
        \App\Jobs\Security\ValidateServerInstallationJob::dispatch($server)
            ->delay($baseDelay->addMinutes(6)) // 6min après début pour laisser temps à tout
            ->onQueue('security');
        
        ray("🛡️ STACK SÉCURITÉ COMPLÈTE scheduled for: {$server->name}");
        ray("   ✅ CrowdSec (Firewall + AppSec)");
        ray("   ✅ Traefik Logging (JSON logs)"); 
        ray("   ✅ Header Logging (Bot protection)");
        ray("   ✅ CrowdSec-Traefik Integration");
        ray("   ✅ Traffic Logger (Métriques)");
        ray("   ✅ Validation automatique");
        ray("🚀 Installation complète en ~6 minutes");
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
