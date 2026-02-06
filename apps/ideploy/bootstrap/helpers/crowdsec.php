<?php

use App\Models\Application;
use App\Models\FirewallConfig;

/**
 * Generate CrowdSec labels for an application if firewall is enabled
 */
function crowdSecLabelsForApplication(Application $application, ?string $appUuid = null): array
{
    $labels = [];
    
    ray("🔍 CrowdSec labels called for: {$application->name}");
    
    // Get firewall config for this application
    $firewallConfig = FirewallConfig::where('application_id', $application->id)->first();
    
    ray("Config found: " . ($firewallConfig ? 'YES' : 'NO') . ", Enabled: " . ($firewallConfig && $firewallConfig->enabled ? 'YES' : 'NO'));
    
    // If no config or firewall disabled, return empty
    if (!$firewallConfig || !$firewallConfig->enabled) {
        ray("⚠️ Firewall disabled or no config - returning empty labels");
        return $labels;
    }
    
    // If no CrowdSec API key, return empty (firewall not fully configured)
    if (!$firewallConfig->crowdsec_api_key) {
        ray("CrowdSec labels skipped: No API key for app {$application->name}");
        return $labels;
    }
    
    $uuid = $appUuid ?? $application->uuid;
    $server = $application->destination->server;
    $lapiUrl = $server->crowdsec_lapi_url ?? 'http://crowdsec-live:8080';
    
    // Extract host without scheme for plugin
    $lapiHost = str_replace(['http://', 'https://'], '', $lapiUrl);
    
    ray("Generating CrowdSec labels for app: {$application->name}");
    
    try {
        $apiKey = $firewallConfig->crowdsec_api_key; // Already plain text, no decryption needed
        
        // CrowdSec bouncer middleware configuration (LAPI - IP blocking)
        // Plugin expects PascalCase for Go struct fields
        $labels = [
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.enabled" => "true",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.CrowdsecLapiKey" => $apiKey,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.CrowdsecLapiHost" => $lapiHost,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.CrowdsecLapiScheme" => "http",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.CrowdsecMode" => "live", // Use live mode for reliable blocking
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.DefaultDecisionSeconds" => (string)$firewallConfig->ban_duration,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.HttpTimeoutSeconds" => "10",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.UpdateIntervalSeconds" => "5", // Check decisions every 5s
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.LogLevel" => "DEBUG",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.ForwardedHeadersTrustedIPs" => "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16", // Trust private IPs
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.RedisCacheEnabled" => "false",
        ];
        
        // AppSec middleware configuration (WAF - HTTP inspection)
        // IMPORTANT: AppSec requires a separate CrowdSec AppSec component running on port 7422
        // Only add AppSec labels if explicitly enabled AND AppSec is available on the server
        // For now, we disable AppSec by default as it requires additional setup
        // TODO: Add server-level check for AppSec availability before enabling
        $hasPathRules = $firewallConfig->rules()->enabled()->where('protection_mode', 'path_only')->exists();
        $shouldEnableAppSec = false; // Disabled by default - requires AppSec installation
        
        if ($shouldEnableAppSec && $firewallConfig->appsec_enabled && ($firewallConfig->inband_enabled || $hasPathRules)) {
            $appSecLabels = [
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.enabled" => "true",
                // LAPI params (required)
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecLapiKey" => $apiKey,
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecLapiHost" => $lapiHost,
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecLapiScheme" => "http",
                // AppSec specific
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecAppsecEnabled" => "true",
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecAppsecHost" => "crowdsec-live:7422",
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.CrowdsecAppsecFailureBlock" => "true",
            ];
            
            $labels = array_merge($labels, $appSecLabels);
            ray("AppSec middleware labels added for {$application->name}");
        }
        
        // NOTE: Router middlewares will be applied automatically by generateLabelsForApplication()
        
        ray("Generated " . count($labels) . " CrowdSec labels");
        
    } catch (\Exception $e) {
        ray("Failed to generate CrowdSec labels: " . $e->getMessage());
        return [];
    }
    
    // Convert to "key=value" strings like other label functions
    $labelStrings = [];
    foreach ($labels as $key => $value) {
        $labelStrings[] = "{$key}={$value}";
    }
    
    return $labelStrings;
}

/**
 * Check if application has firewall enabled
 */
function isFirewallEnabled(Application $application): bool
{
    $firewallConfig = FirewallConfig::where('application_id', $application->id)->first();
    
    return $firewallConfig && $firewallConfig->enabled;
}

/**
 * Get firewall config for application
 */
function getFirewallConfig(Application $application): ?FirewallConfig
{
    return FirewallConfig::where('application_id', $application->id)->first();
}
