<?php

namespace App\Services\Security;

use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\Server;

class TraefikBouncerService
{
    /**
     * Generate Traefik labels for CrowdSec middleware
     */
    public function generateTraefikLabels(Application $application, string $bouncerApiKey): array
    {
        $uuid = $application->uuid;
        $server = $application->destination->server;
        $lapiUrl = $server->crowdsec_lapi_url ?? 'http://crowdsec:8081';
        
        ray("Generating Traefik labels for app: {$application->name}");
        
        $labels = [
            // Define CrowdSec middleware
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.enabled" => "true",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapikey" => $bouncerApiKey,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapihost" => $lapiUrl,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapischemе" => "http",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.defaultdecisiontime" => "3600",
            
            // Apply middleware to router (will be added to existing middlewares)
            "traefik.http.routers.{$uuid}.middlewares" => $this->getMiddlewareChain($application, "crowdsec-{$uuid}"),
        ];
        
        ray("Generated " . count($labels) . " Traefik labels");
        
        return $labels;
    }
    
    /**
     * Get middleware chain for application (existing + CrowdSec)
     */
    private function getMiddlewareChain(Application $application, string $crowdsecMiddleware): string
    {
        // Get existing middlewares from application
        $existingMiddlewares = $this->getExistingMiddlewares($application);
        
        // Add CrowdSec middleware if not already present
        if (!in_array($crowdsecMiddleware, $existingMiddlewares)) {
            $existingMiddlewares[] = $crowdsecMiddleware;
        }
        
        return implode(',', $existingMiddlewares);
    }
    
    /**
     * Get existing middlewares from application labels
     */
    private function getExistingMiddlewares(Application $application): array
    {
        $middlewares = [];
        
        // Parse existing docker labels to find current middlewares
        // This is a placeholder - needs to be adapted based on how iDeploy stores labels
        $uuid = $application->uuid;
        
        // Default middlewares that are usually present
        $defaultMiddlewares = [
            "gzip",
            "redirect-to-https-{$uuid}",
        ];
        
        return array_merge($middlewares, $defaultMiddlewares);
    }
    
    /**
     * Check if Traefik bouncer plugin is installed
     */
    public function isBouncerPluginInstalled(Server $server): bool
    {
        try {
            $result = instant_remote_process([
                'docker exec traefik ls /plugins-local/traefik-plugin-crowdsec-bouncer 2>/dev/null || echo "not_found"'
            ], $server);
            
            return !str_contains($result, 'not_found');
        } catch (\Exception $e) {
            ray("Failed to check bouncer plugin: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Install Traefik bouncer plugin
     */
    public function installBouncerPlugin(Server $server): bool
    {
        ray("Installing Traefik bouncer plugin on server: {$server->name}");
        
        try {
            // Check if already installed
            if ($this->isBouncerPluginInstalled($server)) {
                ray("Bouncer plugin already installed");
                return true;
            }
            
            // Download and install plugin
            $commands = [
                // Create plugins directory
                'docker exec traefik mkdir -p /plugins-local',
                
                // Download plugin (using go get or git clone)
                'docker exec traefik sh -c "cd /plugins-local && git clone https://github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin.git traefik-plugin-crowdsec-bouncer"',
                
                // Update Traefik static config to enable plugin
                // Note: This requires Traefik restart
            ];
            
            instant_remote_process($commands, $server);
            
            ray("Bouncer plugin installed successfully");
            
            return true;
            
        } catch (\Exception $e) {
            ray("Failed to install bouncer plugin: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Configure Traefik static config for CrowdSec plugin
     */
    public function configureTraefikStaticConfig(Server $server): void
    {
        ray("Configuring Traefik static config for CrowdSec");
        
        // Traefik static configuration (traefik.yml or command line args)
        // This needs to be added to enable the plugin
        $staticConfig = <<<YAML
experimental:
  plugins:
    bouncer:
      moduleName: github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin
      version: v1.3.5
YAML;
        
        // This is a placeholder - needs to be adapted based on how iDeploy manages Traefik config
        // Option 1: Modify traefik.yml
        // Option 2: Add to command line arguments
        // Option 3: Use dynamic configuration
        
        ray("Static config generated (needs to be applied to Traefik)");
    }
    
    /**
     * Remove CrowdSec middleware from application
     */
    public function removeTraefikLabels(Application $application): array
    {
        $uuid = $application->uuid;
        
        // Return labels to remove (set to empty string or null)
        return [
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.enabled" => null,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapikey" => null,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapihost" => null,
        ];
    }
    
    /**
     * Test if bouncer can connect to CrowdSec LAPI
     */
    public function testBouncerConnection(Server $server, string $apiKey): bool
    {
        $lapiUrl = $server->crowdsec_lapi_url ?? 'http://crowdsec:8081';
        
        try {
            // Test connection from Traefik container to CrowdSec
            $result = instant_remote_process([
                "docker exec traefik curl -s -H 'X-Api-Key: {$apiKey}' {$lapiUrl}/v1/decisions"
            ], $server);
            
            // If we get JSON response (even empty array), connection works
            $decoded = json_decode($result, true);
            
            if (is_array($decoded)) {
                ray("Bouncer connection test: SUCCESS");
                return true;
            }
            
            ray("Bouncer connection test: FAILED - Invalid response");
            return false;
            
        } catch (\Exception $e) {
            ray("Bouncer connection test: FAILED - " . $e->getMessage());
            return false;
        }
    }
}
