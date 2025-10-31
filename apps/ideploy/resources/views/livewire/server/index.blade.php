<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-slot:title>
        Servers | Ideploy
    </x-slot>

    {{-- Header --}}
    <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
            <h1 class="text-3xl font-light text-gray-100">Servers</h1>
            @can('createAnyResource')
                <x-modal-input buttonTitle="+ Add" title="New Server" :closeOutside="false">
                    <x-slot:content>
                        <button class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-lg hover:scale-105">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                            </svg>
                            Add
                        </button>
                    </x-slot:content>
                    <livewire:server.create />
                </x-modal-input>
            @endcan
        </div>
        <p class="text-sm text-gray-400">All your servers are here.</p>
    </div>

    {{-- Servers Grid --}}
    <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        @forelse ($servers as $server)
            <a href="{{ route('server.show', ['server_uuid' => data_get($server, 'uuid')]) }}" class="group block">
                <div @class([
                    'bg-[#151b2e] hover:bg-[#1a2137] border hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300',
                    'border-red-500' => !$server->settings->is_reachable || $server->settings->force_disabled,
                    'border-gray-700' => $server->settings->is_reachable && !$server->settings->force_disabled,
                ])>
                    {{-- Header --}}
                    <div class="p-5 border-b border-gray-700/50">
                        <div class="flex items-start gap-3">
                            {{-- Server Icon --}}
                            <div @class([
                                'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg',
                                'bg-gradient-to-br from-green-500 to-emerald-600' => $server->settings->is_reachable && !$server->settings->force_disabled,
                                'bg-gradient-to-br from-red-500 to-rose-600' => !$server->settings->is_reachable || $server->settings->force_disabled,
                            ])>
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                                </svg>
                            </div>

                            {{-- Server Info --}}
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate">
                                        {{ $server->name }}
                                    </h3>
                                    {{-- Status Badge --}}
                                    @if ($server->settings->is_reachable && !$server->settings->force_disabled)
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                            Online
                                        </span>
                                    @else
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                            Offline
                                        </span>
                                    @endif
                                </div>
                                <p class="text-sm text-gray-400 line-clamp-2">{{ $server->description ?: 'No description' }}</p>
                            </div>
                        </div>
                    </div>

                    {{-- Issues/Warnings --}}
                    @if (!$server->settings->is_reachable || !$server->settings->is_usable || $server->settings->force_disabled)
                        <div class="px-5 py-3 bg-red-900/20 border-b border-red-500/30">
                            <div class="flex items-start gap-2">
                                <svg class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                </svg>
                                <div class="flex-1 text-xs text-red-400">
                                    @if (!$server->settings->is_reachable)
                                        <div>• Not reachable</div>
                                    @endif
                                    @if (!$server->settings->is_usable)
                                        <div>• Not usable by Ideploy</div>
                                    @endif
                                    @if ($server->settings->force_disabled)
                                        <div>• Disabled by the system</div>
                                    @endif
                                </div>
                            </div>
                        </div>
                    @endif

                    {{-- Footer with Server Details --}}
                    <div class="px-5 py-4 bg-gray-900/20">
                        <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2 text-gray-400">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                </svg>
                                <span class="truncate">{{ $server->ip ?? 'No IP' }}</span>
                            </div>
                            <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </a>
        @empty
            {{-- Empty State --}}
            <div class="col-span-full flex flex-col items-center justify-center py-16">
                <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-300 mb-2">No servers yet</h3>
                <p class="text-sm text-gray-500 mb-4">Without a server, you won't be able to deploy applications</p>
                @can('createAnyResource')
                    <x-modal-input buttonTitle="Add Server" title="New Server" :closeOutside="false">
                        <livewire:server.create />
                    </x-modal-input>
                @endcan
            </div>
        @endforelse

        @isset($error)
            <div class="col-span-full">
                <div class="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                    <div class="flex items-center gap-3">
                        <svg class="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span class="text-sm text-red-400">{{ $error }}</span>
                    </div>
                </div>
            </div>
        @endisset
    </div>
</div>
