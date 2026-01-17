{{-- IDEM: Deployment Choice Step --}}
@if ($current_step === 'deployment-choice')
    <div class="mb-8">
        <div class="mb-6 p-6 bg-[#0a0a0a] rounded-xl border border-gray-800">
            <h2 class="text-2xl font-bold text-white mb-2">🚀 Choose Deployment Environment</h2>
            <p class="text-sm text-gray-400">Select where you want to deploy your resource</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {{-- Option 1: IDEM Managed Servers --}}
            <div wire:click="chooseIdemManaged" 
                 class="group relative p-8 border-2 rounded-xl cursor-pointer transition-all
                        border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400">
                <div class="absolute top-4 right-4">
                    <span class="px-3 py-1 text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                        Recommended
                    </span>
                </div>
                
                <div class="flex items-start">
                    <div class="text-5xl mr-6">☁️</div>
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-white mb-3">
                            IDEM Managed Servers
                        </h3>
                        <p class="text-sm text-gray-300 mb-6">
                            Deploy on our managed infrastructure with automatic scaling and high availability
                        </p>
                        
                        <ul class="space-y-3">
                            <li class="flex items-center text-sm text-gray-300">
                                <svg class="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                <span>High availability & uptime</span>
                            </li>
                            <li class="flex items-center text-sm text-gray-300">
                                <svg class="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                <span>Automatic load balancing</span>
                            </li>
                            <li class="flex items-center text-sm text-gray-300">
                                <svg class="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                <span>Zero server management</span>
                            </li>
                            <li class="flex items-center text-sm text-gray-300">
                                <svg class="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                <span>Optimized performance</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            
            {{-- Option 2: Personal Servers --}}
            <div wire:click="choosePersonalServers" 
                 class="group relative p-8 border-2 rounded-xl cursor-pointer transition-all
                        border-gray-800 bg-[#0a0a0a] hover:bg-[#0f0f0f] hover:border-gray-700">
                <div class="flex items-start">
                    <div class="text-5xl mr-6">🖥️</div>
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-white mb-3">
                            Your Personal Servers
                        </h3>
                        <p class="text-sm text-gray-300 mb-6">
                            Deploy on your own infrastructure with full control
                        </p>
                        
                        <ul class="space-y-3">
                            <li class="flex items-center text-sm text-gray-300">
                                <svg class="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>Complete control</span>
                            </li>
                            <li class="flex items-center text-sm text-gray-300">
                                <svg class="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>Custom configuration</span>
                            </li>
                            <li class="flex items-center text-sm text-gray-300">
                                <svg class="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>Use existing infrastructure</span>
                            </li>
                            <li class="flex items-center text-sm text-gray-300">
                                <svg class="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>Self-managed updates</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="mt-8 p-5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div class="flex items-start">
                <div class="text-2xl mr-3">💡</div>
                <p class="text-sm text-blue-300">
                    <strong class="font-semibold">Recommendation:</strong> IDEM Managed Servers provide automatic load balancing, high availability, and require zero maintenance. Perfect for production workloads.
                </p>
            </div>
        </div>
    </div>
@endif

@if ($current_step === 'servers')
    <div class="mb-8">
        <h2 class="text-2xl font-bold text-white mb-2">Select a Server</h2>
        <p class="text-sm text-gray-400 mb-6">Choose where to deploy your resource</p>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @if ($onlyBuildServerAvailable)
            <div class="col-span-full p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p class="text-yellow-300">
                    Only build servers are available. You need at least one server that is not set as a build server. 
                    <a class="underline hover:text-yellow-200" href="/servers">Go to servers page →</a>
                </p>
            </div>
        @else
            @forelse($servers as $server)
                <div wire:click="setServer({{ $server }})" 
                     class="group cursor-pointer p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl transition-all hover:border-blue-500 hover:bg-[#0f0f0f]">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center mr-4">
                            <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                            </svg>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{{ $server->name }}</h3>
                            <p class="text-sm text-gray-400">{{ $server->description ?: 'No description' }}</p>
                        </div>
                    </div>
                </div>
            @empty
                <div class="col-span-full p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p class="text-red-300">
                        No validated & reachable servers found. 
                        <a class="underline hover:text-red-200" href="/servers">Go to servers page →</a>
                    </p>
                </div>
            @endforelse
        @endif
    </div>
@endif

@if ($current_step === 'destinations')
    <div class="mb-8">
        <h2 class="text-2xl font-bold text-white mb-2">Select a Destination</h2>
        <p class="text-sm text-gray-400 mb-6">Destinations are used to segregate resources by network</p>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @if ($server->isSwarm())
            @foreach ($swarmDockers as $swarmDocker)
                <div wire:click="setDestination('{{ $swarmDocker->uuid }}')" 
                     class="group cursor-pointer p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl transition-all hover:border-blue-500 hover:bg-[#0f0f0f]">
                    <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2">
                        Swarm Docker
                    </h3>
                    <p class="text-sm text-gray-400">{{ $swarmDocker->name }}</p>
                </div>
            @endforeach
        @else
            @foreach ($standaloneDockers as $standaloneDocker)
                <div wire:click="setDestination('{{ $standaloneDocker->uuid }}')" 
                     class="group cursor-pointer p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl transition-all hover:border-blue-500 hover:bg-[#0f0f0f]">
                    <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2">
                        Standalone Docker
                    </h3>
                    <p class="text-sm text-gray-400 mb-1">{{ $standaloneDocker->name }}</p>
                    <p class="text-xs text-gray-500">Network: {{ $standaloneDocker->network }}</p>
                </div>
            @endforeach
        @endif
    </div>
@endif

@if ($current_step === 'select-postgresql-type')
    <div x-data="{ selecting: false }">
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-white mb-2">Select PostgreSQL Type</h2>
            <p class="text-sm text-gray-400 mb-6">Choose the PostgreSQL variant that best fits your needs</p>
        </div>
        
        <div class="grid grid-cols-1 gap-6">
            {{-- PostgreSQL 17 --}}
            <div class="group cursor-pointer p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl transition-all hover:border-blue-500 hover:bg-[#0f0f0f]"
                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('postgres:17-alpine'))">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2">
                            PostgreSQL 17 (default)
                        </h3>
                        <p class="text-sm text-gray-400">
                            Standard PostgreSQL without extensions - Perfect for most use cases
                        </p>
                    </div>
                    <a href="https://hub.docker.com/_/postgres/" target="_blank" 
                       onclick="event.stopPropagation()"
                       class="ml-4 px-4 py-2 text-sm text-gray-400 hover:text-blue-400 transition-colors">
                        Docs →
                    </a>
                </div>
            </div>

            {{-- Supabase PostgreSQL --}}
            <div class="group cursor-pointer p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl transition-all hover:border-green-500 hover:bg-[#0f0f0f]"
                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('supabase/postgres:17.4.1.032'))">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h3 class="text-lg font-bold text-white group-hover:text-green-400 transition-colors mb-2">
                            Supabase PostgreSQL (with extensions)
                        </h3>
                        <p class="text-sm text-gray-400">
                            PostgreSQL with pre-installed extensions for advanced features
                        </p>
                    </div>
                    <a href="https://github.com/supabase/postgres" target="_blank" 
                       onclick="event.stopPropagation()"
                       class="ml-4 px-4 py-2 text-sm text-gray-400 hover:text-green-400 transition-colors">
                        Docs →
                    </a>
                </div>
            </div>

            {{-- PostGIS --}}
            <div class="group cursor-pointer p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl transition-all hover:border-yellow-500 hover:bg-[#0f0f0f]"
                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('postgis/postgis:17-3.5-alpine'))">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h3 class="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors mb-2">
                            PostGIS (AMD only)
                        </h3>
                        <p class="text-sm text-gray-400">
                            PostgreSQL with geospatial extensions for location-based applications
                        </p>
                    </div>
                    <a href="https://github.com/postgis/docker-postgis" target="_blank" 
                       onclick="event.stopPropagation()"
                       class="ml-4 px-4 py-2 text-sm text-gray-400 hover:text-yellow-400 transition-colors">
                        Docs →
                    </a>
                </div>
            </div>

            {{-- PGVector --}}
            <div class="group cursor-pointer p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl transition-all hover:border-purple-500 hover:bg-[#0f0f0f]"
                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('pgvector/pgvector:pg17'))">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h3 class="text-lg font-bold text-white group-hover:text-purple-400 transition-colors mb-2">
                            PGVector (17)
                        </h3>
                        <p class="text-sm text-gray-400">
                            PostgreSQL with vector similarity search for AI/ML applications
                        </p>
                    </div>
                    <a href="https://github.com/pgvector/pgvector" target="_blank" 
                       onclick="event.stopPropagation()"
                       class="ml-4 px-4 py-2 text-sm text-gray-400 hover:text-purple-400 transition-colors">
                        Docs →
                    </a>
                </div>
            </div>
        </div>
    </div>
@endif

@if ($current_step === 'existing-postgresql')
    <div class="mb-8">
        <h2 class="text-2xl font-bold text-white mb-2">Connect Existing PostgreSQL</h2>
        <p class="text-sm text-gray-400 mb-6">Enter the connection URL for your existing PostgreSQL database</p>
    </div>
    
    <form wire:submit='addExistingPostgresql' class="max-w-2xl">
        <div class="space-y-4">
            <x-forms.input 
                placeholder="postgres://username:password@hostname:5432/database" 
                label="Database Connection URL"
                id="existingPostgresqlUrl" 
                class="bg-[#0a0a0a] border-gray-800" />
            
            <div class="flex gap-4">
                <x-forms.button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white">
                    Connect Database
                </x-forms.button>
                <button type="button" wire:click="$set('current_step', 'type')" 
                        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all">
                    Cancel
                </button>
            </div>
        </div>
    </form>
@endif
