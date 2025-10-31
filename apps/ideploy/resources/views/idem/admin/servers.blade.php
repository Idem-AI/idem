<x-layout>
    <div class="container mx-auto px-4 py-8">
        <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                🖥️ IDEM Managed Servers
            </h1>
            <p class="mt-2 text-gray-600 dark:text-gray-400">
                Manage all IDEM managed servers and monitor their load
            </p>
        </div>

        @if($servers->isEmpty())
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
                <svg class="mx-auto h-12 w-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 class="mt-2 text-lg font-medium text-yellow-800 dark:text-yellow-300">
                    No IDEM Managed Servers
                </h3>
                <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                    Add servers as admin to make them available for IDEM managed deployments
                </p>
                <div class="mt-6">
                    <a href="{{ route('server.create') }}" class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                        <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Server
                    </a>
                </div>
            </div>
        @else
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                @foreach($servers as $server)
                    <div class="bg-white dark:bg-coolgray-100 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-coolgray-200">
                        <div class="px-4 py-5 sm:p-6">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-medium text-gray-900 dark:text-white truncate">
                                    {{ $server->name }}
                                </h3>
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                    Active
                                </span>
                            </div>

                            <dl class="space-y-2">
                                <div class="flex justify-between text-sm">
                                    <dt class="text-gray-500 dark:text-gray-400">IP Address:</dt>
                                    <dd class="text-gray-900 dark:text-white font-mono">{{ $server->ip }}</dd>
                                </div>
                                
                                <div class="flex justify-between text-sm">
                                    <dt class="text-gray-500 dark:text-gray-400">Load Score:</dt>
                                    <dd class="text-gray-900 dark:text-white">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                            {{ $server->idem_load_score < 50 ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 
                                               ($server->idem_load_score < 80 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' : 
                                               'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300') }}">
                                            {{ $server->idem_load_score }}%
                                        </span>
                                    </dd>
                                </div>

                                <div class="flex justify-between text-sm">
                                    <dt class="text-gray-500 dark:text-gray-400">Status:</dt>
                                    <dd class="text-gray-900 dark:text-white">
                                        @if($server->settings->is_reachable ?? false)
                                            <span class="text-green-600 dark:text-green-400">● Reachable</span>
                                        @else
                                            <span class="text-red-600 dark:text-red-400">● Unreachable</span>
                                        @endif
                                    </dd>
                                </div>

                                @if($server->description)
                                    <div class="pt-2 border-t border-gray-200 dark:border-coolgray-200">
                                        <p class="text-sm text-gray-600 dark:text-gray-400">
                                            {{ $server->description }}
                                        </p>
                                    </div>
                                @endif
                            </dl>

                            <div class="mt-4 flex space-x-2">
                                <a href="{{ route('server.show', $server->uuid) }}" 
                                   class="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 dark:border-coolgray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-coolgray-200 hover:bg-gray-50 dark:hover:bg-coolgray-300">
                                    View Details
                                </a>
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>

            <div class="mt-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-blue-800 dark:text-blue-300">
                            About IDEM Managed Servers
                        </h3>
                        <div class="mt-2 text-sm text-blue-700 dark:text-blue-400">
                            <p>
                                These servers are automatically used for deployments when users choose "IDEM Managed Servers". 
                                The system automatically selects the server with the lowest load score for optimal performance.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        @endif
    </div>
</x-layout>
