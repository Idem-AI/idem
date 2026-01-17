<?php

namespace App\Jobs\Security;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Version de test du job d'installation CrowdSec
 * Simule l'installation sans accès serveur réel
 */
class TestInstallCrowdSecJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 1;
    public $timeout = 300; // 5 minutes

    public function __construct(
        public Server $server
    ) {}

    public function handle(): void
    {
        ray("🚀 TEST MODE: Installing CrowdSec on server: {$this->server->name}");
        
        try {
            // Simulate installation steps
            $this->simulateDirectories();
            sleep(2);
            
            $this->simulateDockerCompose();
            sleep(2);
            
            $this->simulateStartCrowdSec();
            sleep(5); // Simulate startup time
            
            $apiKey = $this->simulateBouncerKey();
            sleep(2);
            
            $this->simulateTraefikConfig($apiKey);
            sleep(2);
            
            // Update server metadata
            $this->server->update([
                'crowdsec_installed' => true,
                'crowdsec_available' => true,
                'crowdsec_lapi_url' => 'http://crowdsec:8080',
                'crowdsec_api_key' => encrypt($apiKey),
            ]);
            
            ray("✅ TEST MODE: CrowdSec successfully installed on {$this->server->name}");
            
        } catch (\Exception $e) {
            ray("❌ TEST MODE: CrowdSec installation failed: {$e->getMessage()}");
            throw $e;
        }
    }
    
    private function simulateDirectories(): void
    {
        ray("📁 Creating directories...");
        // Simulation: pas de vraies commandes SSH
    }
    
    private function simulateDockerCompose(): void
    {
        ray("🐳 Generating docker-compose.yml...");
        // Simulation: pas de vraie génération
    }
    
    private function simulateStartCrowdSec(): void
    {
        ray("▶️  Starting CrowdSec container...");
        // Simulation: pas de vrai docker compose up
    }
    
    private function simulateBouncerKey(): string
    {
        ray("🔑 Generating bouncer API key...");
        // Generate a fake but valid-looking API key
        return bin2hex(random_bytes(32));
    }
    
    private function simulateTraefikConfig(string $apiKey): void
    {
        ray("⚙️  Configuring Traefik bouncer...");
        // Simulation: pas de vraie config Traefik
    }
}
