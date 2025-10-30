<div class="min-h-screen bg-[#0a0e1a] text-white">
    <x-slot:title>
        {{ data_get_str($server, 'name')->limit(10) }} > Destinations | Coolify
    </x-slot>
    <livewire:server.navbar :server="$server" />
    <div class="flex flex-col h-full gap-8 sm:flex-row">
        <x-server.sidebar :server="$server" activeMenu="destinations" />
        <div class="w-full p-6">
            @if ($server->isFunctional())
                {{-- Header --}}
                <div class="mb-6">
                    <div class="flex items-center gap-3 mb-2">
                        <h1 class="text-3xl font-light text-gray-100">Destinations</h1>
                        @can('update', $server)
                            <x-modal-input buttonTitle="+ Add" title="New Destination">
                                <x-slot:content>
                                    <button class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-lg hover:scale-105">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        Add
                                    </button>
                                </x-slot:content>
                                <livewire:destination.new.docker :server_id="$server->id" />
                            </x-modal-input>
                        @endcan
                        <x-forms.button canGate="update" :canResource="$server" isHighlighted wire:click='scan'>Scan for Destinations</x-forms.button>
                    </div>
                    <p class="text-sm text-gray-400">Destinations are used to segregate resources by network.</p>
                </div>
                
                {{-- Available Destinations --}}
                @if ($server->standaloneDockers->count() > 0 || $server->swarmDockers->count() > 0)
                    <div class="mb-8">
                        <h2 class="text-xl font-light text-gray-100 mb-4">Available Destinations</h2>
                        <div class="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            @foreach ($server->standaloneDockers as $docker)
                                <a href="{{ route('destination.show', ['destination_uuid' => data_get($docker, 'uuid')]) }}" class="group block">
                                    <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-lg p-4 transition-all duration-300">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                                </svg>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate">{{ data_get($docker, 'network') }}</div>
                                                <div class="text-xs text-gray-500">Standalone</div>
                                            </div>
                                            <svg class="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                            </svg>
                                        </div>
                                    </div>
                                </a>
                            @endforeach
                            @foreach ($server->swarmDockers as $docker)
                                <a href="{{ route('destination.show', ['destination_uuid' => data_get($docker, 'uuid')]) }}" class="group block">
                                    <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-lg p-4 transition-all duration-300">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                                </svg>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate">{{ data_get($docker, 'network') }}</div>
                                                <div class="text-xs text-gray-500">Swarm</div>
                                            </div>
                                            <svg class="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                            </svg>
                                        </div>
                                    </div>
                                </a>
                            @endforeach
                        </div>
                    </div>
                @endif
                
                {{-- Found Destinations --}}
                @if ($networks->count() > 0)
                    <div>
                        <h2 class="text-xl font-light text-gray-100 mb-4">Found Destinations</h2>
                        <div class="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            @foreach ($networks as $network)
                                <div class="bg-[#151b2e] border border-gray-700 rounded-lg p-4">
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="flex items-center gap-3 flex-1 min-w-0">
                                            <div class="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                                                </svg>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-semibold text-gray-100 truncate">{{ data_get($network, 'Name') }}</div>
                                                <div class="text-xs text-gray-500">New Network</div>
                                            </div>
                                        </div>
                                        <x-forms.button canGate="update" :canResource="$server" wire:click="add('{{ data_get($network, 'Name') }}')">Add</x-forms.button>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endif
            @else
                {{-- Not Validated State --}}
                <div class="flex flex-col items-center justify-center py-16">
                    <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-300 mb-2">Server not validated</h3>
                    <p class="text-sm text-gray-500">Validate the server first to manage destinations</p>
                </div>
            @endif
        </div>
    </div>
</div>
