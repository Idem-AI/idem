<div>
    <h2 class="text-2xl font-bold text-slate-900 mb-6">Step 2: Configure Triggers</h2>

    <p class="text-slate-600 mb-6">
        Choose when your pipeline should automatically run
    </p>

    <!-- Trigger Mode Selection -->
    <div class="space-y-3 mb-8">
        @php
            $triggerModes = [
                'webhook' => [
                    'label' => '🪝 On Every Push (Webhook)',
                    'description' => 'Pipeline runs automatically when code is pushed to selected branches',
                    'icon' => '📤'
                ],
                'pr' => [
                    'label' => '🔄 On Pull Requests',
                    'description' => 'Pipeline runs on pull request creation and updates',
                    'icon' => '💬'
                ],
                'manual' => [
                    'label' => '🎮 Manual Only',
                    'description' => 'Pipeline only runs when you manually trigger it',
                    'icon' => '⏯️'
                ],
                'scheduled' => [
                    'label' => '⏰ Scheduled (Cron)',
                    'description' => 'Pipeline runs on a schedule (e.g., daily, weekly)',
                    'icon' => '📅'
                ]
            ];
        @endphp

        @foreach($triggerModes as $mode => $config)
            <label class="flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all
                {{ $triggerMode === $mode 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-slate-200 bg-white hover:border-slate-300' }}">
                <input
                    type="radio"
                    wire:model="triggerMode"
                    value="{{ $mode }}"
                    class="mt-1 w-4 h-4"
                >
                <div class="ml-4 flex-1">
                    <div class="font-semibold text-slate-900">
                        {{ $config['label'] }}
                    </div>
                    <p class="text-sm text-slate-600 mt-1">
                        {{ $config['description'] }}
                    </p>
                </div>
            </label>
        @endforeach
    </div>

    <!-- Branch Selection (for webhook/PR modes) -->
    @if (in_array($triggerMode, ['webhook', 'pr']))
        <div class="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
            <h3 class="font-bold text-slate-900 mb-4">Select Branches</h3>

            <p class="text-sm text-slate-600 mb-4">
                Which branches should trigger the pipeline?
            </p>

            <!-- Common Branches -->
            <div class="space-y-2 mb-6">
                @foreach(['main', 'develop', 'staging', 'production'] as $branch)
                    <label class="flex items-center gap-3 p-3 rounded-lg hover:bg-white cursor-pointer">
                        <input
                            type="checkbox"
                            wire:model="selectedBranches"
                            value="{{ $branch }}"
                            class="w-4 h-4 rounded"
                        >
                        <span class="font-mono text-sm text-slate-700">
                            {{ $branch }}
                        </span>
                        @if ($branch === 'main' || $branch === 'develop')
                            <span class="ml-auto text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                                Recommended
                            </span>
                        @endif
                    </label>
                @endforeach
            </div>

            <!-- Custom Branches -->
            <div class="mt-6 pt-6 border-t border-slate-300">
                <label class="block text-sm font-semibold text-slate-900 mb-2">
                    Or enter custom branches:
                </label>
                <input
                    type="text"
                    wire:model="allBranches"
                    wire:change="setCustomBranches"
                    placeholder="feature/*, release/*, custom-branch"
                    class="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                >
                <p class="text-xs text-slate-600 mt-2">
                    Separate multiple branches with commas or spaces. Use * for wildcards.
                </p>
            </div>

            <!-- Selected Branches Display -->
            @if (count($selectedBranches) > 0)
                <div class="mt-6 p-4 bg-white rounded-lg border border-slate-200">
                    <p class="text-sm font-semibold text-slate-900 mb-3">Selected Branches:</p>
                    <div class="flex flex-wrap gap-2">
                        @foreach($selectedBranches as $branch)
                            <div class="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                <span class="font-mono">{{ $branch }}</span>
                                <button
                                    wire:click="removeBranch('{{ $branch }}')"
                                    class="hover:text-blue-600 font-bold"
                                    type="button"
                                >
                                    ✕
                                </button>
                            </div>
                        @endforeach
                    </div>
                </div>
            @endif
        </div>
    @endif

    <!-- Scheduled Settings (for scheduled mode) -->
    @if ($triggerMode === 'scheduled')
        <div class="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
            <h3 class="font-bold text-slate-900 mb-4">Schedule Configuration</h3>

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-semibold text-slate-900 mb-2">
                        Cron Expression:
                    </label>
                    <input
                        type="text"
                        placeholder="0 0 * * * (daily at midnight)"
                        class="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                    >
                    <p class="text-xs text-slate-600 mt-2">
                        Use standard cron syntax. Examples:
                        <br>
                        <span class="font-mono">0 0 * * *</span> = Daily at midnight
                        <br>
                        <span class="font-mono">0 */6 * * *</span> = Every 6 hours
                    </p>
                </div>
            </div>
        </div>
    @endif

    <!-- Webhook URL Display -->
    <div class="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 class="font-bold text-blue-900 mb-2">🪝 Webhook URL</h3>
        <p class="text-sm text-blue-800 mb-4">
            Use this URL in your GitHub repository settings:
        </p>
        <div class="flex items-center gap-2 p-3 bg-white rounded-lg border border-blue-300">
            <input
                type="text"
                value="{{ route('webhook.github', ['application' => $application->id]) }}"
                readonly
                class="flex-1 px-3 py-2 text-sm font-mono text-slate-600 bg-transparent border-none focus:outline-none"
            >
            <button
                onclick="navigator.clipboard.writeText(this.previousElementSibling.value); alert('Copied!')"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
            >
                Copy
            </button>
        </div>
    </div>

    <!-- Info Box -->
    <div class="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p class="text-sm text-slate-700">
            <strong>💡 Tip:</strong> You can enable multiple trigger modes (e.g., webhook + manual). This gives you flexibility!
        </p>
    </div>
</div>
