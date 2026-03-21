<div class="min-h-screen">
    <x-slot:title>
        Webhook Notifications | iDeploy
    </x-slot>
    
    <x-notification.navbar />
    
    {{-- Page Header --}}
    <div class="glass-card mb-8 p-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-xl flex items-center justify-center border border-glass glow-primary">
                    <svg class="w-7 h-7 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                </div>
                <div>
                    <h1 class="text-3xl font-bold text-light text-glow-primary">Webhook Notifications</h1>
                    <p class="text-sm text-gray-400 mt-1">Send HTTP POST requests to custom endpoints</p>
                </div>
            </div>
            
            <div class="flex items-center gap-3">
                @if ($webhookEnabled)
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
                    <div class="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center border border-pink-500/30">
                        <svg class="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-semibold text-light">Endpoint Configuration</h2>
                        <p class="text-xs text-gray-400 mt-0.5">Configure your webhook endpoint</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" wire:model="webhookEnabled" wire:change="instantSaveWebhookEnabled"
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

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        Webhook URL <span class="text-red-400">*</span>
                    </label>
                    <input type="url" wire:model="webhookUrl" required
                           class="input w-full"
                           placeholder="https://your-domain.com/webhook/ideploy">
                    <p class="text-xs text-gray-500 mt-1">Endpoint that will receive POST requests</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        Secret/Token (Optional)
                    </label>
                    <input type="password" wire:model="webhookSecret"
                           class="input w-full"
                           placeholder="your-secret-token">
                    <p class="text-xs text-gray-500 mt-1">Optional authentication token sent in X-Webhook-Token header</p>
                </div>
            </div>

            <div class="mt-4 p-4 bg-pink-500/10 border border-pink-500/30 rounded-lg">
                <h3 class="text-sm font-semibold text-pink-300 mb-2">Webhook Payload Example</h3>
                <pre class="text-xs text-gray-300 bg-black/40 p-3 rounded-lg overflow-x-auto"><code>{
  "event": "deployment.success",
  "timestamp": "2026-02-15T20:00:00Z",
  "application": {
    "name": "my-app",
    "uuid": "abc123"
  },
  "deployment": {
    "status": "success",
    "duration": 45,
    "commit": "a1b2c3d"
  },
  "environment": "production"
}</code></pre>
                <p class="text-xs text-pink-300 mt-2">
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Your endpoint should return a 2xx status code to acknowledge receipt
                </p>
            </div>
        </div>
    </form>

    {{-- Notification Events --}}
    <div class="glass-card p-6">
        <div class="mb-6">
            <h2 class="text-xl font-semibold text-light mb-2">Notification Events</h2>
            <p class="text-sm text-gray-400">Select which events should trigger webhook notifications</p>
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
                        <input type="checkbox" wire:model="deploymentSuccessWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Deployment Success</span>
                            <p class="text-xs text-gray-500">Notify when deployment completes successfully</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="deploymentFailureWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Deployment Failure</span>
                            <p class="text-xs text-gray-500">Notify when deployment fails</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="statusChangeWebhookNotifications" wire:change="saveModel"
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
                        <input type="checkbox" wire:model="backupSuccessWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Backup Success</span>
                            <p class="text-xs text-gray-500">Notify when backup completes</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="backupFailureWebhookNotifications" wire:change="saveModel"
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
                        <input type="checkbox" wire:model="scheduledTaskSuccessWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Task Success</span>
                            <p class="text-xs text-gray-500">Notify when scheduled task succeeds</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="scheduledTaskFailureWebhookNotifications" wire:change="saveModel"
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
                        <input type="checkbox" wire:model="dockerCleanupSuccessWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Docker Cleanup Success</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="dockerCleanupFailureWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Docker Cleanup Failure</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverDiskUsageWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-yellow-600 focus:ring-yellow-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-yellow-400 transition">Server Disk Usage</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverReachableWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Server Reachable</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverUnreachableWebhookNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Server Unreachable</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverPatchWebhookNotifications" wire:change="saveModel"
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
