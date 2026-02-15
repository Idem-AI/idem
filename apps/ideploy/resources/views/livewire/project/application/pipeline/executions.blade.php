<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Pipeline Executions | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    {{-- Sub-Navigation Tabs --}}
    <div class="mb-6 border-b border-gray-800">
        <nav class="flex gap-1">
            <a href="{{ route('project.application.pipeline', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition">
                Overview
            </a>
            <a href="{{ route('project.application.pipeline.executions', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-white border-b-2 border-blue-500 -mb-px">
                Executions
            </a>
            <a href="{{ route('project.application.pipeline.settings', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition">
                Settings
            </a>
        </nav>
    </div>

<div class="space-y-6" wire:poll.3s="refreshExecution">
    {{-- Header --}}
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-white">Pipeline Executions</h1>
            <p class="text-sm text-gray-400 mt-1">View and manage your CI/CD pipeline runs</p>
        </div>
        @if($executions->isNotEmpty())
        <div class="text-sm text-gray-400">
            <span class="font-semibold text-white">{{ $executions->count() }}</span> execution(s)
        </div>
        @endif
    </div>

    @if($selectedExecution)
    <div class="bg-[#0f1724] border border-gray-800 rounded-lg mb-6">
        <!-- Header -->
        <div class="flex justify-between px-6 py-4 border-b border-gray-800">
            <div>
                <h2 class="text-xl font-bold text-white">Pipeline #{{ $selectedExecution->id }}</h2>
                <p class="text-sm text-gray-400">{{ $selectedExecution->branch ?? 'main' }}</p>
            </div>
            <button wire:click="closeDetail" class="text-gray-400 hover:text-white">✕</button>
        </div>

        <!-- Horizontal Pipeline Stages -->
        <div class="p-6 overflow-x-auto bg-gradient-to-b from-gray-900/50 to-transparent">
            <div class="flex items-center gap-3 min-w-max">
                @php
                    // Mapping des noms de stages avec emojis
                    $stageConfig = [
                        'git_clone' => ['label' => 'Git Clone', 'icon' => '📥'],
                        'language_detection' => ['label' => 'Language Detection', 'icon' => '🔍'],
                        'sonarqube' => ['label' => 'SonarQube', 'icon' => '📊'],
                        'trivy' => ['label' => 'Trivy Scan', 'icon' => '🔒'],
                    ];
                    
                    // Ajouter native_security si présent
                    if (isset(($selectedExecution->stages_status ?? [])['native_security'])) {
                        $stageConfig['native_security'] = ['label' => 'Native Security', 'icon' => '🛡️'];
                    }
                    
                    // Ajouter deploy en dernier
                    $stageConfig['deploy'] = ['label' => 'Deployment', 'icon' => '🚀'];
                @endphp
                @foreach($stageConfig as $stageId => $config)
                @php
                    $stageData = ($selectedExecution->stages_status ?? [])[$stageId] ?? ['status' => 'pending'];
                    $stageStatus = is_array($stageData) ? ($stageData['status'] ?? 'pending') : $stageData;
                    
                    // Calculer la durée
                    $duration = null;
                    if (is_array($stageData) && !empty($stageData['started_at']) && !empty($stageData['finished_at'])) {
                        try {
                            $start = new \DateTime($stageData['started_at']);
                            $end = new \DateTime($stageData['finished_at']);
                            $duration = $end->getTimestamp() - $start->getTimestamp();
                        } catch (\Exception $e) {}
                    }
                @endphp
                <div class="flex items-center gap-3">
                    {{-- Stage Card --}}
                    <div class="relative group">
                        <div class="bg-gray-900/80 border-2 rounded-xl px-4 py-3 min-w-[160px] transition-all duration-300
                            {{ $stageStatus === 'success' ? 'border-green-500/70 shadow-lg shadow-green-500/20' : '' }}
                            {{ $stageStatus === 'failed' ? 'border-red-500/70 shadow-lg shadow-red-500/20' : '' }}
                            {{ $stageStatus === 'running' ? 'border-blue-500 shadow-lg shadow-blue-500/30 animate-pulse' : '' }}
                            {{ $stageStatus === 'pending' ? 'border-gray-700' : '' }}
                            {{ $stageStatus === 'skipped' ? 'border-gray-600 opacity-50' : '' }}">
                            
                            <div class="flex items-center gap-3">
                                {{-- Status Icon --}}
                                <div class="flex-shrink-0">
                                    @if($stageStatus === 'success')
                                        <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                                            <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                            </svg>
                                        </div>
                                    @elseif($stageStatus === 'failed')
                                        <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                                            <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                                            </svg>
                                        </div>
                                    @elseif($stageStatus === 'running')
                                        <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                            <svg class="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                            </svg>
                                        </div>
                                    @elseif($stageStatus === 'skipped')
                                        <div class="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                                            <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                                            </svg>
                                        </div>
                                    @else
                                        <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                                            <svg class="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                <circle cx="10" cy="10" r="3"/>
                                            </svg>
                                        </div>
                                    @endif
                                </div>
                                
                                {{-- Stage Info --}}
                                <div class="flex-1">
                                    <div class="text-sm font-semibold {{ $stageStatus === 'running' ? 'text-blue-400' : ($stageStatus === 'success' ? 'text-green-400' : ($stageStatus === 'failed' ? 'text-red-400' : 'text-white')) }}">
                                        {{ $config['label'] }}
                                    </div>
                                    <div class="text-xs text-gray-400 mt-0.5">
                                        @if($stageStatus === 'running')
                                            <span class="text-blue-300">Running...</span>
                                        @elseif($stageStatus === 'success' && $duration)
                                            {{ gmdate('i:s', $duration) }}
                                        @elseif($stageStatus === 'failed')
                                            <span class="text-red-300">Failed</span>
                                        @elseif($stageStatus === 'skipped')
                                            Skipped
                                        @else
                                            Pending
                                        @endif
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Arrow --}}
                    @if(!$loop->last)
                    <svg class="w-6 h-6 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                    </svg>
                    @endif
                </div>
                @endforeach
            </div>
        </div>

        <!-- Logs -->
        <div class="p-6 border-t border-gray-800">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold text-white">Pipeline Logs</h3>
                <button class="text-xs text-gray-400 hover:text-white transition">
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download
                </button>
            </div>
            <div class="bg-black rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs border border-gray-800">
                @if($selectedExecution->logs->isEmpty())
                    <div class="text-gray-500 text-center py-8">No logs available yet</div>
                @else
                    @foreach($selectedExecution->logs as $log)
                    <div class="text-gray-300 hover:bg-gray-900/50 px-2 py-1 rounded transition">
                        <span class="text-gray-600">{{ $log->logged_at->format('H:i:s') }}</span>
                        <span class="{{ $this->getLogLevelColor($log->level) }} font-semibold">[{{ strtoupper($log->level) }}]</span>
                        <span class="text-gray-300">{{ $log->message }}</span>
                    </div>
                    @endforeach
                @endif
            </div>
        </div>
    </div>
    @endif

    <!-- Executions List -->
    <div class="bg-[#0f1724] border border-gray-800 rounded-xl overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-gray-900/50 to-transparent">
            <h3 class="text-lg font-semibold text-white">Recent Executions</h3>
            <p class="text-xs text-gray-400 mt-1">Click on an execution to view details</p>
        </div>
        
        @if($executions->isEmpty())
            <div class="px-6 py-12 text-center">
                <svg class="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <p class="text-gray-400">No pipeline executions yet</p>
                <p class="text-sm text-gray-500 mt-1">Run your first pipeline from the Overview page</p>
            </div>
        @else
            @foreach($executions as $exec)
            <div wire:click="viewExecution({{ $exec->id }})" 
                 class="px-6 py-4 hover:bg-[#151b2e] cursor-pointer border-b border-gray-800 last:border-b-0 transition-all duration-200 group">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        {{-- Status Indicator --}}
                        <div class="flex-shrink-0">
                            @if($exec->status === 'success')
                                <div class="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50">
                                    <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                    </svg>
                                </div>
                            @elseif($exec->status === 'failed')
                                <div class="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/50">
                                    <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                                    </svg>
                                </div>
                            @elseif($exec->status === 'running')
                                <div class="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/50">
                                    <svg class="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                </div>
                            @else
                                <div class="w-10 h-10 bg-gray-700/50 rounded-full flex items-center justify-center border border-gray-600">
                                    <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                        <circle cx="10" cy="10" r="3"/>
                                    </svg>
                                </div>
                            @endif
                        </div>
                        
                        {{-- Execution Info --}}
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-white font-semibold group-hover:text-blue-400 transition">Pipeline #{{ $exec->id }}</span>
                                <span class="px-2 py-0.5 rounded text-xs font-medium {{ $this->getStatusBadgeClass($exec->status) }}">
                                    {{ ucfirst($exec->status) }}
                                </span>
                            </div>
                            <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    {{ $exec->created_at->diffForHumans() }}
                                </span>
                                @if($exec->duration_seconds)
                                <span class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                    </svg>
                                    {{ gmdate('i:s', $exec->duration_seconds) }}
                                </span>
                                @endif
                                <span class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                                    </svg>
                                    {{ $exec->branch ?? 'main' }}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Arrow --}}
                    <svg class="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
            @endforeach
        @endif
    </div>
</div>
</div>
