<div style="font-family: 'Jura', sans-serif;">
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Rules | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    {{-- Sub-Navigation Tabs --}}
    <div class="mb-6 border-b border-glass">
        <nav class="flex gap-6">
            <a href="{{ route('project.application.security.overview', $parameters) }}"
               class="nav-link">
                Overview
            </a>
            <a href="{{ route('project.application.security.rules', $parameters) }}"
               class="nav-link nav-link-active">
                Rules
            </a>
        </nav>
    </div>

    {{-- Header --}}
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-white tracking-wide">Rules</h1>
            <p class="text-sm text-gray-500 mt-1">Configure custom rules to protect your application</p>
        </div>
        <div class="flex gap-3">
            <a href="{{ route('project.application.security.overview', $parameters) }}"
               class="outer-button button-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
                Back to Overview
            </a>
            <button wire:click="openCreateModal" class="inner-button button-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Add Rule
            </button>
        </div>
    </div>

    {{-- Rules List --}}
    <div class="glass-card border border-glass overflow-hidden">
        @if(count($rules) === 0)
            {{-- Empty State --}}
            <div class="text-center py-20">
                <div class="w-16 h-16 glass border border-glass rounded-full flex items-center justify-center mx-auto mb-5">
                    <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                </div>
                <h3 class="text-base font-semibold text-white mb-2 tracking-wide">There are no enforced rules</h3>
                <p class="text-sm text-gray-500 mb-6">Create your first custom firewall rule to get started</p>
                <button wire:click="openCreateModal" class="inner-button button-sm flex items-center gap-2 mx-auto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add New Rule
                </button>
            </div>
        @else
            {{-- Rules Table --}}
            <table class="w-full">
                <thead class="glass-dark border-b border-glass">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rule</th>
                        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Conditions</th>
                        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Matches</th>
                        <th class="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                        <th class="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-glass">
                    @foreach($rules as $rule)
                        <tr class="hover:bg-white/3 transition-colors duration-150">
                            <td class="px-6 py-4">
                                <div class="flex flex-col">
                                    <span class="text-sm font-semibold text-white tracking-wide">{{ $rule['name'] }}</span>
                                    @if($rule['description'])
                                        <span class="text-xs text-gray-500 mt-1">{{ Str::limit($rule['description'], 60) }}</span>
                                    @endif
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <span class="text-sm text-gray-400">{{ count($rule['conditions']) }} condition(s)</span>
                            </td>
                            <td class="px-6 py-4">
                                <span class="px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide
                                    @if($rule['action'] === 'block') bg-red-900/30 text-red-400 border border-red-800/50
                                    @elseif($rule['action'] === 'captcha') bg-yellow-900/30 text-yellow-400 border border-yellow-800/50
                                    @elseif($rule['action'] === 'allow') bg-green-900/30 text-green-400 border border-green-800/50
                                    @else bg-blue-900/30 text-blue-400 border border-blue-800/50 @endif">
                                    {{ ucfirst($rule['action']) }}
                                </span>
                            </td>
                            <td class="px-6 py-4">
                                <span class="text-sm text-gray-400">{{ $rule['match_count'] ?? 0 }}</span>
                            </td>
                            <td class="px-6 py-4">
                                <button wire:click="toggleRule({{ $rule['id'] }})"
                                        class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
                                        {{ $rule['enabled'] ? 'bg-primary-500' : 'bg-gray-700' }}">
                                    <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow
                                        {{ $rule['enabled'] ? 'translate-x-4' : 'translate-x-1' }}">
                                    </span>
                                </button>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex items-center justify-end gap-1">
                                    <button wire:click="editRule({{ $rule['id'] }})"
                                            class="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                            title="Edit">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                        </svg>
                                    </button>
                                    <button wire:click="duplicateRule({{ $rule['id'] }})"
                                            class="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                            title="Duplicate">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                        </svg>
                                    </button>
                                    <button wire:click="deleteRule({{ $rule['id'] }})"
                                            wire:confirm="Are you sure you want to delete this rule?"
                                            class="p-1.5 text-gray-500 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
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

    {{-- Create Rule Modal — 3-step wizard --}}
    @if($showCreateModal)
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
             x-data="{ step: 1 }"
             x-cloak
             style="font-family: 'Jura', sans-serif;">

            {{-- Backdrop --}}
            <div class="absolute inset-0 bg-black/90 backdrop-blur-sm" wire:click="closeCreateModal"></div>

            {{-- Modal --}}
            <div class="relative w-full max-w-xl glass-card border border-glass shadow-2xl" @click.away="$wire.closeCreateModal()">

                {{-- Header --}}
                <div class="flex items-center justify-between px-6 pt-6 pb-4">
                    <div>
                        <p class="text-xs text-gray-500 tracking-widest uppercase mb-1">Firewall</p>
                        <h2 class="text-xl font-bold text-white tracking-wide">New Rule</h2>
                    </div>
                    <button wire:click="closeCreateModal" class="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {{-- Stepper --}}
                <div class="flex items-center px-8 pb-5">
                    <template x-for="(label, i) in ['Basics', 'Conditions', 'Response']" :key="i">
                        <div class="flex items-center" :class="i < 2 ? 'flex-1' : ''">
                            <div class="flex flex-col items-center">
                                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300"
                                     :class="step > i + 1 ? 'bg-primary-500 text-white shadow-lg shadow-primary/20'
                                           : (step === i + 1 ? 'bg-primary-500 text-white ring-4 ring-primary/20 shadow-lg shadow-primary/20'
                                           : 'bg-gray-800 text-gray-500 border border-gray-700')">
                                    <template x-if="step > i + 1">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                                        </svg>
                                    </template>
                                    <template x-if="step <= i + 1">
                                        <span x-text="i + 1"></span>
                                    </template>
                                </div>
                                <span class="text-[11px] font-semibold mt-1.5 transition-colors duration-300"
                                      :class="step === i + 1 ? 'text-white' : (step > i + 1 ? 'text-primary-400' : 'text-gray-600')"
                                      x-text="label"></span>
                            </div>
                            <template x-if="i < 2">
                                <div class="flex-1 h-px mx-3 -mt-4 transition-colors duration-300"
                                     :class="step > i + 1 ? 'bg-primary-500' : 'bg-gray-700'"></div>
                            </template>
                        </div>
                    </template>
                </div>

                {{-- Divider --}}
                <div class="h-px bg-glass mx-6"></div>

                {{-- ── Step 1: Basics ── --}}
                <div x-show="step === 1" x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 translate-x-2" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="px-6 py-5 flex flex-col gap-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-200 mb-1.5">
                                Name <span class="text-red-400 ml-0.5">*</span>
                            </label>
                            <input wire:model="newRule.name" type="text" placeholder="My Firewall Rule" autofocus
                                   class="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-white text-sm placeholder-gray-600 transition-all focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-200 mb-1.5">
                                Description <span class="text-gray-500 font-normal">(Optional)</span>
                            </label>
                            <input wire:model="newRule.description" type="text" placeholder="Describe the purpose of this rule"
                                   class="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-white text-sm placeholder-gray-600 transition-all focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15">
                        </div>
                        <div class="flex items-start gap-3 px-4 py-3 bg-primary/4 border border-primary/15 rounded-xl">
                            <svg class="w-4 h-4 text-primary/60 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
                            </svg>
                            <p class="text-xs text-gray-400 leading-relaxed">The rule will be <span class="font-semibold text-gray-200">activated immediately</span> after saving.</p>
                        </div>
                    </div>
                    <div class="flex justify-end px-6 pb-6">
                        <button type="button" @click="step = 2" class="inner-button flex items-center gap-2">
                            Continue
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                </div>

                {{-- ── Step 2: Conditions ── --}}
                <div x-show="step === 2" x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 translate-x-2" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="px-6 py-5 flex flex-col gap-3">
                        <div class="flex items-center gap-3 mb-1">
                            <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">If</span>
                            <div class="flex-1 h-px bg-gray-800"></div>
                        </div>

                        @foreach($newRule['conditions'] as $index => $condition)
                            @if($index > 0)
                                <div class="flex justify-center">
                                    <select wire:model="newRule.logical_operator"
                                            class="px-5 py-1.5 bg-gray-900 border border-gray-700/80 rounded-lg text-gray-300 text-xs font-bold tracking-widest uppercase focus:outline-none focus:border-primary/60 appearance-none cursor-pointer text-center">
                                        <option value="AND">AND</option>
                                        <option value="OR">OR</option>
                                    </select>
                                </div>
                            @endif
                            <div class="border border-gray-700/60 bg-gray-900/40 rounded-xl p-4">
                                <div class="grid grid-cols-2 gap-3 mb-3">
                                    <select wire:model="newRule.conditions.{{ $index }}.field"
                                            class="px-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-lg text-white text-sm transition-all focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/15 appearance-none cursor-pointer">
                                        <option value="request_path">Request Path</option>
                                        <option value="ip_address">IP Address</option>
                                        <option value="user_agent">User Agent</option>
                                        <option value="method">HTTP Method</option>
                                        <option value="host">Host Header</option>
                                        <option value="uri_full">Full URI</option>
                                        <option value="protocol">Protocol</option>
                                        <option value="query_parameter">Query Param</option>
                                    </select>
                                    <select wire:model="newRule.conditions.{{ $index }}.operator"
                                            class="px-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-lg text-white text-sm transition-all focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/15 appearance-none cursor-pointer">
                                        <option value="equals">Equals</option>
                                        <option value="not_equals">Not Equals</option>
                                        <option value="contains">Contains</option>
                                        <option value="not_contains">Not Contains</option>
                                        <option value="starts_with">Starts With</option>
                                        <option value="ends_with">Ends With</option>
                                        <option value="regex">Regex</option>
                                        <option value="in_range">In Range (CIDR)</option>
                                        <option value="not_in_range">Not In Range</option>
                                        <option value="libinjection_sql">SQL Injection (ML)</option>
                                        <option value="libinjection_xss">XSS Attack (ML)</option>
                                        <option value="gt">Greater Than</option>
                                        <option value="gte">Greater or Equal</option>
                                        <option value="lt">Less Than</option>
                                        <option value="lte">Less or Equal</option>
                                    </select>
                                </div>
                                @if(in_array($condition['operator'] ?? '', ['libinjection_sql', 'libinjection_xss']))
                                    <div class="px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                                        <p class="text-xs font-semibold text-primary/70 mb-0.5">Machine Learning Detection</p>
                                        <p class="text-xs text-gray-500">No value needed — auto-detection via libinjection</p>
                                    </div>
                                @else
                                    <div class="flex items-center gap-2">
                                        <input wire:model="newRule.conditions.{{ $index }}.value" type="text"
                                               placeholder="e.g., /admin, 192.168.0.0/16"
                                               class="flex-1 px-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-lg text-white text-sm font-mono placeholder-gray-600 transition-all focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/15">
                                        @if(count($newRule['conditions']) > 1)
                                            <button wire:click="removeCondition({{ $index }})"
                                                    class="p-2 text-gray-500 hover:text-danger hover:bg-danger/10 rounded-lg transition-all shrink-0">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                                </svg>
                                            </button>
                                        @endif
                                    </div>
                                @endif
                                <details class="group mt-3">
                                    <summary class="cursor-pointer text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1.5 select-none">
                                        <svg class="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                        </svg>
                                        Transformations
                                    </summary>
                                    <div class="mt-2 pl-4 grid grid-cols-2 gap-1.5">
                                        @foreach(['lowercase' => 'Lowercase', 'urldecode' => 'URL Decode', 'b64decode' => 'Base64 Decode', 'trim' => 'Trim', 'normalizepath' => 'Normalize Path'] as $key => $tLabel)
                                            <label class="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                                                <input type="checkbox" wire:model="newRule.conditions.{{ $index }}.transform.{{ $key }}">
                                                {{ $tLabel }}
                                            </label>
                                        @endforeach
                                    </div>
                                </details>
                            </div>
                        @endforeach

                        <button wire:click="addCondition" type="button"
                                class="w-full px-4 py-2.5 border border-dashed border-gray-700/60 rounded-xl text-gray-500 text-sm font-medium hover:border-primary/40 hover:text-gray-300 hover:bg-primary/5 transition-all duration-200">
                            + Add Condition
                        </button>
                    </div>
                    <div class="flex items-center justify-between px-6 pb-6">
                        <button type="button" @click="step = 1"
                                class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                            </svg>
                            Back
                        </button>
                        <button type="button" @click="step = 3" class="inner-button flex items-center gap-2">
                            Continue
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                </div>

                {{-- ── Step 3: Response ── --}}
                <div x-show="step === 3" x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 translate-x-2" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="px-6 py-5 flex flex-col gap-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-200 mb-1.5">Protection Type</label>
                            <select wire:model="newRule.protection_mode"
                                    class="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-white text-sm transition-all focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 appearance-none cursor-pointer">
                                <option value="ip_ban">Block IP Address — Recommended for security threats</option>
                                <option value="path_only">Block Request Only — Less restrictive</option>
                                <option value="hybrid">Maximum Protection — Block IP + Request</option>
                            </select>
                            <p class="text-xs text-gray-600 mt-2 leading-relaxed">
                                <span class="text-gray-500 font-medium">Block IP:</span> Blocks visitor IP for 30 days.
                                <span class="text-gray-500 font-medium">Request only:</span> Blocks matching requests.
                                <span class="text-gray-500 font-medium">Maximum:</span> Both combined.
                            </p>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-200 mb-1.5">Action</label>
                            <select wire:model="newRule.action"
                                    class="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-white text-sm transition-all focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 appearance-none cursor-pointer">
                                <option value="block">Block Access</option>
                                <option value="log">Log Only (Monitor)</option>
                            </select>
                            <p class="text-xs text-gray-600 mt-2 leading-relaxed">
                                <span class="text-gray-500 font-medium">Block:</span> Prevents access and applies protection type.
                                <span class="text-gray-500 font-medium">Log:</span> Records activity without blocking.
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center justify-between px-6 pb-6">
                        <button type="button" @click="step = 2"
                                class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                            </svg>
                            Back
                        </button>
                        <button wire:click="saveRule" class="inner-button flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                            </svg>
                            Create Rule
                        </button>
                    </div>
                </div>

            </div>
        </div>
    @endif
</div>
