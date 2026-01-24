<div wire:poll.3s="checkActivationStatus">
    {{-- Header --}}
    <div class="mb-6">
        <div class="flex items-center gap-3 mb-1">
            <h1 class="text-2xl font-semibold text-white">Firewall</h1>
            @if($activating)
                <span class="flex items-center gap-2 px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full text-xs font-medium">
                    <svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Activation in progress
                </span>
            @elseif($firewallEnabled)
                <span class="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-medium">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    Protected
                </span>
            @endif
        </div>
        <p class="text-sm text-gray-500">Overview</p>
        {{-- Debug info --}}
        <p class="text-xs text-gray-600 mt-1">App ID: {{ $application->id }} | Logs: {{ count($recentEvents) }} | Config ID: {{ $config->id ?? 'null' }}</p>
    </div>
    
    {{-- Time Range & Actions Bar --}}
    <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-2">
            <select wire:model.live="timeRange" class="px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black">
                <option value="hour">Past Hour</option>
                <option value="day">Past 24h</option>
                <option value="week">Past 7d</option>
            </select>
            
            <select class="px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-md text-white text-sm focus:outline-none">
                <option>Overview</option>
                <option>Traffic</option>
                <option>Rules</option>
            </select>
        </div>
        
        <div class="flex gap-2">
            <button wire:click="openBotManagement" class="px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-md text-white text-sm hover:bg-gray-900 transition-colors flex items-center gap-2">
                🤖 Bot Management
                @if($botProtectionEnabled)
                    <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                @endif
            </button>
            <button class="px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-md text-white text-sm hover:bg-gray-900 transition-colors flex items-center gap-2">
                Review Changes
                <span class="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded">1</span>
            </button>
            <a href="{{ route('project.application.security.rules', $parameters) }}" class="px-3 py-1.5 bg-white hover:bg-gray-100 text-black rounded-md text-sm font-medium transition-colors">
                Add New...
            </a>
        </div>
    </div>

    {{-- Main Grid --}}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {{-- Left Column: Status Cards --}}
        <div class="lg:col-span-1 space-y-6">
            
            {{-- Firewall Status --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
                <div class="flex flex-col items-center py-6">
                    {{-- Icon avec animation pulse si activating --}}
                    <div class="relative w-16 h-16 rounded-full {{ $firewallEnabled ? 'bg-green-500/20' : ($activating ? 'bg-blue-600/20' : 'bg-gray-800') }} flex items-center justify-center mb-4 {{ $activating ? 'animate-pulse' : '' }}">
                        <svg class="w-8 h-8 {{ $firewallEnabled ? 'text-green-500' : ($activating ? 'text-blue-600' : 'text-gray-600') }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                        
                        {{-- Spinning loader si activating --}}
                        @if($activating)
                            <div class="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                        @endif
                    </div>
                    
                    {{-- Status avec badge coloré --}}
                    <div class="flex items-center gap-2 mb-1">
                        <p class="text-lg font-semibold text-white">
                            Firewall is
                        </p>
                        @if($activating)
                            <span class="px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full text-xs font-medium animate-pulse">
                                Activating...
                            </span>
                        @elseif($firewallEnabled)
                            <span class="px-2.5 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-medium">
                                Active
                            </span>
                        @else
                            <span class="px-2.5 py-1 bg-gray-800 text-gray-500 border border-gray-700 rounded-full text-xs font-medium">
                                Inactive
                            </span>
                        @endif
                    </div>
                    
                    <p class="text-sm text-gray-500 mb-4 text-center">
                        @if($activating)
                            Setting up security components...
                            <span class="block text-xs text-gray-600 mt-1">
                                @if($pollCount > 0)
                                    {{ floor($pollCount * 3 / 60) }}m {{ ($pollCount * 3) % 60 }}s elapsed
                                @else
                                    Starting installation...
                                @endif
                            </span>
                        @elseif($firewallEnabled)
                            All systems protected
                        @else
                            Click activate to enable protection
                        @endif
                    </p>
                    
                    @if($activating)
                        <button disabled class="px-4 py-2 bg-blue-600/50 text-white rounded-md text-sm font-medium cursor-not-allowed flex items-center gap-2">
                            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Activating...
                        </button>
                    @elseif(!$crowdSecAvailable)
                        <button wire:click="$set('showInstallModal', true)" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-blue-600/20">
                            Activate Firewall
                        </button>
                    @else
                        <button wire:click="toggleFirewall" class="px-4 py-2 {{ $firewallEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700' }} text-white rounded-md text-sm font-medium transition-colors">
                            {{ $firewallEnabled ? 'Disable' : 'Enable' }} Firewall
                        </button>
                    @endif
                </div>
            </div>
            
            {{-- Bot Protection --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm text-white font-medium">Bot Protection</span>
                    <button wire:click="toggleBotProtection" class="px-2.5 py-1 rounded {{ $botProtectionEnabled ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-gray-800 text-gray-500 border border-gray-700' }} text-xs font-medium transition-colors">
                        {{ $botProtectionEnabled ? 'Active' : 'Inactive' }}
                    </button>
                </div>
                <p class="text-xs text-gray-500">Detect and block bots</p>
            </div>
            
            {{-- Custom Rules --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm text-white font-medium">Custom Rules</span>
                    <span class="text-2xl font-semibold text-white">{{ $customRulesCount }}</span>
                </div>
                <a href="{{ route('project.application.security.rules', $parameters) }}" 
                   class="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                    Manage rules
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </a>
            </div>
            
            {{-- Alerts --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
                <h3 class="text-sm text-white font-medium mb-3">Alerts</h3>
                @if(count($activeAlerts) === 0)
                    <div class="text-center py-6">
                        <div class="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        <p class="text-xs text-gray-500">There are no active alerts</p>
                    </div>
                @else
                    <div class="space-y-2">
                        @foreach($activeAlerts as $alert)
                            <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <p class="text-xs text-red-400 font-medium">{{ $alert['message'] }}</p>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
        </div>
        
        {{-- Right Column: Traffic Stats & Events --}}
        <div class="lg:col-span-2 space-y-6">
            
            {{-- Traffic Logging Warning --}}
            @if($firewallEnabled && !$trafficLoggingEnabled)
                <div class="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
                    <div class="flex items-start gap-3">
                        <svg class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <div class="flex-1">
                            <h4 class="text-sm font-medium text-yellow-300 mb-1">Traffic Logging Not Configured</h4>
                            <p class="text-xs text-yellow-200/80 mb-2">
                                Your firewall is active and protecting your application, but traffic statistics are not being collected yet.
                            </p>
                            <p class="text-xs text-yellow-300/60">
                                💡 Traffic logging will be available soon. Your rules are still enforcing protection.
                            </p>
                        </div>
                    </div>
                </div>
            @endif
            
            {{-- Traffic Stats --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-sm font-medium text-white">Traffic Overview</h3>
                </div>
                
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {{-- All Traffic --}}
                    <div class="bg-[#151b2e] rounded-lg p-3 border border-gray-800">
                        <div class="flex items-center gap-1.5 mb-1">
                            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                            </svg>
                            <span class="text-xs text-gray-400">All Traffic</span>
                        </div>
                        <p class="text-lg font-semibold text-white mb-0.5">{{ number_format($stats['all_traffic']) }}</p>
                        <p class="text-xs text-gray-600">–</p>
                    </div>
                    
                    {{-- Allowed --}}
                    <div class="bg-[#151b2e] rounded-lg p-3 border border-gray-800">
                        <div class="flex items-center gap-1.5 mb-1">
                            <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-xs text-gray-400">Allowed</span>
                        </div>
                        <p class="text-lg font-semibold text-white mb-0.5">{{ number_format($stats['allowed']) }}</p>
                        <p class="text-xs text-gray-600">–</p>
                    </div>
                    
                    {{-- Denied --}}
                    <div class="bg-[#151b2e] rounded-lg p-3 border border-gray-800">
                        <div class="flex items-center gap-1.5 mb-1">
                            <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                            </svg>
                            <span class="text-xs text-gray-400">Denied</span>
                        </div>
                        <p class="text-lg font-semibold text-white mb-0.5">{{ number_format($stats['denied']) }}</p>
                        <p class="text-xs text-gray-600">–</p>
                    </div>
                    
                    {{-- Challenged --}}
                    <div class="bg-[#151b2e] rounded-lg p-3 border border-gray-800">
                        <div class="flex items-center gap-1.5 mb-1">
                            <svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                            <span class="text-xs text-gray-400">Challenged</span>
                        </div>
                        <p class="text-lg font-semibold text-white mb-0.5">{{ number_format($stats['challenged']) }}</p>
                        <p class="text-xs text-gray-600">–</p>
                    </div>
                </div>
                
                {{-- Traffic Chart or Empty State --}}
                <div class="mt-5 p-4 bg-black border border-gray-900 rounded-lg">
                    @if($stats['all_traffic'] === 0 && $firewallEnabled)
                        {{-- Empty State avec instructions --}}
                        <div class="flex flex-col items-center justify-center h-48 py-6">
                            <div class="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
                                <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                </svg>
                            </div>
                            <h4 class="text-sm font-medium text-white mb-2">Waiting for Traffic</h4>
                            <p class="text-xs text-gray-500 text-center mb-4 max-w-md">
                                Traffic data will appear here once requests are made to your application.
                            </p>
                            
                            {{-- Test Command Box --}}
                            @if($customRulesCount > 0)
                                <div class="bg-blue-900/20 border border-blue-800 rounded-lg p-3 max-w-lg">
                                    <p class="text-xs text-blue-300 mb-2 font-medium">💡 Test your firewall protection:</p>
                                    <div class="bg-black/50 rounded p-2 font-mono text-xs text-blue-200">
                                        curl {{ $application->fqdn }}
                                    </div>
                                    @if(count($activeRules) > 0 && $activeRules[0]['action'] === 'block')
                                        <p class="text-xs text-gray-400 mt-2">
                                            Try accessing blocked paths to see the firewall in action!
                                        </p>
                                    @endif
                                </div>
                            @endif
                        </div>
                    @elseif($stats['all_traffic'] > 0)
                        {{-- Traffic Chart avec données --}}
                        <div class="py-4">
                            <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Traffic Over Time</h4>
                            
                            {{-- Simple Bar Chart --}}
                            <div class="space-y-3">
                                <div class="flex items-center gap-3">
                                    <span class="text-xs text-gray-500 w-16">Allowed</span>
                                    <div class="flex-1 bg-gray-900 rounded-full h-6 overflow-hidden">
                                        <div class="bg-green-500 h-full flex items-center justify-end px-2" 
                                             style="width: {{ $stats['all_traffic'] > 0 ? ($stats['allowed'] / $stats['all_traffic'] * 100) : 0 }}%">
                                            <span class="text-xs font-medium text-white">{{ $stats['allowed'] }}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="flex items-center gap-3">
                                    <span class="text-xs text-gray-500 w-16">Denied</span>
                                    <div class="flex-1 bg-gray-900 rounded-full h-6 overflow-hidden">
                                        <div class="bg-red-500 h-full flex items-center justify-end px-2" 
                                             style="width: {{ $stats['all_traffic'] > 0 ? ($stats['denied'] / $stats['all_traffic'] * 100) : 0 }}%">
                                            <span class="text-xs font-medium text-white">{{ $stats['denied'] }}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                @if($stats['challenged'] > 0)
                                <div class="flex items-center gap-3">
                                    <span class="text-xs text-gray-500 w-16">Challenged</span>
                                    <div class="flex-1 bg-gray-900 rounded-full h-6 overflow-hidden">
                                        <div class="bg-yellow-500 h-full flex items-center justify-end px-2" 
                                             style="width: {{ $stats['all_traffic'] > 0 ? ($stats['challenged'] / $stats['all_traffic'] * 100) : 0 }}%">
                                            <span class="text-xs font-medium text-white">{{ $stats['challenged'] }}</span>
                                        </div>
                                    </div>
                                </div>
                                @endif
                                
                                {{-- Summary --}}
                                <div class="pt-3 border-t border-gray-800">
                                    <div class="flex justify-between text-xs">
                                        <span class="text-gray-500">Total Requests</span>
                                        <span class="text-white font-medium">{{ number_format($stats['all_traffic']) }}</span>
                                    </div>
                                    <div class="flex justify-between text-xs mt-1">
                                        <span class="text-gray-500">Block Rate</span>
                                        <span class="text-white font-medium">
                                            {{ $stats['all_traffic'] > 0 ? number_format(($stats['denied'] / $stats['all_traffic']) * 100, 1) : 0 }}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    @else
                        <div class="flex items-center justify-center h-48">
                            <p class="text-gray-600 text-sm">Traffic chart will be displayed here</p>
                        </div>
                    @endif
                </div>
            </div>
            
            {{-- Active Rules Section --}}
            @if($firewallEnabled && $customRulesCount > 0)
                <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-sm font-medium text-white">Active Rules</h3>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-1 bg-green-900/30 text-green-400 text-xs font-medium rounded">
                                {{ $customRulesCount }} rule{{ $customRulesCount > 1 ? 's' : '' }}
                            </span>
                            <a href="{{ route('project.application.security.rules', $parameters) }}" 
                               class="text-sm text-blue-400 hover:text-blue-300">
                                Manage →
                            </a>
                        </div>
                    </div>
                    
                    <div class="space-y-2">
                        @foreach($activeRules as $rule)
                            <div class="flex items-center justify-between p-3 bg-[#151b2e] rounded-lg border border-gray-800">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg {{ $rule['action'] === 'block' ? 'bg-red-900/30' : ($rule['action'] === 'log' ? 'bg-blue-900/30' : 'bg-green-900/30') }} flex items-center justify-center flex-shrink-0">
                                        @if($rule['action'] === 'block')
                                            <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                            </svg>
                                        @elseif($rule['action'] === 'log')
                                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                            </svg>
                                        @else
                                            <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                            </svg>
                                        @endif
                                    </div>
                                    <div>
                                        <div class="text-sm font-medium text-white">{{ $rule['name'] }}</div>
                                        <div class="text-xs text-gray-500 mt-0.5">
                                            {{ $rule['conditions_count'] }} condition{{ $rule['conditions_count'] > 1 ? 's' : '' }} · 
                                            <span class="capitalize">{{ $rule['action'] }}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm font-medium text-gray-400">{{ $rule['match_count'] }}</div>
                                    <div class="text-xs text-gray-600">
                                        @if($rule['last_match_at'])
                                            {{ $rule['last_match_at'] }}
                                        @else
                                            No matches yet
                                        @endif
                                    </div>
                                </div>
                            </div>
                        @endforeach
                    </div>
                </div>
            @endif
            
            {{-- Recent Events --}}
            <div class="bg-[#151b2e] border border-gray-700 rounded-xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-white">Recent Events</h3>
                    <a href="{{ route('project.application.security.traffic', $parameters) }}" 
                       class="text-sm text-blue-400 hover:text-blue-300">
                        View all →
                    </a>
                </div>
                
                @if(count($recentEvents) === 0)
                    <div class="text-center py-8">
                        <p class="text-gray-500 text-sm">No events available</p>
                        <p class="text-gray-600 text-xs mt-1">Events will appear here when traffic is detected</p>
                    </div>
                @else
                    <div class="space-y-3">
                        @foreach($recentEvents as $event)
                            <div class="flex items-center justify-between p-4 bg-[#0f1724] rounded-lg border border-gray-800">
                                <div class="flex items-center gap-4">
                                    @if($event['action'] === 'denied')
                                        <div class="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                            </svg>
                                        </div>
                                    @elseif($event['action'] === 'challenged')
                                        <div class="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                            <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                            </svg>
                                        </div>
                                    @else
                                        <div class="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                            </svg>
                                        </div>
                                    @endif
                                    
                                    <div>
                                        <p class="text-sm font-medium text-white">{{ $event['ip'] }}</p>
                                        <p class="text-xs text-gray-500">{{ $event['reason'] }}</p>
                                    </div>
                                </div>
                                
                                <div class="text-right">
                                    <span class="px-2 py-1 rounded text-xs font-medium
                                        {{ $event['action'] === 'denied' ? 'bg-red-500/20 text-red-400' : '' }}
                                        {{ $event['action'] === 'challenged' ? 'bg-yellow-500/20 text-yellow-400' : '' }}
                                        {{ $event['action'] === 'allowed' ? 'bg-green-500/20 text-green-400' : '' }}
                                    ">
                                        {{ ucfirst($event['action']) }}
                                    </span>
                                    <p class="text-xs text-gray-500 mt-1">{{ $event['timestamp']->diffForHumans() }}</p>
                                </div>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
        </div>
    </div>
    
    {{-- Activate Firewall Modal --}}
    @if($showInstallModal)
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" wire:click="$set('showInstallModal', false)">
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg max-w-md w-full p-6" wire:click.stop>
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-white">Activate Firewall</h3>
                    <button wire:click="$set('showInstallModal', false)" class="text-gray-500 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <p class="text-sm text-gray-400 mb-6">
                    The security components need to be configured on your server before enabling the firewall. This process will take approximately 2-3 minutes.
                </p>
                
                <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                    <div class="flex gap-3">
                        <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <div>
                            <p class="text-sm text-blue-400 font-medium">What happens next?</p>
                            <p class="text-xs text-gray-400 mt-1">Security components will be automatically configured on your server. You'll be able to enable the firewall once setup is complete.</p>
                        </div>
                    </div>
                </div>
                
                <div class="flex gap-3">
                    <button wire:click="$set('showInstallModal', false)" class="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors">
                        Cancel
                    </button>
                    <button wire:click="activateFirewall" wire:loading.attr="disabled" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <span wire:loading.remove wire:target="activateFirewall">Activate Now</span>
                        <span wire:loading wire:target="activateFirewall">Activating...</span>
                    </button>
                </div>
            </div>
        </div>
    @endif
    
    {{-- Bot Management Modal --}}
    @if($showBotManagementModal)
        <div class="fixed inset-0 z-50 overflow-y-auto" x-data="{ show: @entangle('showBotManagementModal') }" x-show="show" x-cloak>
            {{-- Backdrop --}}
            <div class="fixed inset-0 bg-black/80 transition-opacity" wire:click="closeBotManagement"></div>
            
            {{-- Modal Content --}}
            <div class="flex min-h-full items-center justify-center p-4">
                <div class="relative w-full max-w-4xl bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl transform transition-all">
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <div>
                            <p class="text-xs text-gray-500 mb-1">Firewall Protection</p>
                            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                                🤖 Bot Management Templates
                            </h2>
                        </div>
                        <button wire:click="closeBotManagement" class="text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Info Banner --}}
                    <div class="px-6 py-4 bg-blue-900/20 border-b border-gray-800">
                        <div class="flex gap-3">
                            <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div>
                                <p class="text-sm text-blue-300 font-medium">Pre-configured Protection Templates</p>
                                <p class="text-xs text-gray-400 mt-1">Import ready-to-use bot detection rules based on User-Agent patterns and behavioral analysis.</p>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Templates Grid --}}
                    <div class="px-6 py-6 max-h-[60vh] overflow-y-auto">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            @foreach($botTemplates as $key => $template)
                                <div class="bg-[#151b2e] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                                    {{-- Template Header --}}
                                    <div class="flex items-start justify-between mb-3">
                                        <div class="flex-1">
                                            <h3 class="text-sm font-semibold text-white mb-1">{{ $template['name'] }}</h3>
                                            <p class="text-xs text-gray-400">{{ $template['description'] }}</p>
                                        </div>
                                        <span class="px-2 py-0.5 rounded text-xs font-medium
                                            @if($template['severity'] === 'critical') bg-red-900/30 text-red-400
                                            @elseif($template['severity'] === 'high') bg-orange-900/30 text-orange-400
                                            @elseif($template['severity'] === 'medium') bg-yellow-900/30 text-yellow-400
                                            @else bg-blue-900/30 text-blue-400 @endif">
                                            {{ ucfirst($template['severity']) }}
                                        </span>
                                    </div>
                                    
                                    {{-- Template Details --}}
                                    <div class="space-y-2 mb-4">
                                        <div class="flex items-center gap-2 text-xs">
                                            <span class="text-gray-500">Action:</span>
                                            <span class="px-2 py-0.5 rounded font-medium
                                                @if($template['action'] === 'block') bg-red-900/30 text-red-400
                                                @elseif($template['action'] === 'captcha') bg-yellow-900/30 text-yellow-400
                                                @else bg-blue-900/30 text-blue-400 @endif">
                                                {{ ucfirst($template['action']) }}
                                            </span>
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            <span class="font-medium">Category:</span> {{ str_replace('_', ' ', ucfirst($template['category'])) }}
                                        </div>
                                    </div>
                                    
                                    {{-- Usage Info --}}
                                    <div class="mb-4 p-3 bg-[#0a0a0a] border border-gray-800 rounded text-xs text-gray-400">
                                        <p class="font-medium text-gray-300 mb-1">💡 Usage:</p>
                                        <p>{{ $template['usage'] }}</p>
                                    </div>
                                    
                                    {{-- Examples --}}
                                    @if(isset($template['examples']) && count($template['examples']) > 0)
                                        <div class="mb-4">
                                            <p class="text-xs font-medium text-gray-400 mb-2">Examples:</p>
                                            <ul class="space-y-1">
                                                @foreach($template['examples'] as $example)
                                                    <li class="text-xs text-gray-500 flex items-start gap-1">
                                                        <span class="text-gray-600">•</span>
                                                        <span>{{ $example }}</span>
                                                    </li>
                                                @endforeach
                                            </ul>
                                        </div>
                                    @endif
                                    
                                    {{-- Import Button --}}
                                    <button wire:click="importBotTemplate('{{ $key }}')" 
                                            class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
                                        Import Template
                                    </button>
                                </div>
                            @endforeach
                        </div>
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-6 py-4 border-t border-gray-800 bg-[#0f0f0f]">
                        <div class="flex items-center justify-between">
                            <p class="text-xs text-gray-500">{{ count($botTemplates) }} templates available</p>
                            <button wire:click="closeBotManagement" class="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @endif
</div>
