<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Pipeline Settings | Coolify
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

<div class="min-h-screen bg-[#0a0a0a] text-white">
    {{-- Header --}}
    <div class="border-b border-gray-800 bg-[#0f0f0f] px-6 py-4 mb-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold">Pipeline Settings</h1>
                <p class="text-sm text-gray-400 mt-1">{{ $application->name }}</p>
            </div>
            <button wire:click="saveSettings" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition">
                Save Changes
            </button>
        </div>
    </div>

    {{-- Tabs Navigation --}}
    <div class="px-6 mb-6">
        <div class="flex gap-1 border-b border-gray-800">
            <a href="{{ route('project.application.pipeline', $parameters) }}" 
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition">
                Overview
            </a>
            <a href="{{ route('project.application.pipeline.executions', $parameters) }}" 
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition">
                Runs
            </a>
            <a href="{{ route('project.application.pipeline.settings', $parameters) }}" 
               class="px-4 py-3 text-sm font-medium text-white border-b-2 border-blue-500 -mb-px">
                Settings
            </a>
        </div>
    </div>

    {{-- Settings Content --}}
    <div class="px-6 space-y-6">
        
        {{-- General Settings --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                General
            </h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Pipeline Name</label>
                    <input type="text" wire:model="pipelineName" value="Main Pipeline" 
                           class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Trigger Branches</label>
                    <input type="text" wire:model="triggerBranches" value="main, develop" 
                           class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition">
                    <p class="text-xs text-gray-500 mt-2">Separate multiple branches with commas</p>
                </div>
                
                <div>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" wire:model="autoCancel" checked class="rounded">
                        <span class="text-sm">Auto-cancel redundant builds</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1 ml-6">Cancel running builds when new commits are pushed</p>
                </div>
            </div>
        </div>

        {{-- SonarQube Configuration --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                SonarQube Configuration
            </h3>
            
            <div class="space-y-4">
                <div>
                    <label class="flex items-center gap-2 mb-4">
                        <input type="checkbox" wire:model="sonarqubeEnabled" checked class="rounded">
                        <span class="text-sm font-medium">Enable SonarQube code quality analysis</span>
                    </label>
                </div>
                
                @if($sonarqubeEnabled ?? true)
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">SonarQube Server</label>
                        <select wire:model="sonarqubeServerId" class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition">
                            <option value="">Select SonarQube Server</option>
                            <option value="1">SonarCloud (sonarcloud.io)</option>
                            <option value="2">Company SonarQube (sonar.company.com)</option>
                            <option value="3">Local SonarQube (localhost:9000)</option>
                        </select>
                        <a href="#" class="inline-block text-sm text-blue-400 hover:text-blue-300 mt-2 transition">
                            + Add new SonarQube server
                        </a>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Quality Gate</label>
                        <select wire:model="qualityGate" class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition">
                            <option value="default">Default Quality Gate</option>
                            <option value="strict">Strict Quality Gate</option>
                            <option value="relaxed">Relaxed Quality Gate</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" wire:model="failOnQualityGate" checked class="rounded">
                            <span class="text-sm">Fail build if Quality Gate fails</span>
                        </label>
                    </div>
                @endif
            </div>
        </div>

        {{-- Trivy Configuration --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                Trivy Security Scan
            </h3>
            
            <div class="space-y-4">
                <div>
                    <label class="flex items-center gap-2 mb-4">
                        <input type="checkbox" wire:model="trivyEnabled" checked class="rounded">
                        <span class="text-sm font-medium">Enable Trivy security scanning</span>
                    </label>
                </div>
                
                @if($trivyEnabled ?? true)
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-3">Scan Types</label>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2">
                                <input type="checkbox" wire:model="trivyScanTypes" value="vuln" checked class="rounded">
                                <span class="text-sm">Vulnerabilities</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" wire:model="trivyScanTypes" value="secret" checked class="rounded">
                                <span class="text-sm">Secrets</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" wire:model="trivyScanTypes" value="config" checked class="rounded">
                                <span class="text-sm">Misconfigurations</span>
                            </label>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-3">Severity Levels</label>
                        <div class="flex flex-wrap gap-2">
                            <label class="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg cursor-pointer hover:bg-red-500/20 transition">
                                <input type="checkbox" wire:model="trivySeverity" value="CRITICAL" checked class="rounded">
                                <span class="text-sm text-red-400 font-medium">CRITICAL</span>
                            </label>
                            <label class="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg cursor-pointer hover:bg-orange-500/20 transition">
                                <input type="checkbox" wire:model="trivySeverity" value="HIGH" checked class="rounded">
                                <span class="text-sm text-orange-400 font-medium">HIGH</span>
                            </label>
                            <label class="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg cursor-pointer hover:bg-yellow-500/20 transition">
                                <input type="checkbox" wire:model="trivySeverity" value="MEDIUM" class="rounded">
                                <span class="text-sm text-yellow-400 font-medium">MEDIUM</span>
                            </label>
                            <label class="flex items-center gap-2 px-3 py-2 bg-gray-500/10 border border-gray-500/30 rounded-lg cursor-pointer hover:bg-gray-500/20 transition">
                                <input type="checkbox" wire:model="trivySeverity" value="LOW" class="rounded">
                                <span class="text-sm text-gray-400 font-medium">LOW</span>
                            </label>
                        </div>
                    </div>
                    
                    <div>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" wire:model="failOnCritical" checked class="rounded">
                            <span class="text-sm">Fail build if CRITICAL vulnerabilities found</span>
                        </label>
                    </div>
                @endif
            </div>
        </div>

        {{-- Notifications --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
                Notifications
            </h3>
            
            <div class="space-y-6">
                {{-- Slack --}}
                <div>
                    <label class="flex items-center gap-2 mb-3">
                        <input type="checkbox" wire:model="notificationsEnabled.slack" class="rounded">
                        <span class="font-medium">Slack</span>
                    </label>
                    
                    @if($notificationsEnabled['slack'] ?? false)
                        <div class="space-y-3 ml-6">
                            <div>
                                <label class="block text-sm text-gray-400 mb-2">Webhook URL</label>
                                <input type="url" wire:model="notifications.slack.webhook_url" 
                                       placeholder="https://hooks.slack.com/services/..." 
                                       class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-400 mb-2">Channel</label>
                                <input type="text" wire:model="notifications.slack.channel" 
                                       placeholder="#deployments" 
                                       class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition">
                            </div>
                        </div>
                    @endif
                </div>
                
                {{-- Discord --}}
                <div>
                    <label class="flex items-center gap-2 mb-3">
                        <input type="checkbox" wire:model="notificationsEnabled.discord" class="rounded">
                        <span class="font-medium">Discord</span>
                    </label>
                    
                    @if($notificationsEnabled['discord'] ?? false)
                        <div class="ml-6">
                            <label class="block text-sm text-gray-400 mb-2">Webhook URL</label>
                            <input type="url" wire:model="notifications.discord.webhook_url" 
                                   placeholder="https://discord.com/api/webhooks/..." 
                                   class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition">
                        </div>
                    @endif
                </div>
                
                {{-- Email --}}
                <div>
                    <label class="flex items-center gap-2 mb-3">
                        <input type="checkbox" wire:model="notificationsEnabled.email" class="rounded">
                        <span class="font-medium">Email</span>
                    </label>
                    
                    @if($notificationsEnabled['email'] ?? false)
                        <div class="ml-6">
                            <label class="block text-sm text-gray-400 mb-2">Recipients</label>
                            <input type="text" wire:model="notifications.email.recipients" 
                                   placeholder="dev@example.com, ops@example.com" 
                                   class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition">
                            <p class="text-xs text-gray-500 mt-2">Separate multiple emails with commas</p>
                        </div>
                    @endif
                </div>
                
                {{-- Notification Events --}}
                <div class="pt-4 border-t border-gray-800">
                    <label class="block text-sm font-medium text-gray-300 mb-3">Notify on</label>
                    <div class="space-y-2">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" wire:model="notifyOn" value="success" class="rounded">
                            <span class="text-sm">Successful builds</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" wire:model="notifyOn" value="failure" checked class="rounded">
                            <span class="text-sm">Failed builds</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" wire:model="notifyOn" value="cancelled" class="rounded">
                            <span class="text-sm">Cancelled builds</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        {{-- Advanced Settings --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                </svg>
                Advanced
            </h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Timeout (minutes)</label>
                    <input type="number" wire:model="timeout" value="60" min="5" max="120"
                           class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition">
                    <p class="text-xs text-gray-500 mt-2">Maximum time allowed for pipeline execution</p>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Concurrency</label>
                    <select wire:model="concurrency" class="w-full bg-[#151b2e] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition">
                        <option value="1">1 (Sequential)</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="5">5</option>
                    </select>
                    <p class="text-xs text-gray-500 mt-2">Maximum number of concurrent pipeline runs</p>
                </div>
                
                <div>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" wire:model="retryOnFailure" class="rounded">
                        <span class="text-sm">Retry failed jobs automatically</span>
                    </label>
                </div>
            </div>
        </div>

        {{-- Save Button --}}
        <div class="flex items-center justify-end gap-3 pb-8">
            <button wire:click="resetSettings" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition">
                Reset to Defaults
            </button>
            <button wire:click="saveSettings" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition">
                Save Changes
            </button>
        </div>
    </div>
</div>
</div>
