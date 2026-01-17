<?php

namespace App\Jobs\Security;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class DeployTrafficLoggerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300;

    public function __construct(
        public Server $server
    ) {}

    public function handle(): void
    {
        ray("🚀 Deploying Traffic Logger on server: {$this->server->name}");
        
        try {
            // 1. Créer répertoire pour Traffic Logger
            instant_remote_process([
                'mkdir -p /opt/traffic-logger',
                'chmod 755 /opt/traffic-logger',
            ], $this->server);
            
            // 2. Upload script Python
            $loggerScript = base_path('traffic-logger-v2.py');
            
            if (!file_exists($loggerScript)) {
                ray("❌ Traffic Logger script not found: {$loggerScript}");
                throw new \Exception("Traffic Logger script not found");
            }
            
            instant_scp(
                $loggerScript,
                '/opt/traffic-logger/logger.py',
                $this->server
            );
            
            ray("✅ Script uploaded");
            
            // 3. Arrêter ancien container si existe
            instant_remote_process([
                'docker stop traffic-logger 2>/dev/null || true',
                'docker rm traffic-logger 2>/dev/null || true',
            ], $this->server);
            
            // 4. Démarrer Traffic Logger container
            // IMPORTANT: iDeploy est sur un serveur différent, utiliser l'IP publique
            $iDeployPublicUrl = config('app.url');
            
            // Si URL locale, utiliser l'IP du serveur iDeploy
            if (str_contains($iDeployPublicUrl, 'localhost') || str_contains($iDeployPublicUrl, '127.0.0.1')) {
                // Récupérer l'IP publique du serveur iDeploy depuis les settings
                $iDeployPublicUrl = 'http://' . gethostname() . ':8000';
            }
            
            ray("Traffic Logger will connect to: {$iDeployPublicUrl}");
            
            instant_remote_process([
                "docker run -d --name traffic-logger \\
                    --network coolify \\
                    --restart unless-stopped \\
                    -v /var/log/traefik:/var/log/traefik:ro \\
                    -v /opt/traffic-logger:/app \\
                    -e IDEPLOY_API_URL={$iDeployPublicUrl}/api/internal/traffic-metrics \\
                    -e CROWDSEC_LAPI_URL=http://crowdsec-live:8080 \\
                    python:3.11-slim \\
                    sh -c 'pip install requests && python /app/logger.py'"
            ], $this->server);
            
            ray("✅ Container started");
            
            // 5. Attendre que le container démarre
            sleep(5);
            
            // 6. Vérifier que le container tourne
            $status = instant_remote_process([
                'docker ps --filter name=traffic-logger --format "{{.Status}}"'
            ], $this->server);
            
            if (str_contains($status, 'Up')) {
                ray("✅ Traffic Logger deployed successfully");
                
                // Marquer comme installé
                $this->server->update([
                    'traffic_logger_installed' => true
                ]);
                
                // Vérifier les logs pour s'assurer qu'il fonctionne
                sleep(2);
                $logs = instant_remote_process([
                    'docker logs traffic-logger --tail 20'
                ], $this->server);
                
                ray("📋 Traffic Logger logs:");
                ray($logs);
                
            } else {
                ray("❌ Traffic Logger not running");
                
                // Récupérer les logs pour debug
                $logs = instant_remote_process([
                    'docker logs traffic-logger 2>&1 || echo "No logs available"'
                ], $this->server);
                
                ray("❌ Container logs:");
                ray($logs);
                
                throw new \Exception("Traffic Logger container not running");
            }
            
        } catch (\Exception $e) {
            ray("❌ Failed to deploy Traffic Logger: " . $e->getMessage());
            throw $e;
        }
    }
}
