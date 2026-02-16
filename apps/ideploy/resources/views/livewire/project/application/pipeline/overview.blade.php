<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Pipelines | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

<div class="space-y-6" wire:poll.3s="refreshExecutions">
    {{-- Tabs Navigation --}}
    <div class="border-b border-gray-800">
        <div class="flex gap-1">
            <a href="{{ route('project.application.pipeline', $parameters) }}" 
               class="px-4 py-3 text-sm font-medium text-white border-b-2 border-blue-500 -mb-px">
                Overview
            </a>
            <a href="{{ route('project.application.pipeline.executions', $parameters) }}" 
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition">
                Runs
            </a>
            <a href="{{ route('project.application.pipeline.settings', $parameters) }}" 
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition">
                Settings
            </a>
        </div>
    </div>

    {{-- Header --}}
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-white mb-1">Pipelines</h1>
            <p class="text-sm text-gray-400">{{ $totalExecutions ?? 0 }} total</p>
        </div>
        <div class="flex gap-3">
            @if($pipelineEnabled)
                <button wire:click="runPipeline" 
                        class="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                    Run pipeline
                </button>
            @else
                <button wire:click="togglePipeline" 
                        class="px-4 py-2 rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors">
                    Enable Pipeline
                </button>
            @endif
        </div>
    </div>

    {{-- Filters Bar --}}
    <div class="flex items-center gap-3 bg-white/5 border border-gray-800 rounded-lg p-3">
        <div class="flex-1">
            <input type="text" 
                   wire:model.live="search"
                   placeholder="Filter pipelines" 
                   class="w-full bg-transparent border-0 text-white placeholder-gray-500 focus:ring-0 text-sm">
        </div>
        <div class="flex gap-2">
            <select wire:model.live="statusFilter" class="bg-gray-800 border-gray-700 text-white text-sm rounded-md px-3 py-1.5">
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
            </select>
        </div>
    </div>

    {{-- Pipelines Table --}}
    <div class="bg-white/5 border border-gray-800 rounded-lg overflow-hidden">
        <table class="w-full">
            <thead class="bg-gray-900/50 border-b border-gray-800">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Pipeline</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Triggered by</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Stages</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
                @forelse($executions ?? [] as $execution)
                <tr class="hover:bg-white/5 transition-colors group">
                    {{-- Status --}}
                    <td class="px-6 py-4 whitespace-nowrap">
                        @if($execution->status === 'success')
                            <div class="flex items-center gap-2 text-green-400">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                </svg>
                                <span class="text-xs font-medium">Success</span>
                            </div>
                        @elseif($execution->status === 'failed')
                            <div class="flex items-center gap-2 text-red-400">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                                </svg>
                                <span class="text-xs font-medium">Failed</span>
                            </div>
                        @elseif($execution->status === 'running')
                            <div class="flex items-center gap-2 text-blue-400">
                                <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span class="text-xs font-medium">Running</span>
                            </div>
                        @else
                            <div class="flex items-center gap-2 text-gray-400">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
                                </svg>
                                <span class="text-xs font-medium">Pending</span>
                            </div>
                        @endif
                    </td>

                    {{-- Pipeline Info --}}
                    <td class="px-6 py-4">
                        <div class="flex flex-col gap-1">
                            <a href="{{ route('project.application.pipeline.execution.detail', array_merge($parameters, ['execution_uuid' => $execution->uuid])) }}" 
                               class="text-blue-400 hover:text-blue-300 font-medium text-sm">
                                #{{ $execution->id }}
                            </a>
                            <div class="flex items-center gap-2 text-xs text-gray-400">
                                <span class="px-2 py-0.5 bg-gray-800 rounded text-gray-300">{{ $execution->branch ?? 'main' }}</span>
                                @if($execution->commit_message)
                                <span class="truncate max-w-xs">{{ Str::limit($execution->commit_message, 50) }}</span>
                                @endif
                            </div>
                        </div>
                    </td>

                    {{-- Triggered By --}}
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                {{ strtoupper(substr($execution->triggered_by ?? 'W', 0, 1)) }}
                            </div>
                            <div class="flex flex-col">
                                <span class="text-sm text-white">{{ $execution->triggered_by ?? 'Webhook' }}</span>
                                <span class="text-xs text-gray-500">{{ $execution->created_at->diffForHumans() }}</span>
                            </div>
                        </div>
                    </td>

                    {{-- Stages --}}
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-1">
                            @php
                                $allStages = [
                                    'git_clone' => 'Clone',
                                    'language_detection' => 'Detect',
                                    'sonarqube' => 'SonarQube',
                                    'trivy' => 'Trivy',
                                    'deploy' => 'Deploy'
                                ];
                                $stagesStatus = $execution->stages_status ?? [];
                            @endphp
                            @foreach($allStages as $stageKey => $stageLabel)
                                @php
                                    // Get status - handle both string and array formats
                                    $stageData = $stagesStatus[$stageKey] ?? null;
                                    $stageStatus = is_array($stageData) ? ($stageData['status'] ?? 'pending') : ($stageData ?? 'pending');
                                @endphp
                                <div class="w-7 h-7 rounded-full flex items-center justify-center transition-all {{ 
                                    $stageStatus === 'success' ? 'bg-green-500' : 
                                    ($stageStatus === 'failed' ? 'bg-red-500' : 
                                    ($stageStatus === 'running' ? 'bg-blue-500 animate-pulse' : 
                                    ($stageStatus === 'skipped' ? 'bg-gray-600' : 'bg-gray-800'))) 
                                }}" 
                                     title="{{ $stageLabel }}: {{ ucfirst($stageStatus) }}">
                                    @if($stageStatus === 'success')
                                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                    @elseif($stageStatus === 'failed')
                                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                                        </svg>
                                    @elseif($stageStatus === 'running')
                                        <svg class="w-4 h-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    @elseif($stageStatus === 'skipped')
                                        <span class="text-white text-xs">⊘</span>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    </td>

                    {{-- Actions --}}
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <div class="flex items-center justify-end gap-2">
                            {{-- View Details Button --}}
                            <a href="{{ route('project.application.pipeline.execution.detail', array_merge($parameters, ['execution_uuid' => $execution->uuid])) }}" 
                               class="p-2 hover:bg-blue-500/10 rounded-lg transition-all group/btn border border-transparent hover:border-blue-500/30" 
                               title="View details">
                                <svg class="w-4 h-4 text-gray-400 group-hover/btn:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </a>
                            
                            {{-- Delete Button (only for completed executions) --}}
                            @if(!in_array($execution->status, ['running', 'pending']))
                            <button wire:click="confirmDelete('{{ $execution->uuid }}')" 
                                    class="p-2 hover:bg-red-500/10 rounded-lg transition-all group/btn border border-transparent hover:border-red-500/30" 
                                    title="Delete execution">
                                <svg class="w-4 h-4 text-gray-400 group-hover/btn:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                            @endif
                        </div>
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center">
                        <div class="flex flex-col items-center gap-3">
                            <svg class="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                            <div>
                                <h3 class="text-lg font-medium text-white mb-1">No pipelines yet</h3>
                                <p class="text-sm text-gray-400">Push code or click "Run pipeline" to get started</p>
                            </div>
                        </div>
                    </td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    {{-- Professional Delete Confirmation Modal --}}
    @if($showDeleteModal && $executionToDelete)
    <div class="fixed inset-0 z-50 overflow-y-auto" x-data="{ show: @entangle('showDeleteModal') }" x-show="show" x-cloak>
        {{-- Backdrop --}}
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
             x-show="show"
             x-transition:enter="ease-out duration-300"
             x-transition:enter-start="opacity-0"
             x-transition:enter-end="opacity-100"
             x-transition:leave="ease-in duration-200"
             x-transition:leave-start="opacity-100"
             x-transition:leave-end="opacity-0"
             wire:click="cancelDelete">
        </div>

        {{-- Modal Content --}}
        <div class="flex min-h-screen items-center justify-center p-4">
            <div class="relative bg-[#0f1724] border border-red-500/30 rounded-xl shadow-2xl max-w-md w-full"
                 x-show="show"
                 x-transition:enter="ease-out duration-300"
                 x-transition:enter-start="opacity-0 scale-95"
                 x-transition:enter-end="opacity-100 scale-100"
                 x-transition:leave="ease-in duration-200"
                 x-transition:leave-start="opacity-100 scale-100"
                 x-transition:leave-end="opacity-0 scale-95">
                
                {{-- Header with Icon --}}
                <div class="flex items-start gap-4 p-6 pb-4">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500/40">
                            <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-white mb-2">Delete Pipeline Execution</h3>
                        <p class="text-sm text-gray-400">This action cannot be undone. This will permanently delete the pipeline execution and all its logs.</p>
                    </div>
                </div>

                {{-- Execution Details --}}
                <div class="px-6 pb-4">
                    <div class="bg-[#151b2e] border border-gray-700 rounded-lg p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">Status</span>
                            <span class="text-sm font-medium {{ $executionToDelete->status === 'success' ? 'text-green-400' : 'text-red-400' }}">
                                {{ ucfirst($executionToDelete->status) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">Branch</span>
                            <span class="text-sm font-medium text-white">{{ $executionToDelete->branch ?? 'N/A' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">Triggered by</span>
                            <span class="text-sm font-medium text-white">{{ $executionToDelete->trigger_user ?? 'Unknown' }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">Created</span>
                            <span class="text-sm font-medium text-white">{{ $executionToDelete->created_at->diffForHumans() }}</span>
                        </div>
                    </div>
                </div>

                {{-- Warning Message --}}
                <div class="px-6 pb-4">
                    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
                        <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <p class="text-sm text-red-300">All execution logs, stage details, and related data will be permanently removed from the system.</p>
                    </div>
                </div>

                {{-- Actions --}}
                <div class="flex items-center gap-3 px-6 py-4 bg-[#0a0f1a] border-t border-gray-800 rounded-b-xl">
                    <button wire:click="cancelDelete" 
                            class="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200 border border-gray-600 hover:border-gray-500">
                        Cancel
                    </button>
                    <button wire:click="deleteExecution" 
                            class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all duration-200 border border-red-500 hover:border-red-400 shadow-lg shadow-red-500/20 hover:shadow-red-500/40">
                        Delete Execution
                    </button>
                </div>
            </div>
        </div>
    </div>
    @endif

</div>
</div>
