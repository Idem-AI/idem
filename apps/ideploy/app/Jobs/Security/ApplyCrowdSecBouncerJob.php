<?php

namespace App\Jobs\Security;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Apply CrowdSec Bouncer middleware to application Traefik routes
 * 
 * This ensures that banned IPs are actually blocked by Traefik
 */
class ApplyCrowdSecBouncerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 1;
    public $timeout = 120;

    public function __construct(
        public Application $application
    ) {}

    public function handle(): void
    {
        ray("Applying CrowdSec bouncer middleware to: {$this->application->name}");
        
        try {
            // CRITICAL: Disable readonly labels to allow custom_labels to be applied
            if ($this->application->settings->is_container_label_readonly_enabled) {
                $this->application->settings->is_container_label_readonly_enabled = false;
                $this->application->settings->save();
                ray("⚠️ Disabled container_label_readonly to allow bouncer middleware");
            }
            
            $this->addBouncerMiddleware();
            $this->redeploy();
            
            ray("✅ CrowdSec bouncer applied successfully");
            
        } catch (\Exception $e) {
            ray("❌ Failed to apply bouncer: {$e->getMessage()}");
            throw $e;
        }
    }
    
    /**
     * Add crowdsec-bouncer middleware to application labels
     * 
     * NOTE: This job only ensures the middleware DEFINITIONS exist.
     * The actual middleware assignment to routers is done by generateLabelsApplication()
     * which is called during deployment.
     */
    private function addBouncerMiddleware(): void
    {
        $uuid = $this->application->uuid;
        $currentLabels = $this->application->custom_labels ?? '';
        
        // Check if labels are base64 encoded (sometimes double-encoded)
        $isBase64 = false;
        if (base64_decode($currentLabels, true) !== false && 
            base64_encode(base64_decode($currentLabels)) === $currentLabels) {
            $currentLabels = base64_decode($currentLabels);
            $isBase64 = true;
            ray("Labels are base64 encoded (level 1)");
            
            // Check for double encoding
            if (base64_decode($currentLabels, true) !== false && 
                base64_encode(base64_decode($currentLabels)) === $currentLabels) {
                $currentLabels = base64_decode($currentLabels);
                ray("Labels are base64 encoded (level 2 - double encoded)");
            }
        }
        
        ray("Current labels length: " . strlen($currentLabels));
        
        // Get firewall config
        $firewall = $this->application->firewallConfig;
        $lapiUrl = $firewall->crowdsec_lapi_url ?? 'http://crowdsec-live:8080';
        
        // Parse LAPI URL to get host and port
        $parsedUrl = parse_url($lapiUrl);
        $lapiHost = $parsedUrl['host'] ?? 'crowdsec-live';
        $lapiPort = $parsedUrl['port'] ?? 8080;
        $lapiKey = $firewall->crowdsec_api_key ?? '';
        
        // Note: Do NOT quote the API key - CrowdSec bouncer plugin validates against a regex
        // that doesn't accept quotes: /^[a-zA-Z0-9 !#$%&'*+-.^_`|~=/]*$/
        // The + character is allowed by the regex, so no quoting needed
        
        // Add bouncer configuration labels if not present
        $bouncerLabelsNeeded = [
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.enabled=true",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.CrowdsecLapiHost={$lapiHost}:{$lapiPort}",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.CrowdsecLapiKey={$lapiKey}",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.CrowdsecLapiScheme=http",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.CrowdsecMode=live",
            "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.enabled=true",
            "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecLapiHost={$lapiHost}:{$lapiPort}",
            "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecLapiKey={$lapiKey}",
            "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecAppsecEnabled=true",
            "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecAppsecHost=crowdsec-live:7422",
        ];
        
        // Split current labels into lines
        $lines = explode("\n", $currentLabels);
        
        // Add missing bouncer labels
        foreach ($bouncerLabelsNeeded as $label) {
            $labelKey = explode('=', $label)[0];
            $exists = false;
            
            foreach ($lines as $line) {
                if (str_starts_with(trim($line), $labelKey . '=')) {
                    $exists = true;
                    break;
                }
            }
            
            if (!$exists) {
                $lines[] = $label;
                ray("Added label: {$labelKey}");
            }
        }
        
        // CRITICAL: Also apply the middleware to the router
        $routerMiddlewareLine = "traefik.http.routers.http-0-{$uuid}.middlewares";
        $middlewareUpdated = false;
        
        foreach ($lines as $i => $line) {
            $line = trim($line);
            if (str_starts_with($line, $routerMiddlewareLine . '=')) {
                // Extract current middlewares
                $currentMiddlewares = explode('=', $line, 2)[1] ?? '';
                
                // Add crowdsec middleware if not present
                if (!str_contains($currentMiddlewares, "crowdsec-{$uuid}")) {
                    $newMiddlewares = $currentMiddlewares ? 
                        $currentMiddlewares . ",crowdsec-{$uuid}" : 
                        "crowdsec-{$uuid}";
                    
                    $lines[$i] = $routerMiddlewareLine . '=' . $newMiddlewares;
                    ray("Updated router middlewares: {$newMiddlewares}");
                    $middlewareUpdated = true;
                }
                break;
            }
        }
        
        if (!$middlewareUpdated) {
            ray("⚠️ Router middleware line not found - middleware definitions added but not applied to router");
        }
        
        // Rebuild labels
        $newLabels = implode("\n", $lines);
        
        // Update application with plain text labels
        $this->application->custom_labels = $newLabels;
        
        // IMPORTANT: Call parseContainerLabels() to encode and save properly
        // This ensures labels are stored in the correct format (base64 encoded)
        // and prevents double encoding issues
        $this->application->parseContainerLabels();
        
        ray("✅ Labels updated with middleware definitions and encoded");
    }
    
    /**
     * Restart container to apply new labels
     */
    private function redeploy(): void
    {
        ray("Restarting container to apply new labels...");
        
        try {
            $server = $this->application->destination->server;
            $containerName = "{$this->application->uuid}-" . $this->application->build_pack;
            
            // Find actual container name
            $containers = instant_remote_process([
                "docker ps --format '{{.Names}}' | grep {$this->application->uuid}"
            ], $server);
            
            $containerName = trim(explode("\n", $containers)[0] ?? '');
            
            if ($containerName) {
                ray("Restarting container: {$containerName}");
                
                instant_remote_process([
                    "docker restart {$containerName}"
                ], $server);
                
                ray("✅ Container restarted successfully");
            } else {
                ray("⚠️ Container not found, labels will apply on next deployment");
            }
            
        } catch (\Exception $e) {
            ray("⚠️ Could not restart container: {$e->getMessage()}");
            // Not critical, labels will apply on next deployment
        }
    }
    
    public function failed(\Throwable $exception): void
    {
        ray("ApplyCrowdSecBouncerJob failed: {$exception->getMessage()}");
    }
}
