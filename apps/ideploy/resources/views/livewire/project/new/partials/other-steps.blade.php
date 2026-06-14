{{-- Step: No VPS servers (projet VPS sans serveur connecté) --}}
@if ($current_step === 'no-servers')
    <div class="border border-orange-500/20 bg-orange-500/5 rounded-glass p-8 mb-8 flex flex-col items-center text-center gap-6">
        <div class="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
            </svg>
        </div>
        <div>
            <h3 class="text-sm font-semibold text-text-primary mb-2">Aucun VPS connecté</h3>
            <p class="text-xs text-text-tertiary leading-relaxed max-w-sm">
                Ce projet est configuré pour un déploiement sur votre propre infrastructure, mais aucun serveur VPS n'a encore été ajouté à votre compte.
            </p>
        </div>
        <div class="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
            <a href="/servers"
               class="flex-1 flex items-center justify-center gap-2 px-5 py-2.5
                      bg-surface-2 border border-[rgba(255,255,255,0.08)]
                      hover:border-primary-500/40 hover:bg-primary-500/5
                      rounded-lg text-xs font-medium text-text-primary transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Ajouter un VPS
            </a>
            <button wire:click="chooseIdemManaged"
                    class="flex-1 inner-button flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                Déployer sur IDEM SaaS
            </button>
        </div>
        <p class="text-[10px] text-text-tertiary">
            Déployer sur IDEM SaaS utilise les serveurs gérés par l'administrateur. Vous pouvez ajouter votre VPS plus tard.
        </p>
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
                @forelse($servers ?? [] as $index => $server)
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
                @foreach ($swarmDockers ?? [] as $index => $swarmDocker)
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
                @foreach ($standaloneDockers ?? [] as $index => $standaloneDocker)
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
    <div x-data="{ selecting: false, chosen: null }">
        <div class="mb-6">
            <h2 class="text-sm font-medium text-text-primary">Distribution PostgreSQL</h2>
            <p class="text-xs text-text-tertiary mt-0.5">Choisissez la variante adaptée à vos besoins</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">

            {{-- Standard v17 --}}
            <div class="group relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200
                        border-[rgba(255,255,255,0.06)] bg-surface-1
                        hover:border-blue-500/30 hover:bg-blue-500/[0.04]"
                 :class="selecting && chosen !== 'standard' ? 'opacity-40 pointer-events-none' : ''"
                 x-on:click="!selecting && (selecting = true, chosen = 'standard', $wire.setPostgresqlType('postgres:17-alpine'))">
                {{-- top gradient bar --}}
                <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-400 to-blue-500/0
                            scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"></div>
                <div class="p-5 flex flex-col gap-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                                <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                                    <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5"/>
                                    <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-semibold text-text-primary group-hover:text-blue-300 transition-colors leading-tight">Standard v17</h3>
                                <p class="text-[10px] text-text-tertiary">postgres:17-alpine</p>
                            </div>
                        </div>
                        <span class="text-[9px] uppercase tracking-widest font-medium text-blue-400 border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 rounded-full">Recommandé</span>
                    </div>
                    <p class="text-[11px] text-text-tertiary leading-relaxed">
                        Distribution officielle légère et rapide. Parfaite pour la majorité des projets.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Léger</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Alpine Linux</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">AMD + ARM</span>
                    </div>
                    <div class="flex items-center justify-end">
                        <span class="text-[10px] text-blue-400/0 group-hover:text-blue-400 flex items-center gap-1 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                            Sélectionner
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </span>
                        <template x-if="selecting && chosen === 'standard'">
                            <svg class="w-3.5 h-3.5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        </template>
                    </div>
                </div>
            </div>

            {{-- Supabase Pack --}}
            <div class="group relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200
                        border-[rgba(255,255,255,0.06)] bg-surface-1
                        hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]"
                 :class="selecting && chosen !== 'supabase' ? 'opacity-40 pointer-events-none' : ''"
                 x-on:click="!selecting && (selecting = true, chosen = 'supabase', $wire.setPostgresqlType('supabase/postgres:17.4.1.032'))">
                <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-emerald-500/0
                            scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"></div>
                <div class="p-5 flex flex-col gap-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                                <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 6c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-semibold text-text-primary group-hover:text-emerald-300 transition-colors leading-tight">Supabase Pack</h3>
                                <p class="text-[10px] text-text-tertiary">supabase/postgres:17</p>
                            </div>
                        </div>
                    </div>
                    <p class="text-[11px] text-text-tertiary leading-relaxed">
                        Extensions cloud pré-installées : PostGIS, pgvector, pg_cron et bien plus.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">PostGIS inclus</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">pgvector inclus</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">AMD + ARM</span>
                    </div>
                    <div class="flex items-center justify-end">
                        <span class="text-[10px] text-emerald-400/0 group-hover:text-emerald-400 flex items-center gap-1 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                            Sélectionner
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </span>
                        <template x-if="selecting && chosen === 'supabase'">
                            <svg class="w-3.5 h-3.5 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        </template>
                    </div>
                </div>
            </div>

            {{-- PostGIS --}}
            <div class="group relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200
                        border-[rgba(255,255,255,0.06)] bg-surface-1
                        hover:border-green-500/30 hover:bg-green-500/[0.04]"
                 :class="selecting && chosen !== 'postgis' ? 'opacity-40 pointer-events-none' : ''"
                 x-on:click="!selecting && (selecting = true, chosen = 'postgis', $wire.setPostgresqlType('postgis/postgis:17-3.5-alpine'))">
                <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-green-500/0 via-green-400 to-green-500/0
                            scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"></div>
                <div class="p-5 flex flex-col gap-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 flex-shrink-0">
                                <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-semibold text-text-primary group-hover:text-green-300 transition-colors leading-tight">PostGIS</h3>
                                <p class="text-[10px] text-text-tertiary">postgis/postgis:17-3.5</p>
                            </div>
                        </div>
                        <span class="text-[9px] uppercase tracking-widest font-medium text-amber-400 border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 rounded-full">AMD only</span>
                    </div>
                    <p class="text-[11px] text-text-tertiary leading-relaxed">
                        Extensions géospatiales natives pour la cartographie et l'analyse de données localisées.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Géospatial</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Rasters</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">GEOS/GDAL</span>
                    </div>
                    <div class="flex items-center justify-end">
                        <span class="text-[10px] text-green-400/0 group-hover:text-green-400 flex items-center gap-1 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                            Sélectionner
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </span>
                        <template x-if="selecting && chosen === 'postgis'">
                            <svg class="w-3.5 h-3.5 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        </template>
                    </div>
                </div>
            </div>

            {{-- PGVector --}}
            <div class="group relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200
                        border-[rgba(255,255,255,0.06)] bg-surface-1
                        hover:border-purple-500/30 hover:bg-purple-500/[0.04]"
                 :class="selecting && chosen !== 'pgvector' ? 'opacity-40 pointer-events-none' : ''"
                 x-on:click="!selecting && (selecting = true, chosen = 'pgvector', $wire.setPostgresqlType('pgvector/pgvector:pg17'))">
                <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500/0 via-purple-400 to-purple-500/0
                            scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"></div>
                <div class="p-5 flex flex-col gap-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
                                <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-semibold text-text-primary group-hover:text-purple-300 transition-colors leading-tight">PGVector v17</h3>
                                <p class="text-[10px] text-text-tertiary">pgvector/pgvector:pg17</p>
                            </div>
                        </div>
                        <span class="text-[9px] uppercase tracking-widest font-medium text-purple-400 border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 rounded-full">AI/ML</span>
                    </div>
                    <p class="text-[11px] text-text-tertiary leading-relaxed">
                        Stockage vectoriel natif pour les embeddings et les workloads IA avec recherche de similarité.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Embeddings</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Similarité cosinus</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">AMD + ARM</span>
                    </div>
                    <div class="flex items-center justify-end">
                        <span class="text-[10px] text-purple-400/0 group-hover:text-purple-400 flex items-center gap-1 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                            Sélectionner
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </span>
                        <template x-if="selecting && chosen === 'pgvector'">
                            <svg class="w-3.5 h-3.5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        </template>
                    </div>
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
