<div class="min-h-screen">
    <x-slot:title>
        Email Notifications | iDeploy
    </x-slot>
    
    <x-notification.navbar />
    
    {{-- Page Header --}}
    <div class="glass-card mb-8 p-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-glass glow-primary">
                    <svg class="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                </div>
                <div>
                    <h1 class="text-3xl font-bold text-light text-glow-primary">Email Notifications</h1>
                    <p class="text-sm text-gray-400 mt-1">Configure email delivery and notification preferences</p>
                </div>
            </div>
            
            <div class="flex items-center gap-3">
                @if (auth()->user()->isAdminFromSession())
                    @can('sendTest', $settings)
                        @if ($team->isNotificationEnabled('email'))
                            <button onclick="document.getElementById('testEmailModal').showModal()" 
                                    class="outer-button flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                                </svg>
                                Send Test Email
                            </button>
                        @else
                            <button disabled class="outer-button opacity-50 cursor-not-allowed">
                                Send Test Email
                            </button>
                        @endif
                    @endcan
                @endif
            </div>
        </div>
    </div>

    {{-- General Settings --}}
    <form wire:submit='submit' class="space-y-6 mb-8">
        <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-semibold text-light">General Settings</h2>
                        <p class="text-xs text-gray-400 mt-0.5">Configure sender information</p>
                    </div>
                </div>
                <button type="submit" class="inner-button">
                    <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Save Settings
                </button>
            </div>

            @if (!isCloud())
                <div class="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <label class="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" wire:model="useInstanceEmailSettings" wire:change="instantSave()"
                               class="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm font-medium text-light">Use System-Wide Email Settings</span>
                            <p class="text-xs text-gray-400 mt-0.5">Use transactional email configuration from instance settings</p>
                        </div>
                    </label>
                </div>
            @endif

            @if (!$useInstanceEmailSettings)
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">
                            From Name <span class="text-red-400">*</span>
                        </label>
                        <input type="text" wire:model="smtpFromName" required
                               class="input w-full"
                               placeholder="iDeploy Notifications">
                        <p class="text-xs text-gray-500 mt-1">Name displayed in email sender</p>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">
                            From Address <span class="text-red-400">*</span>
                        </label>
                        <input type="email" wire:model="smtpFromAddress" required
                               class="input w-full"
                               placeholder="noreply@ideploy.com">
                        <p class="text-xs text-gray-500 mt-1">Email address used as sender</p>
                    </div>
                </div>

                @if (isInstanceAdmin())
                    <div class="mt-4">
                        <button type="button" wire:click='copyFromInstanceSettings' 
                                class="outer-button text-sm">
                            <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                            Copy from Instance Settings
                        </button>
                    </div>
                @endif
            @endif
        </div>
    </form>

    @if (isCloud())
        <div class="glass-card p-6 mb-8">
            <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" wire:model="useInstanceEmailSettings" wire:change="instantSave()"
                       class="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0">
                <div>
                    <span class="text-sm font-medium text-light">Use Hosted Email Service</span>
                    <p class="text-xs text-gray-400 mt-0.5">Leverage our managed email infrastructure</p>
                </div>
            </label>
        </div>
    @endif

    @if (!$useInstanceEmailSettings)
        {{-- SMTP Configuration --}}
        <form wire:submit='submitSmtp' class="mb-8">
            <div class="glass-card p-6">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center border border-purple-500/30">
                            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xl font-semibold text-light">SMTP Server</h2>
                            <p class="text-xs text-gray-400 mt-0.5">Configure your SMTP mail server</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" wire:model="smtpEnabled" wire:change="instantSave('SMTP')"
                                   class="w-5 h-5 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                            <span class="text-sm font-medium text-light">Enabled</span>
                        </label>
                        <button type="submit" class="inner-button">
                            Save SMTP
                        </button>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                Host <span class="text-red-400">*</span>
                            </label>
                            <input type="text" wire:model="smtpHost" required
                                   class="input w-full"
                                   placeholder="smtp.mailgun.org">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                Port <span class="text-red-400">*</span>
                            </label>
                            <input type="number" wire:model="smtpPort" required
                                   class="input w-full"
                                   placeholder="587">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                Encryption <span class="text-red-400">*</span>
                            </label>
                            <select wire:model="smtpEncryption" required class="input w-full">
                                <option value="starttls">StartTLS</option>
                                <option value="tls">TLS/SSL</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                SMTP Username
                            </label>
                            <input type="text" wire:model="smtpUsername"
                                   class="input w-full"
                                   placeholder="username">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                SMTP Password
                            </label>
                            <input type="password" wire:model="smtpPassword"
                                   class="input w-full"
                                   placeholder="••••••••">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                Timeout (seconds)
                            </label>
                            <input type="number" wire:model="smtpTimeout"
                                   class="input w-full"
                                   placeholder="30">
                            <p class="text-xs text-gray-500 mt-1">Connection timeout</p>
                        </div>
                    </div>
                </div>
            </div>
        </form>

        {{-- Resend Configuration --}}
        <form wire:submit='submitResend' class="mb-8">
            <div class="glass-card p-6">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/30">
                            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xl font-semibold text-light">Resend</h2>
                            <p class="text-xs text-gray-400 mt-0.5">Modern email API service</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" wire:model="resendEnabled" wire:change="instantSave('Resend')"
                                   class="w-5 h-5 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                            <span class="text-sm font-medium text-light">Enabled</span>
                        </label>
                        <button type="submit" class="inner-button">
                            Save Resend
                        </button>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        API Key <span class="text-red-400">*</span>
                    </label>
                    <input type="password" wire:model="resendApiKey" required
                           class="input w-full"
                           placeholder="re_••••••••••••••••••••">
                    <p class="text-xs text-gray-500 mt-1">
                        Get your API key from 
                        <a href="https://resend.com/api-keys" target="_blank" class="text-primary hover:underline">Resend Dashboard</a>
                    </p>
                </div>
            </div>
        </form>
    @endif

    {{-- Notification Events --}}
    <div class="glass-card p-6">
        <div class="mb-6">
            <h2 class="text-xl font-semibold text-light mb-2">Notification Events</h2>
            <p class="text-sm text-gray-400">Select which events should trigger email notifications</p>
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
                        <input type="checkbox" wire:model="deploymentSuccessEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Deployment Success</span>
                            <p class="text-xs text-gray-500">Notify when deployment completes successfully</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="deploymentFailureEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Deployment Failure</span>
                            <p class="text-xs text-gray-500">Notify when deployment fails</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="statusChangeEmailNotifications" wire:change="saveModel"
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
                        <input type="checkbox" wire:model="backupSuccessEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Backup Success</span>
                            <p class="text-xs text-gray-500">Notify when backup completes</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="backupFailureEmailNotifications" wire:change="saveModel"
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
                        <input type="checkbox" wire:model="scheduledTaskSuccessEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Task Success</span>
                            <p class="text-xs text-gray-500">Notify when scheduled task succeeds</p>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="scheduledTaskFailureEmailNotifications" wire:change="saveModel"
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
                        <input type="checkbox" wire:model="dockerCleanupSuccessEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Docker Cleanup Success</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="dockerCleanupFailureEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Docker Cleanup Failure</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverDiskUsageEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-yellow-600 focus:ring-yellow-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-yellow-400 transition">Server Disk Usage</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverReachableEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-green-400 transition">Server Reachable</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverUnreachableEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-red-400 transition">Server Unreachable</span>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" wire:model="serverPatchEmailNotifications" wire:change="saveModel"
                               class="mt-0.5 w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0">
                        <div>
                            <span class="text-sm text-light group-hover:text-blue-400 transition">Server Patching</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    </div>

    {{-- Test Email Modal --}}
    <dialog id="testEmailModal" class="modal backdrop:bg-black/60 backdrop:backdrop-blur-sm">
        <div class="glass-card p-6 rounded-xl max-w-md w-full">
            <h3 class="text-xl font-bold text-light mb-4">Send Test Email</h3>
            <form wire:submit.prevent="sendTestEmail" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        Recipient Email <span class="text-red-400">*</span>
                    </label>
                    <input type="email" wire:model="testEmailAddress" required
                           class="input w-full"
                           placeholder="test@example.com">
                </div>
                <div class="flex gap-3">
                    <button type="button" onclick="document.getElementById('testEmailModal').close()" 
                            class="outer-button flex-1">
                        Cancel
                    </button>
                    <button type="submit" onclick="document.getElementById('testEmailModal').close()" 
                            class="inner-button flex-1">
                        Send Email
                    </button>
                </div>
            </form>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button>close</button>
        </form>
    </dialog>
</div>
