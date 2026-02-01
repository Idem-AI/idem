<?php

namespace App\Livewire\Project\Application\Security;

use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallRule;
use App\Services\Security\FirewallRuleService;
use App\Services\Security\FirewallConfigService;
use Livewire\Component;
use Illuminate\Support\Facades\Validator;

class FirewallRules extends Component
{
    public Application $application;
    public ?FirewallConfig $config = null;
    
    public $parameters;
    public $rules = [];
    
    public $showCreateModal = false;
    public $editingRule = null;
    public $showImportModal = false;
    
    // Multi-condition support
    public $newRule = [
        'name' => '',
        'description' => '',
        'rule_type' => 'inband',
        'protection_mode' => 'ip_ban', // ip_ban, path_only, or hybrid
        'conditions' => [
            [
                'field' => 'request_path', 
                'operator' => 'equals', 
                'value' => '',
                'transform' => [
                    'lowercase' => false,
                    'urldecode' => false,
                    'b64decode' => false,
                    'trim' => false,
                    'normalizepath' => false,
                ]
            ]
        ],
        'logical_operator' => 'AND',
        'action' => 'ban',
        'remediation_duration' => 3600,
        'priority' => 100,
    ];
    
    public $availableTemplates = [];
    
    public function mount()
    {
        $project = currentTeam()
            ->projects()
            ->where('uuid', request()->route('project_uuid'))
            ->firstOrFail();
        $environment = $project->environments()
            ->where('uuid', request()->route('environment_uuid'))
            ->firstOrFail();
        $this->application = $environment->applications()
            ->where('uuid', request()->route('application_uuid'))
            ->firstOrFail();
            
        $this->parameters = [
            'project_uuid' => $project->uuid,
            'environment_uuid' => $environment->uuid,
            'application_uuid' => $this->application->uuid,
        ];
        
        $this->loadData();
    }
    
    public function loadData()
    {
        // Load or create firewall config
        $configService = app(FirewallConfigService::class);
        $this->config = $configService->getOrCreateConfig($this->application);
        
        // Load rules
        $this->rules = $this->config->rules()
            ->ordered()
            ->get()
            ->map(fn($rule) => [
                'id' => $rule->id,
                'name' => $rule->name,
                'description' => $rule->description,
                'enabled' => $rule->enabled,
                'priority' => $rule->priority,
                'rule_type' => $rule->rule_type,
                'conditions' => is_string($rule->conditions) ? json_decode($rule->conditions, true) : $rule->conditions,
                'logical_operator' => $rule->logical_operator,
                'action' => $rule->action,
                'match_count' => $rule->match_count,
                'last_match_at' => $rule->last_match_at?->diffForHumans(),
            ])
            ->toArray();
        
        // Load available templates
        $ruleService = app(FirewallRuleService::class);
        $this->availableTemplates = $ruleService->getTemplates();
    }
    
    public function openCreateModal()
    {
        $this->editingRule = null;
        $this->showCreateModal = true;
        $this->resetRuleForm();
    }
    
    public function closeCreateModal()
    {
        $this->showCreateModal = false;
        $this->editingRule = null;
    }
    
    public function resetRuleForm()
    {
        $this->newRule = [
            'name' => '',
            'description' => '',
            'rule_type' => 'inband',
            'protection_mode' => 'ip_ban',
            'conditions' => [
                ['field' => 'request_path', 'operator' => 'equals', 'value' => '']
            ],
            'logical_operator' => 'AND',
            'action' => 'ban',
            'remediation_duration' => 3600,
            'priority' => 100,
        ];
    }
    
    public function addCondition()
    {
        $this->newRule['conditions'][] = [
            'field' => 'request_path',
            'operator' => 'equals',
            'value' => '',
            'transform' => [
                'lowercase' => false,
                'urldecode' => false,
                'b64decode' => false,
                'trim' => false,
                'normalizepath' => false,
            ]
        ];
    }
    
    public function removeCondition($index)
    {
        if (count($this->newRule['conditions']) > 1) {
            unset($this->newRule['conditions'][$index]);
            $this->newRule['conditions'] = array_values($this->newRule['conditions']);
        }
    }
    
    public function saveRule()
    {
        // Validation
        $validator = Validator::make($this->newRule, [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'rule_type' => 'required|in:inband,outofband',
            'protection_mode' => 'required|in:ip_ban,path_only,hybrid',
            'conditions' => 'required|array|min:1',
            'conditions.*.field' => 'required|string',
            'conditions.*.operator' => 'required|string',
            'conditions.*.value' => 'required|string',
            'logical_operator' => 'required|in:AND,OR',
            'action' => 'required|in:ban,block,log,allow,captcha',
            'remediation_duration' => 'required|integer|min:60',
        ]);
        
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->dispatch('error', $error);
            }
            return;
        }
        
        try {
            $ruleService = app(FirewallRuleService::class);
            
            if ($this->editingRule) {
                // Update existing rule
                $rule = FirewallRule::findOrFail($this->editingRule);
                $ruleService->updateRule($rule, $this->newRule);
                $this->dispatch('success', 'Rule updated successfully');
            } else {
                // Create new rule
                $ruleService->createRule($this->config, $this->newRule);
                $this->dispatch('success', 'Rule created successfully');
            }
            
            $this->closeCreateModal();
            $this->loadData();
            
        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to save rule: ' . $e->getMessage());
            ray('Rule save error: ' . $e->getMessage());
        }
    }
    
    public function editRule($ruleId)
    {
        $rule = FirewallRule::findOrFail($ruleId);
        
        $this->editingRule = $rule->id;
        $this->newRule = [
            'name' => $rule->name,
            'description' => $rule->description,
            'rule_type' => $rule->rule_type,
            'protection_mode' => $rule->protection_mode ?? 'ip_ban',
            'conditions' => $rule->conditions,
            'logical_operator' => $rule->logical_operator,
            'action' => $rule->action,
            'remediation_duration' => $rule->remediation_duration,
            'priority' => $rule->priority,
        ];
        
        $this->showCreateModal = true;
    }
    
    public function toggleRule($ruleId)
    {
        try {
            $rule = FirewallRule::findOrFail($ruleId);
            $ruleService = app(FirewallRuleService::class);
            
            $ruleService->toggleRule($rule);
            
            $this->dispatch('success', 'Rule ' . ($rule->enabled ? 'disabled' : 'enabled'));
            $this->loadData();
            
        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to toggle rule: ' . $e->getMessage());
        }
    }
    
    public function deleteRule($ruleId)
    {
        try {
            $rule = FirewallRule::findOrFail($ruleId);
            $ruleService = app(FirewallRuleService::class);
            
            $ruleService->deleteRule($rule);
            
            $this->dispatch('success', 'Rule deleted successfully');
            $this->loadData();
            
        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to delete rule: ' . $e->getMessage());
        }
    }
    
    public function duplicateRule($ruleId)
    {
        try {
            $rule = FirewallRule::findOrFail($ruleId);
            $ruleService = app(FirewallRuleService::class);
            
            $ruleService->duplicateRule($rule);
            
            $this->dispatch('success', 'Rule duplicated successfully');
            $this->loadData();
            
        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to duplicate rule: ' . $e->getMessage());
        }
    }
    
    public function importFromTemplate($templateKey)
    {
        try {
            $ruleService = app(FirewallRuleService::class);
            
            $rules = $ruleService->importFromTemplate($this->config, $templateKey);
            
            $this->dispatch('success', count($rules) . ' rules imported successfully');
            $this->showImportModal = false;
            $this->loadData();
            
        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to import template: ' . $e->getMessage());
        }
    }
    
    public function render()
    {
        return view('livewire.project.application.security.firewall-rules');
    }
}
