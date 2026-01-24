<div>
    {{-- Header --}}
    <div class="flex items-center justify-between mb-6">
        <div>
            <h2 class="text-2xl font-bold dark:text-white">Server Management</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Monitor and manage all servers</p>
        </div>
    </div>

    {{-- Stats Cards --}}
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="box p-4">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">Total Servers</div>
                    <div class="text-2xl font-bold dark:text-white">{{ $stats['total'] }}</div>
                </div>
                <div class="w-12 h-12 bg-blue-100 dark:bg-blue-950/20 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                    </svg>
                </div>
            </div>
        </div>

        <div class="box p-4">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">IDEM Managed</div>
                    <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ $stats['managed'] }}</div>
                </div>
                <div class="w-12 h-12 bg-purple-100 dark:bg-purple-950/20 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                </div>
            </div>
        </div>

        <div class="box p-4">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">Client Servers</div>
                    <div class="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{{ $stats['client'] }}</div>
                </div>
                <div class="w-12 h-12 bg-cyan-100 dark:bg-cyan-950/20 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                </div>
            </div>
        </div>

        <div class="box p-4">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">Reachable</div>
                    <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ $stats['reachable'] }}</div>
                </div>
                <div class="w-12 h-12 bg-green-100 dark:bg-green-950/20 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
            </div>
        </div>
    </div>

    {{-- Filters --}}
    <div class="flex flex-col md:flex-row gap-4 mb-4">
        <div class="flex gap-2">
            <button wire:click="setFilter('all')" 
                    class="button {{ $filterType === 'all' ? 'bg-blue-600' : 'bg-gray-500' }}">
                All
            </button>
            <button wire:click="setFilter('managed')" 
                    class="button {{ $filterType === 'managed' ? 'bg-blue-600' : 'bg-gray-500' }}">
                IDEM Managed
            </button>
            <button wire:click="setFilter('client')" 
                    class="button {{ $filterType === 'client' ? 'bg-blue-600' : 'bg-gray-500' }}">
                Client Servers
            </button>
        </div>

        <input type="text" wire:model.live="search" placeholder="Search by name or IP..." 
               class="input flex-1 md:w-96">
    </div>

    {{-- Servers Table --}}
    <div class="overflow-x-auto">
        <table class="w-full">
            <thead>
                <tr class="border-b dark:border-coolgray-200">
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Server
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Owner
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Load Score
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Resources
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y dark:divide-coolgray-200">
                @forelse($servers as $server)
                    <tr class="hover:bg-gray-50 dark:hover:bg-coolgray-100">
                        <td class="px-4 py-4">
                            <div>
                                <div class="text-sm font-medium dark:text-white">{{ $server->name }}</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400">{{ $server->ip }}</div>
                            </div>
                        </td>
                        <td class="px-4 py-4">
                            @if($server->idem_managed)
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                    </svg>
                                    IDEM Managed
                                </span>
                            @else
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded">
                                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                    </svg>
                                    Client
                                </span>
                            @endif
                        </td>
                        <td class="px-4 py-4">
                            <div class="text-sm dark:text-white">{{ $server->team->name ?? 'N/A' }}</div>
                        </td>
                        <td class="px-4 py-4">
                            @php
                                $loadScore = $server->idem_load_score ?? 0;
                                $loadColor = $loadScore > 80 ? 'red' : ($loadScore > 50 ? 'yellow' : 'green');
                            @endphp
                            <div class="flex items-center gap-2">
                                <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 w-20">
                                    <div class="bg-{{ $loadColor }}-500 h-2 rounded-full" style="width: {{ $loadScore }}%"></div>
                                </div>
                                <span class="text-sm font-medium dark:text-white">{{ $loadScore }}%</span>
                            </div>
                        </td>
                        <td class="px-4 py-4">
                            @if($server->settings->is_reachable ?? false)
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                                    Online
                                </span>
                            @else
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                                    <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                                    Offline
                                </span>
                            @endif
                        </td>
                        <td class="px-4 py-4">
                            <div class="text-sm dark:text-white">
                                {{ $server->destinations()->count() }} destinations
                            </div>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="6" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            No servers found.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    {{-- Pagination --}}
    <div class="mt-4">
        {{ $servers->links() }}
    </div>
</div>
