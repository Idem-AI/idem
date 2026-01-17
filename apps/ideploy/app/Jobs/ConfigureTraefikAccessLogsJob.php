<?php

namespace App\Jobs;

use App\Models\Application;
use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ConfigureTraefikAccessLogsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public Application $application
    ) {}

    public function handle(): void
    {
        try {
            $server = $this->application->destination->server;
            
            // 1. Créer le fichier de configuration Traefik pour l'access log webhook
            $this->createAccessLogConfig($server);
            
            // 2. Activer le middleware sur l'application
            $this->enableAccessLogMiddleware();
            
            // 3. Redémarrer Traefik
            $this->restartTraefik($server);
            
            Log::info("Access logs configured for application {$this->application->uuid}");
            
        } catch (\Exception $e) {
            Log::error("Failed to configure access logs: " . $e->getMessage());
            throw $e;
        }
    }
    
    private function createAccessLogConfig(Server $server): void
    {
        $webhookUrl = config('app.url') . '/api/firewall/webhook/' . $this->application->uuid . '/batch';
        
        // Configuration Traefik pour access logs avec webhook
        $config = <<<YAML
# Access Log Webhook pour {$this->application->name}
http:
  middlewares:
    access-logger-{$this->application->uuid}:
      plugin:
        accesslog-webhook:
          url: "{$webhookUrl}"
          format: "json"
          bufferSize: 50
          flushInterval: "10s"
          headers:
            Content-Type: "application/json"
            X-App-UUID: "{$this->application->uuid}"
YAML;

        $configPath = "/data/coolify/proxy/dynamic/access-log-{$this->application->uuid}.yaml";
        
        // Upload vers le serveur
        $server->sftpUpload(
            content: $config,
            remotePath: $configPath
        );
    }
    
    private function enableAccessLogMiddleware(): void
    {
        // Ajouter le middleware dans les custom labels de l'application
        $currentLabels = $this->application->custom_labels ?? '';
        
        $middlewareName = "access-logger-{$this->application->uuid}";
        
        // Vérifier si le label existe déjà
        if (!str_contains($currentLabels, $middlewareName)) {
            $newLabel = "traefik.http.routers.{$this->application->uuid}.middlewares={$middlewareName}";
            
            if (!empty($currentLabels)) {
                $currentLabels .= "\n" . $newLabel;
            } else {
                $currentLabels = $newLabel;
            }
            
            $this->application->update([
                'custom_labels' => $currentLabels
            ]);
        }
    }
    
    private function restartTraefik(Server $server): void
    {
        // Signal SIGHUP pour reload config sans downtime
        instant_remote_process([
            "docker kill -s HUP coolify-proxy"
        ], $server);
    }
}
