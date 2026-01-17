<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Jobs\Security\ConfigureTrafficLoggerForwardAuthJob;
use Illuminate\Console\Command;

class FixFirewallMetrics extends Command
{
    protected $signature = 'firewall:fix-metrics {app_uuid}';
    protected $description = 'Fix firewall metrics collection by reconfiguring ForwardAuth';

    public function handle()
    {
        $appUuid = $this->argument('app_uuid');
        $this->info("🔧 CORRECTION MÉTRIQUES FIREWALL");
        
        $app = Application::where('uuid', $appUuid)->first();
        if (!$app) {
            $this->error("❌ Application {$appUuid} non trouvée");
            return 1;
        }
        
        $this->info("✅ Application trouvée: {$app->name}");
        $config = $app->firewallConfig;
        $server = $app->destination->server;
        
        // 1. Vérifier Traffic Logger
        if (!$server->traffic_logger_installed) {
            $this->error("❌ Traffic Logger non installé sur serveur");
            return 1;
        }
        
        // 2. Reconfigurer ForwardAuth
        $this->info("🔧 Reconfiguration ForwardAuth Traffic Logger...");
        
        try {
            $job = new ConfigureTrafficLoggerForwardAuthJob($app);
            $job->handle();
            $this->info("✅ ForwardAuth configuré");
        } catch (\Exception $e) {
            $this->error("❌ Erreur configuration ForwardAuth: " . $e->getMessage());
            return 1;
        }
        
        // 3. Redémarrer Traffic Logger
        $this->info("🔄 Redémarrage Traffic Logger...");
        
        try {
            $server = $app->destination->server;
            instant_remote_process([
                'docker restart traffic-logger'
            ], $server);
            $this->info("✅ Traffic Logger redémarré");
        } catch (\Exception $e) {
            $this->warn("⚠️ Impossible de redémarrer Traffic Logger: " . $e->getMessage());
        }
        
        // 4. Test métrique
        sleep(5);
        $this->info("📊 Test métriques...");
        
        try {
            \Cache::forget("traefik_metrics_{$app->id}");
            $service = app(\App\Services\Security\TraefikAccessLogService::class);
            $metrics = $service->getMetrics($app, 1);
            
            $this->line("Requests détectées: " . $metrics['total_requests']);
            $this->line("Recent events: " . count($metrics['recent_events']));
            
            if ($metrics['total_requests'] > 0) {
                $this->info("✅ Métriques fonctionnelles");
            } else {
                $this->warn("⚠️ Aucune métrique récente - Générer du trafic pour test");
            }
        } catch (\Exception $e) {
            $this->error("❌ Erreur test métriques: " . $e->getMessage());
        }
        
        // 5. Instructions utilisateur
        $this->info("=== INSTRUCTIONS TEST ===");
        $this->line("1. Visite ton application pour générer du trafic");
        $this->line("2. Attends 30s (cache refresh)");
        $this->line("3. Vérifie le dashboard métriques");
        $this->line("4. Les nouvelles métriques devraient apparaître");
        
        $this->info("✅ Correction métriques terminée");
        
        return 0;
    }
}
