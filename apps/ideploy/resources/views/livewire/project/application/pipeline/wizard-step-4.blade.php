<!-- Step 4: Notifications -->
<div class="space-y-8">
    
    <!-- Notification Mode Selection -->
    <div class="space-y-4">
        <h3 class="font-bold text-slate-900 mb-4">📬 Quand vous notifier?</h3>
        
        <div class="space-y-3">
            <!-- No Notifications -->
            <div
                wire:click="setNotificationMode('none')"
                class="cursor-pointer p-4 border-2 rounded-lg transition-all duration-200
                    {{ $this->notificationMode === 'none'
                        ? 'border-slate-600 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }}"
            >
                <div class="flex items-start gap-3">
                    <div class="text-2xl mt-1">🔇</div>
                    <div class="flex-1">
                        <h4 class="font-bold text-slate-900">Pas de notifications</h4>
                        <p class="text-slate-600 text-sm mt-1">
                            Consultez les résultats manuellement dans le dashboard
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Failures Only -->
            <div
                wire:click="setNotificationMode('failures')"
                class="cursor-pointer p-4 border-2 rounded-lg transition-all duration-200
                    {{ $this->notificationMode === 'failures'
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-slate-200 bg-white hover:border-amber-300'
                    }}"
            >
                <div class="flex items-start gap-3">
                    <div class="text-2xl mt-1">⚠️</div>
                    <div class="flex-1">
                        <h4 class="font-bold text-slate-900">Seulement les erreurs</h4>
                        <p class="text-slate-600 text-sm mt-1">
                            Recevez une notification seulement si le pipeline échoue
                        </p>
                        <p class="text-slate-500 text-xs mt-2">✓ Recommandé • ✓ Moins de bruit</p>
                    </div>
                </div>
            </div>
            
            <!-- All Events -->
            <div
                wire:click="setNotificationMode('all')"
                class="cursor-pointer p-4 border-2 rounded-lg transition-all duration-200
                    {{ $this->notificationMode === 'all'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }}"
            >
                <div class="flex items-start gap-3">
                    <div class="text-2xl mt-1">🔔</div>
                    <div class="flex-1">
                        <h4 class="font-bold text-slate-900">Tous les événements</h4>
                        <p class="text-slate-600 text-sm mt-1">
                            Recevez une notification pour chaque événement du pipeline
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Notification Channels (if not 'none') -->
    @if ($this->notificationMode !== 'none')
        <div class="space-y-4 pt-6 border-t border-slate-200">
            <h3 class="font-bold text-slate-900">💬 Où vous notifier?</h3>
            
            <p class="text-slate-600 text-sm">
                Sélectionnez les canaux sur lesquels vous souhaitez recevoir les notifications:
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                @foreach ($availableChannels as $channelKey => $channelInfo)
                    <div
                        wire:click="toggleNotificationChannel('{{ $channelKey }}')"
                        class="cursor-pointer p-4 border-2 rounded-lg transition-all duration-200
                            {{ in_array($channelKey, $this->notificationChannels)
                                ? 'border-green-600 bg-green-50'
                                : 'border-slate-200 bg-white hover:border-green-300'
                            }}"
                    >
                        <div class="flex items-start gap-3">
                            <div class="text-2xl">{{ $channelInfo['icon'] }}</div>
                            <div class="flex-1">
                                <h4 class="font-bold text-slate-900">{{ $channelInfo['name'] }}</h4>
                                
                                @if (in_array($channelKey, $this->notificationChannels))
                                    <!-- Configuration Input -->
                                    <div class="mt-3 pt-3 border-t border-green-200 space-y-2">
                                        @switch($channelKey)
                                            @case('slack')
                                                <input
                                                    type="text"
                                                    placeholder="Webhook URL (slack.com/...)"
                                                    wire:change="updateNotificationConfig('slack', {'webhook_url': $event.target.value})"
                                                    value="{{ $this->notificationConfig['slack']['webhook_url'] ?? '' }}"
                                                    class="w-full px-3 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                                />
                                                @break
                                            @case('email')
                                                <input
                                                    type="email"
                                                    placeholder="Adresse e-mail"
                                                    wire:change="updateNotificationConfig('email', {'email': $event.target.value})"
                                                    value="{{ $this->notificationConfig['email']['email'] ?? '' }}"
                                                    class="w-full px-3 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                                />
                                                @break
                                            @case('discord')
                                                <input
                                                    type="text"
                                                    placeholder="Webhook URL (discord.com/...)"
                                                    wire:change="updateNotificationConfig('discord', {'webhook_url': $event.target.value})"
                                                    value="{{ $this->notificationConfig['discord']['webhook_url'] ?? '' }}"
                                                    class="w-full px-3 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                                />
                                                @break
                                            @case('telegram')
                                                <input
                                                    type="text"
                                                    placeholder="Bot Token"
                                                    wire:change="updateNotificationConfig('telegram', {'bot_token': $event.target.value})"
                                                    value="{{ $this->notificationConfig['telegram']['bot_token'] ?? '' }}"
                                                    class="w-full px-3 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Chat ID"
                                                    wire:change="updateNotificationConfig('telegram', {'chat_id': $event.target.value})"
                                                    value="{{ $this->notificationConfig['telegram']['chat_id'] ?? '' }}"
                                                    class="w-full px-3 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                                />
                                                @break
                                        @endswitch
                                    </div>
                                @endif
                            </div>
                            
                            <!-- Checkbox -->
                            <div class="pt-1">
                                <div class="w-5 h-5 rounded border-2 flex items-center justify-center
                                    {{ in_array($channelKey, $this->notificationChannels)
                                        ? 'border-green-600 bg-green-600'
                                        : 'border-slate-300 bg-white'
                                    }}"
                                >
                                    @if (in_array($channelKey, $this->notificationChannels))
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    @endif
                                </div>
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
            
            <!-- Selected Channels Summary -->
            @if (!empty($this->notificationChannels))
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                    <p class="text-green-900 text-sm">
                        <span class="font-bold">✓</span> Notifications configurées pour:
                        <span class="font-medium">{{ implode(', ', $this->notificationChannels) }}</span>
                    </p>
                </div>
            @endif
        </div>
    @endif
    
    <!-- Info Box -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <p class="text-blue-900 text-sm">
            <span class="font-bold">💡 Conseil:</span>
            Commencez par "Seulement les erreurs" pour éviter trop de notifications.
            Vous pourrez toujours changer ce paramètre plus tard.
        </p>
    </div>
    
</div>
