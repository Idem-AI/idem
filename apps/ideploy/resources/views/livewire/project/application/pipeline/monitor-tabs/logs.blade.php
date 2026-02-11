<div class="space-y-4">
    <!-- Logs Controls -->
    <div class="flex items-center justify-between gap-4">
        <div class="flex gap-2">
            <input
                type="text"
                placeholder="Search logs..."
                class="px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
            <button class="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-semibold transition-all">
                🔍 Search
            </button>
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
            <input
                type="checkbox"
                wire:model="autoScroll"
                class="w-4 h-4 rounded"
            >
            <span class="text-sm text-slate-700">Auto-scroll</span>
        </label>
    </div>

    <!-- Logs Container -->
    <div class="bg-black rounded-lg border border-slate-300 p-4 font-mono text-sm overflow-x-auto" style="max-height: 600px; overflow-y: auto;" id="logsContainer">
        @php
            $logs = $currentExecution->logs ?? [
                ['timestamp' => '2025-02-09T10:00:00Z', 'level' => 'info', 'stage' => 'lint', 'message' => 'Starting lint stage...'],
                ['timestamp' => '2025-02-09T10:00:05Z', 'level' => 'info', 'stage' => 'lint', 'message' => 'Running ESLint...'],
                ['timestamp' => '2025-02-09T10:00:10Z', 'level' => 'warning', 'stage' => 'lint', 'message' => 'Found 3 warnings'],
                ['timestamp' => '2025-02-09T10:00:15Z', 'level' => 'success', 'stage' => 'lint', 'message' => 'Lint stage completed ✓'],
                ['timestamp' => '2025-02-09T10:00:20Z', 'level' => 'info', 'stage' => 'test', 'message' => 'Starting test stage...'],
                ['timestamp' => '2025-02-09T10:00:25Z', 'level' => 'info', 'stage' => 'test', 'message' => 'Running Jest tests...'],
                ['timestamp' => '2025-02-09T10:00:45Z', 'level' => 'success', 'stage' => 'test', 'message' => 'All tests passed (45 tests)'],
            ];
        @endphp

        @if (is_array($logs) && count($logs) > 0)
            @foreach($logs as $log)
                <div class="mb-1 text-xs flex gap-4">
                    <span class="text-gray-600 whitespace-nowrap">
                        {{ \Carbon\Carbon::parse($log['timestamp'] ?? now())->format('H:i:s') }}
                    </span>
                    <span class="whitespace-nowrap {{ match($log['level'] ?? 'info') {
                        'error' => 'text-red-400',
                        'warning' => 'text-yellow-400',
                        'success' => 'text-green-400',
                        default => 'text-gray-300'
                    } }}">
                        [{{ strtoupper($log['level'] ?? 'INFO') }}]
                    </span>
                    <span class="text-blue-400 whitespace-nowrap">
                        {{ $log['stage'] ?? 'system' }}
                    </span>
                    <span class="text-gray-300 flex-1">
                        {{ $log['message'] ?? 'No message' }}
                    </span>
                </div>
            @endforeach
        @else
            <div class="text-gray-500 text-center py-8">
                No logs available yet
            </div>
        @endif
    </div>

    <!-- Log Export -->
    <div class="flex gap-2">
        <button class="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-semibold transition-all text-sm">
            📥 Download Logs
        </button>
        <button class="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-semibold transition-all text-sm">
            📋 Copy All
        </button>
    </div>
</div>

<script>
    document.addEventListener('DOMContentLoaded', function() {
        const container = document.getElementById('logsContainer');
        if (container) {
            // Auto-scroll to bottom
            container.scrollTop = container.scrollHeight;
            
            // Listen for new logs (would be implemented with WebSocket/Livewire)
            // container.scrollTop = container.scrollHeight;
        }
    });
</script>
