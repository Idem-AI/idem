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
    public function generateAppSecConfig(FirewallConfig $config, $application): string
    {
        $inbandRules = $this->getInbandRules($config, $application);
        $outofbandRules = $this->getOutofbandRules($config);
        
        // Manual YAML generation to ensure empty arrays render as []
        $yaml = "name: ideploy/app-{$application->uuid}\n";
        $yaml .= "default_remediation: ban\n";
        $yaml .= "default_pass_action: allow\n";
        
        // CRITICAL: Force empty array syntax []
        if (empty($inbandRules)) {
            $yaml .= "inband_rules: []\n";
        } else {
            $yaml .= "inband_rules:\n";
            foreach ($inbandRules as $rule) {
                $yaml .= "  - $rule\n";
            }
        }
        
        // Add outofband rules if enabled
        if ($outofbandRules !== null) {
            if (empty($outofbandRules)) {
                $yaml .= "outofband_rules: []\n";
            } else {
                $yaml .= "outofband_rules:\n";
                foreach ($outofbandRules as $rule) {
                    $yaml .= "  - $rule\n";
                }
            }
        }
        
        return $yaml;
    }
    
    /**
     * Get list of inband rules to load
     */
    private function getInbandRules(FirewallConfig $config, $application): array
    {
        $rules = [];
        
        if ($config->inband_enabled) {
            // Only use our custom rules (base CrowdSec rules too strict)
            // Note: crowdsecurity/base-config and vpatch-* are disabled for now
            
            // Add custom AppSec rules file if path_only or hybrid rules exist
            $customRulesCount = $config->rules()
                ->where('enabled', true)
                ->whereIn('protection_mode', ['path_only', 'hybrid'])
                ->count();
                
            if ($customRulesCount > 0) {
                $rules[] = "ideploy/custom-appsec-{$application->uuid}";
            }
        }
        
        return $rules;
    }
    
    /**
     * Get list of outofband rules to load
     */
    private function getOutofbandRules(FirewallConfig $config): ?array
    {
        $rules = [];
        
        if ($config->outofband_enabled) {
            $rules[] = 'crowdsecurity/security-scanner-detection';
            $rules[] = 'crowdsecurity/http-probing';
            return $rules;
        }
        
        // Retourner null si vide pour que YAML génère [] au lieu de {}
        return null;
    }
    
    /**
     * Generate custom AppSec rules file for path_only and hybrid modes
     */
    public function generateCustomAppSecRules(Collection $rules): string
    {
        if ($rules->isEmpty()) {
            return $this->generateEmptyRulesFile();
        }
        
        $application = $rules->first()->config->application;
        
        $yamlData = [
            'name' => "ideploy/custom-appsec-{$application->uuid}",
            'description' => "Custom AppSec rules for {$application->name}",
            'rules' => [],
        ];
        
        foreach ($rules as $rule) {
            $yamlData['rules'][] = $this->convertRuleToAppSecYAML($rule);
        }
        
        return Yaml::dump($yamlData, 6, 2);
    }
    
    /**
     * Generate custom rules file from database rules (legacy)
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
     * Convert a single FirewallRule to AppSec YAML structure
     * Used for path_only and hybrid modes (inline rules)
     */
    public function convertRuleToAppSecYAML(FirewallRule $rule): array
    {
        // Ensure conditions are properly decoded to array
        $conditions = $rule->conditions;
        if (is_string($conditions)) {
            $conditions = json_decode($conditions, true) ?? [];
        }
        
        // Handle single condition object vs array of conditions
        if (isset($conditions['field']) && isset($conditions['operator'])) {
            // Single condition object, wrap in array
            $conditions = [$conditions];
        }
        
        // Filter out empty conditions
        $conditions = array_filter($conditions, function($condition) {
            return !empty($condition) && isset($condition['operator']) && isset($condition['field']);
        });
        
        $yamlRule = [
            'name' => $this->sanitizeRuleName($rule->name),
            'zones' => $this->extractZones($conditions),
        ];
        
        // Add variables for specific headers
        $variables = $this->extractVariables($conditions);
        if (!empty($variables)) {
            $yamlRule['variables'] = $variables;
        }
        
        // Add transforms if needed
        $transforms = $this->getTransforms($conditions);
        if (!empty($transforms)) {
            $yamlRule['transform'] = $transforms;
        }
        
        // Build match pattern
        if (count($conditions) === 1) {
            $yamlRule['match'] = $this->buildSingleMatch($conditions[0]);
        } else {
            $yamlRule['match'] = $this->buildMultipleMatch($conditions, $rule->logical_operator);
        }
        
        // NOTE: inline rules don't support 'action' field
        // Action is defined at config level via default_remediation
        
        return $yamlRule;
    }
    
    /**
     * Convert a single FirewallRule to YAML structure (legacy)
     * Kept for backwards compatibility
     */
    public function convertRuleToYAML(FirewallRule $rule): array
    {
        // Ensure conditions are properly decoded to array
        $conditions = $rule->conditions;
        if (is_string($conditions)) {
            $conditions = json_decode($conditions, true) ?? [];
        }
        
        // Handle single condition object vs array of conditions
        if (isset($conditions['field']) && isset($conditions['operator'])) {
            // Single condition object, wrap in array
            $conditions = [$conditions];
        }
        
        // Filter out empty conditions
        $conditions = array_filter($conditions, function($condition) {
            return !empty($condition) && isset($condition['operator']) && isset($condition['field']);
        });
        
        $yamlRule = [
            'name' => $this->sanitizeRuleName($rule->name),
            'zones' => $this->extractZones($conditions),
        ];
        
        // Add variables for specific headers
        $variables = $this->extractVariables($conditions);
        if (!empty($variables)) {
            $yamlRule['variables'] = $variables;
        }
        
        // Add transforms if needed
        $transforms = $this->getTransforms($conditions);
        if (!empty($transforms)) {
            $yamlRule['transform'] = $transforms;
        }
        
        // Build match pattern
        if (count($conditions) === 1) {
            // Single condition
            $yamlRule['match'] = $this->buildSingleMatch($conditions[0]);
        } else {
            // Multiple conditions with logical operator
            $yamlRule['match'] = $this->buildMultipleMatch($conditions, $rule->logical_operator);
        }
        
        // NOTE: Actions are NOT defined at rule level in CrowdSec AppSec
        // They are defined at config level via default_remediation
        
        return $yamlRule;
    }
    
    /**
     * Extract variables (for HEADERS, ARGS, etc.)
     */
    private function extractVariables(array $conditions): array
    {
        $variables = [];
        
        foreach ($conditions as $condition) {
            $field = $condition['field'] ?? $condition['type'] ?? 'path';
            $var = $this->getVariable($field);
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
            $field = $condition['field'] ?? $condition['type'] ?? 'path';
            $zone = $this->mapFieldToZone($field);
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
        // Defensive programming - ensure operator exists
        if (!isset($condition['operator']) || !$condition['operator']) {
            throw new \InvalidArgumentException('Condition missing operator: ' . json_encode($condition));
        }
        
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
     */
    private function buildMultipleMatch(array $conditions, string $logicalOperator): array
    {
        $matches = [];
        
        foreach ($conditions as $condition) {
            // Ensure condition is array (defensive programming)
            if (is_string($condition)) {
                $condition = json_decode($condition, true) ?? [];
            }
            
            // Skip empty conditions
            if (empty($condition) || !isset($condition['operator']) || !isset($condition['field'])) {
                continue;
            }
            
            $matches[] = $this->buildSingleMatch($condition);
        }
        
        // Si toutes les conditions sont identiques en type, simplifier
        if (count($matches) === 1) {
            return $matches[0];
        }
        
        return [
            'type' => strtolower($logicalOperator), // 'and' or 'or'
            'expressions' => $matches,
        ];
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
            'contains' => 'regex', // FIX: contains doit utiliser regex car on génère un pattern .*value.*
            'starts_with' => 'regex', // FIX: startsWith doit utiliser regex
            'ends_with' => 'regex', // FIX: endsWith doit utiliser regex
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
     * Get AppSec action from rule action
     */
    private function getAppSecAction(string $action): string
    {
        return match($action) {
            'block' => 'ban',
            'captcha' => 'captcha',
            'log' => 'log',
            'allow' => 'allow',
            default => 'ban',
        };
    }
    
    /**
     * Check if rule should generate AppSec rule
     */
    public function shouldGenerateAppSecRule(FirewallRule $rule): bool
    {
        return in_array($rule->protection_mode, ['path_only', 'hybrid']);
    }
    
    /**
     * Check if rule should generate Scenario
     */
    public function shouldGenerateScenario(FirewallRule $rule): bool
    {
        return in_array($rule->protection_mode, ['ip_ban', 'hybrid']);
    }
    
    /**
     * Generate rule and update model
     */
    public function generateAndStore(FirewallRule $rule): void
    {
        // Generate based on protection mode
        if ($this->shouldGenerateAppSecRule($rule)) {
            $yaml = $this->convertRuleToAppSecYAML($rule);
        } else {
            $yaml = $this->convertRuleToYAML($rule);
        }
        
        $rule->generated_yaml = Yaml::dump($yaml, 4, 2);
        $rule->saveQuietly(); // Save without triggering observers
    }
}
