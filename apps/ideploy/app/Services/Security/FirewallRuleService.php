<?php

namespace App\Services\Security;

use App\Models\FirewallRule;
use App\Models\FirewallConfig;
use App\Models\Application;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FirewallRuleService
{
    public function __construct(
        private YAMLGeneratorService $yamlGenerator
    ) {}
    
    /**
     * Create a new firewall rule
     */
    public function createRule(FirewallConfig $config, array $data): FirewallRule
    {
        return DB::transaction(function () use ($config, $data) {
            // Create rule
            $rule = $config->rules()->create([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'enabled' => $data['enabled'] ?? true,
                'priority' => $data['priority'] ?? $this->getNextPriority($config),
                'rule_type' => $data['rule_type'] ?? 'inband',
                'protection_mode' => $data['protection_mode'] ?? 'ip_ban',
                'conditions' => $data['conditions'],
                'logical_operator' => $data['logical_operator'] ?? 'AND',
                'action' => $data['action'] ?? 'block',
                'remediation_duration' => $data['remediation_duration'] ?? 3600,
                'capacity' => $data['capacity'] ?? 1,
            ]);
            
            // Deploy rule to CrowdSec (Observers don't fire in transactions)
            app(\App\Services\Security\FirewallRulesDeploymentService::class)->deployRules($config);
            
            return $rule->fresh();
        });
    }
    
    /**
     * Update an existing rule
     */
    public function updateRule(FirewallRule $rule, array $data): FirewallRule
    {
        return DB::transaction(function () use ($rule, $data) {
            $rule->update([
                'name' => $data['name'] ?? $rule->name,
                'description' => $data['description'] ?? $rule->description,
                'enabled' => $data['enabled'] ?? $rule->enabled,
                'priority' => $data['priority'] ?? $rule->priority,
                'rule_type' => $data['rule_type'] ?? $rule->rule_type,
                'conditions' => $data['conditions'] ?? $rule->conditions,
                'logical_operator' => $data['logical_operator'] ?? $rule->logical_operator,
                'action' => $data['action'] ?? $rule->action,
                'remediation_duration' => $data['remediation_duration'] ?? $rule->remediation_duration,
            ]);
            
            // Regenerate YAML if conditions changed
            if (isset($data['conditions']) || isset($data['action']) || isset($data['name'])) {
                $this->yamlGenerator->generateAndStore($rule);
            }
            
            return $rule->fresh();
        });
    }
    
    /**
     * Delete a rule
     */
    public function deleteRule(FirewallRule $rule): bool
    {
        return $rule->delete();
    }
    
    /**
     * Toggle rule enabled/disabled
     */
    public function toggleRule(FirewallRule $rule): FirewallRule
    {
        $rule->update(['enabled' => !$rule->enabled]);
        return $rule->fresh();
    }
    
    /**
     * Reorder rules by priority
     */
    public function reorderRules(FirewallConfig $config, array $ruleIds): void
    {
        DB::transaction(function () use ($config, $ruleIds) {
            $priority = 1;
            foreach ($ruleIds as $ruleId) {
                $config->rules()->where('id', $ruleId)->update([
                    'priority' => $priority++,
                ]);
            }
        });
    }
    
    /**
     * Duplicate a rule
     */
    public function duplicateRule(FirewallRule $rule): FirewallRule
    {
        $newRule = $rule->replicate();
        $newRule->name = $rule->name . ' (Copy)';
        $newRule->priority = $this->getNextPriority($rule->config);
        $newRule->match_count = 0;
        $newRule->last_match_at = null;
        $newRule->save();
        
        // Generate YAML for new rule
        $this->yamlGenerator->generateAndStore($newRule);
        
        return $newRule;
    }
    
    /**
     * Get rules by type
     */
    public function getRulesByType(FirewallConfig $config, string $type): Collection
    {
        return $config->rules()
            ->where('rule_type', $type)
            ->ordered()
            ->get();
    }
    
    /**
     * Get enabled rules only
     */
    public function getEnabledRules(FirewallConfig $config): Collection
    {
        return $config->rules()
            ->enabled()
            ->ordered()
            ->get();
    }
    
    /**
     * Bulk enable/disable rules
     */
    public function bulkToggle(FirewallConfig $config, array $ruleIds, bool $enabled): int
    {
        return $config->rules()
            ->whereIn('id', $ruleIds)
            ->update(['enabled' => $enabled]);
    }
    
    /**
     * Bulk delete rules
     */
    public function bulkDelete(FirewallConfig $config, array $ruleIds): int
    {
        return $config->rules()
            ->whereIn('id', $ruleIds)
            ->delete();
    }
    
    /**
     * Get rule statistics
     */
    public function getRuleStats(FirewallRule $rule): array
    {
        return [
            'total_matches' => $rule->match_count,
            'last_match' => $rule->last_match_at?->diffForHumans(),
            'effectiveness' => $this->calculateEffectiveness($rule),
            'recent_matches' => $this->getRecentMatches($rule, 7),
        ];
    }
    
    /**
     * Calculate rule effectiveness (matches per day)
     */
    private function calculateEffectiveness(FirewallRule $rule): float
    {
        if (!$rule->created_at) {
            return 0.0;
        }
        
        $daysActive = max(1, $rule->created_at->diffInDays(now()));
        return round($rule->match_count / $daysActive, 2);
    }
    
    /**
     * Get recent matches for a rule
     */
    private function getRecentMatches(FirewallRule $rule, int $days): int
    {
        return $rule->trafficLogs()
            ->where('timestamp', '>=', now()->subDays($days))
            ->count();
    }
    
    /**
     * Get next available priority
     */
    private function getNextPriority(FirewallConfig $config): int
    {
        $maxPriority = $config->rules()->max('priority');
        return ($maxPriority ?? 0) + 10;
    }
    
    /**
     * Import rules from template
     */
    public function importFromTemplate(FirewallConfig $config, string $template): Collection
    {
        $templates = $this->getTemplates();
        
        if (!isset($templates[$template])) {
            throw new \InvalidArgumentException("Template not found: {$template}");
        }
        
        $rules = collect();
        
        foreach ($templates[$template]['rules'] as $ruleData) {
            $rules->push($this->createRule($config, $ruleData));
        }
        
        return $rules;
    }
    
    /**
     * Get predefined rule templates
     */
    public function getTemplates(): array
    {
        return [
            'basic_protection' => [
                'name' => 'Basic Protection',
                'description' => 'Essential security rules',
                'rules' => [
                    [
                        'name' => 'Block Admin Access',
                        'description' => 'Prevent unauthorized access to admin paths',
                        'conditions' => [
                            ['field' => 'request_path', 'operator' => 'starts_with', 'value' => '/admin'],
                        ],
                        'action' => 'block',
                    ],
                    [
                        'name' => 'Block SQL Injection',
                        'description' => 'Detect SQL injection patterns',
                        'conditions' => [
                            ['field' => 'query_parameter', 'operator' => 'regex', 'value' => '(?i)(union.*select|insert.*into)'],
                        ],
                        'action' => 'block',
                    ],
                ],
            ],
            'api_protection' => [
                'name' => 'API Protection',
                'description' => 'Protect API endpoints',
                'rules' => [
                    [
                        'name' => 'Require API Key',
                        'description' => 'Block API requests without key',
                        'conditions' => [
                            ['field' => 'request_path', 'operator' => 'starts_with', 'value' => '/api'],
                            ['field' => 'header', 'operator' => 'not_contains', 'value' => 'X-Api-Key'],
                        ],
                        'logical_operator' => 'AND',
                        'action' => 'block',
                    ],
                ],
            ],
            'bot_protection' => [
                'name' => 'Bot Protection',
                'description' => 'Block malicious bots',
                'rules' => [
                    [
                        'name' => 'Block Bad Bots',
                        'description' => 'Block known malicious user agents',
                        'conditions' => [
                            ['field' => 'user_agent', 'operator' => 'regex', 'value' => '(bot|crawler|spider|scraper)'],
                        ],
                        'action' => 'block',
                    ],
                ],
            ],
        ];
    }
    
    /**
     * Validate rule conditions
     */
    public function validateConditions(array $conditions): bool
    {
        if (empty($conditions)) {
            return false;
        }
        
        foreach ($conditions as $condition) {
            if (!isset($condition['field']) || !isset($condition['operator']) || !isset($condition['value'])) {
                return false;
            }
        }
        
        return true;
    }
}
