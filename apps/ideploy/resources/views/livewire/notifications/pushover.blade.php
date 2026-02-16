<div class="min-h-screen">
    <x-slot:title>
        Pushover Notifications | iDeploy
    </x-slot>
    
    <x-notification.navbar />
    
    {{-- Page Header --}}
    <div class="glass-card mb-8 p-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center border border-glass glow-primary">
                    <svg class="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                </div>
                <div>
                    <h1 class="text-3xl font-bold text-light text-glow-primary">Pushover Notifications</h1>
                    <p class="text-sm text-gray-400 mt-1">Send push notifications to your devices</p>
                </div>
            </div>
            
            <div class="flex items-center gap-3">
                @if ($pushoverEnabled)
                    <button wire:click="sendTestNotification" 
                            class="outer-button flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                        </svg>
                        Send Test Notification
                    </button>
                @else
                    <button disabled class="outer-button opacity-50 cursor-not-allowed">
                        Send Test Notification
                    </button>
                @endif
            </div>
        </div>
    </div>

    {{-- Configuration --}}
    <form wire:submit='submit' class="mb-8">
        <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-semibold text-light">API Configuration</h2>
                        <p class="text-xs text-gray-400 mt-0.5">Connect your Pushover account</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" wire:model="pushoverEnabled" wire:change="instantSavePushoverEnabled"
                               class="w-5 h-5 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <span class="text-sm font-medium text-light">Enabled</span>
                    </label>
                    <button type="submit" class="inner-button">
                        <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        Save Configuration
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        User Key <span class="text-red-400">*</span>
                    </label>
                    <input type="password" wire:model="pushoverUserKey" required
                           class="input w-full"
                           placeholder="azGDORePK8gMaC0QOYAMyEEuzJnyUi">
                    <p class="text-xs text-gray-500 mt-1">Your Pushover user key</p>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        API Token <span class="text-red-400">*</span>
                    </label>
                    <input type="password" wire:model="pushoverApiToken" required
                           class="input w-full"
                           placeholder="azGDORePK8gMaC0QOYAMyEEuzJnyUi">
                    <p class="text-xs text-gray-500 mt-1">Your application API token</p>
                </div>
            </div>

            <div class="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p class="text-xs text-emerald-300 flex items-start gap-2">
                    <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>
                        <strong>How to get your credentials:</strong><br>
                        1. Sign up at <a href="https://pushover.net" target="_blank" class="text-primary hover:underline">pushover.net</a><br>
                        2. Your <strong>User Key</strong> is displayed on the home page after login<br>
                        3. Create an application to get your <strong>API Token</strong><br>
                        4. Install Pushover app on your iOS/Android device
                    </span>
                </p>
            </div>
        </div>
    </form>

    {{-- Notification Events --}}
    <div class="glass-card p-6">
        <div class="mb-6">
            <h2 class="text-xl font-semibold text-light mb-2">Notification Events</h2>
            <p class="text-sm text-gray-400">Select which events should trigger Pushover notifications</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {{-- Deployments --}}
            <div class="glass-dark p-5 rounded-xl border-glass">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-light">Deployments</h3>
                </div>
                <div class="space-y-3">
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="deploymentSuccessPushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Deployment Success</span>
                            <p class="text-xs text-gray-500">Notify when deployment completes successfully</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="deploymentFailurePushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Deployment Failure</span>
                            <p class="text-xs text-gray-500">Notify when deployment fails</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="statusChangePushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-yellow-600 focus:ring-yellow-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-yellow-400 transition">Container Status Changes</span>
                            <p class="text-xs text-gray-500">Notify on container stop/restart events</p>
                        </div>
                    </label>
                </div>
            </div>

            {{-- Backups --}}
            <div class="glass-dark p-5 rounded-xl border-glass">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-light">Backups</h3>
                </div>
                <div class="space-y-3">
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="backupSuccessPushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Backup Success</span>
                            <p class="text-xs text-gray-500">Notify when backup completes</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="backupFailurePushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Backup Failure</span>
                            <p class="text-xs text-gray-500">Notify when backup fails</p>
                        </div>
                    </label>
                </div>
            </div>

            {{-- Scheduled Tasks --}}
            <div class="glass-dark p-5 rounded-xl border-glass">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-light">Scheduled Tasks</h3>
                </div>
                <div class="space-y-3">
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="scheduledTaskSuccessPushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Task Success</span>
                            <p class="text-xs text-gray-500">Notify when scheduled task succeeds</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="scheduledTaskFailurePushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Task Failure</span>
                            <p class="text-xs text-gray-500">Notify when scheduled task fails</p>
                        </div>
                    </label>
                </div>
            </div>

            {{-- Server Events --}}
            <div class="glass-dark p-5 rounded-xl border-glass">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <svg class="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-light">Server Events</h3>
                </div>
                <div class="space-y-3">
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="dockerCleanupSuccessPushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Docker Cleanup Success</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="dockerCleanupFailurePushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Docker Cleanup Failure</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverDiskUsagePushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-yellow-600 focus:ring-yellow-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-yellow-400 transition">Server Disk Usage</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverReachablePushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Server Reachable</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverUnreachablePushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Server Unreachable</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverPatchPushoverNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-blue-400 transition">Server Patching</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    </div>
</div>
