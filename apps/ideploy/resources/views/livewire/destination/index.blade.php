<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-slot:title>
        Destinations | Ideploy
    </x-slot>

    {{-- Header --}}
    <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
            <h1 class="text-3xl font-light text-gray-100">Destinations</h1>
            @if ($servers->count() > 0)
                @can('createAnyResource')
                    <x-modal-input buttonTitle="+ Add" title="New Destination">
                        <x-slot:content>
                            <button class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-lg hover:scale-105">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                </svg>
                                Add
                            </button>
                        </x-slot:content>
                        <livewire:destination.new.docker />
                    </x-modal-input>
                @endcan
            @endif
        </div>
        <p class="text-sm text-gray-400">Network endpoints to deploy your resources.</p>
    </div>

    {{-- Destinations Grid --}}
    <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        @forelse ($servers as $server)
            @forelse ($server->destinations() as $destination)
                <a href="{{ route('destination.show', ['destination_uuid' => data_get($destination, 'uuid')]) }}" class="group block">
                    <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300">
                        {{-- Header --}}
                        <div class="p-5 border-b border-gray-700/50">
                            <div class="flex items-start gap-3">
                                {{-- Destination Icon --}}
                                <div @class([
                                    'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg',
                                    'bg-gradient-to-br from-cyan-500 to-blue-600' => $destination->getMorphClass() === 'App\Models\StandaloneDocker',
                                    'bg-gradient-to-br from-purple-500 to-pink-600' => $destination->getMorphClass() === 'App\Models\SwarmDocker',
                                ])>
                                    @if ($destination->getMorphClass() === 'App\Models\StandaloneDocker')
                                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                        </svg>
                                    @else
                                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                        </svg>
                                    @endif
                                </div>

                                {{-- Destination Info --}}
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate">
                                            {{ $destination->name }}
                                        </h3>
                                        <span @class([
                                            'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border',
                                            'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' => $destination->getMorphClass() === 'App\Models\StandaloneDocker',
                                            'bg-purple-500/20 text-purple-400 border-purple-500/30' => $destination->getMorphClass() === 'App\Models\SwarmDocker',
                                        ])>
                                            {{ $destination->getMorphClass() === 'App\Models\StandaloneDocker' ? 'Standalone' : 'Swarm' }}
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-400 truncate">Server: {{ $destination->server->name }}</p>
                                </div>
                            </div>
                        </div>

                        {{-- Footer --}}
                        <div class="px-5 py-4 bg-gray-900/20">
                            <div class="flex items-center justify-between text-xs">
                                <div class="flex items-center gap-2 text-gray-400">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                                    </svg>
                                    <span class="truncate">{{ $destination->server->name }}</span>
                                </div>
                                <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </a>
            @empty
                {{-- No destinations for this server --}}
            @endforelse
        @empty
            {{-- Empty State --}}
            <div class="col-span-full flex flex-col items-center justify-center py-16">
                <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-300 mb-2">No servers found</h3>
                <p class="text-sm text-gray-500 mb-4">Add a server first to create destinations</p>
            </div>
        @endforelse
    </div>
</div>
