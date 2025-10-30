<div class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
    <h2 class="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        🚀 Deployment Configuration
    </h2>

    <p class="text-gray-600 dark:text-gray-400 mb-6">
        Choose where to deploy your application: <strong>{{ $application->name }}</strong>
    </p>

    @if (session('success'))
        <div class="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg">
            ✅ {{ session('success') }}
        </div>
    @endif

    @if (session('error'))
        <div class="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
            ❌ {{ session('error') }}
        </div>
    @endif

    <form wire:submit.prevent="saveChoice">
        <!-- Choice: IDEM Managed vs Personal Servers -->
        <div class="space-y-6">
            
            <!-- Option 1: IDEM Managed Servers (Recommended) -->
            <label class="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors
                {{ $deployOnManaged ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400' }}">
                <input type="radio" 
                       wire:model.live="deployOnManaged" 
                       value="true" 
                       class="mt-1 mr-4">
                <div class="flex-1">
                    <div class="flex items-center">
                        <span class="text-lg font-semibold text-gray-900 dark:text-white">
                            ☁️ IDEM Managed Servers
                        </span>
                        <span class="ml-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full">
                            Recommended
                        </span>
                    </div>
                    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Deploy on our optimized, load-balanced infrastructure. No server management required.
                    </p>
                    <ul class="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <li>✅ Automatic load balancing</li>
                        <li>✅ High availability</li>
                        <li>✅ Automatic updates & monitoring</li>
                        <li>✅ No server limit (unlimited apps on your plan)</li>
                    </ul>

                    @if ($deployOnManaged)
                        <div class="mt-4 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Server Selection Strategy
                            </label>
                            <select wire:model="serverStrategy" 
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                                @foreach($availableStrategies as $value => $label)
                                    <option value="{{ $value }}">{{ $label }}</option>
                                @endforeach
                            </select>
                            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                @if($serverStrategy === 'least_loaded')
                                    Selects the server with lowest load for optimal performance.
                                @elseif($serverStrategy === 'round_robin')
                                    Distributes apps evenly across all servers.
                                @else
                                    Randomly selects an available server.
                                @endif
                            </p>

                            <!-- Available IDEM Servers Info -->
                            <div class="mt-4">
                                <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Available IDEM Servers ({{ count($managedServers) }})
                                </p>
                                <div class="space-y-2">
                                    @forelse($managedServers as $server)
                                        <div class="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-600 rounded">
                                            <span class="font-medium">{{ $server->name }}</span>
                                            <span class="text-gray-500 dark:text-gray-400">
                                                Load: {{ $server->idem_load_score }}
                                            </span>
                                        </div>
                                    @empty
                                        <p class="text-xs text-gray-500 dark:text-gray-400">
                                            No servers available. Contact support.
                                        </p>
                                    @endforelse
                                </div>
                            </div>
                        </div>
                    @endif
                </div>
            </label>

            <!-- Option 2: Personal Servers -->
            <label class="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors
                {{ !$deployOnManaged ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400' }}">
                <input type="radio" 
                       wire:model.live="deployOnManaged" 
                       value="false" 
                       class="mt-1 mr-4"
                       @if(!$canAddServers) disabled @endif>
                <div class="flex-1">
                    <div class="flex items-center">
                        <span class="text-lg font-semibold text-gray-900 dark:text-white">
                            🖥️ Your Personal Servers
                        </span>
                        @if(!$canAddServers)
                            <span class="ml-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full">
                                Upgrade Required
                            </span>
                        @endif
                    </div>
                    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Deploy on your own servers that you manage.
                    </p>

                    <!-- Server Quota Warning -->
                    <div class="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div class="flex items-center text-sm">
                            <span class="font-medium text-yellow-800 dark:text-yellow-300">
                                Server Quota: {{ $serverQuota['used'] }} / {{ $serverQuota['unlimited'] ? '∞' : $serverQuota['limit'] }}
                            </span>
                        </div>
                        @if(!$canAddServers)
                            <p class="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
                                ⚠️ You've reached your server limit. 
                                <a href="{{ route('idem.subscription') }}" class="underline font-medium">Upgrade your plan</a> 
                                to add personal servers.
                            </p>
                        @endif
                    </div>

                    @if (!$deployOnManaged && $canAddServers)
                        <div class="mt-4 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Select Your Server
                            </label>
                            @if(count($personalServers) > 0)
                                <select wire:model="personalServerId" 
                                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                                    <option value="">Choose a server...</option>
                                    @foreach($personalServers as $server)
                                        <option value="{{ $server->id }}">
                                            {{ $server->name }} ({{ $server->ip }})
                                        </option>
                                    @endforeach
                                </select>
                            @else
                                <div class="p-4 bg-gray-50 dark:bg-gray-600 rounded-lg text-center">
                                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        You don't have any personal servers yet.
                                    </p>
                                    <a href="{{ route('server.create') }}" 
                                       class="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                        + Add Your First Server
                                    </a>
                                </div>
                            @endif

                            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                💡 Personal servers require manual setup and maintenance.
                            </p>
                        </div>
                    @endif
                </div>
            </label>
        </div>

        <!-- Save Button -->
        <div class="mt-6 flex items-center justify-end space-x-4">
            <button type="button" 
                    onclick="window.history.back()" 
                    class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
            </button>
            <button type="submit" 
                    class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
                💾 Save Configuration
            </button>
        </div>
    </form>

    <!-- Current Configuration -->
    @if($application->idem_deploy_on_managed !== null)
        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                📋 Current Configuration
            </h3>
            <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="font-medium text-gray-600 dark:text-gray-400">Deployment Type:</span>
                        <span class="ml-2 text-gray-900 dark:text-white">
                            {{ $application->idem_deploy_on_managed ? '☁️ IDEM Managed' : '🖥️ Personal Server' }}
                        </span>
                    </div>
                    @if($application->idem_deploy_on_managed)
                        <div>
                            <span class="font-medium text-gray-600 dark:text-gray-400">Strategy:</span>
                            <span class="ml-2 text-gray-900 dark:text-white">
                                {{ $availableStrategies[$application->idem_server_strategy] ?? 'N/A' }}
                            </span>
                        </div>
                        @if($application->idem_assigned_server_id)
                            <div>
                                <span class="font-medium text-gray-600 dark:text-gray-400">Assigned Server:</span>
                                <span class="ml-2 text-gray-900 dark:text-white">
                                    {{ $application->assignedServer->name ?? 'N/A' }}
                                </span>
                            </div>
                        @endif
                    @endif
                </div>
            </div>
        </div>
    @endif
</div>
