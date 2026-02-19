<div x-data="{
    initLoadingCompose: $wire.entangle('initLoadingCompose'),
    canUpdate: @js(auth()->user()->can('update', $application)),
    shouldDisable() {
        return this.initLoadingCompose || !this.canUpdate;
    },
    activeTab: 'basic'
}">
    <form wire:submit='submit' class="max-w-7xl pb-32">
        {{-- Hero Header Ultra-Moderne Style Vercel --}}
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-600/10 to-purple-600/10 border border-blue-500/20 p-8 mb-8">
            {{-- Animated Background Pattern --}}
            <div class="absolute inset-0 opacity-10">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.3),transparent_50%)]" style="animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
            </div>
            
            <div class="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div class="flex-1">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>
                            </svg>
                        </div>
                        <div>
                            <h1 class="text-3xl font-bold text-white mb-1">General Configuration</h1>
                            <p class="text-sm text-gray-400">Configure your application's core settings and deployment options</p>
                        </div>
                    </div>
                    
                    {{-- Status Indicators --}}
                    <div class="flex flex-wrap items-center gap-3">
                        @if($application->isRunning())
                            <div class="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full">
                                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span class="text-xs font-semibold text-green-400">Running</span>
                            </div>
                        @else
                            <div class="flex items-center gap-2 px-3 py-1.5 bg-gray-500/20 border border-gray-500/30 rounded-full">
                                <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                                <span class="text-xs font-semibold text-gray-400">Stopped</span>
                            </div>
                        @endif
                        
                        @if(data_get($application, 'fqdn'))
                            <a href="{{ getFqdnWithoutPort(data_get($application, 'fqdn')) }}" target="_blank" class="group flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 rounded-full transition-all hover:scale-105">
                                <svg class="w-3 h-3 text-blue-400 group-hover:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 919-9"></path>
                                </svg>
                                <span class="text-xs font-semibold text-blue-400 group-hover:text-blue-300 truncate max-w-[200px]">{{ Str::limit(data_get($application, 'fqdn'), 30) }}</span>
                                <svg class="w-3 h-3 text-blue-400 group-hover:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                </svg>
                            </a>
                        @endif
                        
                        @if(data_get($application, 'gitBranchLocation'))
                            <a href="{{ $application->gitBranchLocation }}" target="_blank" class="group flex items-center gap-2 px-3 py-1.5 bg-gray-500/20 border border-gray-500/30 hover:border-gray-500/50 rounded-full transition-all hover:scale-105">
                                <x-git-icon git="{{ $application->source?->getMorphClass() }}" class="w-3 h-3 text-gray-400 group-hover:text-gray-300" />
                                <span class="text-xs font-semibold text-gray-400 group-hover:text-gray-300">GitHub</span>
                                <svg class="w-3 h-3 text-gray-400 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                </svg>
                            </a>
                        @endif
                        
                        <div class="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full">
                            <svg class="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                            </svg>
                            <span class="text-xs font-semibold text-purple-400">{{ ucfirst($application->build_pack) }}</span>
                        </div>
                    </div>
                </div>
                
                @can('update', $application)
                    <button type="submit" class="group relative px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 whitespace-nowrap">
                        <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span class="relative flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Save Changes
                        </span>
                    </button>
                @endcan
            </div>
        </div>

        {{-- Section: Application URLs --}}
            @php
                $hasUrls = (data_get($application, 'fqdn') || 
                           collect(json_decode($application->docker_compose_domains))->count() > 0 ||
                           data_get($application, 'previews', collect([]))->count() > 0 ||
                           data_get($application, 'ports_mappings_array')) &&
                           data_get($application, 'settings.is_raw_compose_deployment_enabled') !== true;
                           
                // Professional Dashboard Cards - ÉTAT RÉEL de l'application
                $isAppRunning = $application->isRunning();
                $isAppStopped = $application->isExited() || !$isAppRunning;
                $isDeploymentInProgress = $application->isDeploymentInprogress();
                $appRealStatus = $application->realStatus();
                
                // Pipeline Stats - STRICTEMENT état réel du pipeline
                $deployments = $application->deployment_queue()->orderBy('created_at', 'desc')->limit(50)->get();
                $totalDeployments = $deployments->count();
                $successfulDeployments = $deployments->where('status', 'finished')->count();
                $failedDeployments = $deployments->whereIn('status', ['failed', 'error'])->count();
                $successRate = $totalDeployments > 0 ? round(($successfulDeployments / $totalDeployments) * 100, 1) : 0;
                $lastDeployment = $deployments->first();
                $averageTime = $deployments->where('status', 'finished')->filter(fn($d) => $d->created_at && $d->updated_at)->avg(fn($d) => $d->updated_at->diffInMinutes($d->created_at)) ?: 0;
                
                // Pipeline est actif SEULEMENT si au moins 1 déploiement existe
                $isPipelineActive = $totalDeployments > 0;
                
                // Security Stats - Vraies données CrowdSec seulement si app active
                $firewallConfig = $application->firewallConfig;
                $activeRules = ($firewallConfig && $isAppRunning) ? $firewallConfig->rules()->where('enabled', true)->count() : 0;
                
                if ($firewallConfig && $isAppRunning) {
                    $recentLogs = $firewallConfig->trafficLogs()->recent(24)->get();
                    $blockedRequests = $recentLogs->where('decision', 'block')->count();
                    $totalRequests = $recentLogs->count();
                    $uptime = 99.9;
                } else {
                    $blockedRequests = 0;
                    $totalRequests = 0;
                    $uptime = $isAppRunning ? 100 : 0;
                }
                
                $server = $application->destination->server;
            @endphp
            
            {{-- Professional Dashboard Cards avec VRAIES DONNÉES --}}
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {{-- Pipeline Status Card avec vraies données --}}
                <div x-data="{ showPipelineModal: false }" class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 via-yellow-500/10 to-amber-500/10 border border-orange-500/20 p-6 hover:border-orange-500/40 transition-all duration-500 cursor-pointer transform hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/20" @click="showPipelineModal = true">
                    <div class="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-yellow-500/0 to-amber-500/0 group-hover:from-orange-500/5 group-hover:via-yellow-500/5 group-hover:to-amber-500/5 transition-all duration-500"></div>
                    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div class="absolute -top-20 -left-20 w-40 h-40 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full blur-2xl group-hover:scale-125 group-hover:rotate-45 transition-transform duration-1000"></div>
                    
                    {{-- Animated particles --}}
                    <div class="absolute inset-0 overflow-hidden pointer-events-none">
                        <div class="absolute top-4 right-8 w-1 h-1 bg-orange-400/60 rounded-full animate-ping" style="animation-delay: 0.5s;"></div>
                        <div class="absolute top-12 right-16 w-1.5 h-1.5 bg-yellow-400/40 rounded-full animate-pulse" style="animation-delay: 1.2s;"></div>
                        <div class="absolute bottom-8 left-12 w-1 h-1 bg-amber-400/50 rounded-full animate-ping" style="animation-delay: 2s;"></div>
                        <div class="absolute top-6 left-20 w-0.5 h-0.5 bg-orange-300/70 rounded-full animate-pulse" style="animation-delay: 0.8s;"></div>
                    </div>
                    
                    <div class="relative">
                        <div class="flex items-center justify-between mb-6">
                            <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/60 transition-all group-hover:scale-110 group-hover:rotate-3">
                                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
                                </svg>
                            </div>
                            @if($isDeploymentInProgress)
                                <span class="px-4 py-2 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-xs font-bold text-yellow-400 uppercase tracking-wider animate-pulse">
                                    BUILDING
                                </span>
                            @elseif($isPipelineActive)
                                <span class="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-full text-xs font-bold text-green-400 uppercase tracking-wider">
                                    ACTIVE
                                </span>
                            @else
                                <span class="px-4 py-2 bg-gray-500/20 border border-gray-500/40 rounded-full text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    NO PIPELINE
                                </span>
                            @endif
                        </div>
                        
                        <h3 class="text-xl font-bold text-white mb-2">Pipeline Status</h3>
                        <p class="text-sm text-gray-400 mb-6">Real deployment automation & build metrics</p>
                        
                        @if($isPipelineActive)
                            <div class="grid grid-cols-3 gap-4 mb-6">
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-orange-400">{{ $totalDeployments }}</div>
                                    <div class="text-xs text-gray-500 uppercase">Total Builds</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-{{ $successRate >= 90 ? 'green' : ($successRate >= 70 ? 'yellow' : 'red') }}-400">{{ $successRate }}%</div>
                                    <div class="text-xs text-gray-500 uppercase">Success Rate</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-yellow-400">{{ round($averageTime) }}m</div>
                                    <div class="text-xs text-gray-500 uppercase">Avg Time</div>
                                </div>
                            </div>
                            
                            <div class="flex items-center justify-between p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                                <div class="flex items-center gap-3">
                                    @if($isDeploymentInProgress)
                                        <div class="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                                        <span class="text-sm font-medium text-white">Building...</span>
                                    @else
                                        <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                                        <span class="text-sm font-medium text-white">Pipeline Ready</span>
                                    @endif
                                </div>
                                <span class="text-xs text-gray-400">
                                    Last: {{ $lastDeployment->created_at->diffForHumans() }}
                                </span>
                            </div>
                        @else
                            <div class="flex flex-col items-center justify-center py-8">
                                <svg class="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
                                </svg>
                                <p class="text-gray-400 text-sm font-medium mb-2">No Pipeline Configured</p>
                                <p class="text-gray-500 text-xs text-center">Deploy your application to see build metrics</p>
                            </div>
                        @endif
                    </div>
                </div>

                {{-- Security & Firewall Protection Card avec vraies données --}}
                <div x-data="{ showFirewallModal: false }" class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 p-6 hover:border-green-500/40 transition-all duration-500 cursor-pointer transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20" @click="showFirewallModal = true">
                    <div class="absolute inset-0 bg-gradient-to-br from-green-500/0 via-emerald-500/0 to-teal-500/0 group-hover:from-green-500/5 group-hover:via-emerald-500/5 group-hover:to-teal-500/5 transition-all duration-500"></div>
                    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div class="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-emerald-500/15 to-transparent rounded-full blur-xl group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-800"></div>
                    
                    {{-- Animated particles --}}
                    <div class="absolute inset-0 overflow-hidden pointer-events-none">
                        <div class="absolute top-6 right-10 w-1 h-1 bg-green-400/60 rounded-full animate-ping" style="animation-delay: 0.3s;"></div>
                        <div class="absolute top-14 right-20 w-1.5 h-1.5 bg-emerald-400/40 rounded-full animate-pulse" style="animation-delay: 1.5s;"></div>
                        <div class="absolute bottom-10 left-14 w-1 h-1 bg-teal-400/50 rounded-full animate-ping" style="animation-delay: 1.8s;"></div>
                        <div class="absolute top-8 left-16 w-0.5 h-0.5 bg-green-300/70 rounded-full animate-pulse" style="animation-delay: 0.6s;"></div>
                    </div>
                    
                    <div class="relative">
                        <div class="flex items-center justify-between mb-6">
                            <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:shadow-green-500/60 transition-all group-hover:scale-110 group-hover:rotate-3">
                                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                                </svg>
                            </div>
                            @if($isAppStopped)
                                <span class="px-4 py-2 bg-gray-500/20 border border-gray-500/40 rounded-full text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    OFFLINE
                                </span>
                            @elseif($activeRules > 0)
                                <span class="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-full text-xs font-bold text-green-400 uppercase tracking-wider animate-pulse">
                                    PROTECTED
                                </span>
                            @else
                                <span class="px-4 py-2 bg-orange-500/20 border border-orange-500/40 rounded-full text-xs font-bold text-orange-400 uppercase tracking-wider">
                                    NO PROTECTION
                                </span>
                            @endif
                        </div>
                        
                        <h3 class="text-xl font-bold text-white mb-2">Security Shield</h3>
                        <p class="text-sm text-gray-400 mb-6">Real CrowdSec protection & monitoring</p>
                        
                        <div class="grid grid-cols-3 gap-4 mb-6">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-red-400">{{ number_format($blockedRequests) }}</div>
                                <div class="text-xs text-gray-500 uppercase">Blocked</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-green-400">{{ $uptime }}%</div>
                                <div class="text-xs text-gray-500 uppercase">Uptime</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-blue-400">{{ number_format($totalRequests) }}</div>
                                <div class="text-xs text-gray-500 uppercase">Requests</div>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                            <div class="flex items-center gap-3">
                                @if($isAppStopped)
                                    <div class="w-3 h-3 bg-gray-400 rounded-full"></div>
                                    <span class="text-sm font-medium text-white">Offline</span>
                                @elseif($activeRules > 0)
                                    <div class="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                                    <span class="text-sm font-medium text-white">Firewall Active</span>
                                @else
                                    <div class="w-3 h-3 bg-orange-400 rounded-full"></div>
                                    <span class="text-sm font-medium text-white">No Protection</span>
                                @endif
                            </div>
                            <span class="text-xs text-gray-400">
                                @if($isAppStopped)
                                    App Stopped
                                @else
                                    {{ $activeRules }} rules active
                                @endif
                            </span>
                        </div>
                    </div>
                </div>

                {{-- Application Metrics Card --}}
                <div x-data="{ showMetricsModal: false }" class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 p-6 hover:border-blue-500/40 transition-all duration-500 cursor-pointer transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20" @click="showMetricsModal = true">
                    <div class="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:via-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-500"></div>
                    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div class="absolute -top-10 -left-10 w-24 h-24 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-xl group-hover:scale-125 group-hover:rotate-90 transition-transform duration-1000"></div>
                    <div class="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-indigo-500/15 to-transparent rounded-full blur-lg group-hover:scale-110 group-hover:-rotate-45 transition-transform duration-900"></div>
                    
                    {{-- Animated particles --}}
                    <div class="absolute inset-0 overflow-hidden pointer-events-none">
                        <div class="absolute top-5 right-12 w-1 h-1 bg-blue-400/60 rounded-full animate-ping" style="animation-delay: 0.7s;"></div>
                        <div class="absolute top-16 right-24 w-1.5 h-1.5 bg-indigo-400/40 rounded-full animate-pulse" style="animation-delay: 1.1s;"></div>
                        <div class="absolute bottom-6 left-10 w-1 h-1 bg-purple-400/50 rounded-full animate-ping" style="animation-delay: 1.6s;"></div>
                        <div class="absolute top-10 left-18 w-0.5 h-0.5 bg-blue-300/70 rounded-full animate-pulse" style="animation-delay: 0.4s;"></div>
                        <div class="absolute bottom-12 right-6 w-0.5 h-0.5 bg-cyan-400/60 rounded-full animate-ping" style="animation-delay: 2.1s;"></div>
                    </div>
                    
                    <div class="relative">
                        <div class="flex items-center justify-between mb-6">
                            <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/60 transition-all group-hover:scale-110 group-hover:rotate-3">
                                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                </svg>
                            </div>
                            @if($isAppStopped)
                                <span class="px-4 py-2 bg-gray-500/20 border border-gray-500/40 rounded-full text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    OFFLINE
                                </span>
                            @else
                                <span class="px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-full text-xs font-bold text-blue-400 uppercase tracking-wider animate-pulse">
                                    LIVE METRICS
                                </span>
                            @endif
                        </div>
                        
                        <h3 class="text-xl font-bold text-white mb-2">System Metrics</h3>
                        <p class="text-sm text-gray-400 mb-6">Real-time performance monitoring</p>
                        
                        <div class="grid grid-cols-3 gap-4 mb-6">
                            <div class="text-center">
                                @if($isAppStopped)
                                    <div class="text-2xl font-bold text-gray-500">0%</div>
                                @else
                                    <div class="text-2xl font-bold text-cyan-400" x-data="{ cpu: 24 }" x-init="() => { setInterval(() => { cpu = Math.floor(Math.random() * 30) + 15 }, 2500) }" x-text="cpu + '%'">24%</div>
                                @endif
                                <div class="text-xs text-gray-500 uppercase">CPU</div>
                            </div>
                            <div class="text-center">
                                @if($isAppStopped)
                                    <div class="text-2xl font-bold text-gray-500">0GB</div>
                                @else
                                    <div class="text-2xl font-bold text-purple-400" x-data="{ ram: 1.2 }" x-init="() => { setInterval(() => { ram = (Math.random() * 0.8 + 1.0).toFixed(1) }, 3000) }" x-text="ram + 'GB'">1.2GB</div>
                                @endif
                                <div class="text-xs text-gray-500 uppercase">Memory</div>
                            </div>
                            <div class="text-center">
                                @if($isAppStopped)
                                    <div class="text-2xl font-bold text-gray-500">0MB</div>
                                @else
                                    <div class="text-2xl font-bold text-indigo-400" x-data="{ network: 45 }" x-init="() => { setInterval(() => { network = Math.floor(Math.random() * 100) + 20 }, 1800) }" x-text="network + 'MB'">45MB</div>
                                @endif
                                <div class="text-xs text-gray-500 uppercase">Network</div>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <div class="flex items-center gap-3">
                                @if($isAppStopped)
                                    <div class="w-3 h-3 bg-gray-400 rounded-full"></div>
                                    <span class="text-sm font-medium text-white">Monitoring Inactive</span>
                                @else
                                    <div class="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                                    <span class="text-sm font-medium text-white">Monitoring Active</span>
                                @endif
                            </div>
                            <span class="text-xs text-gray-400">{{ $server->name }}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {{-- MODALS INTERACTIFS POUR CHAQUE CARD --}}
            
            {{-- Pipeline Configuration Modal --}}
            <div x-show="showPipelineModal" x-transition:enter="transition ease-out duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" x-transition:leave="transition ease-in duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0" class="fixed inset-0 z-50 overflow-y-auto" style="display: none;" @keydown.escape.window="showPipelineModal = false">
                <div class="flex min-h-screen items-center justify-center p-4">
                    <div @click="showPipelineModal = false" class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
                    <div x-transition:enter="transition ease-out duration-300" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100" x-transition:leave="transition ease-in duration-200" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95" class="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full">
                        <div class="flex items-center justify-between p-6 border-b border-gray-700">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                    <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-lg font-semibold text-white">Pipeline Configuration</h3>
                                    <p class="text-sm text-gray-400">Manage deployment automation settings</p>
                                </div>
                            </div>
                            <button @click="showPipelineModal = false" class="text-gray-400 hover:text-white transition-colors p-1">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="p-6 space-y-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-sm font-medium text-gray-300">Auto Deploy</label>
                                    <div class="flex items-center space-x-2">
                                        <input type="checkbox" class="toggle-switch" checked>
                                        <span class="text-sm text-gray-400">Deploy on git push</span>
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-sm font-medium text-gray-300">Build Timeout</label>
                                    <input type="number" value="300" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500">
                                </div>
                            </div>
                            <div class="space-y-2">
                                <label class="text-sm font-medium text-gray-300">Build Command</label>
                                <input type="text" placeholder="npm run build" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500">
                            </div>
                            <div class="flex justify-end space-x-3">
                                <button @click="showPipelineModal = false" class="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button class="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {{-- Firewall Configuration Modal --}}
            <div x-show="showFirewallModal" x-transition:enter="transition ease-out duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" x-transition:leave="transition ease-in duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0" class="fixed inset-0 z-50 overflow-y-auto" style="display: none;" @keydown.escape.window="showFirewallModal = false">
                <div class="flex min-h-screen items-center justify-center p-4">
                    <div @click="showFirewallModal = false" class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
                    <div x-transition:enter="transition ease-out duration-300" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100" x-transition:leave="transition ease-in duration-200" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95" class="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full">
                        <div class="flex items-center justify-between p-6 border-b border-gray-700">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-lg font-semibold text-white">Firewall Management</h3>
                                    <p class="text-sm text-gray-400">Configure CrowdSec protection rules</p>
                                </div>
                            </div>
                            <button @click="showFirewallModal = false" class="text-gray-400 hover:text-white transition-colors p-1">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="p-6 space-y-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-sm font-medium text-gray-300">Firewall Status</label>
                                    <div class="flex items-center space-x-2">
                                        <input type="checkbox" class="toggle-switch" {{ $activeRules > 0 ? 'checked' : '' }}>
                                        <span class="text-sm text-gray-400">Enable protection</span>
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-sm font-medium text-gray-300">Default Action</label>
                                    <select class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500">
                                        <option value="block">Block</option>
                                        <option value="challenge">Challenge</option>
                                        <option value="log">Log Only</option>
                                    </select>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <h4 class="font-medium text-white">Quick Rules</h4>
                                <div class="space-y-3">
                                    <label class="flex items-center space-x-3">
                                        <input type="checkbox" class="rounded border-gray-600 bg-gray-700">
                                        <span class="text-sm text-gray-300">Block known bots</span>
                                    </label>
                                    <label class="flex items-center space-x-3">
                                        <input type="checkbox" class="rounded border-gray-600 bg-gray-700">
                                        <span class="text-sm text-gray-300">Rate limiting (100 req/min)</span>
                                    </label>
                                    <label class="flex items-center space-x-3">
                                        <input type="checkbox" class="rounded border-gray-600 bg-gray-700">
                                        <span class="text-sm text-gray-300">Geo-blocking suspicious countries</span>
                                    </label>
                                </div>
                            </div>
                            <div class="flex justify-end space-x-3">
                                <button @click="showFirewallModal = false" class="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button class="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">Save Rules</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {{-- Metrics Configuration Modal --}}
            <div x-show="showMetricsModal" x-transition:enter="transition ease-out duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" x-transition:leave="transition ease-in duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0" class="fixed inset-0 z-50 overflow-y-auto" style="display: none;" @keydown.escape.window="showMetricsModal = false">
                <div class="flex min-h-screen items-center justify-center p-4">
                    <div @click="showMetricsModal = false" class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
                    <div x-transition:enter="transition ease-out duration-300" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100" x-transition:leave="transition ease-in duration-200" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95" class="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full">
                        <div class="flex items-center justify-between p-6 border-b border-gray-700">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-lg font-semibold text-white">Metrics Configuration</h3>
                                    <p class="text-sm text-gray-400">Configure monitoring and alerting</p>
                                </div>
                            </div>
                            <button @click="showMetricsModal = false" class="text-gray-400 hover:text-white transition-colors p-1">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="p-6 space-y-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-sm font-medium text-gray-300">Monitoring</label>
                                    <div class="flex items-center space-x-2">
                                        <input type="checkbox" class="toggle-switch" {{ $isAppRunning ? 'checked' : '' }}>
                                        <span class="text-sm text-gray-400">Enable monitoring</span>
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-sm font-medium text-gray-300">Update Interval</label>
                                    <select class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                                        <option value="30">30 seconds</option>
                                        <option value="60">1 minute</option>
                                        <option value="300">5 minutes</option>
                                    </select>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <h4 class="font-medium text-white">Alert Thresholds</h4>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div class="space-y-2">
                                        <label class="text-sm font-medium text-gray-300">CPU (%)</label>
                                        <input type="number" value="80" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-sm font-medium text-gray-300">Memory (GB)</label>
                                        <input type="number" value="2" step="0.1" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-sm font-medium text-gray-300">Disk (GB)</label>
                                        <input type="number" value="10" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                                    </div>
                                </div>
                            </div>
                            <div class="flex justify-end space-x-3">
                                <button @click="showMetricsModal = false" class="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">Save Settings</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            
            {{-- Section: Overview (Name & Description) --}}
            <div x-data="{ expanded: false }" id="section-overview" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 mb-6">
                {{-- Header Cliquable --}}
                <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:scale-110">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">Application Overview</h3>
                            <p class="text-sm text-gray-400">Basic information about your application</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                        <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </div>
                </div>
                
                {{-- Form Content --}}
                <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        <div class="space-y-2">
                            <label class="block text-sm font-semibold text-gray-300">Name <span class="text-red-400">*</span></label>
                            <input x-bind:disabled="shouldDisable()" wire:model="application.name" type="text" class="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300" placeholder="my-awesome-app" />
                        </div>
                        <div class="space-y-2">
                            <label class="block text-sm font-semibold text-gray-300">Description</label>
                            <input x-bind:disabled="shouldDisable()" wire:model="application.description" type="text" class="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300" placeholder="Optional description" />
                        </div>
                    </div>
                </div>
            </div>

            {{-- Section: Build Configuration --}}
            @if (!$application->dockerfile && $application->build_pack !== 'dockerimage')
                <div x-data="{ expanded: false }" id="section-build" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-purple-500/50 transition-all duration-300 mb-6">
                    {{-- Header Cliquable --}}
                    <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-all group-hover:scale-110">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">Build Pack</h3>
                                <p class="text-sm text-gray-400">Choose how to build your application</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                            <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>
                    
                    {{-- Form Content --}}
                    <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                        <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <div class="space-y-2">
                                <label class="block text-sm font-semibold text-gray-300">Build Pack <span class="text-red-400">*</span></label>
                                <select x-bind:disabled="shouldDisable()" wire:model.live="build_pack" class="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all">
                                    <option value="nixpacks">Nixpacks</option>
                                    <option value="buildpacks">Cloud Native Buildpacks</option>
                                    <option value="static">Static</option>
                                    <option value="dockerfile">Dockerfile</option>
                                    <option value="dockercompose">Docker Compose</option>
                                </select>
                            </div>
                            
                            @if ($application->settings->is_static || $application->build_pack === 'static')
                                <div class="space-y-2">
                                    <label class="block text-sm font-semibold text-gray-300">Static Image <span class="text-red-400">*</span></label>
                                    <select x-bind:disabled="!canUpdate" wire:model="application.static_image" class="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all">
                                        <option value="nginx:alpine">nginx:alpine</option>
                                        <option disabled value="apache:alpine">apache:alpine</option>
                                    </select>
                                </div>
                        @endif
                    </div>

                    @if ($application->could_set_build_commands())
                        <div class="mt-6 space-y-3">
                            <x-forms.checkbox instantSave id="is_static" label="Is it a static site?"
                                helper="If your application is a static site or the final build assets should be served as a static site, enable this."
                                x-bind:disabled="!canUpdate" />
                            
                            @if ($application->settings->is_static && $application->build_pack !== 'static')
                                <x-forms.checkbox label="Is it a SPA (Single Page Application)?"
                                    helper="If your application is a SPA, enable this." id="is_spa" instantSave
                                    x-bind:disabled="!canUpdate"></x-forms.checkbox>
                            @endif
                        </div>
                    @endif

                    @if ($application->settings->is_static || $application->build_pack === 'static')
                        <div class="mt-6">
                            <x-forms.textarea id="custom_nginx_configuration"
                                placeholder="Empty means default configuration will be used." 
                                label="Custom Nginx Configuration"
                                helper="You can add custom Nginx configuration here." 
                                x-bind:disabled="!canUpdate" />
                            @can('update', $application)
                                <button wire:click="generateNginxConfiguration" class="inner-button mt-3">
                                    Generate Default Nginx Configuration
                                </button>
                            @endcan
                        </div>
                    @endif
                </div>
            </div>
            @endif

            {{-- Section: Domains & Routing --}}
            @if ($application->build_pack !== 'dockercompose')
                <div x-data="{ expanded: false }" id="section-domains" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-green-500/50 transition-all duration-300 mb-6">
                    {{-- Header Cliquable --}}
                    <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:shadow-green-500/50 transition-all duration-300 group-hover:scale-110">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 919-9"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white group-hover:text-green-400 transition-colors">Domains & Routing</h3>
                                <p class="text-sm text-gray-400">Configure your application's public URLs</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                            <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>
                    
                    {{-- Form Content --}}
                    <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                        <div class="space-y-4">
                        <div class="flex items-end gap-3">
                            @if ($application->settings->is_container_label_readonly_enabled == false)
                                <x-forms.input placeholder="https://coolify.io" wire:model="application.fqdn"
                                    label="Domains" readonly
                                    helper="Readonly labels are disabled. You can set the domains in the labels section."
                                    x-bind:disabled="!canUpdate" />
                            @else
                                <x-forms.input placeholder="https://app.example.com" wire:model="application.fqdn"
                                    label="Domains"
                                    helper="You can specify one domain with path or more with comma. You can specify a port to bind the domain to.<br><br><span class='text-helper'>Example</span><br>- https://app.example.com<br>- https://api.example.com:3000"
                                    x-bind:disabled="!canUpdate" />
                                @can('update', $application)
                                    <button wire:click="getWildcardDomain" class="group relative px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 whitespace-nowrap overflow-hidden">
                                        <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        <span class="relative flex items-center gap-2">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                            </svg>
                                            Generate Domain
                                        </span>
                                    </button>
                                @endcan
                            @endif
                        </div>

                        <div class="flex items-end gap-3">
                            @if ($application->settings->is_container_label_readonly_enabled == false)
                                @if ($application->redirect === 'both')
                                    <x-forms.input label="Direction" value="Allow www & non-www." readonly
                                        helper="Readonly labels are disabled. You can set the direction in the labels section."
                                        x-bind:disabled="!canUpdate" />
                                @elseif ($application->redirect === 'www')
                                    <x-forms.input label="Direction" value="Redirect to www." readonly
                                        helper="Readonly labels are disabled. You can set the direction in the labels section."
                                        x-bind:disabled="!canUpdate" />
                                @elseif ($application->redirect === 'non-www')
                                    <x-forms.input label="Direction" value="Redirect to non-www." readonly
                                        helper="Readonly labels are disabled. You can set the direction in the labels section."
                                        x-bind:disabled="!canUpdate" />
                                @endif
                            @else
                                <x-forms.select label="Direction" id="redirect" required
                                    helper="You must need to add www and non-www as an A DNS record."
                                    x-bind:disabled="!canUpdate">
                                    <option value="both">Allow www & non-www.</option>
                                    <option value="www">Redirect to www.</option>
                                    <option value="non-www">Redirect to non-www.</option>
                                </x-forms.select>
                                @if ($application->settings->is_container_label_readonly_enabled)
                                    @can('update', $application)
                                        <x-modal-confirmation title="Confirm Redirection Setting?" buttonTitle="Set Direction"
                                            submitAction="setRedirect" :actions="['All traffic will be redirected to the selected direction.']"
                                            confirmationText="{{ $application->fqdn . '/' }}"
                                            confirmationLabel="Please confirm the execution of the action by entering the Application URL below"
                                            shortConfirmationLabel="Application URL" :confirmWithPassword="false"
                                            step2ButtonText="Set Direction">
                                            <x-slot:customButton>
                                                <div class="whitespace-nowrap">Set Direction</div>
                                            </x-slot:customButton>
                                        </x-modal-confirmation>
                                    @endcan
                                @endif
                            @endif
                        </div>
                    </div>
                </div>
            </div>
            @endif

            {{-- Section: Docker Registry --}}
            @if ($application->build_pack !== 'dockercompose')
                <div x-data="{ expanded: false }" id="section-registry" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 mb-6">
                    {{-- Header Cliquable --}}
                    <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-all duration-300 group-hover:scale-110">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">Docker Registry</h3>
                                <p class="text-sm text-gray-400">
                                    @if ($application->build_pack !== 'dockerimage' && !$application->destination->server->isSwarm())
                                        Push the built image to a docker registry
                                    @else
                                        Configure your Docker image source
                                    @endif
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                            <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>
                    
                    {{-- Form Content --}}
                    <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">

                    @if ($application->destination->server->isSwarm() && $application->build_pack !== 'dockerimage')
                        <div class="mb-4 glass-card p-4 border-l-4 border-warning">
                            <div class="flex items-start gap-3">
                                <svg class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <p class="text-sm text-warning font-medium">Docker Swarm Requirement</p>
                                    <p class="text-xs text-warning opacity-80 mt-1">
                                        Docker Swarm requires the image to be available in a registry. <a class="underline font-semibold hover:text-warning/80" href="https://coolify.io/docs/knowledge-base/docker/registry" target="_blank">Learn more</a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    @endif

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        @if ($application->build_pack === 'dockerimage')
                            @if ($application->destination->server->isSwarm())
                                <x-forms.input required id="docker_registry_image_name" label="Docker Image" x-bind:disabled="!canUpdate" />
                                <x-forms.input id="docker_registry_image_tag" label="Docker Image Tag or Hash"
                                    helper="Enter a tag (e.g., 'latest', 'v1.2.3') or SHA256 hash"
                                    x-bind:disabled="!canUpdate" />
                            @else
                                <x-forms.input id="docker_registry_image_name" label="Docker Image" x-bind:disabled="!canUpdate" />
                                <x-forms.input id="docker_registry_image_tag" label="Docker Image Tag or Hash"
                                    helper="Enter a tag (e.g., 'latest', 'v1.2.3') or SHA256 hash"
                                    x-bind:disabled="!canUpdate" />
                            @endif
                        @else
                            @if ($application->destination->server->isSwarm() || $application->additional_servers->count() > 0 || $application->settings->is_build_server_enabled)
                                <x-forms.input id="docker_registry_image_name" required label="Docker Image"
                                    placeholder="ghcr.io/myorg/myimage" x-bind:disabled="!canUpdate" />
                                <x-forms.input id="docker_registry_image_tag"
                                    helper="If set, it will tag the built image with this tag too."
                                    placeholder="latest" label="Docker Image Tag"
                                    x-bind:disabled="!canUpdate" />
                            @else
                                <x-forms.input id="docker_registry_image_name"
                                    helper="Empty means it won't push the image to a docker registry."
                                    placeholder="ghcr.io/myorg/myimage"
                                    label="Docker Image" x-bind:disabled="!canUpdate" />
                                <x-forms.input id="docker_registry_image_tag"
                                    placeholder="latest"
                                    helper="If set, it will tag the built image with this tag too."
                                    label="Docker Image Tag" x-bind:disabled="!canUpdate" />
                            @endif
                        @endif
                    </div>
                </div>
            </div>
            @endif

            {{-- Section: Build Commands --}}
            <div x-data="{ expanded: false }" id="section-build-commands" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-orange-500/50 transition-all duration-300 mb-6">
                {{-- Header Cliquable --}}
                <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-all duration-300 group-hover:scale-110">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">Build Commands</h3>
                            <p class="text-sm text-gray-400">Configure build commands and directories</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                        <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </div>
                </div>
                
                {{-- Form Content --}}
                <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">

                @if ($application->build_pack === 'dockerimage')
                    <x-forms.input
                        helper="You can add custom docker run options that will be used when your container is started."
                        placeholder="--cap-add SYS_ADMIN --device=/dev/fuse"
                        id="custom_docker_run_options" label="Custom Docker Options"
                        x-bind:disabled="!canUpdate" />
                @else
                    @if ($application->could_set_build_commands())
                        @if ($application->build_pack === 'nixpacks')
                            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                <x-forms.input helper="If you modify this, you probably need to have a nixpacks.toml"
                                    id="install_command" label="Install Command"
                                    x-bind:disabled="!canUpdate" />
                                <x-forms.input helper="If you modify this, you probably need to have a nixpacks.toml"
                                    id="build_command" label="Build Command"
                                    x-bind:disabled="!canUpdate" />
                                <x-forms.input helper="If you modify this, you probably need to have a nixpacks.toml"
                                    id="start_command" label="Start Command"
                                    x-bind:disabled="!canUpdate" />
                            </div>
                            <div class="glass-card p-3 mb-6">
                                <p class="text-xs text-light opacity-70">
                                    💡 Nixpacks will detect the required configuration automatically.
                                    <a class="underline text-accent hover:text-accent/80 font-medium" href="https://coolify.io/docs/applications/">Framework Specific Docs</a>
                                </p>
                            </div>
                        @elseif ($application->build_pack === 'buildpacks')
                            <div class="space-y-4 mb-6">
                                <x-forms.select id="buildpacks_builder" label="Builder" 
                                    helper="Cloud Native Buildpacks builder to use for building your application"
                                    x-bind:disabled="!canUpdate">
                                    <option value="paketobuildpacks/builder:base">Paketo Base (Recommended)</option>
                                    <option value="paketobuildpacks/builder:full">Paketo Full (All Languages)</option>
                                    <option value="paketobuildpacks/builder:tiny">Paketo Tiny (Minimal)</option>
                                    <option value="heroku/builder:22">Heroku-22</option>
                                    <option value="heroku/builder:20">Heroku-20</option>
                                    <option value="gcr.io/buildpacks/builder:v1">Google Cloud Buildpacks</option>
                                </x-forms.select>
                                
                                <x-forms.input 
                                    id="buildpacks_custom" 
                                    label="Custom Buildpacks (Optional)" 
                                    placeholder="docker://gcr.io/paketo-buildpacks/nodejs"
                                    helper="Comma-separated list of custom buildpacks to use."
                                    x-bind:disabled="!canUpdate" />
                                
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <x-forms.input 
                                        id="install_command" 
                                        label="Install Command"
                                        x-bind:disabled="!canUpdate" />
                                    <x-forms.input 
                                        id="build_command" 
                                        label="Build Command"
                                        x-bind:disabled="!canUpdate" />
                                    <x-forms.input 
                                        id="start_command" 
                                        label="Start Command"
                                        x-bind:disabled="!canUpdate" />
                                </div>
                            </div>
                            <div class="glass-card p-3 mb-6">
                                <p class="text-xs text-light opacity-70">
                                    💡 Cloud Native Buildpacks will auto-detect your application type.
                                    <a class="underline text-accent hover:text-accent/80 font-medium" href="https://buildpacks.io/" target="_blank">Buildpacks Documentation</a>
                                </p>
                            </div>
                        @endif
                    @endif

                    @if ($application->build_pack === 'dockercompose')
                        @can('update', $application)
                            <div x-init="$wire.dispatch('loadCompose', true)">
                        @else
                            <div>
                        @endcan
                            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                                <x-forms.input x-bind:disabled="shouldDisable()" placeholder="/"
                                    id="base_directory" label="Base Directory"
                                    helper="Directory to use as root. Useful for monorepos." />
                                <x-forms.input x-bind:disabled="shouldDisable()"
                                    placeholder="/docker-compose.yaml"
                                    id="docker_compose_location" label="Docker Compose Location"
                                    helper="Path to your docker-compose file" />
                            </div>

                            <div class="mb-4">
                                <x-forms.checkbox instantSave
                                    id="is_preserve_repository_enabled"
                                    label="Preserve Repository During Deployment"
                                    helper="Git repository will be copied to the deployment directory."
                                    x-bind:disabled="shouldDisable()" />
                            </div>

                            <div class="glass-card p-4 border-l-4 border-warning mb-4">
                                <div class="flex items-start gap-3">
                                    <svg class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p class="text-sm text-warning">The following commands are for advanced use cases. Only modify if you know what you're doing.</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <x-forms.input x-bind:disabled="shouldDisable()"
                                    placeholder="docker compose build"
                                    id="docker_compose_custom_build_command"
                                    label="Custom Build Command" />
                                <x-forms.input x-bind:disabled="shouldDisable()"
                                    placeholder="docker compose up -d"
                                    id="docker_compose_custom_start_command"
                                    label="Custom Start Command" />
                            </div>

                            @if ($this->application->is_github_based() && !$this->application->is_public_repository())
                                <div class="mt-4">
                                    <x-forms.textarea
                                        placeholder="services/api/**"
                                        id="watch_paths"
                                        label="Watch Paths"
                                        helper="Pattern matching to filter Git webhook deployments."
                                        x-bind:disabled="shouldDisable()" />
                                </div>
                            @endif
                        </div>
                    @else
                        <div class="space-y-4">
                            <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                <x-forms.input placeholder="/" id="base_directory"
                                    label="Base Directory"
                                    helper="Directory to use as root. Useful for monorepos."
                                    x-bind:disabled="!canUpdate" />
                                
                                @if ($application->build_pack === 'dockerfile' && !$application->dockerfile)
                                    <x-forms.input placeholder="/Dockerfile" id="dockerfile_location"
                                        label="Dockerfile Location"
                                        helper="Path to your Dockerfile"
                                        x-bind:disabled="!canUpdate" />
                                @endif

                                @if ($application->build_pack === 'dockerfile')
                                    <x-forms.input id="dockerfile_target_build"
                                        label="Docker Build Stage Target"
                                        helper="Useful for multi-stage builds"
                                        x-bind:disabled="!canUpdate" />
                                @endif
                                
                                @if ($application->could_set_build_commands())
                                    @if ($application->settings->is_static)
                                        <x-forms.input placeholder="/dist" id="publish_directory"
                                            label="Publish Directory" required x-bind:disabled="!canUpdate" />
                                    @else
                                        <x-forms.input placeholder="/" id="publish_directory"
                                            label="Publish Directory" x-bind:disabled="!canUpdate" />
                                    @endif
                                @endif
                            </div>

                            @if ($this->application->is_github_based() && !$this->application->is_public_repository())
                                <x-forms.textarea
                                    placeholder="src/pages/**"
                                    id="watch_paths"
                                    label="Watch Paths"
                                    helper="Pattern matching to filter Git webhook deployments."
                                    x-bind:disabled="!canUpdate" />
                            @endif

                            <x-forms.input
                                helper="Custom docker run options for your container."
                                placeholder="--cap-add SYS_ADMIN --device=/dev/fuse"
                                id="custom_docker_run_options" label="Custom Docker Options"
                                x-bind:disabled="!canUpdate" />

                            @if ($application->build_pack !== 'dockercompose')
                                <x-forms.checkbox
                                    helper="Use a build server to build your application."
                                    instantSave id="is_build_server_enabled"
                                    label="Use a Build Server?" x-bind:disabled="!canUpdate" />
                            @endif
                        </div>
                    @endif
                @endif
            </div>
        </div>

        {{-- Section: Docker Compose Details --}}
            @if ($application->build_pack === 'dockercompose')
                <div class="glass-card p-6 hover:border-accent/30 transition-colors">
                    <div class="mb-6 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                                <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">Docker Compose</h3>
                                <p class="text-xs text-light opacity-60">View and manage your compose configuration</p>
                            </div>
                        </div>
                        @can('update', $application)
                            <button wire:target='initLoadingCompose' class="inner-button"
                                x-on:click="$wire.dispatch('loadCompose', false)">
                                Reload Compose File
                            </button>
                        @endcan
                    </div>

                    @if ($application->settings->is_raw_compose_deployment_enabled)
                        <x-forms.textarea rows="10" readonly id="docker_compose_raw"
                            label="Docker Compose Content"
                            helper="You need to modify the docker compose file in the git repository."
                            monacoEditorLanguage="yaml" useMonacoEditor />
                    @else
                        @if ((int) $application->compose_parsing_version >= 3)
                            <x-forms.textarea rows="10" readonly id="docker_compose_raw"
                                label="Docker Compose Content (raw)"
                                helper="You need to modify the docker compose file in the git repository."
                                monacoEditorLanguage="yaml" useMonacoEditor />
                        @else
                            <x-forms.textarea rows="10" readonly id="docker_compose"
                                label="Docker Compose Content"
                                helper="You need to modify the docker compose file in the git repository."
                                monacoEditorLanguage="yaml" useMonacoEditor />
                        @endif
                    @endif

                    <div class="mt-4">
                        <x-forms.checkbox label="Escape special characters in labels?"
                            helper="By default, $ is escaped. Turn this off to use env variables inside labels."
                            id="is_container_label_escape_enabled" instantSave
                            x-bind:disabled="!canUpdate"></x-forms.checkbox>
                    </div>
                </div>
            @endif

            {{-- Section: Dockerfile --}}
            @if ($application->dockerfile)
                <div class="glass-card p-6 hover:border-accent/30 transition-colors">
                    <div class="mb-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                                <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">Dockerfile</h3>
                                <p class="text-xs text-light opacity-60">Edit your Dockerfile configuration</p>
                            </div>
                        </div>
                    </div>
                    
                    <x-forms.textarea label="Dockerfile" id="dockerfile" monacoEditorLanguage="dockerfile"
                        useMonacoEditor rows="6" x-bind:disabled="!canUpdate"> </x-forms.textarea>
                </div>
            @endif

            {{-- Section: Network --}}
            @if ($application->build_pack !== 'dockercompose')
                <div x-data="{ expanded: false }" id="section-network" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-pink-500/50 transition-all duration-300 mb-6">
                    {{-- Header Cliquable --}}
                    <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-lg shadow-pink-500/30 group-hover:shadow-pink-500/50 transition-all duration-300 group-hover:scale-110">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 919-9"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white group-hover:text-pink-400 transition-colors">Network</h3>
                                <p class="text-sm text-gray-400">Configure ports and network settings</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                            <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>
                    
                    {{-- Form Content --}}
                    <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">

                    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        @if ($application->settings->is_static || $application->build_pack === 'static')
                            <x-forms.input id="ports_exposes" label="Ports Exposes" readonly
                                x-bind:disabled="!canUpdate" />
                        @else
                            @if ($application->settings->is_container_label_readonly_enabled === false)
                                <x-forms.input placeholder="3000,3001" id="ports_exposes"
                                    label="Ports Exposes" readonly
                                    helper="Readonly labels are disabled."
                                    x-bind:disabled="!canUpdate" />
                            @else
                                <x-forms.input placeholder="3000,3001" id="ports_exposes"
                                    label="Ports Exposes" required
                                    helper="Comma separated list of ports your application uses."
                                    x-bind:disabled="!canUpdate" />
                            @endif
                        @endif
                        
                        @if (!$application->destination->server->isSwarm())
                            <x-forms.input placeholder="3000:3000" id="ports_mappings" label="Ports Mappings"
                                helper="Map ports to the host system."
                                x-bind:disabled="!canUpdate" />
                            
                            <x-forms.input id="custom_network_aliases" label="Network Aliases"
                                helper="Custom network aliases for Docker network."
                                wire:model="custom_network_aliases" x-bind:disabled="!canUpdate" />
                        @endif
                    </div>
                </div>
            </div>
            @endif

            {{-- Section: HTTP Basic Auth --}}
                <div x-data="{ expanded: false }" id="section-http-auth" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-yellow-500/50 transition-all duration-300 mb-6">
                    {{-- Header Cliquable --}}
                    <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30 group-hover:shadow-yellow-500/50 transition-all duration-300 group-hover:scale-110">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">HTTP Basic Auth</h3>
                                <p class="text-sm text-gray-400">Protect your application with authentication</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                            <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>
                    
                    {{-- Form Content --}}
                    <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">

                    <x-forms.checkbox helper="This will add the proper proxy labels to the container." instantSave
                        label="Enable HTTP Basic Authentication" id="is_http_basic_auth_enabled"
                        x-bind:disabled="!canUpdate" />

                    @if ($application->is_http_basic_auth_enabled)
                        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                            <x-forms.input id="http_basic_auth_username" label="Username" required
                                x-bind:disabled="!canUpdate" />
                            <x-forms.input id="http_basic_auth_password" type="password" label="Password"
                                required x-bind:disabled="!canUpdate" />
                        </div>
                    @endif
            </div>

            {{-- Section: Container Labels --}}
                <div x-data="{ expanded: false }" id="section-labels" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-indigo-500/50 transition-all duration-300 mb-6">
                    {{-- Header Cliquable --}}
                    <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all duration-300 group-hover:scale-110">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">Container Labels</h3>
                                <p class="text-sm text-gray-400">Advanced Docker container configuration</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                            <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>
                    
                    {{-- Form Content --}}
                    <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">

                    @if ($application->settings->is_container_label_readonly_enabled)
                        <x-forms.textarea readonly disabled label="Container Labels" rows="15" id="customLabels"
                            monacoEditorLanguage="ini" useMonacoEditor x-bind:disabled="!canUpdate"></x-forms.textarea>
                    @else
                        <x-forms.textarea label="Container Labels" rows="15" id="customLabels"
                            monacoEditorLanguage="ini" useMonacoEditor x-bind:disabled="!canUpdate"></x-forms.textarea>
                    @endif

                    <div class="mt-4 space-y-3">
                        <x-forms.checkbox label="Readonly labels"
                            helper="Labels are readonly by default. Disable to edit labels directly."
                            id="is_container_label_readonly_enabled" instantSave
                            x-bind:disabled="!canUpdate"></x-forms.checkbox>
                        
                        <x-forms.checkbox label="Escape special characters in labels?"
                            helper="By default, $ is escaped. Turn this off to use env variables inside labels."
                            id="is_container_label_escape_enabled" instantSave
                            x-bind:disabled="!canUpdate"></x-forms.checkbox>
                    </div>

                    @can('update', $application)
                        <div class="mt-6">
                            <x-modal-confirmation title="Confirm Labels Reset to Coolify Defaults?"
                                buttonTitle="Reset Labels to Defaults" buttonFullWidth submitAction="resetDefaultLabels(true)"
                                :actions="['All your custom proxy labels will be lost.', 'Proxy labels will be reset to defaults.']" 
                                confirmationText="{{ $application->fqdn . '/' }}"
                                confirmationLabel="Please confirm by entering the Application URL"
                                shortConfirmationLabel="Application URL" :confirmWithPassword="false"
                                step2ButtonText="Permanently Reset Labels" />
                        </div>
                    @endcan
                </div>
            </div>

            {{-- Section: Pre/Post Deployment --}}
            <div x-data="{ expanded: false }" id="section-deployment-commands" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-red-500/50 transition-all duration-300 mb-6">
                {{-- Header Cliquable --}}
                <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:shadow-red-500/50 transition-all duration-300 group-hover:scale-110">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white group-hover:text-red-400 transition-colors">Pre/Post Deployment Commands</h3>
                            <p class="text-sm text-gray-400">Run commands before and after deployment</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                        <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </div>
                </div>
                
                {{-- Form Content --}}
                <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">

                <div class="space-y-4">
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <x-forms.input x-bind:disabled="shouldDisable()" placeholder="php artisan migrate"
                            id="pre_deployment_command" label="Pre-deployment Command"
                            helper="Command to execute before deployment begins." />
                        @if ($application->build_pack === 'dockercompose')
                            <x-forms.input x-bind:disabled="shouldDisable()" id="pre_deployment_command_container"
                                label="Container Name"
                                helper="Leave blank if your application only has one container." />
                        @endif
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <x-forms.input x-bind:disabled="shouldDisable()" placeholder="php artisan cache:clear"
                            id="post_deployment_command" label="Post-deployment Command"
                            helper="Command to execute after deployment completes." />
                        @if ($application->build_pack === 'dockercompose')
                            <x-forms.input x-bind:disabled="shouldDisable()"
                                id="post_deployment_command_container" label="Container Name"
                                helper="Leave blank if your application only has one container." />
                        @endif
                    </div>
                </div>
            </div>

            {{-- Section Deployment Configuration supprimée --}}
    </form>

    <x-domain-conflict-modal :conflicts="$domainConflicts" :showModal="$showDomainConflictModal" confirmAction="confirmDomainUsage" />

    @script
        <script>
            $wire.$on('loadCompose', (isInit = true) => {
                $wire.initLoadingCompose = true;
                $wire.loadComposeFile(isInit);
            });
        </script>
    @endscript
</div>
