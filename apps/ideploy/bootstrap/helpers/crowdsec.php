<?php

use App\Models\Application;
use App\Models\FirewallConfig;

/**
 * Generate CrowdSec labels for an application if firewall is enabled
 */
function crowdSecLabelsForApplication(Application $application, ?string $appUuid = null): array
{
    $labels = [];
    
    // Get firewall config for this application
    $firewallConfig = FirewallConfig::where('application_id', $application->id)->first();
    
    // If no config or firewall disabled, return empty
    if (!$firewallConfig || !$firewallConfig->enabled) {
        return $labels;
    }
    
    // If no CrowdSec API key, return empty (firewall not fully configured)
    if (!$firewallConfig->crowdsec_api_key) {
        ray("CrowdSec labels skipped: No API key for app {$application->name}");
        return $labels;
    }
    
    $uuid = $appUuid ?? $application->uuid;
    $server = $application->destination->server;
    $lapiUrl = $server->crowdsec_lapi_url ?? 'http://crowdsec:8080';
    
    // Extract host without scheme for plugin
    $lapiHost = str_replace(['http://', 'https://'], '', $lapiUrl);
    
    ray("Generating CrowdSec labels for app: {$application->name}");
    
    try {
        $apiKey = decrypt($firewallConfig->crowdsec_api_key);
        
        // CrowdSec bouncer middleware configuration (LAPI - IP blocking)
        // Using Traefik plugin format
        $labels = [
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.enabled" => "true",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapikey" => $apiKey,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapihost" => $lapiHost,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapischemе" => "http",
            
            // Optionally configure other bouncer settings
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdseclapikey_file" => "",
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.crowdsec_mode" => $firewallConfig->inband_enabled ? "live" : "stream",
            
            // Ban settings
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.defaultdecisiontime" => (string)$firewallConfig->ban_duration,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.httptimeoutseconds" => "10",
            
            // Response customization
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.returnstatuscode" => (string)$firewallConfig->blocked_http_code,
            "traefik.http.middlewares.crowdsec-{$uuid}.plugin.bouncer.captchastatuscodе" => "401",
        ];
        
        // AppSec middleware configuration (WAF - HTTP inspection)
        // Only add if inband (blocking) mode is enabled
        if ($firewallConfig->inband_enabled) {
            $appSecLabels = [
                // AppSec middleware pointing to CrowdSec AppSec component (port 7422)
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.enabled" => "true",
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.crowdseclapikey" => $apiKey,
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.crowdseclapihost" => $lapiHost,
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.crowdseclapischemе" => "http",
                
                // CRITICAL: Enable AppSec feature in the plugin
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.crowdsecappsecenabled" => "true",
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.crowdsecappsechost" => "crowdsec:7422",
                
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.appsecfailureblock" => "true",
                "traefik.http.middlewares.appsec-{$uuid}.plugin.bouncer.appsecuniqidentifierheader" => "",
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
    
    // Convert associative array to "key=value" strings for Docker labels
    $dockerLabels = [];
    foreach ($labels as $key => $value) {
        $dockerLabels[] = "{$key}={$value}";
    }
    
    return $dockerLabels;
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
