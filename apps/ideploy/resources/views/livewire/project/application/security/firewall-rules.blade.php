<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Rules | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    {{-- Sub-Navigation Tabs --}}
    <div class="mb-6 border-b border-gray-800">
        <nav class="flex gap-1">
            <a href="{{ route('project.application.security.overview', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white">
                Overview
            </a>
            <a href="{{ route('project.application.security.traffic', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white">
                Events
            </a>
            <a href="{{ route('project.application.security.rules', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-white border-b-2 border-blue-500 -mb-px">
                Rules
            </a>
        </nav>
    </div>

    {{-- Header --}}
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-white">Rules</h1>
            <p class="text-sm text-gray-500 mt-1">Configure custom rules to protect your application</p>
        </div>
        
        <div class="flex gap-3">
            <a href="{{ route('project.application.security.overview', $parameters) }}" 
               class="px-4 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-white text-sm hover:bg-gray-900 transition-colors flex items-center gap-2">
                ← Back to Overview
            </a>
            <button wire:click="openCreateModal" class="px-4 py-2 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-medium transition-colors">
                Add New...
            </button>
        </div>
    </div>
    
    {{-- Rules List (Vercel Table Style) --}}
    <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg overflow-hidden">
        @if(count($rules) === 0)
            {{-- Empty State --}}
            <div class="text-center py-20">
                <div class="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-white mb-2">There are no enforced rules</h3>
                <p class="text-sm text-gray-500 mb-6">Create your first custom firewall rule to get started</p>
                <button wire:click="openCreateModal" class="px-4 py-2 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-medium transition-colors">
                    Add New Rule
                </button>
            </div>
        @else
            {{-- Rules Table (Vercel Style) --}}
            <table class="w-full">
                <thead class="bg-[#0f1724]">
                    <tr class="border-b border-gray-800">
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">RULE</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">CONDITIONS</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ACTION</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">MATCHES</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">STATUS</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($rules as $rule)
                        <tr class="border-b border-gray-800 hover:bg-[#151b2e] transition-colors">
                            {{-- Rule Name & Description --}}
                            <td class="px-6 py-4">
                                <div class="flex flex-col">
                                    <span class="text-sm font-medium text-white">{{ $rule['name'] }}</span>
                                    @if($rule['description'])
                                        <span class="text-xs text-gray-500 mt-1">{{ Str::limit($rule['description'], 60) }}</span>
                                    @endif
                                </div>
                            </td>
                            
                            {{-- Conditions --}}
                            <td class="px-6 py-4">
                                <span class="text-sm text-gray-400">{{ count($rule['conditions']) }} condition(s)</span>
                            </td>
                            
                            {{-- Action Badge --}}
                            <td class="px-6 py-4">
                                <span class="px-2.5 py-1 rounded-md text-xs font-medium
                                    @if($rule['action'] === 'block') bg-red-900/30 text-red-400 border border-red-800/50
                                    @elseif($rule['action'] === 'captcha') bg-yellow-900/30 text-yellow-400 border border-yellow-800/50
                                    @elseif($rule['action'] === 'allow') bg-green-900/30 text-green-400 border border-green-800/50
                                    @else bg-blue-900/30 text-blue-400 border border-blue-800/50 @endif">
                                    {{ ucfirst($rule['action']) }}
                                </span>
                            </td>
                            
                            {{-- Matches --}}
                            <td class="px-6 py-4">
                                <span class="text-sm text-gray-400">{{ $rule['match_count'] ?? 0 }}</span>
                            </td>
                            
                            {{-- Status Toggle --}}
                            <td class="px-6 py-4">
                                <button wire:click="toggleRule({{ $rule['id'] }})" 
                                        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                                        {{ $rule['enabled'] ? 'bg-green-600' : 'bg-gray-700' }}">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                        {{ $rule['enabled'] ? 'translate-x-6' : 'translate-x-1' }}">
                                    </span>
                                </button>
                            </td>
                            
                            {{-- Actions --}}
                            <td class="px-6 py-4 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <button wire:click="editRule({{ $rule['id'] }})" 
                                            class="p-1.5 text-gray-400 hover:text-white transition-colors"
                                            title="Edit">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                        </svg>
                                    </button>
                                    <button wire:click="duplicateRule({{ $rule['id'] }})" 
                                            class="p-1.5 text-gray-400 hover:text-white transition-colors"
                                            title="Duplicate">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                        </svg>
                                    </button>
                                    <button wire:click="deleteRule({{ $rule['id'] }})" 
                                            wire:confirm="Are you sure you want to delete this rule?"
                                            class="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                                            title="Delete">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                        </svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </div>
    
    {{-- Create Rule Modal (Vercel Style) --}}
    @if($showCreateModal)
        <div class="fixed inset-0 z-50 overflow-y-auto" x-data="{ show: @entangle('showCreateModal') }" x-show="show" x-cloak>
            {{-- Backdrop --}}
            <div class="fixed inset-0 bg-black/80 transition-opacity" wire:click="closeCreateModal"></div>
            
            {{-- Modal Content --}}
            <div class="flex min-h-full items-center justify-center p-4">
                <div class="relative w-full max-w-2xl bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl transform transition-all" @click.away="$wire.closeCreateModal()">
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <div>
                            <p class="text-xs text-gray-500 mb-1">All Rules</p>
                            <h2 class="text-xl font-semibold text-white">New Rule</h2>
                        </div>
                        <button wire:click="closeCreateModal" class="text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Form --}}
                    <div class="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        {{-- Rule Name --}}
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Name</label>
                            <input wire:model="newRule.name" type="text" placeholder="New Rule" 
                                   class="w-full px-3 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        </div>
                        
                        {{-- Description --}}
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Description <span class="text-gray-500">(Optional)</span></label>
                            <input wire:model="newRule.description" type="text" placeholder="Describe the purpose of this rule" 
                                   class="w-full px-3 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        </div>
                        
                        {{-- Protection Type --}}
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Protection Type</label>
                            <select wire:model="newRule.protection_mode" class="w-full px-3 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="ip_ban">🔒 Block IP Address - Recommended for security threats</option>
                                <option value="path_only">🛡️ Block Request Only - Less restrictive</option>
                                <option value="hybrid">⚡ Maximum Protection - Block IP + Request</option>
                            </select>
                            <p class="text-xs text-gray-500 mt-1.5">
                                <span class="font-medium">Block IP:</span> Completely blocks the visitor's IP address (30 days). 
                                <span class="font-medium">Block Request:</span> Only blocks matching requests. 
                                <span class="font-medium">Maximum:</span> Both protections combined.
                            </p>
                        </div>
                        
                        {{-- Configure Section --}}
                        <div>
                            <h3 class="text-sm font-medium text-gray-300 mb-4">Configure</h3>
                            
                            {{-- Multi-Condition Builder --}}
                            @foreach($newRule['conditions'] as $index => $condition)
                                <div class="bg-[#0f1724] border border-gray-800 rounded-lg p-4 mb-3">
                                    {{-- Condition Header --}}
                                    <div class="flex items-start gap-3 mb-4">
                                        <span class="text-sm text-gray-400 mt-2">{{ $index === 0 ? 'If' : '' }}</span>
                                        <div class="flex-1">
                                            <select wire:model="newRule.conditions.{{ $index }}.field" class="w-full px-3 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                                <option value="request_path">Request Path</option>
                                                <option value="ip_address">IP Address</option>
                                                <option value="user_agent">User Agent</option>
                                                <option value="method">HTTP Method</option>
                                                <option value="host">Host Header</option>
                                                <option value="uri_full">Full URI (with query)</option>
                                                <option value="protocol">HTTP Protocol Version</option>
                                                <option value="query_parameter">Query Parameters</option>
                                            </select>
                                        </div>
                                        @if(count($newRule['conditions']) > 1)
                                            <button wire:click="removeCondition({{ $index }})" class="p-2 hover:bg-gray-800 rounded transition-colors" title="Remove condition">
                                                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                                </svg>
                                            </button>
                                        @endif
                                    </div>
                                    
                                    {{-- Operator --}}
                                    <div class="mb-4">
                                        <select wire:model="newRule.conditions.{{ $index }}.operator" class="w-full px-3 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value="equals">Equals</option>
                                            <option value="not_equals">Not Equals</option>
                                            <option value="contains">Contains</option>
                                            <option value="not_contains">Not Contains</option>
                                            <option value="starts_with">Starts With</option>
                                            <option value="ends_with">Ends With</option>
                                            <option value="regex">Regex (Pattern)</option>
                                            <option value="in_range">In Range (CIDR)</option>
                                            <option value="not_in_range">Not In Range (CIDR)</option>
                                            <option value="libinjection_sql" class="bg-red-900 text-red-200">🛡️ Auto-detect SQL Injection (ML)</option>
                                            <option value="libinjection_xss" class="bg-red-900 text-red-200">🛡️ Auto-detect XSS Attack (ML)</option>
                                            <option value="gt">Greater Than (&gt;)</option>
                                            <option value="gte">Greater or Equal (&gt;=)</option>
                                            <option value="lt">Less Than (&lt;)</option>
                                            <option value="lte">Less or Equal (&lt;=)</option>
                                        </select>
                                    </div>
                                    
                                    {{-- Value --}}
                                    <div>
                                        @if(in_array($condition['operator'] ?? '', ['libinjection_sql', 'libinjection_xss']))
                                            <div class="px-3 py-2 bg-blue-900/20 border border-blue-700 rounded-lg">
                                                <p class="text-xs text-blue-300 mb-1">🤖 Machine Learning Detection</p>
                                                <p class="text-xs text-gray-400">No value needed - automatic detection using libinjection</p>
                                            </div>
                                        @else
                                            <input wire:model="newRule.conditions.{{ $index }}.value" type="text" placeholder="e.g., /admin, 192.168.0.0/16, 1000" 
                                                   class="w-full px-3 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm">
                                        @endif
                                    </div>
                                    
                                    {{-- Transformations (Optional) --}}
                                    <div class="mt-3">
                                        <details class="group">
                                            <summary class="cursor-pointer text-xs text-gray-400 hover:text-gray-300 flex items-center gap-2">
                                                <svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                                </svg>
                                                Advanced: Transformations
                                            </summary>
                                            <div class="mt-2 pl-6 space-y-2">
                                                <label class="flex items-center gap-2 text-xs text-gray-400">
                                                    <input type="checkbox" wire:model="newRule.conditions.{{ $index }}.transform.lowercase" class="rounded bg-gray-700 border-gray-600">
                                                    Lowercase
                                                </label>
                                                <label class="flex items-center gap-2 text-xs text-gray-400">
                                                    <input type="checkbox" wire:model="newRule.conditions.{{ $index }}.transform.urldecode" class="rounded bg-gray-700 border-gray-600">
                                                    URL Decode
                                                </label>
                                                <label class="flex items-center gap-2 text-xs text-gray-400">
                                                    <input type="checkbox" wire:model="newRule.conditions.{{ $index }}.transform.b64decode" class="rounded bg-gray-700 border-gray-600">
                                                    Base64 Decode
                                                </label>
                                                <label class="flex items-center gap-2 text-xs text-gray-400">
                                                    <input type="checkbox" wire:model="newRule.conditions.{{ $index }}.transform.trim" class="rounded bg-gray-700 border-gray-600">
                                                    Trim (remove spaces)
                                                </label>
                                                <label class="flex items-center gap-2 text-xs text-gray-400">
                                                    <input type="checkbox" wire:model="newRule.conditions.{{ $index }}.transform.normalizepath" class="rounded bg-gray-700 border-gray-600">
                                                    Normalize Path
                                                </label>
                                            </div>
                                        </details>
                                    </div>
                                </div>
                                
                                {{-- Logical Operator between conditions --}}
                                @if($index < count($newRule['conditions']) - 1)
                                    <div class="flex justify-center my-3">
                                        <select wire:model="newRule.logical_operator" class="px-4 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-gray-300 text-xs font-medium hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value="AND">AND</option>
                                            <option value="OR">OR</option>
                                        </select>
                                    </div>
                                @endif
                            @endforeach
                            
                            {{-- Add Condition Button --}}
                            <div class="mt-3">
                                <button wire:click="addCondition" type="button" class="w-full px-4 py-2 bg-[#0f1724] border border-gray-800 border-dashed rounded-lg text-gray-400 text-sm font-medium hover:bg-gray-800 hover:border-gray-700 transition-colors">
                                    + Add Condition
                                </button>
                            </div>
                        </div>
                        
                        {{-- Then Action --}}
                        <div>
                            <div class="flex items-center gap-3 mb-4">
                                <span class="text-sm text-gray-400">Then</span>
                                <select wire:model="newRule.action" class="flex-1 px-3 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="block">🚫 Block Access</option>
                                    <option value="log">📝 Log Only (Monitor)</option>
                                </select>
                            </div>
                            <p class="text-xs text-gray-500">
                                <span class="font-medium">Block:</span> Prevents access and applies chosen protection type. 
                                <span class="font-medium">Log:</span> Records activity without blocking.
                            </p>
                        </div>
                    </div>
                    
                    {{-- Footer --}}
                    <div class="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-[#0f0f0f]">
                        <p class="text-xs text-gray-500">Rule will be activated immediately after saving</p>
                        <div class="flex gap-3">
                            <button wire:click="closeCreateModal" class="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                                Cancel
                            </button>
                            <button wire:click="saveRule" class="px-4 py-2 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-medium transition-colors">
                                Save Rule
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @endif
</div>
