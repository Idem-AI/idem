<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Security | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    {{-- Sub-Navigation Tabs --}}
    <div class="mb-6 border-b border-gray-800">
        <nav class="flex gap-1">
            <a href="{{ route('project.application.security.overview', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-white border-b-2 border-blue-500 -mb-px">
                Overview
            </a>
            <a href="{{ route('project.application.security.traffic', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white">
                Events
            </a>
            <a href="{{ route('project.application.security.rules', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white">
                Rules
            </a>
        </nav>
    </div>

    <div wire:poll.3s="checkActivationStatus" class="flex gap-6">
    
    {{-- Left Sidebar: Status Card (Vercel Style) --}}
    <div class="w-72 flex-shrink-0">
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6 sticky top-6">
            
            {{-- Firewall Status --}}
            <div class="text-center mb-8">
                {{-- Shield Icon --}}
                <div class="w-20 h-20 mx-auto mb-4 rounded-full {{ $firewallEnabled ? 'bg-blue-600/20' : 'bg-gray-800' }} flex items-center justify-center">
                    <svg class="w-10 h-10 {{ $firewallEnabled ? 'text-blue-500' : 'text-gray-600' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                </div>
                
                <h2 class="text-lg font-semibold text-white mb-1">
                    Firewall is {{ $firewallEnabled ? 'active' : 'inactive' }}
                </h2>
                <p class="text-sm text-gray-500">
                    {{ $firewallEnabled ? 'All systems normal' : 'Protection disabled' }}
                </p>
            </div>
            
            {{-- Divider --}}
            <div class="border-t border-gray-800 my-6"></div>
            
            {{-- Bot Protection Status --}}
            <div class="flex items-center justify-between mb-4">
                <span class="text-sm text-gray-400">Bot Protection</span>
                <span class="text-sm {{ $botProtectionEnabled ? 'text-green-400' : 'text-gray-500' }} font-medium">
                    {{ $botProtectionEnabled ? 'active' : 'inactive' }}
                </span>
            </div>
            
            {{-- Custom Rules Count --}}
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-400">Custom Rules</span>
                <span class="text-sm text-white font-medium">{{ $customRulesCount }}</span>
            </div>
            
            {{-- Action Button --}}
            @if(!$firewallEnabled && !$activating)
                <button wire:click="toggleFirewall" wire:loading.attr="disabled" class="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <span wire:loading.remove wire:target="toggleFirewall">Activate Firewall</span>
                    <span wire:loading wire:target="toggleFirewall" class="flex items-center justify-center gap-2">
                        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Activating...
                    </span>
                </button>
            @elseif($activating)
                <button disabled class="w-full mt-6 px-4 py-2 bg-blue-600/50 text-white rounded-md text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2">
                    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Activating...
                </button>
            @else
                <button wire:click="toggleFirewall" class="w-full mt-6 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-md text-sm font-medium transition-colors">
                    Disable Firewall
                </button>
            @endif
        </div>
    </div>
    
    {{-- Right Content Area --}}
    <div class="flex-1 space-y-6">
        
        {{-- Header --}}
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-semibold text-white">Firewall</h1>
                <p class="text-sm text-gray-500 mt-1">Monitor and protect your application</p>
            </div>
            
            <div class="flex gap-2">
                <button wire:click="openBotManagement" class="px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-md text-white text-sm hover:bg-gray-900 transition-colors flex items-center gap-2">
                    🤖 Bot Management
                </button>
                <button wire:click="openRateLimit" class="px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-md text-white text-sm hover:bg-gray-900 transition-colors flex items-center gap-2">
                    🛡️ Protection Patterns
                </button>
                <button wire:click="openGeoBlocking" class="px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-md text-white text-sm hover:bg-gray-900 transition-colors flex items-center gap-2">
                    🌍 Geo-Blocking
                </button>
                <a href="{{ route('project.application.security.rules', $parameters) }}" class="px-3 py-1.5 bg-white hover:bg-gray-100 text-black rounded-md text-sm font-medium transition-colors">
                    Add New...
                </a>
            </div>
        </div>
        
        {{-- Traffic Stats Cards --}}
        <div class="grid grid-cols-4 gap-4">
            {{-- All Traffic --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="text-xs text-gray-500">All Traffic</span>
                </div>
                <p class="text-2xl font-semibold text-white">{{ number_format($stats['all_traffic']) }}</p>
            </div>
            
            {{-- Allowed --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="text-xs text-gray-500">Allowed</span>
                </div>
                <p class="text-2xl font-semibold text-white">{{ number_format($stats['allowed']) }}</p>
            </div>
            
            {{-- Denied --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                    </svg>
                    <span class="text-xs text-gray-500">Denied</span>
                </div>
                <p class="text-2xl font-semibold text-white">{{ number_format($stats['denied']) }}</p>
            </div>
            
            {{-- Challenged --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <span class="text-xs text-gray-500">Challenged</span>
                </div>
                <p class="text-2xl font-semibold text-white">{{ number_format($stats['challenged']) }}</p>
            </div>
        </div>
        
        {{-- Chart Area --}}
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6" wire:ignore.self>
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-white">Traffic Over Time</h3>
                <select class="px-3 py-1.5 bg-[#151b2e] border border-gray-700 rounded-md text-white text-xs focus:outline-none">
                    <option>Last 24 hours</option>
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                </select>
            </div>
            
            @if($stats['all_traffic'] > 0)
                {{-- Chart with data --}}
                <div class="relative h-64" wire:ignore>
                    <canvas id="trafficChart" 
                            data-hourly='@json($hourlyTrafficData)' 
                            data-allowed="{{ $stats['allowed'] }}" 
                            data-denied="{{ $stats['denied'] }}"></canvas>
                </div>
                
                {{-- Chart Legend --}}
                <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-800">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span class="text-xs text-gray-400">Allowed</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span class="text-xs text-gray-400">Denied</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span class="text-xs text-gray-400">Challenged</span>
                    </div>
                </div>
                
                <script>
                    (function() {
                        let trafficChartInstance = null;
                        
                        function initOrUpdateChart() {
                            const canvas = document.getElementById('trafficChart');
                            if (!canvas) return;
                            
                            // Get real hourly data
                            const hourlyData = JSON.parse(canvas.dataset.hourly || '{}');
                            
                            const labels = [];
                            const allowedData = [];
                            const deniedData = [];
                            
                            // Parse hourly data
                            for (let key in hourlyData) {
                                labels.push(key);
                                allowedData.push(hourlyData[key].allowed || 0);
                                deniedData.push(hourlyData[key].denied || 0);
                            }
                            
                            if (trafficChartInstance) {
                                // Update existing chart
                                trafficChartInstance.data.datasets[0].data = allowedData;
                                trafficChartInstance.data.datasets[1].data = deniedData;
                                trafficChartInstance.update('none'); // Update without animation
                            } else {
                                // Create new chart
                                trafficChartInstance = new Chart(canvas, {
                                    type: 'line',
                                    data: {
                                        labels: labels,
                                        datasets: [{
                                            label: 'Allowed',
                                            data: allowedData,
                                            borderColor: 'rgb(34, 197, 94)',
                                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                            borderWidth: 2,
                                            fill: true,
                                            tension: 0.4
                                        }, {
                                            label: 'Denied',
                                            data: deniedData,
                                            borderColor: 'rgb(239, 68, 68)',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            borderWidth: 2,
                                            fill: true,
                                            tension: 0.4
                                        }]
                                    },
                                    options: {
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: false },
                                            tooltip: {
                                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                titleColor: 'rgb(255, 255, 255)',
                                                bodyColor: 'rgb(156, 163, 175)',
                                                borderColor: 'rgb(55, 65, 81)',
                                                borderWidth: 1
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                                ticks: { color: 'rgb(156, 163, 175)' }
                                            },
                                            x: {
                                                grid: { display: false },
                                                ticks: { color: 'rgb(156, 163, 175)' }
                                            }
                                        }
                                    }
                                });
                            }
                        }
                        
                        // Init on load
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', initOrUpdateChart);
                        } else {
                            initOrUpdateChart();
                        }
                        
                        // Update on Livewire updates (but chart won't be destroyed thanks to wire:ignore)
                        document.addEventListener('livewire:init', initOrUpdateChart);
                    })();
                </script>
            @else
                {{-- No data state --}}
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <svg class="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                        </svg>
                        <p class="text-lg font-medium text-white mb-1">No Data</p>
                        <p class="text-sm text-gray-500">There's no data available for your selection.</p>
                    </div>
                </div>
            @endif
        </div>
        
        {{-- Bottom Grid: Alerts & Rules --}}
        <div class="grid grid-cols-2 gap-6">
            
            {{-- Alerts Section --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-semibold text-white">Security Alerts</h3>
                    <button wire:click="syncAlerts" class="px-3 py-1.5 bg-[#151b2e] border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                        Sync Alerts
                    </button>
                </div>
                
                @if(count($activeAlerts) === 0)
                    <div class="text-center py-12">
                        <div class="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        <p class="text-sm font-medium text-white mb-1">No threats detected</p>
                        <p class="text-xs text-gray-500 mb-2">Your application is secure ✅</p>
                        <p class="text-xs text-gray-600">Alerts auto-sync every 5 minutes from CrowdSec</p>
                    </div>
                @else
                    <div class="space-y-3">
                        @foreach($activeAlerts as $alert)
                            <div class="flex items-start gap-3 p-3 bg-[#151b2e] border border-gray-800 rounded-lg">
                                <div class="flex-1">
                                    <p class="text-sm text-white font-medium">{{ $alert['type'] }}</p>
                                    <p class="text-xs text-gray-500 mt-1">{{ $alert['message'] }}</p>
                                </div>
                                <span class="px-2 py-1 rounded text-xs font-medium
                                    @if($alert['severity'] === 'critical') bg-red-900/30 text-red-400
                                    @elseif($alert['severity'] === 'high') bg-orange-900/30 text-orange-400
                                    @else bg-yellow-900/30 text-yellow-400 @endif">
                                    {{ ucfirst($alert['severity']) }}
                                </span>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
            
            {{-- Rules Section --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
                <h3 class="text-sm font-semibold text-white mb-4">Rules</h3>
                
                @if(count($activeRules) === 0)
                    <div class="text-center py-12">
                        <svg class="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                        <p class="text-sm text-gray-500">There are no enforced rules</p>
                    </div>
                @else
                    <div class="space-y-2">
                        @foreach($activeRules as $rule)
                            <div class="flex items-center justify-between p-2 hover:bg-[#151b2e] rounded transition-colors">
                                <div class="flex-1">
                                    <p class="text-sm text-white">{{ $rule['name'] }}</p>
                                    <p class="text-xs text-gray-500">{{ $rule['conditions_count'] }} condition(s)</p>
                                </div>
                                <span class="px-2 py-1 rounded text-xs font-medium
                                    @if($rule['action'] === 'block') bg-red-900/30 text-red-400
                                    @elseif($rule['action'] === 'captcha') bg-yellow-900/30 text-yellow-400
                                    @else bg-green-900/30 text-green-400 @endif">
                                    {{ ucfirst($rule['action']) }}
                                </span>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
        </div>
        
    </div>
    
    {{-- Bot Management Modal (unchanged) --}}
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
    
    {{-- Rate Limiting Modal --}}
    @if($showRateLimitModal)
        <div class="fixed inset-0 z-50 overflow-y-auto" x-data="{ show: @entangle('showRateLimitModal') }" x-show="show" x-cloak>
            {{-- Backdrop --}}
            <div class="fixed inset-0 bg-black/80 transition-opacity" wire:click="closeRateLimit"></div>
            
            {{-- Modal Content --}}
            <div class="flex min-h-full items-center justify-center p-4">
                <div class="relative w-full max-w-4xl bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl transform transition-all">
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <div>
                            <p class="text-xs text-gray-500 mb-1">Firewall Protection</p>
                            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                                🛡️ Protection Pattern Templates
                            </h2>
                        </div>
                        <button wire:click="closeRateLimit" class="text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Info Banner --}}
                    <div class="px-6 py-4 bg-purple-900/20 border-b border-gray-800">
                        <div class="flex gap-3">
                            <svg class="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                            <div>
                                <p class="text-sm text-purple-300 font-medium">Pre-configured Protection Patterns</p>
                                <p class="text-xs text-gray-400 mt-1">Pattern-based request filtering and monitoring. Note: These are static rules, not temporal rate limiting with request counting. For true rate limiting with time-based tracking, see CrowdSec Scenarios (coming soon).</p>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Templates Grid --}}
                    <div class="px-6 py-6 max-h-[60vh] overflow-y-auto">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            @foreach($rateLimitTemplates as $key => $template)
                                <div class="bg-[#151b2e] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                                    {{-- Template Header --}}
                                    <div class="flex items-start justify-between mb-3">
                                        <div class="flex-1">
                                            <h3 class="text-sm font-semibold text-white mb-1">{{ $template['name'] }}</h3>
                                            <p class="text-xs text-gray-400">{{ $template['description'] }}</p>
                                        </div>
                                        <span class="px-2 py-0.5 rounded text-xs font-medium ml-2
                                            @if($template['severity'] === 'high') bg-red-900/30 text-red-400 border border-red-800/50
                                            @elseif($template['severity'] === 'medium') bg-yellow-900/30 text-yellow-400 border border-yellow-800/50
                                            @else bg-blue-900/30 text-blue-400 border border-blue-800/50 @endif">
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
                                            <span class="font-medium">Rate:</span> {{ $template['rate_limit']['threshold'] }} requests / {{ $template['rate_limit']['window'] }}s
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            <span class="font-medium">Block Duration:</span> {{ round($template['duration'] / 60) }} minutes
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
                                    <button wire:click="importRateLimitTemplate('{{ $key }}')" 
                                            class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors">
                                        Import Template
                                    </button>
                                </div>
                            @endforeach
                        </div>
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-6 py-4 border-t border-gray-800 bg-[#0f0f0f]">
                        <div class="flex items-center justify-between">
                            <p class="text-xs text-gray-500">{{ count($rateLimitTemplates) }} templates available</p>
                            <button wire:click="closeRateLimit" class="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @endif
    
    {{-- Install Modal (si pas activé) --}}
    @if(!$crowdSecAvailable && $showInstallModal)
        <div class="fixed inset-0 z-50 overflow-y-auto">
            <div class="fixed inset-0 bg-black/80 transition-opacity"></div>
            <div class="flex min-h-full items-center justify-center p-4">
                <div class="relative w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl p-6">
                    <h3 class="text-lg font-semibold text-white mb-4">Activate Firewall</h3>
                    <p class="text-sm text-gray-400 mb-6">CrowdSec will be automatically installed and configured on your server.</p>
                    
                    <div class="flex gap-3">
                        <button wire:click="$set('showInstallModal', false)" class="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors">
                            Cancel
                        </button>
                        <button wire:click="activateFirewall" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
                            Activate Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    @endif

    {{-- Geo-Blocking Modal --}}
    @if($showGeoBlockingModal)
        <div class="fixed inset-0 z-50 overflow-y-auto">
            {{-- Backdrop --}}
            <div class="fixed inset-0 bg-black/80 transition-opacity" wire:click="closeGeoBlocking"></div>
            
            {{-- Modal --}}
            <div class="flex min-h-full items-center justify-center p-4">
                <div class="relative w-full max-w-4xl bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl">
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <div>
                            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                                🌍 Geo-Blocking
                            </h2>
                            <p class="text-sm text-gray-400 mt-1">Block or allow traffic from specific countries</p>
                        </div>
                        <button wire:click="closeGeoBlocking" class="text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Mode Selection --}}
                    <div class="px-6 py-4 border-b border-gray-800 bg-[#0f0f0f]">
                        <div class="flex gap-4">
                            <button wire:click="$set('geoBlockingMode', 'blacklist')" class="flex-1 px-4 py-3 rounded-lg border transition-colors {{ $geoBlockingMode === 'blacklist' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-[#151b2e] border-gray-800 text-gray-400 hover:border-gray-700' }}">
                                <div class="text-left">
                                    <p class="text-sm font-semibold">Blacklist Mode</p>
                                    <p class="text-xs mt-1">Block selected countries</p>
                                </div>
                            </button>
                            <button wire:click="$set('geoBlockingMode', 'whitelist')" class="flex-1 px-4 py-3 rounded-lg border transition-colors {{ $geoBlockingMode === 'whitelist' ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-[#151b2e] border-gray-800 text-gray-400 hover:border-gray-700' }}">
                                <div class="text-left">
                                    <p class="text-sm font-semibold">Whitelist Mode</p>
                                    <p class="text-xs mt-1">Allow only selected countries</p>
                                </div>
                            </button>
                        </div>
                        
                        {{-- Quick Actions --}}
                        <div class="flex gap-2 mt-3">
                            <button wire:click="applySuggestedCountries('whitelist')" class="px-3 py-1.5 bg-[#151b2e] border border-gray-700 rounded text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
                                📍 EU + US + Major Countries
                            </button>
                            <button wire:click="applySuggestedCountries('blacklist')" class="px-3 py-1.5 bg-[#151b2e] border border-gray-700 rounded text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
                                ⚠️ High-Risk Countries
                            </button>
                        </div>
                    </div>
                    
                    {{-- Countries Grid --}}
                    <div class="px-6 py-4 max-h-[50vh] overflow-y-auto">
                        @foreach($availableCountries as $continent => $countries)
                            <div class="mb-6 last:mb-0">
                                <h3 class="text-sm font-semibold text-gray-400 mb-3">{{ $continent }}</h3>
                                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    @foreach($countries as $code => $data)
                                        <button wire:click="toggleCountry('{{ $code }}')" class="px-3 py-2 rounded-lg border transition-colors text-left {{ in_array($code, $selectedCountries) ? 'bg-blue-900/20 border-blue-800' : 'bg-[#151b2e] border-gray-800 hover:border-gray-700' }}">
                                            <div class="flex items-center gap-2">
                                                <span class="text-2xl">{{ $data['flag'] }}</span>
                                                <div class="flex-1 min-w-0">
                                                    <p class="text-xs font-medium text-white truncate">{{ $data['name'] }}</p>
                                                    <p class="text-xs text-gray-500">{{ $code }}</p>
                                                </div>
                                                @if(in_array($code, $selectedCountries))
                                                    <svg class="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                                    </svg>
                                                @endif
                                            </div>
                                        </button>
                                    @endforeach
                                </div>
                            </div>
                        @endforeach
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-6 py-4 border-t border-gray-800 bg-[#0f0f0f]">
                        <div class="flex items-center justify-between">
                            <div class="text-sm">
                                <span class="text-gray-400">Selected:</span>
                                <span class="text-white font-semibold ml-2">{{ count($selectedCountries) }} countries</span>
                            </div>
                            <div class="flex gap-3">
                                <button wire:click="closeGeoBlocking" class="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                                    Cancel
                                </button>
                                <button wire:click="createGeoBlockingRule" class="px-4 py-2 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-medium transition-colors" {{ count($selectedCountries) === 0 ? 'disabled' : '' }}>
                                    Create Rule
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @endif
    </div>
</div>
