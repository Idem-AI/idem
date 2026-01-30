<?php

namespace App\Services\Security;

use App\Models\FirewallRule;
use App\Models\FirewallConfig;
use Symfony\Component\Yaml\Yaml;

/**
 * Generate AppSec rules for advanced HTTP filtering
 * AppSec mode is more robust than scenarios for:
 * - Path/URL blocking
 * - Header inspection (User-Agent, etc.) 
 * - POST body analysis
 * - Query parameter filtering
 */
class AppSecRuleGeneratorService
{
    /**
     * Generate AppSec config for an application
     */
    public function generateAppSecConfig(FirewallConfig $config): array
    {
        $rules = $config->rules()->enabled()->get();
        $appSecRules = [];
        $configs = [];
        
        foreach ($rules as $rule) {
            if ($this->shouldUseAppSec($rule)) {
                $appSecRule = $this->generateAppSecRule($rule);
                if ($appSecRule) {
                    $appSecRules[] = $appSecRule;
                }
            }
        }
        
        if (!empty($appSecRules)) {
            $configs[] = $this->generateAppSecConfigFile($config, $appSecRules);
        }
        
        return $configs;
    }
    
    /**
     * Check if rule should use AppSec instead of scenarios
     */
    private function shouldUseAppSec(FirewallRule $rule): bool
    {
        $conditions = $rule->conditions;
        if (is_string($conditions)) {
            $conditions = json_decode($conditions, true) ?? [];
        }
        
        foreach ($conditions as $condition) {
            $field = $condition['field'] ?? '';
            
            // These fields work better with AppSec
            if (in_array($field, [
                'path',           // Standard path field
                'request_path',   // Alternative path field
                'uri_full', 
                'query_parameter',
                'post_body',
                'user_agent',
                'referer',
                'method'
            ])) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Generate single AppSec rule in proper CrowdSec format
     */
    private function generateAppSecRule(FirewallRule $rule): ?array
    {
        $ruleConditions = [];
        
        foreach ($rule->conditions as $condition) {
            $field = $condition['field'] ?? '';
            $operator = $condition['operator'] ?? '';
            $value = $condition['value'] ?? '';
            
            $ruleCondition = $this->buildAppSecRuleCondition($field, $operator, $value);
            if ($ruleCondition) {
                $ruleConditions[] = $ruleCondition;
            }
        }
        
        if (empty($ruleConditions)) {
            return null;
        }
        
        // CrowdSec AppSec rule format
        $ruleName = "custom_rule_" . $rule->id . "_" . str_replace([' ', '-', '/'], '_', strtolower($rule->name));
        
        return [
            'name' => "ideploy/{$ruleName}",
            'description' => $rule->description ?: "Generated rule: {$rule->name}",
            'rules' => $ruleConditions,
            'labels' => [
                'type' => 'exploit',
                'service' => 'http',
                'behavior' => 'http:exploit',
                'confidence' => 2,
                'spoofable' => 0,
                'label' => "iDeploy Custom Rule: {$rule->name}",
                'classification' => ['attack.T1190']
            ]
        ];
    }
    
    /**
     * Build individual AppSec rule condition
     */
    private function buildAppSecRuleCondition(string $field, string $operator, string $value): ?array
    {
        $zones = $this->mapFieldToAppSecZones($field);
        if (empty($zones)) {
            return null;
        }
        
        $match = $this->buildAppSecMatch($operator, $value);
        if (!$match) {
            return null;
        }
        
        $condition = [
            'zones' => $zones,
            'match' => $match
        ];
        
        // Add variable for specific headers (User-Agent, Referer, etc.)
        $variable = $this->getVariableForField($field);
        if ($variable) {
            $condition['variables'] = [$variable];
        }
        
        // Add transforms if needed
        $transforms = $this->getTransformsForField($field);
        if (!empty($transforms)) {
            $condition['transform'] = $transforms;
        }
        
        return $condition;
    }
    
    /**
     * Map UI field to AppSec zones (CrowdSec standard zones)
     */
    private function mapFieldToAppSecZones(string $field): array
    {
        return match($field) {
            'path' => ['URI'],            // Standard path field
            'request_path' => ['URI'],    // Alternative path field
            'uri_full' => ['URI_FULL'], 
            'query_parameter' => ['ARGS'],
            'post_body' => ['BODY_ARGS'],
            'user_agent' => ['HEADERS'],  // Generic HEADERS + variable
            'referer' => ['HEADERS'],
            'host' => ['HEADERS'],
            'method' => ['METHOD'],
            default => []
        };
    }
    
    /**
     * Get variable name for specific headers
     */
    private function getVariableForField(string $field): ?string
    {
        return match($field) {
            'user_agent' => 'User-Agent',
            'referer' => 'Referer',
            'host' => 'Host',
            default => null
        };
    }
    
    /**
     * Build AppSec match condition
     */
    private function buildAppSecMatch(string $operator, string $value): ?array
    {
        return match($operator) {
            'equals' => ['type' => 'equals', 'value' => $value],
            'not_equals' => ['type' => 'equals', 'value' => $value, 'negate' => true],
            'contains' => ['type' => 'contains', 'value' => $value],
            'not_contains' => ['type' => 'contains', 'value' => $value, 'negate' => true],
            'starts_with', 'startsWith' => ['type' => 'startsWith', 'value' => $value],
            'ends_with', 'endsWith' => ['type' => 'endsWith', 'value' => $value],
            'regex' => ['type' => 'regex', 'value' => $value],
            default => null
        };
    }
    
    /**
     * Get transforms for field
     */
    private function getTransformsForField(string $field): array
    {
        return match($field) {
            'request_path', 'uri_full' => ['lowercase'],
            'user_agent', 'referer' => ['lowercase'],
            default => []
        };
    }
    
    /**
     * Generate complete AppSec config file
     */
    private function generateAppSecConfigFile(FirewallConfig $config, array $rules): array
    {
        $appUuid = $config->application->uuid;
        
        // Generate rule names for AppSec config
        $ruleNames = [];
        foreach ($rules as $rule) {
            $ruleNames[] = $rule['name'];
        }
        
        $configContent = [
            'name' => "ideploy/app-{$appUuid}",
            'default_remediation' => 'ban',
            'default_pass_action' => 'allow',
            'blocked_http_code' => 403,
            'passed_http_code' => 200,
            'inband_rules' => $ruleNames,
            'log_level' => 'info'
        ];
        
        return [
            'filename' => "appsec-config.yaml",
            'content' => Yaml::dump($configContent, 6, 2)
        ];
    }
    
    /**
     * Generate AppSec rules (separate from config)
     */
    public function generateAppSecRules(FirewallConfig $config): array
    {
        $rules = $config->rules()->enabled()->get();
        $appSecRuleFiles = [];
        
        foreach ($rules as $rule) {
            if ($this->shouldUseAppSec($rule)) {
                $appSecRule = $this->generateAppSecRule($rule);
                if ($appSecRule) {
                    $filename = "custom-appsec-{$rule->id}.yaml";
                    
                    $appSecRuleFiles[] = [
                        'filename' => $filename,
                        'content' => Yaml::dump($appSecRule, 6, 2)
                    ];
                }
            }
        }
        
        return $appSecRuleFiles;
    }
}
