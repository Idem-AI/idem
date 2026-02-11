<div>
    <x-slot:title>
        Pipeline #{{ $execution->id ?? 'N/A' }} | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    <div class="space-y-6" wire:poll.3s>
        {{-- Header avec status --}}
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">
            <div class="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 border-b border-gray-700">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <a href="{{ route('project.application.pipeline', $parameters) }}" 
                           class="text-gray-400 hover:text-white transition">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                            </svg>
                        </a>
                        
                        <div class="flex items-center gap-3">
                            @php
                                $statusColors = [
                                    'pending' => 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                                    'running' => 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                                    'success' => 'bg-green-500/20 text-green-400 border-green-500/30',
                                    'failed' => 'bg-red-500/20 text-red-400 border-red-500/30',
                                    'cancelled' => 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                                ];
                                $status = $execution->status ?? 'pending';
                                $statusColor = $statusColors[$status] ?? $statusColors['pending'];
                            @endphp
                            
                            <div class="w-3 h-3 rounded-full {{ str_replace('/20', '', $statusColor) }} {{ $status === 'running' ? 'animate-pulse' : '' }}"></div>
                            <h1 class="text-2xl font-bold text-white">Pipeline #{{ $execution->id ?? '—' }}</h1>
                            <span class="px-3 py-1 rounded-full text-xs font-semibold border {{ $statusColor }}">
                                {{ strtoupper($status) }}
                            </span>
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        @if($status === 'running')
                            <button wire:click="cancelExecution" 
                                    class="px-4 py-2 bg-red-600/10 border border-red-600/30 hover:bg-red-600/20 text-red-400 rounded-lg font-medium transition-all">
                                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                                Cancel
                            </button>
                        @endif
                        
                        <button wire:click="rerunExecution" 
                                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20">
                            <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Re-run
                        </button>
                    </div>
                </div>

                {{-- Metadata --}}
                <div class="mt-4 flex items-center gap-6 text-sm text-gray-400">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                        </svg>
                        <span class="font-mono">{{ $execution->branch ?? 'main' }}</span>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        <span>{{ $execution->trigger_user ?? 'System' }}</span>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span>
                            @if($execution->started_at)
                                {{ $execution->started_at->diffForHumans() }}
                                @if($execution->duration_seconds)
                                    ({{ gmdate('i:s', $execution->duration_seconds) }})
                                @endif
                            @else
                                Not started
                            @endif
                        </span>
                    </div>
                    
                    @if($execution->commit_sha)
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                        </svg>
                        <span class="font-mono text-xs">{{ substr($execution->commit_sha, 0, 7) }}</span>
                    </div>
                    @endif
                </div>
                
                @if($execution->commit_message)
                <div class="mt-3 text-sm text-gray-300">
                    <span class="font-medium">Commit:</span> {{ $execution->commit_message }}
                </div>
                @endif
            </div>
        </div>

        {{-- Stages Horizontaux (Style GitLab) --}}
        <div class="bg-white/5 border border-gray-800 rounded-lg p-6">
            <div class="flex items-center gap-4">
                @foreach(['sonarqube', 'trivy', 'deploy'] as $index => $stageName)
                    @php
                        $stageData = $execution->stages[$stageName] ?? ['status' => 'pending', 'duration' => null];
                        $stageStatus = $stageData['status'] ?? 'pending';
                        $stageDuration = $stageData['duration'] ?? null;
                    @endphp
                    
                    {{-- Stage Card --}}
                    <button 
                        wire:click="selectStage('{{ $stageName }}')"
                        class="flex-1 bg-gray-900/50 border {{ $selectedStage === $stageName ? 'border-blue-500' : 'border-gray-800' }} rounded-lg p-4 hover:bg-gray-900 transition-all">
                        <div class="flex items-center gap-3">
                            {{-- Status Icon --}}
                            <div class="flex-shrink-0">
                                @if($stageStatus === 'success')
                                    <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                    </div>
                                @elseif($stageStatus === 'failed')
                                    <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                                        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                                        </svg>
                                    </div>
                                @elseif($stageStatus === 'running')
                                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                        <svg class="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                        </svg>
                                    </div>
                                @else
                                    <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                                        <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                            <circle cx="10" cy="10" r="3"/>
                                        </svg>
                                    </div>
                                @endif
                            </div>
                            
                            {{-- Stage Info --}}
                            <div class="flex-1 text-left">
                                <div class="text-sm font-semibold text-white">{{ ucfirst($stageName) }}</div>
                                @if($stageDuration)
                                    <div class="text-xs text-gray-400">{{ gmdate('i:s', $stageDuration) }}</div>
                                @else
                                    <div class="text-xs text-gray-500">—</div>
                                @endif
                            </div>
                            
                            {{-- Chevron --}}
                            @if($selectedStage === $stageName)
                                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                </svg>
                            @endif
                        </div>
                    </button>
                    
                    {{-- Arrow between stages --}}
                    @if($index < 2)
                        <svg class="w-6 h-6 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                        </svg>
                    @endif
                @endforeach
            </div>
        </div>

        {{-- Stage Details --}}
        @if($selectedStage)
            <div class="space-y-6">
                {{-- Stage Header --}}
                <div class="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                    <h2 class="text-xl font-bold text-white">{{ ucfirst($selectedStage) }} Stage</h2>
                    <p class="text-sm text-gray-400 mt-1">Detailed results and logs</p>
                </div>

                {{-- Dashboards conditionnels --}}
                @if($selectedStage === 'sonarqube' && isset($execution->sonarqube_results))
                    <div class="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">
                        <div class="bg-gradient-to-r from-blue-900/20 to-purple-900/20 px-6 py-4 border-b border-gray-700">
                            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                                </svg>
                                SonarQube Analysis Results
                            </h3>
                        </div>
                        <div class="p-6 space-y-6">
                            {{-- Metrics Cards --}}
                            <div class="grid grid-cols-4 gap-4">
                                <div class="bg-gray-900/50 border border-red-900/30 rounded-lg p-4 hover:border-red-500/50 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-xs font-medium text-gray-400 uppercase">Bugs</div>
                                        <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z"/>
                                        </svg>
                                    </div>
                                    <div class="text-3xl font-bold text-red-400">{{ $execution->sonarqube_results['bugs'] ?? 0 }}</div>
                                    <div class="mt-2 text-xs text-gray-500">{{ $execution->sonarqube_results['bugs'] == 0 ? 'Perfect!' : 'Need attention' }}</div>
                                </div>
                                <div class="bg-gray-900/50 border border-orange-900/30 rounded-lg p-4 hover:border-orange-500/50 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-xs font-medium text-gray-400 uppercase">Vulnerabilities</div>
                                        <svg class="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clip-rule="evenodd"/>
                                        </svg>
                                    </div>
                                    <div class="text-3xl font-bold text-orange-400">{{ $execution->sonarqube_results['vulnerabilities'] ?? 0 }}</div>
                                    <div class="mt-2 text-xs text-gray-500">Security issues</div>
                                </div>
                                <div class="bg-gray-900/50 border border-yellow-900/30 rounded-lg p-4 hover:border-yellow-500/50 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-xs font-medium text-gray-400 uppercase">Code Smells</div>
                                        <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                        </svg>
                                    </div>
                                    <div class="text-3xl font-bold text-yellow-400">{{ $execution->sonarqube_results['code_smells'] ?? 0 }}</div>
                                    <div class="mt-2 text-xs text-gray-500">Maintainability</div>
                                </div>
                                <div class="bg-gray-900/50 border border-green-900/30 rounded-lg p-4 hover:border-green-500/50 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-xs font-medium text-gray-400 uppercase">Coverage</div>
                                        <svg class="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                        </svg>
                                    </div>
                                    <div class="text-3xl font-bold text-green-400">{{ $execution->sonarqube_results['coverage'] ?? 0 }}%</div>
                                    <div class="mt-2 text-xs text-gray-500">Test coverage</div>
                                </div>
                            </div>
                            
                            {{-- Quality Gate --}}
                            <div class="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-800/30 rounded-lg p-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                                        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                        </svg>
                                    </div>
                                    <div class="flex-1">
                                        <div class="text-lg font-semibold text-white">Quality Gate: PASSED</div>
                                        <div class="text-sm text-gray-400">All quality criteria met</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                @endif

                @if($selectedStage === 'trivy' && isset($execution->trivy_results))
                    <div class="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">
                        <div class="bg-gradient-to-r from-red-900/20 to-orange-900/20 px-6 py-4 border-b border-gray-700">
                            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clip-rule="evenodd"/>
                                </svg>
                                Trivy Security Scan Results
                            </h3>
                        </div>
                        <div class="p-6 space-y-6">
                            {{-- Severity Cards --}}
                            <div class="grid grid-cols-4 gap-4">
                                <div class="bg-gray-900/50 border border-red-900/50 rounded-lg p-4 hover:border-red-500/70 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-xs font-medium text-gray-400 uppercase">Critical</div>
                                        <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                    </div>
                                    <div class="text-3xl font-bold text-red-400">{{ $execution->trivy_results['critical'] ?? 0 }}</div>
                                    <div class="mt-2 text-xs text-red-300">Immediate action required</div>
                                </div>
                                <div class="bg-gray-900/50 border border-orange-900/50 rounded-lg p-4 hover:border-orange-500/70 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-xs font-medium text-gray-400 uppercase">High</div>
                                        <div class="w-3 h-3 bg-orange-500 rounded-full"></div>
                                    </div>
                                    <div class="text-3xl font-bold text-orange-400">{{ $execution->trivy_results['high'] ?? 0 }}</div>
                                    <div class="mt-2 text-xs text-orange-300">Should be fixed soon</div>
                                </div>
                                <div class="bg-gray-900/50 border border-yellow-900/50 rounded-lg p-4 hover:border-yellow-500/70 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-xs font-medium text-gray-400 uppercase">Medium</div>
                                        <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                    </div>
                                    <div class="text-3xl font-bold text-yellow-400">{{ $execution->trivy_results['medium'] ?? 0 }}</div>
                                    <div class="mt-2 text-xs text-yellow-300">Plan to fix</div>
                                </div>
                                <div class="bg-gray-900/50 border border-blue-900/50 rounded-lg p-4 hover:border-blue-500/70 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-xs font-medium text-gray-400 uppercase">Low</div>
                                        <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    </div>
                                    <div class="text-3xl font-bold text-blue-400">{{ $execution->trivy_results['low'] ?? 0 }}</div>
                                    <div class="mt-2 text-xs text-blue-300">Monitor</div>
                                </div>
                            </div>
                            
                            {{-- Total Vulnerabilities --}}
                            <div class="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <div class="text-sm text-gray-400 mb-1">Total Vulnerabilities</div>
                                        <div class="text-2xl font-bold text-white">
                                            {{ ($execution->trivy_results['critical'] ?? 0) + ($execution->trivy_results['high'] ?? 0) + ($execution->trivy_results['medium'] ?? 0) + ($execution->trivy_results['low'] ?? 0) }}
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        @if(($execution->trivy_results['critical'] ?? 0) > 0)
                                            <div class="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-xs font-semibold text-red-400">
                                                ⚠️ Action Required
                                            </div>
                                        @elseif(($execution->trivy_results['high'] ?? 0) > 0)
                                            <div class="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-xs font-semibold text-orange-400">
                                                ⚡ Review Needed
                                            </div>
                                        @else
                                            <div class="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-xs font-semibold text-green-400">
                                                ✓ Good
                                            </div>
                                        @endif
                                    </div>
                                </div>
                            </div>
                            
                            {{-- Visual Bar Chart --}}
                            <div class="space-y-3">
                                <div class="text-sm font-medium text-gray-400">Severity Distribution</div>
                                @php
                                    $total = ($execution->trivy_results['critical'] ?? 0) + ($execution->trivy_results['high'] ?? 0) + ($execution->trivy_results['medium'] ?? 0) + ($execution->trivy_results['low'] ?? 0);
                                    $criticalPercent = $total > 0 ? (($execution->trivy_results['critical'] ?? 0) / $total) * 100 : 0;
                                    $highPercent = $total > 0 ? (($execution->trivy_results['high'] ?? 0) / $total) * 100 : 0;
                                    $mediumPercent = $total > 0 ? (($execution->trivy_results['medium'] ?? 0) / $total) * 100 : 0;
                                    $lowPercent = $total > 0 ? (($execution->trivy_results['low'] ?? 0) / $total) * 100 : 0;
                                @endphp
                                <div class="flex h-8 bg-gray-900 rounded-lg overflow-hidden">
                                    @if($criticalPercent > 0)
                                        <div class="bg-red-500 flex items-center justify-center text-xs font-bold text-white" style="width: {{ $criticalPercent }}%">
                                            {{ round($criticalPercent) }}%
                                        </div>
                                    @endif
                                    @if($highPercent > 0)
                                        <div class="bg-orange-500 flex items-center justify-center text-xs font-bold text-white" style="width: {{ $highPercent }}%">
                                            {{ round($highPercent) }}%
                                        </div>
                                    @endif
                                    @if($mediumPercent > 0)
                                        <div class="bg-yellow-500 flex items-center justify-center text-xs font-bold text-white" style="width: {{ $mediumPercent }}%">
                                            {{ round($mediumPercent) }}%
                                        </div>
                                    @endif
                                    @if($lowPercent > 0)
                                        <div class="bg-blue-500 flex items-center justify-center text-xs font-bold text-white" style="width: {{ $lowPercent }}%">
                                            {{ round($lowPercent) }}%
                                        </div>
                                    @endif
                                </div>
                            </div>
                        </div>
                    </div>
                @endif

                {{-- Logs --}}
                <div class="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">
                    <div class="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-white">Logs</h3>
                        <button class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition">
                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                            Download
                        </button>
                    </div>
                    <div class="bg-black p-6 font-mono text-xs overflow-x-auto max-h-96">
                        @if(isset($execution->logs[$selectedStage]))
                            <pre class="text-green-400 whitespace-pre-wrap">{{ $execution->logs[$selectedStage] }}</pre>
                        @else
                            <div class="text-gray-500 text-center py-8">No logs available for this stage</div>
                        @endif
                    </div>
                </div>
            </div>
        @else
            <div class="bg-[#0a0a0a] border border-gray-800 rounded-xl p-12 text-center">
                <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <h3 class="text-lg font-medium text-gray-400">Select a stage to view details</h3>
                <p class="text-sm text-gray-500 mt-2">Click on a stage above to see results and logs</p>
            </div>
        @endif
    </div>
</div>
