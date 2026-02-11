<div>
    <h2 class="text-2xl font-bold text-slate-900 mb-6">Step 4: Configure Notifications</h2>

    <p class="text-slate-600 mb-6">
        Get updates about your pipeline runs via your favorite channels
    </p>

    <!-- Notification Mode Selection -->
    <div class="space-y-3 mb-8">
        @php
            $notificationModes = [
                'none' => [
                    'label' => '🔇 No Notifications',
                    'description' => 'Stay silent - don\'t send any notifications'
                ],
                'failures' => [
                    'label' => '⚠️ Only on Failures',
                    'description' => 'Get notified only when the pipeline fails'
                ],
                'all' => [
                    'label' => '📢 All Events',
                    'description' => 'Get notified for all pipeline events (start, success, failure)'
                ]
            ];
        @endphp

        @foreach($notificationModes as $mode => $config)
            <label class="flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all
                {{ $notificationMode === $mode 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-slate-200 bg-white hover:border-slate-300' }}">
                <input
                    type="radio"
                    wire:model="notificationMode"
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

    <!-- Notification Channels -->
    @if ($notificationMode !== 'none')
        <div class="mt-8">
            <h3 class="font-bold text-slate-900 mb-4">Select Notification Channels</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Email -->
                <div class="p-4 rounded-lg border-2 transition-all {{ in_array('email', $notificationChannels) ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white' }}">
                    <label class="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            wire:model="notificationChannels"
                            value="email"
                            class="mt-1 w-4 h-4"
                        >
                        <div class="flex-1">
                            <div class="font-semibold text-slate-900">📧 Email</div>
                            <p class="text-sm text-slate-600 mt-1">
                                Receive pipeline notifications via email
                            </p>
                        </div>
                    </label>

                    @if (in_array('email', $notificationChannels))
                        <div class="mt-4 pt-4 border-t border-blue-300 space-y-3">
                            <input
                                type="email"
                                wire:model="notificationConfig.email.recipient"
                                placeholder="your@email.com"
                                class="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                            >
                            <label class="flex items-center gap-2">
                                <input type="checkbox" class="w-4 h-4 rounded">
                                <span class="text-sm text-slate-700">Notify on success</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" class="w-4 h-4 rounded" checked>
                                <span class="text-sm text-slate-700">Notify on failure</span>
                            </label>
                        </div>
                    @endif
                </div>

                <!-- Slack -->
                <div class="p-4 rounded-lg border-2 transition-all {{ in_array('slack', $notificationChannels) ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white' }}">
                    <label class="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            wire:model="notificationChannels"
                            value="slack"
                            class="mt-1 w-4 h-4"
                        >
                        <div class="flex-1">
                            <div class="font-semibold text-slate-900">💬 Slack</div>
                            <p class="text-sm text-slate-600 mt-1">
                                Send messages to a Slack channel
                            </p>
                        </div>
                    </label>

                    @if (in_array('slack', $notificationChannels))
                        <div class="mt-4 pt-4 border-t border-blue-300 space-y-3">
                            <input
                                type="text"
                                wire:model="notificationConfig.slack.webhook"
                                placeholder="https://hooks.slack.com/services/..."
                                class="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                            >
                            <p class="text-xs text-slate-600">
                                <a href="https://api.slack.com/apps" target="_blank" class="text-blue-600 hover:underline">
                                    Get your Slack webhook →
                                </a>
                            </p>
                        </div>
                    @endif
                </div>

                <!-- Discord -->
                <div class="p-4 rounded-lg border-2 transition-all {{ in_array('discord', $notificationChannels) ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white' }}">
                    <label class="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            wire:model="notificationChannels"
                            value="discord"
                            class="mt-1 w-4 h-4"
                        >
                        <div class="flex-1">
                            <div class="font-semibold text-slate-900">💎 Discord</div>
                            <p class="text-sm text-slate-600 mt-1">
                                Send messages to a Discord channel
                            </p>
                        </div>
                    </label>

                    @if (in_array('discord', $notificationChannels))
                        <div class="mt-4 pt-4 border-t border-blue-300 space-y-3">
                            <input
                                type="text"
                                wire:model="notificationConfig.discord.webhook"
                                placeholder="https://discordapp.com/api/webhooks/..."
                                class="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                            >
                            <p class="text-xs text-slate-600">
                                <a href="https://discord.com/developers/docs/resources/webhook" target="_blank" class="text-blue-600 hover:underline">
                                    Get your Discord webhook →
                                </a>
                            </p>
                        </div>
                    @endif
                </div>

                <!-- Telegram -->
                <div class="p-4 rounded-lg border-2 transition-all {{ in_array('telegram', $notificationChannels) ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white' }}">
                    <label class="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            wire:model="notificationChannels"
                            value="telegram"
                            class="mt-1 w-4 h-4"
                        >
                        <div class="flex-1">
                            <div class="font-semibold text-slate-900">📱 Telegram</div>
                            <p class="text-sm text-slate-600 mt-1">
                                Send messages to a Telegram chat
                            </p>
                        </div>
                    </label>

                    @if (in_array('telegram', $notificationChannels))
                        <div class="mt-4 pt-4 border-t border-blue-300 space-y-3">
                            <div class="space-y-2">
                                <input
                                    type="text"
                                    wire:model="notificationConfig.telegram.bot_token"
                                    placeholder="Your Telegram Bot Token"
                                    class="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                                >
                                <input
                                    type="text"
                                    wire:model="notificationConfig.telegram.chat_id"
                                    placeholder="Your Telegram Chat ID"
                                    class="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                                >
                            </div>
                            <p class="text-xs text-slate-600">
                                <a href="https://core.telegram.org/bots" target="_blank" class="text-blue-600 hover:underline">
                                    Create a Telegram bot →
                                </a>
                            </p>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    @endif

    <!-- Summary -->
    @if ($notificationMode !== 'none')
        <div class="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 class="font-bold text-blue-900 mb-3">Notification Summary</h3>
            <ul class="space-y-2 text-sm text-blue-900">
                <li class="flex items-center gap-2">
                    <span>📢</span>
                    <span>You'll be notified <strong>{{ $notificationMode === 'failures' ? 'on failures' : 'on all events' }}</strong></span>
                </li>
                <li class="flex items-center gap-2">
                    <span>📡</span>
                    <span>Via: <strong>{{ implode(', ', array_map('ucfirst', $notificationChannels)) }}</strong></span>
                </li>
            </ul>
        </div>
    @else
        <div class="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 class="font-bold text-yellow-900 mb-2">⚠️ No Notifications</h3>
            <p class="text-sm text-yellow-800">
                You won't receive any notifications. You can enable them anytime in the pipeline settings.
            </p>
        </div>
    @endif

    <!-- Info Box -->
    <div class="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p class="text-sm text-slate-700">
            <strong>💡 Tip:</strong> You can configure multiple notification channels. Webhooks are securely stored and encrypted.
        </p>
    </div>
</div>
