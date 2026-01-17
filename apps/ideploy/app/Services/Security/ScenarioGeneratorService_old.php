<?php

namespace App\Services\Security;

use App\Models\FirewallConfig;
use App\Models\FirewallRule;
use Illuminate\Support\Collection;
use Symfony\Component\Yaml\Yaml;

/**
 * Generate CrowdSec Scenarios (for features not supported by AppSec rules)
 * 
 * Use cases:
 * - Geo-blocking (requires GeoIP enrichment)
 * - Complex time-based rules
 * - Multi-stage attack detection
 */
class ScenarioGeneratorService
{
    /**
     * Generate scenarios for rules that require it
     */
    public function generateScenarios(Collection $rules, FirewallConfig $config): array
    {
        $scenarios = [];
        
        foreach ($rules as $rule) {
            if ($this->needsScenario($rule)) {
                $scenario = $this->generateScenario($rule, $config);
                if ($scenario) {
                    $scenarios[] = $scenario;
                }
            }
        }
        
        return $scenarios;
    }
    
    /**
     * Check if a rule needs a scenario instead of AppSec rule
     * 
     * NOTE: Since AppSec is not supported in CrowdSec v1.7.3,
     * ALL rules must be converted to Scenarios
     */
    private function needsScenario(FirewallRule $rule): bool
    {
        // In CrowdSec v1.7.3 without AppSec support,
        // ALL rules need to be converted to Scenarios
        return true;
    }
    
    /**
     * Generate a scenario YAML for a rule
     */
    private function generateScenario(FirewallRule $rule, FirewallConfig $config): ?array
    {
        $application = $config->application;
        
        // Check if this is a geo-blocking rule
        if ($this->isGeoBlockingRule($rule)) {
            return $this->generateGeoBlockingScenario($rule, $application);
        }
        
        // For all other rules, generate generic HTTP scenario
        return $this->generateHTTPScenario($rule, $application);
    }
    
    /**
     * Check if rule is geo-blocking
     */
    private function isGeoBlockingRule(FirewallRule $rule): bool
    {
        foreach ($rule->conditions as $condition) {
            if ($condition['field'] === 'country_code') {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Generate geo-blocking scenario
     */
    private function generateGeoBlockingScenario(FirewallRule $rule, $application): array
    {
        $countryCodes = [];
        $ruleType = 'blocklist'; // or 'allowlist'
        
        // Extract country codes from conditions
        foreach ($rule->conditions as $condition) {
            if ($condition['field'] === 'country_code') {
                $operator = $condition['operator'];
                $value = $condition['value'];
                
                // Parse country codes (can be comma-separated)
                $codes = array_map('trim', explode(',', $value));
                $countryCodes = array_merge($countryCodes, $codes);
                
                // Determine if it's a blocklist or allowlist
                $ruleType = in_array($operator, ['in', 'equals']) ? 'blocklist' : 'allowlist';
            }
        }
        
        // Build filter expression
        if ($ruleType === 'blocklist') {
            // Block if country is in the list
            $filter = $this->buildGeoBlocklistFilter($countryCodes);
        } else {
            // Block if country is NOT in the list (allowlist)
            $filter = $this->buildGeoAllowlistFilter($countryCodes);
        }
        
        $scenarioName = "ideploy/geo-" . strtolower($rule->action) . "-{$application->uuid}-" . $rule->id;
        
        return [
            'filename' => "geo-{$rule->id}.yaml",
            'content' => Yaml::dump([
                'type' => 'trigger',
                'name' => $scenarioName,
                'description' => $rule->description ?: "Geo-blocking rule for {$application->name}",
                'filter' => $filter,
                'groupby' => 'evt.Meta.source_ip',
                'blackhole' => $rule->remediation_duration . 's',
                'labels' => [
                    'service' => 'appsec',
                    'type' => 'geo_blocking',
                    'remediation' => true,
                    'application_id' => (string)$application->id,
                    'application_uuid' => $application->uuid,
                    'rule_id' => (string)$rule->id,
                ],
            ], 6, 2),
        ];
    }
    
    /**
     * Build filter for geo-blocklist
     */
    private function buildGeoBlocklistFilter(array $countryCodes): string
    {
        // Filter: block if country matches any in the list
        $quotedCodes = array_map(fn($code) => "'{$code}'", $countryCodes);
        $codesList = implode(', ', $quotedCodes);
        
        return "evt.Enriched.IsoCode in [{$codesList}]";
    }
    
    /**
     * Build filter for geo-allowlist
     */
    private function buildGeoAllowlistFilter(array $countryCodes): string
    {
        // Filter: block if country does NOT match any in the list
        $quotedCodes = array_map(fn($code) => "'{$code}'", $countryCodes);
        $codesList = implode(', ', $quotedCodes);
        
        return "evt.Enriched.IsoCode not in [{$codesList}]";
    }
    
    /**
     * Generate all scenario files for an application
     */
    public function generateScenarioFiles(FirewallConfig $config): array
    {
        $rules = $config->rules()->enabled()->get();
        $scenarios = $this->generateScenarios($rules, $config);
        
        $files = [];
        foreach ($scenarios as $scenario) {
            $files[$scenario['filename']] = $scenario['content'];
        }
        
        return $files;
    }
    
    /**
     * Check if GeoIP enrichment is enabled on server
     */
    public function isGeoIPEnabled($server): bool
    {
        try {
            // Check if GeoIP parser is installed
            $result = instant_remote_process([
                'docker exec crowdsec cscli parsers list -o json | grep -i geoip || echo "not_found"'
            ], $server);
            
            return !str_contains($result, 'not_found');
            
        } catch (\Exception $e) {
            return false;
        }
    }
    
    /**
     * Install GeoIP enrichment on server
     */
    public function installGeoIPEnrichment($server): bool
    {
        try {
            // Install GeoIP parser collection
            instant_remote_process([
                'docker exec crowdsec cscli parsers install crowdsecurity/geoip-enrich',
                'docker exec crowdsec cscli parsers install crowdsecurity/dateparse-enrich',
                'docker exec crowdsec kill -SIGHUP 1', // Reload CrowdSec
            ], $server);
            
            ray('✅ GeoIP enrichment installed');
            return true;
            
        } catch (\Exception $e) {
            ray('❌ Failed to install GeoIP enrichment: ' . $e->getMessage());
            return false;
        }
    }
}
