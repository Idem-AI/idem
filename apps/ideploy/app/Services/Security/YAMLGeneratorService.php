<?php

namespace App\Services\Security;

use App\Models\FirewallConfig;
use App\Models\FirewallRule;
use Illuminate\Support\Collection;
use Symfony\Component\Yaml\Yaml;

class YAMLGeneratorService
{
    /**
     * Generate complete AppSec configuration file for an application
     */
    public function generateAppSecConfig(FirewallConfig $config): string
    {
        $application = $config->application;
        
        // CrowdSec AppSec config format (minimal working version)
        $yamlConfig = [
            'name' => "ideploy_app_{$application->uuid}",
            
            // Rules to load
            'inband_rules' => $this->getInbandRules($config),
            
            // Default remediation action
            'default_remediation' => $config->default_remediation,
        ];
        
        // Add outofband_rules only if enabled
        $outofbandRules = $this->getOutofbandRules($config);
        if ($outofbandRules !== null) {
            $yamlConfig['outofband_rules'] = $outofbandRules;
        }
        
        return Yaml::dump($yamlConfig, 6, 2);
    }
    
    /**
     * Get list of inband rules to load
     */
    private function getInbandRules(FirewallConfig $config): array
    {
        $rules = [];
        
        if ($config->inband_enabled) {
            // Only use custom rules for this application
            // CrowdSec core rules require installation via cscli
            $rules[] = "ideploy/custom-rules-{$config->application->uuid}";
        }
        
        return $rules;
    }
    
    /**
     * Get list of outofband rules to load
     */
    private function getOutofbandRules(FirewallConfig $config): ?array
    {
        if (!$config->outofband_enabled) {
            // Return null to omit the field entirely from YAML
            return null;
        }
        
        return [
            'crowdsecurity/security-scanner-detection',
            'crowdsecurity/http-probing',
        ];
    }
    
    /**
     * Generate custom rules file from database rules
     */
    public function generateCustomRules(Collection $rules): string
    {
        if ($rules->isEmpty()) {
            return $this->generateEmptyRulesFile();
        }
        
        $application = $rules->first()->config->application;
        
        $yamlData = [
            'name' => "ideploy/custom-rules-{$application->uuid}",
            'description' => "Custom rules created from iDeploy UI for {$application->name}",
            'rules' => [],
        ];
        
        foreach ($rules as $rule) {
            $yamlData['rules'][] = $this->convertRuleToYAML($rule);
        }
        
        return Yaml::dump($yamlData, 6, 2);
    }
    
    /**
     * Generate empty rules file
     */
    private function generateEmptyRulesFile(): string
    {
        return Yaml::dump([
            'name' => 'ideploy/empty-rules',
            'description' => 'Empty rules file',
            'rules' => [],
        ], 4, 2);
    }
    
    /**
     * Convert a single FirewallRule to YAML structure
     * Format simplifié compatible CrowdSec AppSec v2
     */
    public function convertRuleToYAML(FirewallRule $rule): array
    {
        // Utiliser seulement la première condition pour simplifier
        $condition = $rule->conditions[0];
        
        $yamlRule = [
            'name' => $this->sanitizeRuleName($rule->name),
            'zones' => [$this->mapFieldToZone($condition['field'])],
        ];
        
        // Add variables for HEADERS
        if ($this->mapFieldToZone($condition['field']) === 'HEADERS') {
            $variable = $this->getVariableName($condition['field']);
            if ($variable) {
                $yamlRule['variables'] = [$variable];
            }
        }
        
        // Build simple match
        $yamlRule['match'] = $this->buildSingleMatch($condition);
        
        return $yamlRule;
    }
    
    /**
     * Extract variable name from field (for HEADERS)
     */
    private function getVariableName(string $field): ?string
    {
        if ($field === 'user_agent') {
            return 'user-agent';
        }
        if (str_starts_with($field, 'header_')) {
            return str_replace('header_', '', $field);
        }
        return null;
    }
    
    /**
     * Extract variables (for HEADERS, ARGS, etc.)
     */
    private function extractVariables(array $conditions): array
    {
        $variables = [];
        
        foreach ($conditions as $condition) {
            $var = $this->getVariable($condition['field']);
            if ($var && !in_array($var, $variables)) {
                $variables[] = $var;
            }
        }
        
        return $variables;
    }
    
    /**
     * Sanitize rule name for YAML
     */
    private function sanitizeRuleName(string $name): string
    {
        return 'custom_' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $name));
    }
    
    /**
     * Extract CrowdSec zones from UI conditions
     */
    private function extractZones(array $conditions): array
    {
        $zones = [];
        
        foreach ($conditions as $condition) {
            $zone = $this->mapFieldToZone($condition['field']);
            if (!in_array($zone, $zones)) {
                $zones[] = $zone;
            }
        }
        
        return $zones;
    }
    
    /**
     * Map UI field to CrowdSec zone
     */
    private function mapFieldToZone(string $field): string
    {
        return match($field) {
            'request_path' => 'URI',
            'uri_full' => 'URI_FULL',
            'query_parameter' => 'ARGS',
            'post_body' => 'BODY_ARGS',
            'raw_body' => 'RAW_BODY',
            'header' => 'HEADERS',
            'user_agent' => 'HEADERS',
            'ip_address' => 'ADDR',
            'method' => 'METHOD',
            'protocol' => 'PROTOCOL',
            'host' => 'HEADERS',
            'cookie' => 'COOKIES',
            'referer' => 'HEADERS',
            'filenames' => 'FILENAMES',
            'files_size' => 'FILES_TOTAL_SIZE',
            'country_code' => 'ENRICHED', // For geo-blocking (requires GeoIP enrichment)
            default => 'URI',
        };
    }
    
    /**
     * Get variable name for specific headers
     */
    private function getVariable(string $field): ?string
    {
        return match($field) {
            'user_agent' => 'User-Agent',
            'host' => 'Host',
            'referer' => 'Referer',
            default => null,
        };
    }
    
    /**
     * Get transforms for conditions
     */
    private function getTransforms(array $conditions): array
    {
        $transforms = [];
        
        foreach ($conditions as $condition) {
            // Check if user selected transforms
            if (isset($condition['transform']) && is_array($condition['transform'])) {
                foreach ($condition['transform'] as $transformKey => $enabled) {
                    if ($enabled && !in_array($transformKey, $transforms)) {
                        $transforms[] = $transformKey;
                    }
                }
            }
        }
        
        return $transforms;
    }
    
    /**
     * Build match pattern for single condition
     */
    private function buildSingleMatch(array $condition): array
    {
        $matchType = $this->getMatchType($condition['operator']);
        
        // ML-based operators don't need value
        if (in_array($matchType, ['libinjectionSQL', 'libinjectionXSS'])) {
            return ['type' => $matchType];
        }
        
        $pattern = $this->buildPattern($condition['operator'], $condition['value'] ?? '');
        
        return [
            'type' => $matchType,
            'value' => $pattern,
        ];
    }
    
    /**
     * Build match pattern for multiple conditions
     * CrowdSec AppSec ne supporte PAS le format avec 'rules' imbriqué
     * Si plusieurs conditions, on utilise seulement la première pour simplifier
     */
    private function buildMultipleMatch(array $conditions, string $logicalOperator): array
    {
        // Pour l'instant, CrowdSec AppSec ne supporte pas bien les AND/OR complexes
        // Utilisons seulement la première condition comme fallback
        return $this->buildSingleMatch($conditions[0]);
    }
    
    /**
     * Build pattern/value based on operator
     */
    private function buildPattern(string $operator, ?string $value): ?string
    {
        // ML-based operators don't need a value
        if (in_array($operator, ['libinjection_sql', 'libinjection_xss'])) {
            return null;
        }
        
        return match($operator) {
            // Equals - exact match
            'equals' => $value,
            
            // Contains - wrap in .* for partial match
            'contains' => ".*" . preg_quote($value, '/') . ".*",
            
            // String position operators
            'starts_with' => preg_quote($value, '/') . ".*",
            'ends_with' => ".*" . preg_quote($value, '/'),
            
            // Regex - ensure it has wildcards for flexible matching
            'regex' => $this->normalizeRegexPattern($value),
            
            // Numeric comparisons
            'gt', 'gte', 'lt', 'lte' => $value,
            
            // Custom operators - convert to regex
            'not_equals' => '^(?!' . preg_quote($value, '/') . '$)',
            'not_contains' => '^((?!' . preg_quote($value, '/') . ').)*$',
            
            // CIDR
            'in_range', 'not_in_range' => $value,
            
            default => $value,
        };
    }
    
    /**
     * Normalize regex pattern for better matching
     */
    private function normalizeRegexPattern(string $pattern): string
    {
        // If pattern already has anchors or wildcards, use as-is
        if (preg_match('/^(\^|\.|\*)/', $pattern) || preg_match('/(\$|\.|\*)$/', $pattern)) {
            return $pattern;
        }
        
        // Otherwise, wrap in .* for flexible matching
        return ".*{$pattern}.*";
    }
    
    /**
     * Get CrowdSec match type
     */
    private function getMatchType(string $operator): string
    {
        return match($operator) {
            'equals' => 'equals',
            'contains' => 'contains',
            'starts_with' => 'startsWith',
            'ends_with' => 'endsWith',
            'regex' => 'regex',
            'in_range', 'not_in_range' => 'cidr',
            'libinjection_sql' => 'libinjectionSQL',
            'libinjection_xss' => 'libinjectionXSS',
            'gt' => 'gt',
            'gte' => 'gte',
            'lt' => 'lt',
            'lte' => 'lte',
            default => 'regex',
        };
    }
    
    /**
     * Generate rule and update model
     */
    public function generateAndStore(FirewallRule $rule): void
    {
        $yaml = $this->convertRuleToYAML($rule);
        $rule->generated_yaml = Yaml::dump($yaml, 4, 2);
        $rule->saveQuietly(); // Save without triggering observers
    }
}
