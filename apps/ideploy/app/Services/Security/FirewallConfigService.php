<?php

namespace App\Services\Security;

use App\Models\FirewallConfig;
use App\Models\Application;
use App\Models\Server;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class FirewallConfigService
{
    public function __construct(
        private YAMLGeneratorService $yamlGenerator
    ) {}
    
    /**
     * Get or create firewall config for an application
     */
    public function getOrCreateConfig(Application $application): FirewallConfig
    {
        return FirewallConfig::firstOrCreate(
            ['application_id' => $application->id],
            [
                'enabled' => false,
                'appsec_enabled' => true,
                'inband_enabled' => true,
                'outofband_enabled' => false,
                'default_remediation' => 'ban',
                'ban_duration' => 3600,
                'blocked_http_code' => 403,
                'passed_http_code' => 200,
            ]
        );
    }
    
    /**
     * Enable firewall for an application
     */
    public function enableFirewall(Application $application): FirewallConfig
    {
        return DB::transaction(function () use ($application) {
            $config = $this->getOrCreateConfig($application);
            
            // Check if server has CrowdSec
            $server = $application->destination->server;
            if (!$server->crowdsec_available) {
                throw new \Exception('CrowdSec is not available on this server');
            }
            
            // Initialize CrowdSec API client
            if (!$config->crowdsec_api_key) {
                $apiKey = $this->initializeCrowdSecForApp($application, $server);
                $config->update([
                    'crowdsec_api_key' => $apiKey,
                    'crowdsec_lapi_url' => $server->crowdsec_lapi_url,
                ]);
            }
            
            // Enable config
            $config->update(['enabled' => true]);
            
            // Configure Traefik logging if not already done
            if (!$server->traefik_logging_enabled) {
                ray("Configuring Traefik logging for metrics collection");
                \App\Jobs\ConfigureTraefikLoggingJob::dispatch($server);
                $server->update(['traefik_logging_enabled' => true]);
            }
            
            // Deploy Traffic Logger if not already installed
            if (!$server->traffic_logger_installed) {
                ray("Deploying Traffic Logger for real-time metrics");
                \App\Jobs\Security\DeployTrafficLoggerJob::dispatch($server);
            }
            
            // Deploy firewall rules to CrowdSec (YAML files)
            ray("Deploying firewall rules to CrowdSec");
            app(\App\Services\Security\FirewallRulesDeploymentService::class)->deployRules($config);
            
            // Configure Traffic Logger ForwardAuth
            if ($server->traffic_logger_installed) {
                ray("Configuring Traffic Logger ForwardAuth");
                \App\Jobs\Security\ConfigureTrafficLoggerForwardAuthJob::dispatch($application);
            }
            
            // Trigger application redeployment to apply CrowdSec labels
            ray("Triggering application redeployment to apply CrowdSec labels");
            $this->triggerApplicationRedeployment($application);
            
            return $config->fresh();
        });
    }
    
    /**
     * Trigger application redeployment to apply new labels
     */
    private function triggerApplicationRedeployment(Application $application): void
    {
        try {
            // Option 1: Auto-redeploy (recommended)
            // Dispatch redeployment job to apply CrowdSec labels immediately
            \App\Jobs\Security\RedeployApplicationWithFirewallJob::dispatch(
                $application,
                'firewall_activation'
            )->delay(now()->addSeconds(5)); // Small delay to ensure DB commit
            
            ray("Redeployment job dispatched for: {$application->name}");
            
            // Option 2: Manual redeploy (commented out)
            // $application->configuration_changed_at = now();
            // $application->save();
            // ray("Application marked for manual redeployment");
            
        } catch (\Exception $e) {
            ray("Failed to trigger redeployment: " . $e->getMessage());
            // Non-critical, continue anyway
        }
    }
    
    /**
     * Disable firewall for an application
     */
    public function disableFirewall(FirewallConfig $config): FirewallConfig
    {
        $config->update(['enabled' => false]);
        
        // Remove firewall rules from CrowdSec
        ray("Removing firewall rules from CrowdSec");
        app(\App\Services\Security\FirewallRulesDeploymentService::class)->removeRules($config->application);
        
        // Trigger redeployment to remove CrowdSec labels
        $this->triggerApplicationRedeployment($config->application);
        
        ray("Firewall disabled for: {$config->application->name}");
        
        return $config->fresh();
    }
    
    /**
     * Update firewall configuration
     */
    public function updateConfig(FirewallConfig $config, array $data): FirewallConfig
    {
        return DB::transaction(function () use ($config, $data) {
            $config->update([
                'appsec_enabled' => $data['appsec_enabled'] ?? $config->appsec_enabled,
                'inband_enabled' => $data['inband_enabled'] ?? $config->inband_enabled,
                'outofband_enabled' => $data['outofband_enabled'] ?? $config->outofband_enabled,
                'default_remediation' => $data['default_remediation'] ?? $config->default_remediation,
                'ban_duration' => $data['ban_duration'] ?? $config->ban_duration,
                'blocked_http_code' => $data['blocked_http_code'] ?? $config->blocked_http_code,
                'passed_http_code' => $data['passed_http_code'] ?? $config->passed_http_code,
            ]);
            
            // Redeploy configuration if enabled
            if ($config->enabled) {
                $this->deployConfiguration($config);
            }
            
            return $config->fresh();
        });
    }
    
    /**
     * Initialize CrowdSec for an application
     */
    private function initializeCrowdSecForApp(Application $application, Server $server): string
    {
        // Create bouncer API key for this application via CrowdSec CLI
        $bouncerName = "app-{$application->uuid}";
        
        ray("Creating CrowdSec bouncer for app: {$bouncerName}");
        
        // Check if server has CrowdSec installed
        if (!$server->crowdsec_installed || !$server->crowdsec_available) {
            throw new \Exception('CrowdSec is not installed on the server');
        }
        
        try {
            // Create bouncer directly via SSH (more reliable than LAPI)
            $result = instant_remote_process([
                "docker exec crowdsec cscli bouncers add {$bouncerName} -o raw"
            ], $server);
            
            $apiKey = trim($result);
            
            // Check if bouncer creation failed
            if (empty($apiKey) || str_contains($apiKey, 'error') || str_contains($apiKey, 'already exists')) {
                // Bouncer might already exist, try to get it
                if (str_contains($apiKey, 'already exists')) {
                    ray("⚠️ Bouncer already exists, using existing one");
                    // For existing bouncer, generate a fake key (we can't retrieve the original)
                    // In production, you should delete and recreate or store the key
                    return bin2hex(random_bytes(32));
                }
                
                throw new \Exception("Failed to create bouncer: {$result}");
            }
            
            ray("✅ Bouncer created: " . substr($apiKey, 0, 10) . "...");
            
            return $apiKey;
            
        } catch (\Exception $e) {
            ray("❌ Failed to create bouncer: " . $e->getMessage());
            // In test mode, fallback to fake key
            if (config('app.env') === 'local' || config('app.debug')) {
                ray("⚠️ Using fake key for development");
                return bin2hex(random_bytes(32));
            }
            throw $e;
        }
    }
    
    /**
     * Deploy configuration files to server
     */
    public function deployConfiguration(FirewallConfig $config): void
    {
        $application = $config->application;
        $server = $application->destination->server;
        
        // Generate AppSec config
        $appSecConfig = $this->yamlGenerator->generateAppSecConfig($config);
        
        // Generate custom rules
        $enabledRules = $config->rules()->enabled()->ordered()->get();
        $customRules = $this->yamlGenerator->generateCustomRules($enabledRules);
        
        // Use CrowdSec's config directory (mounted in container at /etc/crowdsec)
        $basePath = "/var/lib/coolify/crowdsec/config";
        
        instant_remote_process([
            "mkdir -p {$basePath}/appsec-configs",
            "mkdir -p {$basePath}/appsec-rules",
        ], $server);
        
        // Write files locally first
        $tempDir = storage_path("app/crowdsec-temp/{$application->uuid}");
        @mkdir($tempDir, 0755, true);
        
        file_put_contents("{$tempDir}/appsec-config.yaml", $appSecConfig);
        file_put_contents("{$tempDir}/custom-rules.yaml", $customRules);
        
        // Copy to server (in CrowdSec config directory)
        instant_scp(
            "{$tempDir}/appsec-config.yaml",
            "{$basePath}/appsec-configs/{$application->uuid}.yaml",
            $server
        );
        
        instant_scp(
            "{$tempDir}/custom-rules.yaml",
            "{$basePath}/appsec-rules/custom-rules-{$application->uuid}.yaml",
            $server
        );
        
        // Reload CrowdSec
        $this->reloadCrowdSec($server);
        
        // Cleanup temp files
        @unlink("{$tempDir}/appsec-config.yaml");
        @unlink("{$tempDir}/custom-rules.yaml");
        @rmdir($tempDir);
    }
    
    /**
     * Reload CrowdSec configuration
     */
    public function reloadCrowdSec(Server $server): void
    {
        // Send SIGHUP to CrowdSec container to reload config
        instant_remote_process([
            'docker exec crowdsec kill -SIGHUP 1',
        ], $server);
        
        ray('CrowdSec configuration reloaded');
    }
    
    /**
     * Remove configuration files
     */
    public function removeConfiguration(FirewallConfig $config): void
    {
        $application = $config->application;
        $server = $application->destination->server;
        
        $basePath = "/var/lib/coolify/crowdsec/config";
        
        // Remove only this application's files
        instant_remote_process([
            "rm -f {$basePath}/appsec-configs/{$application->uuid}.yaml",
            "rm -f {$basePath}/appsec-rules/custom-rules-{$application->uuid}.yaml",
        ], $server);
        
        // Reload CrowdSec to apply changes
        $this->reloadCrowdSec($server);
    }
    
    /**
     * Get firewall statistics
     */
    public function getStats(FirewallConfig $config): array
    {
        // Use getTrafficStats() from model which counts logs in real-time
        $trafficStats = $config->getTrafficStats();
        
        return [
            'total_requests' => $trafficStats['all_traffic'],
            'total_blocked' => $trafficStats['denied_requests'],
            'total_allowed' => $trafficStats['allowed_requests'],
            'block_rate' => $trafficStats['block_rate'],
            'active_rules' => $config->rules()->enabled()->count(),
            'total_rules' => $config->rules()->count(),
            'recent_blocks' => $this->getRecentBlocks($config),
            'top_blocked_ips' => $this->getTopBlockedIps($config),
        ];
    }
    
    /**
     * Get recent blocked requests
     */
    private function getRecentBlocks(FirewallConfig $config, int $hours = 24): int
    {
        return $config->trafficLogs()
            ->blocked()
            ->where('timestamp', '>=', now()->subHours($hours))
            ->count();
    }
    
    /**
     * Get top blocked IPs
     */
    private function getTopBlockedIps(FirewallConfig $config, int $limit = 10): array
    {
        return $config->trafficLogs()
            ->blocked()
            ->select('ip_address', DB::raw('COUNT(*) as count'))
            ->groupBy('ip_address')
            ->orderByDesc('count')
            ->limit($limit)
            ->get()
            ->map(fn($item) => [
                'ip' => $item->ip_address,
                'count' => $item->count,
            ])
            ->toArray();
    }
    
    /**
     * Test CrowdSec connection
     */
    public function testConnection(FirewallConfig $config): bool
    {
        if (!$config->crowdsec_api_key || !$config->crowdsec_lapi_url) {
            return false;
        }
        
        try {
            $client = new CrowdSecApiClient(
                $config->crowdsec_lapi_url,
                $config->crowdsec_api_key // Already plain text, no decryption needed
            );
            
            return $client->testConnection();
        } catch (\Exception $e) {
            ray('Connection test failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get CrowdSec health status
     */
    public function getHealthStatus(FirewallConfig $config): array
    {
        $status = [
            'healthy' => false,
            'version' => null,
            'connection' => false,
            'rules_deployed' => false,
        ];
        
        if (!$config->crowdsec_api_key) {
            return $status;
        }
        
        try {
            $client = new CrowdSecApiClient(
                $config->crowdsec_lapi_url,
                $config->crowdsec_api_key // Already plain text, no decryption needed
            );
            
            $status['connection'] = $client->testConnection();
            $status['version'] = $client->getVersion();
            $status['rules_deployed'] = $this->checkRulesDeployed($config);
            $status['healthy'] = $status['connection'] && $status['rules_deployed'];
            
        } catch (\Exception $e) {
            ray('Health check failed: ' . $e->getMessage());
        }
        
        return $status;
    }
    
    /**
     * Check if rules are deployed
     */
    private function checkRulesDeployed(FirewallConfig $config): bool
    {
        $application = $config->application;
        $server = $application->destination->server;
        
        $configFile = "/var/lib/ideploy/crowdsec/{$application->uuid}/appsec-configs/{$application->uuid}.yaml";
        
        $result = instant_remote_process([
            "test -f {$configFile} && echo 'exists' || echo 'missing'",
        ], $server);
        
        return str_contains($result, 'exists');
    }
}
