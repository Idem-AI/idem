<div class="space-y-6">
    <!-- Key Metrics -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-lg border border-slate-200 bg-white">
            <p class="text-sm text-slate-600 mb-1">Status</p>
            <p class="text-xl font-bold text-slate-900">
                {{ ucfirst($currentExecution->status) }}
            </p>
        </div>
        <div class="p-4 rounded-lg border border-slate-200 bg-white">
            <p class="text-sm text-slate-600 mb-1">Branch</p>
            <p class="text-lg font-bold text-slate-900 font-mono">
                {{ $currentExecution->branch }}
            </p>
        </div>
        <div class="p-4 rounded-lg border border-slate-200 bg-white">
            <p class="text-sm text-slate-600 mb-1">Duration</p>
            <p class="text-lg font-bold text-slate-900">
                @if ($currentExecution->completed_at)
                    {{ $currentExecution->completed_at->diffInSeconds($currentExecution->created_at) }}s
                @else
                    {{ now()->diffInSeconds($currentExecution->created_at) }}s
                @endif
            </p>
        </div>
        <div class="p-4 rounded-lg border border-slate-200 bg-white">
            <p class="text-sm text-slate-600 mb-1">Commit</p>
            <p class="text-lg font-bold text-slate-900 font-mono">
                {{ substr($currentExecution->commit_sha ?? 'N/A', 0, 7) }}
            </p>
        </div>
    </div>

    <!-- Execution Details -->
    <div class="p-6 rounded-lg border border-slate-200 bg-white">
        <h3 class="font-bold text-slate-900 mb-4">📋 Execution Details</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
                <p class="text-slate-600">Started At</p>
                <p class="font-semibold text-slate-900">
                    {{ $currentExecution->created_at?->format('M d, Y H:i:s') }}
                </p>
            </div>
            <div>
                <p class="text-slate-600">Completed At</p>
                <p class="font-semibold text-slate-900">
                    {{ $currentExecution->completed_at?->format('M d, Y H:i:s') ?? 'In progress...' }}
                </p>
            </div>
            <div>
                <p class="text-slate-600">Triggered By</p>
                <p class="font-semibold text-slate-900">
                    {{ $currentExecution->triggered_by ?? 'Webhook' }}
                </p>
            </div>
            <div>
                <p class="text-slate-600">Total Stages</p>
                <p class="font-semibold text-slate-900">
                    {{ count($currentExecution->stages_status ?? []) }}
                </p>
            </div>
        </div>
    </div>

    <!-- Stages Progress -->
    <div class="p-6 rounded-lg border border-slate-200 bg-white">
        <h3 class="font-bold text-slate-900 mb-4">🔄 Stages Progress</h3>

        <div class="space-y-3">
            @php
                $stagesStatus = $currentExecution->stages_status ?? [];
                $stageEmojis = [
                    'lint' => '📝',
                    'test' => '✅',
                    'build' => '🔨',
                    'security' => '🔒',
                    'deploy' => '🚀',
                    'performance' => '⚡',
                ];
            @endphp

            @foreach($stagesStatus as $stageName => $stageInfo)
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="text-lg">{{ $stageEmojis[$stageName] ?? '⚙️' }}</span>
                            <span class="font-semibold text-slate-900">{{ ucfirst($stageName) }}</span>
                            <span class="text-xs px-2 py-1 rounded-full font-semibold {{ match($stageInfo['status'] ?? 'pending') {
                                'running' => 'bg-blue-100 text-blue-800',
                                'success' => 'bg-green-100 text-green-800',
                                'failed' => 'bg-red-100 text-red-800',
                                'skipped' => 'bg-gray-100 text-gray-800',
                                default => 'bg-yellow-100 text-yellow-800'
                            } }}">
                                {{ ucfirst($stageInfo['status'] ?? 'pending') }}
                            </span>
                        </div>
                        <span class="text-sm text-slate-600">
                            {{ $stageInfo['duration'] ?? '—' }}s
                        </span>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="w-full bg-slate-200 rounded-full h-2">
                        <div
                            class="h-2 rounded-full transition-all duration-300 {{ match($stageInfo['status'] ?? 'pending') {
                                'running' => 'bg-blue-500 w-1/2',
                                'success' => 'bg-green-500 w-full',
                                'failed' => 'bg-red-500 w-full',
                                'skipped' => 'bg-gray-500 w-0',
                                default => 'bg-yellow-500 w-0'
                            } }}"
                        ></div>
                    </div>
                </div>
            @endforeach
        </div>
    </div>

    <!-- Environment Variables -->
    <div class="p-6 rounded-lg border border-slate-200 bg-white">
        <h3 class="font-bold text-slate-900 mb-4">🔐 Environment</h3>
        <div class="space-y-2 text-sm">
            <div class="flex justify-between">
                <span class="text-slate-600">Repository</span>
                <span class="font-semibold text-slate-900">{{ $currentExecution->repository_name ?? 'N/A' }}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-slate-600">Branch</span>
                <span class="font-mono text-slate-900 font-semibold">{{ $currentExecution->branch }}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-slate-600">Commit SHA</span>
                <span class="font-mono text-slate-900 font-semibold">{{ substr($currentExecution->commit_sha ?? 'N/A', 0, 12) }}</span>
            </div>
        </div>
    </div>
</div>
