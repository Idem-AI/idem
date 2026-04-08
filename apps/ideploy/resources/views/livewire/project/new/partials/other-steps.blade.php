{{-- Contiguous Grid Layout for Step: Deployment Choice --}}
@if ($current_step === 'deployment-choice')
    <div class="mb-4">
        <h2 class="text-sm font-medium text-text-primary">Deployment Target</h2>
        <p class="text-xs text-text-tertiary mt-0.5">Select the environment infrastructure</p>
    </div>
    
    <div class="border border-[rgba(255,255,255,0.05)] rounded-glass overflow-hidden bg-surface-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[rgba(255,255,255,0.05)] mb-8">
        <div wire:click="chooseIdemManaged" class="group flex-1 p-6 sm:p-8 relative cursor-pointer hover:bg-surface-2 transition-colors flex flex-col">
            <div class="absolute top-0 left-0 w-full h-[1px] bg-primary-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></div>
            <header class="flex justify-between items-start mb-6">
                <h3 class="text-sm font-medium text-text-primary group-hover:text-primary-400 transition-colors">IDEM Managed Infrastructure</h3>
                <span class="text-[9px] uppercase tracking-widest text-primary-400 border border-primary-500/20 px-1.5 py-0.5 rounded-sm bg-primary-500/10">Recommended</span>
            </header>
            <div class="text-xs text-text-tertiary leading-relaxed mb-6 max-w-sm flex-1">
                <p class="mb-2">Deploy instantly on our pre-configured network.</p>
                <ul class="space-y-1 text-[11px]">
                    <li>— Automatic load balancing</li>
                    <li>— High availability</li>
                    <li>— Zero server maintenance</li>
                </ul>
            </div>
            <div class="text-[11px] font-medium text-text-secondary group-hover:text-primary-400 transition-colors flex items-center gap-2 mt-auto">
                <span>Select Path</span>
                <svg class="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </div>
        </div>
        
        <div wire:click="choosePersonalServers" class="group flex-1 p-6 sm:p-8 relative cursor-pointer hover:bg-surface-2 transition-colors flex flex-col">
            <div class="absolute top-0 left-0 w-full h-[1px] bg-accent-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></div>
            <header class="flex justify-between items-start mb-6">
                <h3 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors">Private Infrastructure</h3>
            </header>
            <div class="text-xs text-text-tertiary leading-relaxed mb-6 max-w-sm flex-1">
                <p class="mb-2">Total control over hardware and networking.</p>
                <ul class="space-y-1 text-[11px]">
                    <li>— Connect custom nodes</li>
                    <li>— Bring your own cloud</li>
                    <li>— Manual scaling configured by you</li>
                </ul>
            </div>
            <div class="text-[11px] font-medium text-text-secondary group-hover:text-accent-400 transition-colors flex items-center gap-2 mt-auto">
                <span>Select Path</span>
                <svg class="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </div>
        </div>
    </div>
@endif

@if ($current_step === 'servers')
    <div class="mb-4 flex justify-between items-end">
        <div>
            <h2 class="text-sm font-medium text-text-primary">Host Node Selection</h2>
            <p class="text-xs text-text-tertiary mt-0.5">Select a node from your private mesh</p>
        </div>
        <a href="/servers" class="text-[10px] text-text-tertiary hover:text-text-primary underline transition-colors">Manage Nodes</a>
    </div>
    
    <div class="border border-[rgba(255,255,255,0.05)] rounded-glass overflow-hidden bg-surface-1 mb-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0">
            @if ($onlyBuildServerAvailable)
                <div class="col-span-full p-6 bg-orange-500/5 flex flex-col items-center justify-center">
                    <p class="text-[11px] text-orange-400 mb-3">No valid compute nodes available.</p>
                    <x-forms.button class="button-sm">Configure Nodes</x-forms.button>
                </div>
            @else
                @forelse($servers as $index => $server)
                    <div wire:click="setServer({{ $server }})"
                         class="group relative p-5 hover:bg-surface-2 transition-colors cursor-pointer flex items-center justify-between
                                {{ $index % 3 !== 2 ? 'lg:border-r border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index % 2 !== 1 ? 'sm:border-r lg:border-r-0 border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index >= 3 ? 'lg:border-t border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index >= 2 ? 'sm:border-t lg:border-t-0 border-[rgba(255,255,255,0.05)]' : '' }}">
                        <div class="absolute inset-y-0 left-0 w-[1px] bg-primary-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <div class="w-1.5 h-1.5 rounded-full bg-green-500/50 group-hover:bg-green-400 transition-colors"></div>
                                <h4 class="text-sm font-medium text-text-primary group-hover:text-primary-400 transition-colors truncate">{{ $server->name }}</h4>
                            </div>
                            <p class="text-[11px] text-text-tertiary pl-3.5">{{ $server->description ?: 'Status: Ready' }}</p>
                        </div>
                    </div>
                @empty
                    <div class="col-span-full p-6 text-center">
                        <p class="text-xs text-text-tertiary">No validated servers detected.</p>
                    </div>
                @endforelse
            @endif
        </div>
    </div>
@endif

@if ($current_step === 'destinations')
    <div class="mb-4">
        <h2 class="text-sm font-medium text-text-primary">Network Destination</h2>
        <p class="text-xs text-text-tertiary mt-0.5">Select a segregation network</p>
    </div>

    <div class="border border-[rgba(255,255,255,0.05)] rounded-glass overflow-hidden bg-surface-1 mb-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0">
            @if ($server->isSwarm())
                @foreach ($swarmDockers as $index => $swarmDocker)
                    <div wire:click="setDestination('{{ $swarmDocker->uuid }}')"
                         class="group relative p-5 hover:bg-surface-2 transition-colors cursor-pointer
                                {{ $index % 3 !== 2 ? 'lg:border-r border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index % 2 !== 1 ? 'sm:border-r lg:border-r-0 border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index >= 3 ? 'lg:border-t border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index >= 2 ? 'sm:border-t lg:border-t-0 border-[rgba(255,255,255,0.05)]' : '' }}">
                        <div class="absolute inset-y-0 left-0 w-[1px] bg-accent-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                        <h4 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors mb-1">Swarm Endpoint</h4>
                        <p class="text-[11px] text-text-tertiary">{{ $swarmDocker->name }}</p>
                    </div>
                @endforeach
            @else
                @foreach ($standaloneDockers as $index => $standaloneDocker)
                    <div wire:click="setDestination('{{ $standaloneDocker->uuid }}')"
                         class="group relative p-5 hover:bg-surface-2 transition-colors cursor-pointer
                                {{ $index % 3 !== 2 ? 'lg:border-r border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index % 2 !== 1 ? 'sm:border-r lg:border-r-0 border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index >= 3 ? 'lg:border-t border-[rgba(255,255,255,0.05)]' : '' }}
                                {{ $index >= 2 ? 'sm:border-t lg:border-t-0 border-[rgba(255,255,255,0.05)]' : '' }}">
                        <div class="absolute inset-y-0 left-0 w-[1px] bg-accent-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                        <h4 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors mb-1">{{ $standaloneDocker->name }}</h4>
                        <p class="text-[10px] text-text-tertiary bg-white/5 inline-block px-1.5 py-0.5 rounded">{{ $standaloneDocker->network }}</p>
                    </div>
                @endforeach
            @endif
        </div>
    </div>
@endif

@if ($current_step === 'select-postgresql-type')
    <div x-data="{ selecting: false }">
        <div class="mb-4">
            <h2 class="text-sm font-medium text-text-primary">Engine Configuration</h2>
            <p class="text-xs text-text-tertiary mt-0.5">Select PostgreSQL distribution variant</p>
        </div>
        
        <div class="border border-[rgba(255,255,255,0.05)] rounded-glass overflow-hidden bg-surface-1 mb-8">
            <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[rgba(255,255,255,0.05)]">
                <div class="group relative p-6 hover:bg-surface-2 transition-colors cursor-pointer flex flex-col"
                    :class="{ 'opacity-50 cursor-not-allowed': selecting }"
                    x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('postgres:17-alpine'))">
                    <div class="absolute inset-y-0 left-0 w-[1px] bg-primary-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    <header class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-medium text-text-primary group-hover:text-primary-400 transition-colors">Standard v17</h3>
                        <span class="text-[9px] uppercase tracking-widest text-text-tertiary border border-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded-sm bg-surface-base">Default</span>
                    </header>
                    <p class="text-xs text-text-tertiary leading-relaxed mb-2 max-w-sm flex-1">
                        Base distribution. Light, fast, and secure. Standard performance.
                    </p>
                </div>

                <div class="group relative p-6 hover:bg-surface-2 transition-colors cursor-pointer flex flex-col"
                    :class="{ 'opacity-50 cursor-not-allowed': selecting }"
                    x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('supabase/postgres:17.4.1.032'))">
                    <div class="absolute inset-y-0 left-0 w-[1px] bg-accent-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    <header class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors">Supabase Pack</h3>
                    </header>
                    <p class="text-xs text-text-tertiary leading-relaxed mb-2 max-w-sm flex-1">
                        Includes PostGIS, pgvector, and cloud extensions pre-installed.
                    </p>
                </div>

                <div class="group relative p-6 border-t border-[rgba(255,255,255,0.05)] hover:bg-surface-2 transition-colors cursor-pointer flex flex-col"
                    :class="{ 'opacity-50 cursor-not-allowed': selecting }"
                    x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('postgis/postgis:17-3.5-alpine'))">
                    <div class="absolute inset-y-0 left-0 w-[1px] bg-green-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    <header class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-medium text-text-primary group-hover:text-green-400 transition-colors">PostGIS</h3>
                        <span class="text-[9px] uppercase tracking-widest text-text-tertiary border border-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded-sm bg-surface-base">AMD only</span>
                    </header>
                    <p class="text-xs text-text-tertiary leading-relaxed mb-2 max-w-sm flex-1">
                        Geospatial extensions built-in for advanced location mapping.
                    </p>
                </div>

                <div class="group relative p-6 border-t border-[rgba(255,255,255,0.05)] hover:bg-surface-2 transition-colors cursor-pointer flex flex-col"
                    :class="{ 'opacity-50 cursor-not-allowed': selecting }"
                    x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('pgvector/pgvector:pg17'))">
                    <div class="absolute inset-y-0 left-0 w-[1px] bg-purple-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    <header class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-medium text-text-primary group-hover:text-purple-400 transition-colors">PGVector v17</h3>
                    </header>
                    <p class="text-xs text-text-tertiary leading-relaxed mb-2 max-w-sm flex-1">
                        Dedicated vector embedding store for AI/ML workloads.
                    </p>
                </div>
            </div>
        </div>
    </div>
@endif

@if ($current_step === 'existing-postgresql')
    <div class="border border-[rgba(255,255,255,0.05)] rounded-glass bg-surface-1 p-6 mb-8">
        <header class="mb-5">
            <h2 class="text-sm font-medium text-text-primary">Connect Foreign URI</h2>
            <p class="text-xs text-text-tertiary mt-1">Link an existing external database instance.</p>
        </header>
        <form wire:submit='addExistingPostgresql' class="flex flex-col sm:flex-row gap-4">
            <div class="flex-1">
                <x-forms.input placeholder="postgres://user:pass@host:5432/db" id="existingPostgresqlUrl" />
            </div>
            <button type="submit" class="inner-button px-6 text-xs whitespace-nowrap">Link Database</button>
        </form>
    </div>
@endif
