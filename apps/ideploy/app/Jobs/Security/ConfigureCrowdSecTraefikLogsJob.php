<?php

namespace App\Jobs\Security;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Configure CrowdSec to read Traefik access logs
 * Mounts Traefik log volume and updates acquis.yaml
 */
class ConfigureCrowdSecTraefikLogsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 1;
    public $timeout = 180;

    public function __construct(
        public Server $server
    ) {}

    public function handle(): void
    {
        ray("🔧 Configuring CrowdSec to read Traefik logs on: {$this->server->name}");
        
        try {
            // 1. Backup current docker-compose
            $this->backupDockerCompose();
            
            // 2. Update docker-compose to mount Traefik logs
            $this->updateDockerCompose();
            
            // 3. Update acquis.yaml with correct path
            $this->updateAcquisConfig();
            
            // 4. Recreate CrowdSec container
            $this->recreateCrowdSec();
            
            // 5. Verify logs are being read
            sleep(10);
            $this->verifyLogReading();
            
            ray("✅ CrowdSec configured to read Traefik logs");
            
        } catch (\Exception $e) {
            ray("❌ Failed to configure CrowdSec: {$e->getMessage()}");
            throw $e;
        }
    }
    
    private function backupDockerCompose(): void
    {
        ray("Creating backup...");
        
        instant_remote_process([
            'cd /var/lib/coolify/crowdsec',
            'cp docker-compose.yml docker-compose.yml.backup-' . date('YmdHis'),
        ], $this->server);
    }
    
    private function updateDockerCompose(): void
    {
        ray("Updating docker-compose.yml...");
        
        // Read current compose
        $currentCompose = instant_remote_process([
            'cat /var/lib/coolify/crowdsec/docker-compose.yml'
        ], $this->server);
        
        // Check if already configured
        if (str_contains($currentCompose, 'coolify_dev_coolify_data/_data/proxy')) {
            ray("✅ Traefik logs already mounted");
            return;
        }
        
        // Generate new compose with Traefik logs volume
        $newCompose = <<<'YAML'
version: '3.8'
services:
  crowdsec:
    image: 'crowdsecurity/crowdsec:latest'
    container_name: crowdsec-live
    restart: always
    environment:
      COLLECTIONS: 'crowdsecurity/nginx crowdsecurity/traefik crowdsecurity/http-cve'
      GID: '1000'
      TZ: UTC
    volumes:
      - './config:/etc/crowdsec'
      - './data:/var/lib/crowdsec/data'
      - '/var/log:/var/log:ro'
      - '/var/lib/docker/volumes/coolify_dev_coolify_data/_data/proxy:/traefik:ro'
    ports:
      - '0.0.0.0:8081:8080'
    networks:
      - coolify
networks:
  coolify:
    external: true
YAML;
        
        // Write to temp file
        $tempFile = storage_path("app/crowdsec-compose-{$this->server->id}.yml");
        file_put_contents($tempFile, $newCompose);
        
        // Upload
        instant_scp(
            $tempFile,
            '/var/lib/coolify/crowdsec/docker-compose.yml',
            $this->server
        );
        
        @unlink($tempFile);
        
        ray("✅ docker-compose.yml updated");
    }
    
    private function updateAcquisConfig(): void
    {
        ray("Updating acquis.yaml...");
        
        // Get all applications on this server with firewall enabled
        $applications = \App\Models\Application::whereHas('destination', function($q) {
            $q->where('server_id', $this->server->id);
        })->whereHas('firewallConfig', function($q) {
            $q->where('enabled', true);
        })->get();
        
        $acquisConfig = "---\n";
        $acquisConfig .= "source: file\n";
        $acquisConfig .= "filenames:\n";
        $acquisConfig .= "  - /traefik/access.log\n";
        $acquisConfig .= "labels:\n";
        $acquisConfig .= "  type: traefik\n\n";
        
        // Add AppSec configs for each application
        foreach ($applications as $app) {
            $acquisConfig .= "---\n";
            $acquisConfig .= "source: appsec\n";
            $acquisConfig .= "listen_addr: '0.0.0.0:7422'\n";
            $acquisConfig .= "appsec_config: ideploy/app-{$app->uuid}\n";
            $acquisConfig .= "labels:\n";
            $acquisConfig .= "  type: appsec\n";
            $acquisConfig .= "  application_uuid: {$app->uuid}\n\n";
        }
        
        // Write to temp file
        $tempFile = storage_path("app/acquis-{$this->server->id}.yaml");
        file_put_contents($tempFile, $acquisConfig);
        
        // Upload
        instant_scp(
            $tempFile,
            '/var/lib/coolify/crowdsec/config/acquis.yaml',
            $this->server
        );
        
        @unlink($tempFile);
        
        ray("✅ acquis.yaml updated");
    }
    
    private function recreateCrowdSec(): void
    {
        ray("Recreating CrowdSec container...");
        
        instant_remote_process([
            'cd /var/lib/coolify/crowdsec',
            'docker-compose down',
            'docker-compose up -d',
        ], $this->server);
        
        // Wait for CrowdSec to be healthy
        sleep(15);
        
        ray("✅ CrowdSec recreated");
    }
    
    private function verifyLogReading(): void
    {
        ray("Verifying log reading...");
        
        // Check if file is accessible
        $result = instant_remote_process([
            'docker exec crowdsec-live ls -lh /traefik/access.log 2>&1'
        ], $this->server);
        
        if (str_contains($result, 'No such file')) {
            throw new \Exception('Traefik access.log not accessible in CrowdSec container');
        }
        
        // Check CrowdSec logs for acquisition
        $logs = instant_remote_process([
            'docker logs crowdsec-live 2>&1 | grep -i "traefik/access.log" | tail -5'
        ], $this->server);
        
        if (str_contains($logs, 'No matching files')) {
            throw new \Exception('CrowdSec cannot read Traefik logs');
        }
        
        ray("✅ CrowdSec is reading Traefik logs");
    }
    
    public function failed(\Throwable $exception): void
    {
        ray("ConfigureCrowdSecTraefikLogsJob failed: {$exception->getMessage()}");
    }
}
