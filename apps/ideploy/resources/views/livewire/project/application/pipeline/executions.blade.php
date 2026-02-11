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
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white">
                Overview
            </a>
            <a href="{{ route('project.application.pipeline.executions', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-white border-b-2 border-blue-500 -mb-px">
                Executions
            </a>
        </nav>
    </div>

<div class="bg-[#0a0a0a] min-h-screen" wire:poll.3s="refreshExecution">
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-white">Pipeline Executions</h1>
    </div>

    @if($selectedExecution)
    <div class="bg-[#0f1724] border border-gray-800 rounded-lg mb-6">
        <\!-- Header -->
        <div class="flex justify-between px-6 py-4 border-b border-gray-800">
            <div>
                <h2 class="text-xl font-bold text-white">Pipeline #{{ $selectedExecution->id }}</h2>
                <p class="text-sm text-gray-400">{{ $selectedExecution->branch ?? 'main' }}</p>
            </div>
            <button wire:click="closeDetail" class="text-gray-400 hover:text-white">✕</button>
        </div>

        <\!-- Horizontal Pipeline -->
        <div class="p-8 overflow-x-auto">
            <div class="flex items-center gap-4 min-w-max">
                @foreach(($selectedExecution->stages_status ?? []) as $stageId => $stage)
                <div class="flex items-center gap-4">
                    <div class="text-center">
                        <div class="mb-2 text-xs text-gray-400">{{ $stage['name'] ?? $stageId }}</div>
                        <div class="bg-white border-2 rounded-lg px-6 py-3 min-w-[140px]
                            {{ $stage['status'] === 'success' ? 'border-green-500' : '' }}
                            {{ $stage['status'] === 'failed' ? 'border-red-500' : '' }}
                            {{ $stage['status'] === 'running' ? 'border-blue-500' : '' }}">
                            <div class="flex items-center gap-2">
                                @if($stage['status'] === 'success')
                                <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">✓</div>
                                @elseif($stage['status'] === 'running')
                                <div class="w-8 h-8 bg-blue-500 rounded-full animate-spin">⟳</div>
                                @else
                                <div class="w-8 h-8 border-2 border-gray-400 rounded-full"></div>
                                @endif
                            </div>
                        </div>
                    </div>
                    @if(!$loop->last)
                    <div class="text-gray-600">→</div>
                    @endif
                </div>
                @endforeach
            </div>
        </div>

        <!-- Logs -->
        <div class="p-6">
            <h3 class="text-white mb-3">Logs</h3>
            <div class="bg-black rounded p-4 max-h-96 overflow-y-auto font-mono text-xs">
                @foreach($selectedExecution->logs as $log)
                <div class="text-gray-300">
                    <span class="text-gray-600">{{ $log->logged_at->format('H:i:s') }}</span>
                    <span class="{{ $this->getLogLevelColor($log->level) }}">[{{ $log->level }}]</span>
                    {{ $log->message }}
                </div>
                @endforeach
            </div>
        </div>
    </div>
    @endif

    <\!-- List -->
    <div class="bg-[#0f1724] border border-gray-800 rounded-lg">
        <div class="px-6 py-4 border-b border-gray-800">
            <h3 class="text-white">Recent Executions</h3>
        </div>
        @foreach($executions as $exec)
        <div wire:click="viewExecution({{ $exec->id }})" class="px-6 py-4 hover:bg-[#151b2e] cursor-pointer border-b border-gray-800">
            <div class="flex justify-between items-center">
                <div>
                    <span class="text-white">#{{ $exec->id }}</span>
                    <span class="text-gray-400 text-sm ml-2">{{ $exec->created_at->diffForHumans() }}</span>
                </div>
                <span class="px-3 py-1 rounded text-sm {{ $this->getStatusBadgeClass($exec->status) }}">
                    {{ $exec->status }}
                </span>
            </div>
        </div>
        @endforeach
    </div>
</div>
</div>
