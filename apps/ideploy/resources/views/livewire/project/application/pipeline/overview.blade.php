<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Pipelines | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

<div class="space-y-6">
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
                            <a href="{{ route('project.application.pipeline.execution.detail', array_merge($parameters, ['execution_uuid' => $execution->id])) }}" 
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
                            @foreach(['sonarqube', 'trivy', 'deploy'] as $stage)
                                @php
                                    $stageStatus = $execution->stages[$stage] ?? 'pending';
                                @endphp
                                <div class="w-6 h-6 rounded-full flex items-center justify-center {{ 
                                    $stageStatus === 'success' ? 'bg-green-500' : 
                                    ($stageStatus === 'failed' ? 'bg-red-500' : 
                                    ($stageStatus === 'running' ? 'bg-blue-500' : 'bg-gray-700')) 
                                }}" 
                                     title="{{ ucfirst($stage) }}">
                                    @if($stageStatus === 'success')
                                        <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                    @elseif($stageStatus === 'failed')
                                        <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                                        </svg>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    </td>

                    {{-- Actions --}}
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href="{{ route('project.application.pipeline.execution.detail', array_merge($parameters, ['execution_uuid' => $execution->id])) }}" 
                               class="p-1.5 hover:bg-gray-800 rounded transition-colors" title="View details">
                                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </a>
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

</div>
</div>
