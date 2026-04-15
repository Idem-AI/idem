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
            
            <div class="flex gap-3">
                <button wire:click="openBotManagement" class="outer-button button-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
                    </svg>
                    <span>Bot Management</span>
                </button>
                <button wire:click="openRateLimit" class="outer-button button-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    <span>Protection Patterns</span>
                </button>
                <button wire:click="openGeoBlocking" class="outer-button button-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Geo-Blocking</span>
                </button>
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
                            
                            // Get real hourly data (with allowed and denied)
                            const hourlyData = JSON.parse(canvas.dataset.hourly || '{}');
                            
                            const labels = [];
                            const allowedData = [];
                            const deniedData = [];
                            
                            // Parse hourly data (with allowed and denied)
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
        
        {{-- Bottom Grid: Events & Rules --}}
        <div class="grid grid-cols-2 gap-6">
            
            {{-- Recent Events --}}
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-semibold text-white">Recent Events</h3>
                </div>
                
                @if(count($recentEvents) === 0)
                    <div class="text-center py-8">
                        <p class="text-gray-500 text-sm">No events available</p>
                        <p class="text-gray-600 text-xs mt-1">Events will appear here when traffic is detected</p>
                    </div>
                @else
                    <div class="space-y-3">
                        @foreach($recentEvents as $event)
                            <div class="flex items-center justify-between p-4 bg-[#151b2e] rounded-lg border border-gray-800">
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
    
    {{-- Bot Management Modal --}}
    <div class="fixed inset-0 z-50 overflow-y-auto" x-data="{ show: @entangle('showBotManagementModal').live }" x-show="show" x-cloak style="font-family: 'Jura', sans-serif;">
        {{-- Backdrop --}}
        <div class="fixed inset-0 bg-black/95 backdrop-blur-md transition-all duration-300" @click="show = false"></div>
            
            {{-- Modal Content --}}
            <div class="flex min-h-full items-center justify-center p-4" @click.self="show = false">
                <div class="relative w-full max-w-4xl glass-card border-2 border-glass glow-accent" @click.stop>
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-8 py-6 border-b border-glass bg-gradient-glow">
                        <div>
                            <h2 class="text-3xl font-bold text-white flex items-center gap-3 tracking-wide i-underline">
                                BOT MANAGEMENT
                            </h2>
                            <p class="text-sm text-gray-300 mt-2 font-medium">Pre-configured bot protection templates</p>
                        </div>
                        <button @click="show = false" class="group outer-button p-3 rounded-xl hover:bg-danger transition-all duration-200">
                            <svg class="w-6 h-6 text-gray-300 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Info Banner --}}
                    <div class="px-8 py-4 border-b border-glass glass-dark">
                        <div class="flex gap-3 items-start">
                            <svg class="w-5 h-5 text-accent-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div>
                                <p class="text-sm text-white font-semibold tracking-wide">Pre-configured Protection Templates</p>
                                <p class="text-xs text-gray-400 mt-1">Import ready-to-use bot detection rules based on User-Agent patterns and behavioral analysis.</p>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Templates Grid --}}
                    <div class="px-6 py-6 max-h-[60vh] overflow-y-auto">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            @foreach($botTemplates as $key => $template)
                                <div class="glass border border-glass rounded-xl p-4 hover:border-white/20 transition-all duration-200">
                                    {{-- Template Header --}}
                                    <div class="flex items-start justify-between mb-3">
                                        <div class="flex-1">
                                            <h3 class="text-sm font-semibold text-white mb-1 tracking-wide">{{ $template['name'] }}</h3>
                                            <p class="text-xs text-gray-400">{{ $template['description'] }}</p>
                                        </div>
                                        <span class="px-2 py-0.5 rounded text-xs font-medium ml-2
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
                                    <div class="mb-4 p-3 glass-dark border border-glass rounded-lg text-xs text-gray-400">
                                        <p class="font-medium text-white mb-1">Usage:</p>
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
                                    <button wire:click="importBotTemplate('{{ $key }}')" class="inner-button w-full button-sm">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                        </svg>
                                        Import
                                    </button>
                                </div>
                            @endforeach
                        </div>
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-8 py-6 border-t border-glass glass-dark">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></div>
                                <span class="text-gray-300 text-sm font-medium"><span class="text-white font-bold">{{ count($botTemplates) }}</span> TEMPLATES AVAILABLE</span>
                            </div>
                            <button @click="show = false" class="outer-button button-sm flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
    </div>
    
    {{-- Rate Limiting Modal --}}
    <div class="fixed inset-0 z-50 overflow-y-auto" x-data="{ show: @entangle('showRateLimitModal').live }" x-show="show" x-cloak style="font-family: 'Jura', sans-serif;">
        {{-- Backdrop --}}
        <div class="fixed inset-0 bg-black/95 backdrop-blur-md transition-all duration-300" @click="show = false"></div>
            
            {{-- Modal Content --}}
            <div class="flex min-h-full items-center justify-center p-4" @click.self="show = false">
                <div class="relative w-full max-w-4xl glass-card border-2 border-glass glow-accent" @click.stop>
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-8 py-6 border-b border-glass bg-gradient-glow">
                        <div>
                            <h2 class="text-3xl font-bold text-white flex items-center gap-3 tracking-wide i-underline">
                                PROTECTION PATTERNS
                            </h2>
                            <p class="text-sm text-gray-300 mt-2 font-medium">Pattern-based request filtering and rate limiting</p>
                        </div>
                        <button @click="show = false" class="group outer-button p-3 rounded-xl hover:bg-danger transition-all duration-200">
                            <svg class="w-6 h-6 text-gray-300 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Info Banner --}}
                    <div class="px-8 py-4 border-b border-glass glass-dark">
                        <div class="flex gap-3 items-start">
                            <svg class="w-5 h-5 text-accent-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                            <div>
                                <p class="text-sm text-white font-semibold tracking-wide">Pre-configured Protection Patterns</p>
                                <p class="text-xs text-gray-400 mt-1">Pattern-based request filtering and monitoring. Static rules for request pattern detection. For time-based rate limiting, see CrowdSec Scenarios (coming soon).</p>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Templates Grid --}}
                    <div class="px-6 py-6 max-h-[60vh] overflow-y-auto">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            @foreach($rateLimitTemplates as $key => $template)
                                <div class="glass border border-glass rounded-xl p-4 hover:border-white/20 transition-all duration-200">
                                    {{-- Template Header --}}
                                    <div class="flex items-start justify-between mb-3">
                                        <div class="flex-1">
                                            <h3 class="text-sm font-semibold text-white mb-1 tracking-wide">{{ $template['name'] }}</h3>
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
                                    <div class="mb-4 p-3 glass-dark border border-glass rounded-lg text-xs text-gray-400">
                                        <p class="font-medium text-white mb-1">Usage:</p>
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
                                    <button wire:click="importRateLimitTemplate('{{ $key }}')" class="inner-button w-full button-sm">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                        </svg>
                                        Import
                                    </button>
                                </div>
                            @endforeach
                        </div>
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-8 py-6 border-t border-glass glass-dark">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></div>
                                <span class="text-gray-300 text-sm font-medium"><span class="text-white font-bold">{{ count($rateLimitTemplates) }}</span> TEMPLATES AVAILABLE</span>
                            </div>
                            <button @click="show = false" class="outer-button button-sm flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
    </div>
    
    {{-- Install Modal (si pas activé) --}}
    @if(!$crowdSecAvailable && $showInstallModal)
        <div class="fixed inset-0 z-50 overflow-y-auto" style="font-family: 'Jura', sans-serif;">
            <div class="fixed inset-0 bg-black/95 backdrop-blur-md transition-opacity"></div>
            <div class="flex min-h-full items-center justify-center p-4">
                <div class="relative w-full max-w-md glass-card border-2 border-glass glow-accent p-8">
                    <h3 class="text-2xl font-bold text-white mb-2 tracking-wide i-underline">Activate Firewall</h3>
                    <p class="text-sm text-gray-400 mt-4 mb-6">CrowdSec will be automatically installed and configured on your server.</p>
                    
                    <div class="flex gap-3">
                        <button wire:click="$set('showInstallModal', false)" class="outer-button button-sm flex-1">
                            Cancel
                        </button>
                        <button wire:click="activateFirewall" class="inner-button button-sm flex-1">
                            Activate Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    @endif

    {{-- Geo-Blocking Modal --}}
    <div class="fixed inset-0 z-50 overflow-y-auto" x-data="{ show: @entangle('showGeoBlockingModal').live }" x-show="show" x-cloak style="font-family: 'Jura', sans-serif;">
        {{-- Backdrop --}}
        <div class="fixed inset-0 bg-black/95 backdrop-blur-md transition-all duration-300" @click="show = false"></div>
            
            {{-- Modal --}}
            <div class="flex min-h-full items-center justify-center p-4" @click.self="show = false">
                <div class="relative w-full max-w-5xl glass-card border-2 border-glass glow-accent" @click.stop>
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-8 py-6 border-b border-glass bg-gradient-glow">
                        <div>
                            <h2 class="text-3xl font-bold text-white flex items-center gap-3 tracking-wide i-underline">
                                GEO-BLOCKING
                            </h2>
                            <p class="text-sm text-gray-300 mt-2 font-medium">Block or allow traffic from specific countries</p>
                        </div>
                        <button @click="show = false" class="group outer-button p-3 rounded-xl hover:bg-danger transition-all duration-200">
                            <svg class="w-6 h-6 text-gray-300 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Mode Selection --}}
                    <div class="px-8 py-6 border-b border-glass glass-dark">
                        <div class="flex gap-6">
                            <button wire:click="$set('geoBlockingMode', 'blacklist')" class="flex-1 glass-card p-6 border-2 transition-all duration-300 {{ $geoBlockingMode === 'blacklist' ? 'border-danger shadow-glass-hover' : 'border-glass hover:border-gray-600' }}" style="{{ $geoBlockingMode === 'blacklist' ? 'box-shadow: 0 0 20px color-mix(in oklch, var(--color-danger) 50%, transparent);' : '' }}">
                                <div class="text-left">
                                    <p class="text-lg font-bold tracking-wide {{ $geoBlockingMode === 'blacklist' ? 'text-danger' : 'text-gray-400' }}">BLACKLIST MODE</p>
                                    <p class="text-sm mt-2 font-medium {{ $geoBlockingMode === 'blacklist' ? 'text-gray-300' : 'text-gray-500' }}">Block selected countries</p>
                                </div>
                            </button>
                            <button wire:click="$set('geoBlockingMode', 'whitelist')" class="flex-1 glass-card p-6 border-2 transition-all duration-300 {{ $geoBlockingMode === 'whitelist' ? 'border-success shadow-glass-hover' : 'border-glass hover:border-gray-600' }}" style="{{ $geoBlockingMode === 'whitelist' ? 'box-shadow: 0 0 20px color-mix(in oklch, var(--color-success) 50%, transparent);' : '' }}">
                                <div class="text-left">
                                    <p class="text-lg font-bold tracking-wide {{ $geoBlockingMode === 'whitelist' ? 'text-success' : 'text-gray-400' }}">WHITELIST MODE</p>
                                    <p class="text-sm mt-2 font-medium {{ $geoBlockingMode === 'whitelist' ? 'text-gray-300' : 'text-gray-500' }}">Allow only selected countries</p>
                                </div>
                            </button>
                        </div>
                        
                        {{-- Quick Actions --}}
                        <div class="flex gap-3 mt-5">
                            <button wire:click="applySuggestedCountries('whitelist')" class="glass px-4 py-2 rounded-lg text-xs font-bold text-gray-300 hover:text-white hover:border-primary border border-glass transition-all duration-300 tracking-wide" style="backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
                                EU + US + MAJOR COUNTRIES
                            </button>
                            <button wire:click="applySuggestedCountries('blacklist')" class="glass px-4 py-2 rounded-lg text-xs font-bold text-gray-300 hover:text-white hover:border-danger border border-glass transition-all duration-300 tracking-wide" style="backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
                                HIGH-RISK COUNTRIES
                            </button>
                        </div>
                    </div>
                    
                    {{-- Countries Grid --}}
                    <div class="px-6 py-4 max-h-[50vh] overflow-y-auto" x-data="{ localSelected: @entangle('selectedCountries').live }">
                        @foreach($availableCountries as $continent => $countries)
                            <div class="mb-6 last:mb-0">
                                <h3 class="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">{{ $continent }}</h3>
                                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    @foreach($countries as $code => $data)
                                        <button 
                                            @click="
                                                if (localSelected.includes('{{ $code }}')) {
                                                    localSelected = localSelected.filter(c => c !== '{{ $code }}');
                                                } else {
                                                    localSelected.push('{{ $code }}');
                                                }
                                            "
                                            :class="localSelected.includes('{{ $code }}') ? 'glass-card border-primary shadow-glass-hover scale-105 glow-primary' : 'glass border-glass hover:border-primary hover:shadow-glass'"
                                            class="px-5 py-4 rounded-xl border-2 transition-all duration-300 text-left cursor-pointer group">
                                            <div class="flex items-center gap-4">
                                                <span class="text-4xl group-hover:scale-125 transition-transform duration-300">{{ $data['flag'] }}</span>
                                                <div class="flex-1 min-w-0">
                                                    <p class="text-base font-bold text-white truncate tracking-wide">{{ $data['name'] }}</p>
                                                    <p class="text-xs text-gray-400 font-mono font-semibold">{{ $code }}</p>
                                                </div>
                                                <div x-show="localSelected.includes('{{ $code }}')" class="flex-shrink-0" x-transition>
                                                    <div class="w-7 h-7 inner-button rounded-full flex items-center justify-center glow-primary">
                                                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    @endforeach
                                </div>
                            </div>
                        @endforeach
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-8 py-6 border-t border-glass glass-dark">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <div class="glass px-6 py-3 rounded-xl glow-secondary">
                                    <div class="flex items-center gap-2">
                                        <div class="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></div>
                                        <span class="text-gray-300 text-sm font-medium">Selected:</span>
                                        <span class="text-white font-bold text-2xl">{{ count($selectedCountries) }}</span>
                                        <span class="text-gray-400 text-sm font-medium tracking-wide">{{ count($selectedCountries) === 1 ? 'COUNTRY' : 'COUNTRIES' }}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-4">
                                <button @click="show = false" class="outer-button button-sm">
                                    CANCEL
                                </button>
                                <button wire:click="createGeoBlockingRule" class="inner-button button-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed" {{ count($selectedCountries) === 0 ? 'disabled' : '' }}>
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                    CREATE RULE
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    </div>
</div>
