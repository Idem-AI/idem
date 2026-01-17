<?php

namespace App\Services\Security;

use App\Models\FirewallConfig;
use App\Models\FirewallRule;
use Illuminate\Support\Collection;
use Symfony\Component\Yaml\Yaml;

/**
 * Generate CrowdSec Scenarios for Custom Rules
 * 
 * CrowdSec Scenarios are the ONLY way to load custom rules without the hub system.
 * They use CrowdSec's expression language to analyze HTTP requests and make decisions.
 * 
 * Workflow:
 * 1. UI Rule → Scenario YAML
 * 2. Upload to /etc/crowdsec/scenarios/
 * 3. CrowdSec auto-detects and loads
 * 4. Scenarios analyze traffic and ban IPs
 * 
 * Supported:
 * - Path blocking (/fr/home, /admin, etc.)
 * - IP whitelisting/blacklisting
 * - User-Agent filtering (bots, crawlers)
 * - Header-based rules
 * - Method restrictions (block POST, PUT, etc.)
 * - Geo-blocking (with GeoIP enrichment)
 */
class ScenarioGeneratorService
{
    /**
     * Generate scenarios for rules with ip_ban or hybrid protection mode
     * 
     * Converts UI rules to CrowdSec Scenarios with leaky bucket
     */
    public function generateScenarios(Collection $rules, FirewallConfig $config): array
    {
        $scenarios = [];
        
        foreach ($rules as $rule) {
            if (!$rule->enabled) {
                continue;
            }
            
            // Only generate scenarios for ip_ban and hybrid modes
            if (!in_array($rule->protection_mode, ['ip_ban', 'hybrid'])) {
                continue;
            }
            
            // Generate scenario with leaky bucket
            $scenario = $this->generateScenario($rule, $config);
            if ($scenario) {
                $scenarios[] = $scenario;
            }
        }
        
        return $scenarios;
    }
    
    /**
     * Generate a scenario with leaky bucket for ip_ban and hybrid modes
     */
    private function generateScenario(FirewallRule $rule, FirewallConfig $config): ?array
    {
        $application = $config->application;
        
        // Build filter expression from conditions
        $filter = $this->buildFilterExpression($rule->conditions, $rule->logical_operator);
        
        if (!$filter) {
            ray("⚠️ Could not build filter for rule: {$rule->name}");
            return null;
        }
        
        $scenarioName = $this->generateScenarioName($rule, $application);
        $blackholeDuration = $this->getBlackholeDuration($rule);
        
        // Build leaky bucket scenario
        $scenario = [
            'type' => 'leaky',
            'name' => $scenarioName,
            'description' => $rule->description ?: "Custom rule: {$rule->name} (IP ban on abuse)",
            'filter' => $filter,
            'groupby' => 'evt.Meta.source_ip',
            'capacity' => $rule->capacity ?? 1,
            'leakspeed' => $rule->leakspeed ?? '10s',
            'blackhole' => $blackholeDuration,
            'labels' => [
                'service' => 'http',
                'type' => 'custom_block',
                'remediation' => true,
                'protection_mode' => $rule->protection_mode,
                'application_id' => (string)$application->id,
                'application_uuid' => $application->uuid,
                'rule_id' => (string)$rule->id,
                'rule_name' => $rule->name,
            ],
        ];
        
        return [
            'filename' => "custom-{$rule->id}.yaml",
            'content' => Yaml::dump($scenario, 6, 2),
        ];
    }
    
    /**
     * Build CrowdSec filter expression from UI conditions
     * 
     * Converts UI conditions to CrowdSec expression language
     * Examples:
     * - UI: path equals "/fr/home"
     * - Scenario: evt.Parsed.request_path == "/fr/home"
     * 
     * - UI: user_agent contains "bot"
     * - Scenario: evt.Parsed.http_user_agent contains "bot"
     */
    private function buildFilterExpression(array $conditions, string $logicalOperator = 'AND'): ?string
    {
        $expressions = [];
        
        // Filter only on HTTP traffic (Traefik parser sets this)
        $expressions[] = 'evt.Meta.service == "http"';
        
        foreach ($conditions as $condition) {
            $expr = $this->buildSingleCondition($condition);
            if ($expr) {
                $expressions[] = $expr;
            }
        }
        
        if (empty($expressions)) {
            return null;
        }
        
        // Join with logical operator
        $operator = strtoupper($logicalOperator) === 'OR' ? ' or ' : ' and ';
        return implode($operator, $expressions);
    }
    
    /**
     * Build single condition expression
     * 
     * Maps UI fields/operators to CrowdSec expression language
     */
    private function buildSingleCondition(array $condition): ?string
    {
        $field = $condition['field'] ?? null;
        $operator = $condition['operator'] ?? null;
        $value = $condition['value'] ?? null;
        
        if (!$field || !$operator) {
            return null;
        }
        
        // Map UI field to CrowdSec parsed field
        $crowdsecField = $this->mapFieldToCrowdSec($field);
        
        // Build expression based on operator
        return $this->buildOperatorExpression($crowdsecField, $operator, $value);
    }
    
    /**
     * Map UI field names to CrowdSec parsed fields
     */
    private function mapFieldToCrowdSec(string $field): string
    {
        return match($field) {
            'request_path' => 'evt.Parsed.request',  // Traefik JSON: RequestPath field
            'uri_full' => 'evt.Parsed.uri',
            'method' => 'evt.Parsed.verb',  // Traefik parser uses 'verb' not 'method'
            'user_agent' => 'evt.Parsed.http_user_agent',
            'ip_address' => 'evt.Meta.source_ip',
            'host' => 'evt.Meta.target_fqdn',  // Traefik parser uses evt.Meta.target_fqdn
            'referer' => 'evt.Parsed.http_referer',
            'protocol' => 'evt.Parsed.http_version',
            'query_parameter' => 'evt.Parsed.uri',  // Full URI includes query
            'country_code' => 'evt.Enriched.IsoCode',
            default => "evt.Parsed.{$field}",
        };
    }
    
    /**
     * Build operator expression
     */
    private function buildOperatorExpression(string $field, string $operator, $value): string
    {
        // For regex, don't escape - CrowdSec handles regex as-is
        // For other operators, escape quotes only
        $escapedValue = $operator === 'regex' ? $value : str_replace('"', '\\"', $value);
        
        return match($operator) {
            'equals' => "{$field} == \"{$escapedValue}\"",
            'not_equals' => "{$field} != \"{$escapedValue}\"",
            'contains' => "{$field} contains \"{$escapedValue}\"",
            'not_contains' => "!({$field} contains \"{$escapedValue}\")",
            'startsWith', 'starts_with' => "{$field} startsWith \"{$escapedValue}\"",
            'endsWith', 'ends_with' => "{$field} endsWith \"{$escapedValue}\"",
            'regex' => "{$field} matches '{$escapedValue}'",  // Use single quotes for regex
            'in' => "{$field} in [{$this->buildInList($value)}]",
            'not_in' => "{$field} not in [{$this->buildInList($value)}]",
            'gt' => "{$field} > {$value}",
            'gte' => "{$field} >= {$value}",
            'lt' => "{$field} < {$value}",
            'lte' => "{$field} <= {$value}",
            default => "{$field} == \"{$escapedValue}\"",
        };
    }
    
    /**
     * Build list for IN operator
     */
    private function buildInList($value): string
    {
        $items = is_array($value) ? $value : explode(',', $value);
        $quoted = array_map(fn($item) => "'" . trim($item) . "'", $items);
        return implode(', ', $quoted);
    }
    
    /**
     * Generate scenario name
     */
    private function generateScenarioName(FirewallRule $rule, $application): string
    {
        $sanitized = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $rule->name));
        return "ideploy/{$sanitized}_{$application->uuid}_{$rule->id}";
    }
    
    /**
     * Get blackhole duration (ban duration)
     */
    private function getBlackholeDuration(FirewallRule $rule): string
    {
        // Default 1 hour if not specified
        $duration = $rule->remediation_duration ?? 3600;
        return "{$duration}s";
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
     * 
     * NOUVELLE IMPLÉMENTATION: Utilise ParserGeneratorService pour isolation par app_uuid
     */
    public function generateScenarioFiles(FirewallConfig $config): array
    {
        $parserService = app(ParserGeneratorService::class);
        $files = [];
        
        // Générer scenarios avec isolation par app_uuid
        foreach ($config->rules()->enabled()->get() as $rule) {
            try {
                // Utiliser le nouveau ParserGeneratorService qui inclut l'isolation
                $scenarioYaml = $parserService->generateScenario(
                    $config->application->uuid,
                    $rule->name,
                    $rule->conditions,
                    $rule->action,
                    $rule->id  // Pass rule ID to guarantee unique scenario names
                );
                
                $filename = "rule-{$rule->id}.yaml";
                $files[$filename] = $scenarioYaml;
                
                ray("✅ Generated scenario with app isolation: {$filename}");
                
            } catch (\Exception $e) {
                ray("⚠️ Failed to generate scenario for rule {$rule->id}: " . $e->getMessage());
                // Continue avec les autres règles
            }
        }
        
        // Fallback: Utiliser l'ancienne méthode si aucun scenario généré
        if (empty($files)) {
            ray("⚠️ No scenarios generated with new method, falling back to legacy");
            $rules = $config->rules()->enabled()->get();
            $scenarios = $this->generateScenarios($rules, $config);
            
            foreach ($scenarios as $scenario) {
                $files[$scenario['filename']] = $scenario['content'];
            }
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
