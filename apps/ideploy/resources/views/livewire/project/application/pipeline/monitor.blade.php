<div class="h-full flex flex-col bg-slate-50">
    <!-- Header -->
    <div class="bg-white border-b border-slate-200 p-6">
        <h1 class="text-3xl font-bold text-slate-900">🔍 Pipeline Monitor</h1>
        <p class="text-slate-600 mt-2">Real-time pipeline execution tracking</p>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
        <!-- Left Panel: Execution History -->
        <div class="w-full md:w-80 border-r border-slate-200 bg-white overflow-y-auto">
            <div class="p-4 border-b border-slate-200 sticky top-0 bg-white">
                <h2 class="font-bold text-slate-900 mb-3">📋 Recent Executions</h2>
                <button
                    onclick="location.reload()"
                    class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                >
                    🔄 Refresh
                </button>
            </div>

            <div class="divide-y divide-slate-200">
                @php
                    $recentExecutions = $currentExecution ? 
                        \App\Models\PipelineExecution::where('application_id', $application->id)
                            ->orderBy('created_at', 'desc')
                            ->limit(10)
                            ->get() 
                        : collect([]);
                @endphp

                @forelse($recentExecutions as $exec)
                    <button
                        wire:click="selectExecution({{ $exec->id }})"
                        class="w-full p-4 hover:bg-slate-50 transition-all text-left border-l-4 {{ $currentExecution?->id === $exec->id ? 'border-blue-600 bg-blue-50' : 'border-transparent' }}"
                    >
                        <div class="flex items-start gap-3">
                            <div class="flex-shrink-0 text-xl">
                                @switch($exec->status)
                                    @case('running')
                                        🔄
                                    @break
                                    @case('success')
                                        ✅
                                    @break
                                    @case('failed')
                                        ❌
                                    @break
                                    @case('cancelled')
                                        ⏹️
                                    @break
                                    @default
                                        ⏳
                                @endswitch
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-slate-900 text-sm truncate">
                                    {{ $exec->branch }}
                                </p>
                                <p class="text-xs text-slate-600 font-mono truncate">
                                    {{ substr($exec->commit_sha ?? 'N/A', 0, 7) }}
                                </p>
                                <p class="text-xs text-slate-500 mt-1">
                                    {{ $exec->created_at?->diffForHumans() }}
                                </p>
                            </div>
                        </div>
                    </button>
                @empty
                    <div class="p-8 text-center text-slate-500">
                        <p class="text-sm">No executions yet</p>
                    </div>
                @endforelse
            </div>
        </div>

        <!-- Right Panel: Execution Details -->
        <div class="flex-1 overflow-y-auto">
            @if ($currentExecution)
                <div class="p-8 max-w-6xl">
                    <!-- Status Header -->
                    <div class="mb-8 p-6 rounded-lg border-2 {{ match($currentExecution->status) {
                        'running' => 'border-blue-300 bg-blue-50',
                        'success' => 'border-green-300 bg-green-50',
                        'failed' => 'border-red-300 bg-red-50',
                        'cancelled' => 'border-gray-300 bg-gray-50',
                        default => 'border-yellow-300 bg-yellow-50'
                    } }}">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="text-3xl">
                                        @switch($currentExecution->status)
                                            @case('running')
                                                🔄
                                            @break
                                            @case('success')
                                                ✅
                                            @break
                                            @case('failed')
                                                ❌
                                            @break
                                            @case('cancelled')
                                                ⏹️
                                            @break
                                            @default
                                                ⏳
                                        @endswitch
                                    </span>
                                    <div>
                                        <h2 class="text-2xl font-bold text-slate-900">
                                            {{ ucfirst($currentExecution->status) }}
                                        </h2>
                                        <p class="text-sm text-slate-600 mt-1">
                                            Started: {{ $currentExecution->created_at?->format('M d, Y H:i:s') }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                @if ($currentExecution->status === 'failed')
                                    <button
                                        wire:click="retryExecution"
                                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
                                    >
                                        🔄 Retry
                                    </button>
                                @endif
                                @if ($currentExecution->status === 'running')
                                    <button
                                        wire:click="cancelExecution"
                                        class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
                                    >
                                        ⏹️ Cancel
                                    </button>
                                @endif
                            </div>
                        </div>
                    </div>

                    <!-- Tabs -->
                    <div class="flex gap-4 border-b border-slate-200 mb-6">
                        @foreach(['overview' => '📊 Overview', 'logs' => '📝 Logs', 'stages' => '🔄 Stages'] as $tab => $label)
                            <button
                                wire:click="selectTab('{{ $tab }}')"
                                class="px-4 py-3 font-semibold border-b-2 transition-all {{ $selectedTab === $tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900' }}"
                            >
                                {{ $label }}
                            </button>
                        @endforeach
                    </div>

                    <!-- Tab Content -->
                    <div>
                        @switch($selectedTab)
                            @case('overview')
                                @include('livewire.project.application.pipeline.monitor-tabs.overview')
                            @break
                            @case('logs')
                                @include('livewire.project.application.pipeline.monitor-tabs.logs')
                            @break
                            @case('stages')
                                @include('livewire.project.application.pipeline.monitor-tabs.stages')
                            @break
                        @endswitch
                    </div>
                </div>
            @else
                <div class="h-full flex items-center justify-center">
                    <div class="text-center">
                        <p class="text-3xl mb-3">📭</p>
                        <p class="text-xl font-semibold text-slate-900 mb-2">No Execution Selected</p>
                        <p class="text-slate-600">Select an execution from the list to view details</p>
                    </div>
                </div>
            @endif
        </div>
    </div>
</div>
