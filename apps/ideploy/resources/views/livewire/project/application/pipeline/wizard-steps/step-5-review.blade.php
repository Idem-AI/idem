<div>
    <h2 class="text-2xl font-bold text-slate-900 mb-6">Step 5: Review & Confirm</h2>

    <p class="text-slate-600 mb-8">
        Here's a summary of your pipeline configuration. Review and confirm to save it.
    </p>

    <!-- Configuration Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <!-- Template Selected -->
        <div class="p-6 rounded-lg border border-slate-200 bg-white">
            <div class="flex items-center gap-3 mb-3">
                <span class="text-2xl">📦</span>
                <h3 class="font-bold text-slate-900">Template</h3>
            </div>
            <p class="text-lg font-semibold text-blue-600">
                {{ ucfirst($selectedTemplate ?? 'None') }}
            </p>
            <p class="text-sm text-slate-600 mt-2">
                @if ($currentTemplate)
                    {{ $currentTemplate->description }}
                @else
                    No template selected
                @endif
            </p>
        </div>

        <!-- Trigger Configuration -->
        <div class="p-6 rounded-lg border border-slate-200 bg-white">
            <div class="flex items-center gap-3 mb-3">
                <span class="text-2xl">🪝</span>
                <h3 class="font-bold text-slate-900">Trigger Mode</h3>
            </div>
            <p class="text-lg font-semibold text-blue-600">
                @switch($triggerMode)
                    @case('webhook')
                        On Every Push
                    @break
                    @case('pr')
                        On Pull Requests
                    @break
                    @case('manual')
                        Manual Only
                    @break
                    @case('scheduled')
                        Scheduled (Cron)
                    @break
                    @default
                        Unknown
                @endswitch
            </p>
            @if (in_array($triggerMode, ['webhook', 'pr']))
                <div class="text-sm text-slate-600 mt-2">
                    <p class="font-semibold">Branches:</p>
                    <div class="flex flex-wrap gap-1 mt-1">
                        @foreach($selectedBranches as $branch)
                            <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                                {{ $branch }}
                            </span>
                        @endforeach
                    </div>
                </div>
            @endif
        </div>

        <!-- Pipeline Stages -->
        <div class="p-6 rounded-lg border border-slate-200 bg-white md:col-span-2">
            <div class="flex items-center gap-3 mb-4">
                <span class="text-2xl">🔄</span>
                <h3 class="font-bold text-slate-900">Pipeline Stages</h3>
            </div>
            <div class="space-y-2">
                @php
                    $stageEmojis = [
                        'lint' => '📝',
                        'test' => '✅',
                        'build' => '🔨',
                        'security' => '🔒',
                        'deploy' => '🚀',
                        'performance' => '⚡',
                    ];
                @endphp

                @foreach($selectedStages as $index => $stageKey)
                    <div class="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                            {{ $index + 1 }}
                        </div>
                        <span class="text-lg">{{ $stageEmojis[$stageKey] ?? '⚙️' }}</span>
                        <span class="font-semibold text-slate-900 flex-1">
                            {{ ucfirst($stageKey) }}
                        </span>
                        <span class="text-xs text-slate-600">
                            ⏱️ {{ $stageConfigs[$stageKey]['timeout'] ?? 600 }}s
                        </span>
                    </div>
                @endforeach
            </div>
        </div>

        <!-- Notifications -->
        <div class="p-6 rounded-lg border border-slate-200 bg-white md:col-span-2">
            <div class="flex items-center gap-3 mb-3">
                <span class="text-2xl">📢</span>
                <h3 class="font-bold text-slate-900">Notifications</h3>
            </div>
            @if ($notificationMode !== 'none')
                <div class="space-y-2 text-sm">
                    <p class="text-slate-700">
                        <strong>Mode:</strong>
                        {{ $notificationMode === 'failures' ? '⚠️ On Failures Only' : '📢 All Events' }}
                    </p>
                    @if (count($notificationChannels) > 0)
                        <p class="text-slate-700">
                            <strong>Channels:</strong>
                            <div class="flex flex-wrap gap-1 mt-1">
                                @foreach($notificationChannels as $channel)
                                    <span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                        @switch($channel)
                                            @case('slack')
                                                💬 Slack
                                            @break
                                            @case('email')
                                                📧 Email
                                            @break
                                            @case('discord')
                                                💎 Discord
                                            @break
                                            @case('telegram')
                                                📱 Telegram
                                            @break
                                        @endswitch
                                    </span>
                                @endforeach
                            </div>
                        </p>
                    @endif
                </div>
            @else
                <p class="text-sm text-slate-600">
                    ✅ No notifications enabled
                </p>
            @endif
        </div>
    </div>

    <!-- Confirmation Checkbox -->
    <div class="p-6 rounded-lg border-2 border-yellow-300 bg-yellow-50 mb-8">
        <label class="flex items-start gap-3 cursor-pointer">
            <input
                type="checkbox"
                wire:model="isConfirmed"
                class="mt-1 w-5 h-5"
            >
            <div>
                <p class="font-semibold text-slate-900">
                    I confirm this pipeline configuration is correct
                </p>
                <p class="text-sm text-slate-600 mt-1">
                    Once saved, your GitHub webhook will be activated and the pipeline will start running based on your trigger settings.
                </p>
            </div>
        </label>
    </div>

    <!-- Final Steps -->
    <div class="space-y-4 mb-8">
        <div class="p-4 rounded-lg border border-blue-200 bg-blue-50">
            <h4 class="font-bold text-blue-900 mb-2">🎉 What happens next?</h4>
            <ol class="text-sm text-blue-900 space-y-2 ml-4 list-decimal">
                <li>Your pipeline configuration is saved securely</li>
                <li>The GitHub webhook is activated automatically</li>
                <li>Your pipeline will start running on the next event</li>
                <li>You'll receive notifications based on your settings</li>
            </ol>
        </div>

        <div class="p-4 rounded-lg border border-slate-200 bg-slate-50">
            <h4 class="font-bold text-slate-900 mb-2">📝 Can I edit this later?</h4>
            <p class="text-sm text-slate-700">
                Yes! You can always return to the pipeline settings to modify your configuration, add/remove stages, or change notifications.
            </p>
        </div>
    </div>

    <!-- Quick Reference -->
    <div class="p-6 rounded-lg border border-slate-200 bg-white mb-8">
        <h3 class="font-bold text-slate-900 mb-4">Quick Reference</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
                <p class="font-semibold text-slate-900">Application</p>
                <p class="text-slate-600 font-mono">{{ $application->name }}</p>
            </div>
            <div>
                <p class="font-semibold text-slate-900">Status</p>
                <p class="text-slate-600">Ready to deploy ✅</p>
            </div>
            <div>
                <p class="font-semibold text-slate-900">Total Stages</p>
                <p class="text-slate-600">{{ count($selectedStages) }} stages</p>
            </div>
            <div>
                <p class="font-semibold text-slate-900">Estimated Duration</p>
                <p class="text-slate-600">~{{ array_sum(array_map(fn($s) => $stageConfigs[$s]['timeout'] ?? 600, $selectedStages)) / 60 }} minutes</p>
            </div>
        </div>
    </div>

    <!-- Success/Error Messages -->
    @if ($successMessage)
        <div class="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
            <span class="text-xl">✅</span>
            <span>{{ $successMessage }}</span>
        </div>
    @endif

    @if ($errorMessage)
        <div class="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <span class="text-xl">❌</span>
            <span>{{ $errorMessage }}</span>
        </div>
    @endif

    <!-- Info Box -->
    <div class="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p class="text-sm text-slate-700">
            <strong>🚀 Ready to go!</strong> Click "Save & Deploy" below to finalize your pipeline setup.
        </p>
    </div>
</div>
