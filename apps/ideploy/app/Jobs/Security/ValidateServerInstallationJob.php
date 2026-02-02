<?php

namespace App\Jobs\Security;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ValidateServerInstallationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes
    public $tries = 3;
    public $backoff = 60; // 1 minute between retries

    public function __construct(
        public Server $server
    ) {}

    public function handle()
    {
        ray("🔍 Validation installation serveur: {$this->server->name}");
        
        $validationResults = [
            'crowdsec' => $this->validateCrowdSec(),
            'traefik_logging' => $this->validateTraefikLogging(),
            'traffic_logger' => $this->validateTrafficLogger(),
        ];
        
        $allValid = array_filter($validationResults);
        $isComplete = count($allValid) === count($validationResults);
        
        // Update server status
        $this->server->update([
            'installation_validated' => $isComplete,
            'last_validation_at' => now(),
            'validation_details' => json_encode($validationResults)
        ]);
        
        if ($isComplete) {
            ray("✅ Serveur {$this->server->name} - Installation complète et validée");
            // Update server metadata based on successful validations
            $this->updateServerMetadata($validationResults);
            
            ray("🎉 All firewall components validated successfully!");
        } else {
            ray("⚠️ Serveur {$this->server->name} - Installation incomplète: " . json_encode($validationResults));
            
            // Retry failed components
            $this->retryFailedComponents($validationResults);
        }
        
        return $isComplete;
    }
    
    private function validateCrowdSec(): bool
    {
        if (!$this->server->crowdsec_available) {
            return false;
        }
        
        try {
            // Test container running
            $result = instant_remote_process([
                'docker ps --filter name=crowdsec-live --format "{{.Status}}" | grep -q "Up"'
            ], $this->server);
            
            return !empty($result);
        } catch (\Exception $e) {
            ray("❌ CrowdSec validation failed: " . $e->getMessage());
            return false;
        }
    }
    
    private function validateTraefikLogging(): bool
    {
        if (!$this->server->traefik_logging_enabled) {
            return false;
        }
        
        try {
            // Check if access.log exists and has JSON format
            $result = instant_remote_process([
                'test -f /traefik/access.log && tail -1 /traefik/access.log | jq empty 2>/dev/null'
            ], $this->server);
            
            return true; // If command doesn't throw, JSON format is valid
        } catch (\Exception $e) {
            ray("❌ Traefik Logging validation failed: " . $e->getMessage());
            return false;
        }
    }
    
    private function validateTrafficLogger(): bool
    {
        if (!$this->server->traffic_logger_installed) {
            return false;
        }
        
        try {
            // Test container responding
            $result = instant_remote_process([
                'curl -s http://localhost:3001/health'
            ], $this->server);
            
            return str_contains($result, 'OK') || str_contains($result, 'healthy');
        } catch (\Exception $e) {
            ray("❌ Traffic Logger validation failed: " . $e->getMessage());
            return false;
        }
    }
    
    private function retryFailedComponents(array $validationResults): void
    {
        // Retry CrowdSec installation if failed
        if (!$validationResults['crowdsec']) {
            ray("🔄 Retry CrowdSec installation");
            \App\Jobs\Server\InstallCrowdSecJob::dispatch($this->server)->delay(now()->addMinutes(2));
        }
        
        // Retry Traefik Logging if failed
        if (!$validationResults['traefik_logging']) {
            ray("🔄 Retry Traefik Logging configuration");
            \App\Jobs\ConfigureTraefikLoggingJob::dispatch($this->server)->delay(now()->addMinutes(1));
        }
        
        // Retry Traffic Logger if failed
        if (!$validationResults['traffic_logger']) {
            ray("🔄 Retry Traffic Logger deployment");
            \App\Jobs\Security\DeployTrafficLoggerJob::dispatch($this->server)->delay(now()->addMinutes(3));
        }
    }
    
    private function updateServerMetadata(array $validationResults): void
    {
        $updateData = [];
        
        if ($validationResults['crowdsec'] ?? false) {
            $updateData['crowdsec_installed'] = true;
            $updateData['crowdsec_available'] = true;
        }
        
        if ($validationResults['traefik_logging'] ?? false) {
            $updateData['traefik_logging_enabled'] = true;
        }
        
        if ($validationResults['traffic_logger'] ?? false) {
            $updateData['traffic_logger_installed'] = true;
        }
        
        if (!empty($updateData)) {
            $this->server->update($updateData);
            ray("✅ Server metadata updated: " . implode(', ', array_keys($updateData)));
        }
    }
}
