<?php

namespace App\Jobs\Security;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Yaml\Yaml;

class InstallCrowdSecJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 1;
    public $timeout = 300; // 5 minutes

    public function __construct(
        public Server $server
    ) {}

    public function handle(): void
    {
        ray("Installing CrowdSec on server: {$this->server->name}");
        
        try {
            // 1. Create directory structure
            $this->createDirectories();
            
            // 2. Generate Docker Compose file
            $this->generateDockerCompose();
            
            // 3. Start CrowdSec container
            $this->startCrowdSec();
            
            // 4. Generate bouncer API key
            $apiKey = $this->generateBouncerKey();
            
            // 5. Configure Traefik bouncer
            $this->configureTraefikBouncer($apiKey);
            
            // 6. Update server metadata
            $this->server->update([
                'crowdsec_installed' => true,
                'crowdsec_available' => true,
                'crowdsec_lapi_url' => 'http://crowdsec:8080',
                'crowdsec_api_key' => encrypt($apiKey),
            ]);
            
            ray("CrowdSec successfully installed on {$this->server->name}");
            
        } catch (\Exception $e) {
            ray("CrowdSec installation failed: {$e->getMessage()}");
            throw $e;
        }
    }
    
    private function createDirectories(): void
    {
        instant_remote_process([
            'mkdir -p /var/lib/ideploy/crowdsec/{data,config}',
            'chown -R 1000:1000 /var/lib/ideploy/crowdsec',
        ], $this->server);
    }
    
    private function generateDockerCompose(): void
    {
        // Docker compose according to official CrowdSec documentation
        $compose = [
            'version' => '3.8',
            'services' => [
                'crowdsec' => [
                    'image' => 'crowdsecurity/crowdsec:latest',
                    'container_name' => 'crowdsec',
                    'restart' => 'always',
                    'environment' => [
                        'COLLECTIONS' => 'crowdsecurity/nginx crowdsecurity/traefik crowdsecurity/http-cve',
                        'GID' => '1000',
                        'TZ' => 'UTC',
                    ],
                    'volumes' => [
                        '/var/lib/ideploy/crowdsec/config:/etc/crowdsec',
                        '/var/lib/ideploy/crowdsec/data:/var/lib/crowdsec/data',
                        '/var/log:/var/log:ro',
                    ],
                    'networks' => ['ideploy-network'],
                    'ports' => [
                        '127.0.0.1:8080:8080',  // LAPI (localhost only for security)
                    ],
                    'labels' => [
                        'coolify.managed' => 'true',
                    ],
                ],
            ],
            'networks' => [
                'ideploy-network' => [
                    'external' => true,
                ],
            ],
        ];
        
        $yaml = Yaml::dump($compose, 6, 2);
        
        // Save locally
        $tempFile = storage_path("app/crowdsec-compose-{$this->server->id}.yml");
        file_put_contents($tempFile, $yaml);
        
        // Copy to server
        instant_scp(
            $tempFile,
            '/var/lib/ideploy/crowdsec/docker-compose.yml',
            $this->server
        );
        
        // Cleanup
        @unlink($tempFile);
    }
    
    private function startCrowdSec(): void
    {
        instant_remote_process([
            'cd /var/lib/ideploy/crowdsec',
            'docker compose up -d',
            'sleep 10', // Wait for CrowdSec to start
        ], $this->server);
    }
    
    private function generateBouncerKey(): string
    {
        $output = instant_remote_process([
            'docker exec crowdsec cscli bouncers add ideploy-traefik -o raw',
        ], $this->server);
        
        // Extract API key from output
        $lines = explode("\n", trim($output));
        $apiKey = trim(end($lines));
        
        if (empty($apiKey) || strlen($apiKey) < 20) {
            throw new \Exception('Failed to generate bouncer API key');
        }
        
        return $apiKey;
    }
    
    private function configureTraefikBouncer(string $apiKey): void
    {
        $config = [
            'http' => [
                'middlewares' => [
                    'crowdsec-bouncer' => [
                        'plugin' => [
                            'crowdsec-bouncer-traefik-plugin' => [
                                'enabled' => true,
                                'logLevel' => 'INFO',
                                'crowdsecLapiHost' => 'crowdsec:8080',
                                'crowdsecLapiScheme' => 'http',
                                'crowdsecLapiKey' => $apiKey,
                                'crowdsecAppsecEnabled' => true,
                                'crowdsecAppsecHost' => 'crowdsec:7422',
                                'crowdsecAppsecFailureBlock' => true,
                                'crowdsecMode' => 'live',
                                'updateIntervalSeconds' => 10,
                                'defaultDecisionSeconds' => 3600,
                            ],
                        ],
                    ],
                ],
            ],
        ];
        
        $yaml = Yaml::dump($config, 6, 2);
        
        // Save locally
        $tempFile = storage_path("app/crowdsec-traefik-{$this->server->id}.yml");
        file_put_contents($tempFile, $yaml);
        
        // Copy to server
        instant_scp(
            $tempFile,
            '/data/coolify/proxy/dynamic/crowdsec.yaml',
            $this->server
        );
        
        // Cleanup
        @unlink($tempFile);
        
        // Reload Traefik
        instant_remote_process([
            'docker exec coolify-proxy kill -SIGHUP 1',
        ], $this->server);
    }
    
    public function failed(\Throwable $exception): void
    {
        ray("InstallCrowdSecJob failed for {$this->server->name}: {$exception->getMessage()}");
        
        // Mark as failed
        $this->server->update([
            'crowdsec_installed' => false,
            'crowdsec_available' => false,
        ]);
    }
}
