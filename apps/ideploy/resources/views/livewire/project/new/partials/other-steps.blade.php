{{-- Step: No VPS servers (projet VPS sans serveur connecté) --}}
@if ($current_step === 'no-servers')
    <div class="flex flex-col items-center justify-center py-4 mb-8">

        {{-- Card principale --}}
        <div class="w-full max-w-xl bg-surface-1/60 backdrop-blur-xl border border-[rgba(255,255,255,0.06)]
                    rounded-2xl p-10 text-center flex flex-col items-center
                    shadow-[0_0_40px_rgba(0,0,0,0.4),0_0_80px_rgba(99,102,241,0.04)]">

            {{-- Illustration --}}
            <div class="relative w-28 h-28 mb-8 flex items-center justify-center flex-shrink-0">
                {{-- Halo --}}
                <div class="absolute inset-0 rounded-full bg-primary-500/10 blur-2xl"></div>
                {{-- Carte serveur principale --}}
                <div class="relative w-20 h-20 bg-surface-2 rounded-2xl border border-[rgba(255,255,255,0.08)]
                            flex items-center justify-center shadow-lg rotate-3">
                    <svg class="w-10 h-10 text-primary-400" style="filter:drop-shadow(0 0 10px rgba(99,102,241,0.4))"
                         fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 8h.01M15 16h.01"/>
                    </svg>
                </div>
                {{-- Badge déconnecté --}}
                <div class="absolute -bottom-1 -right-1 w-10 h-10 bg-surface-base rounded-xl
                            border border-[rgba(255,255,255,0.07)] flex items-center justify-center
                            -rotate-6 shadow-md">
                    <svg class="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                    </svg>
                </div>
            </div>

            {{-- Texte --}}
            <h2 class="text-xl font-semibold text-text-primary mb-3 tracking-tight">
                Aucun VPS connecté
            </h2>
            <p class="text-sm text-text-tertiary leading-relaxed max-w-sm mb-8">
                Ce projet est configuré pour un déploiement sur votre propre infrastructure,
                mais aucun serveur VPS n'a encore été ajouté à votre compte.
            </p>

            {{-- Actions --}}
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                <button wire:click="chooseIdemManaged"
                        class="inner-button w-full sm:w-auto px-8 py-3 text-xs flex items-center justify-center gap-2">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    Déployer sur IDEM SaaS
                </button>
                <a href="/servers"
                   class="w-full sm:w-auto px-8 py-3 text-xs font-semibold uppercase tracking-widest
                          flex items-center justify-center gap-2
                          border border-[rgba(255,255,255,0.1)] rounded-xl
                          text-text-secondary bg-transparent
                          hover:border-primary-500/40 hover:bg-primary-500/5 hover:text-text-primary
                          transition-all duration-200">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    + Ajouter un VPS
                </a>
            </div>

            {{-- Footer info --}}
            <div class="mt-8 pt-6 border-t border-[rgba(255,255,255,0.05)] w-full">
                <p class="text-[11px] text-text-tertiary flex items-center justify-center gap-1.5">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Déployer sur IDEM SaaS utilise les serveurs gérés par l'administrateur. Vous pouvez ajouter votre VPS plus tard.
                </p>
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
    <div x-data="{ selectedType: null, selecting: false }" class="flex flex-col">

        {{-- Header --}}
        <div class="mb-8 text-center">
            <h1 class="text-2xl font-bold text-text-primary tracking-tight">Distribution PostgreSQL</h1>
            <p class="text-sm text-text-secondary mt-2">Choisissez la variante adaptée à vos besoins</p>
        </div>

        {{-- 2×2 card grid --}}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

            {{-- Standard v17 --}}
            <div class="relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200 group"
                 style="background-color: rgba(15,23,42,0.7); backdrop-filter: blur(12px);"
                 :class="selectedType === 'postgres:17-alpine'
                     ? 'border-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.2)] -translate-y-0.5'
                     : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(37,99,235,0.5)] hover:shadow-[0_0_20px_rgba(37,99,235,0.1)] hover:-translate-y-0.5'"
                 x-on:click="!selecting && (selectedType = 'postgres:17-alpine')">
                {{-- hover / selected gradient overlay --}}
                <div class="absolute inset-0 pointer-events-none transition-opacity duration-200"
                     :class="selectedType === 'postgres:17-alpine' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                     style="background: linear-gradient(to bottom right, rgba(37,99,235,0.1), transparent);"></div>
                <div class="relative p-6 flex flex-col gap-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                                    <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5"/>
                                    <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-base font-semibold text-text-primary leading-tight">Standard v17</h3>
                                <p class="text-xs font-mono text-text-tertiary mt-0.5">postgres:17-alpine</p>
                            </div>
                        </div>
                        <span class="text-[10px] uppercase tracking-widest font-medium text-blue-400 border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">Recommandé</span>
                    </div>
                    <p class="text-xs text-text-secondary leading-relaxed">
                        Distribution officielle légère et rapide. Parfaite pour la majorité des projets.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Léger</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Alpine Linux</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">AMD + ARM</span>
                    </div>
                </div>
                <template x-if="selectedType === 'postgres:17-alpine'">
                    <div class="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.5)]">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                    </div>
                </template>
            </div>

            {{-- Supabase Pack --}}
            <div class="relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200 group"
                 style="background-color: rgba(15,23,42,0.7); backdrop-filter: blur(12px);"
                 :class="selectedType === 'supabase/postgres:17.4.1.032'
                     ? 'border-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.2)] -translate-y-0.5'
                     : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(16,185,129,0.5)] hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:-translate-y-0.5'"
                 x-on:click="!selecting && (selectedType = 'supabase/postgres:17.4.1.032')">
                <div class="absolute inset-0 pointer-events-none transition-opacity duration-200"
                     :class="selectedType === 'supabase/postgres:17.4.1.032' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                     style="background: linear-gradient(to bottom right, rgba(16,185,129,0.1), transparent);"></div>
                <div class="relative p-6 flex flex-col gap-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 6c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-base font-semibold text-text-primary leading-tight">Supabase Pack</h3>
                                <p class="text-xs font-mono text-text-tertiary mt-0.5">supabase/postgres:17</p>
                            </div>
                        </div>
                    </div>
                    <p class="text-xs text-text-secondary leading-relaxed">
                        Extensions cloud pré-installées : PostGIS, pgvector, pg_cron et bien plus.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] text-emerald-400 border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 rounded-full">PostGIS inclus</span>
                        <span class="text-[10px] text-emerald-400 border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 rounded-full">pgvector inclus</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">AMD + ARM</span>
                    </div>
                </div>
                <template x-if="selectedType === 'supabase/postgres:17.4.1.032'">
                    <div class="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                    </div>
                </template>
            </div>

            {{-- PostGIS --}}
            <div class="relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200 group"
                 style="background-color: rgba(15,23,42,0.7); backdrop-filter: blur(12px);"
                 :class="selectedType === 'postgis/postgis:17-3.5-alpine'
                     ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)] -translate-y-0.5'
                     : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(245,158,11,0.5)] hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] hover:-translate-y-0.5'"
                 x-on:click="!selecting && (selectedType = 'postgis/postgis:17-3.5-alpine')">
                <div class="absolute inset-0 pointer-events-none transition-opacity duration-200"
                     :class="selectedType === 'postgis/postgis:17-3.5-alpine' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                     style="background: linear-gradient(to bottom right, rgba(245,158,11,0.1), transparent);"></div>
                <div class="relative p-6 flex flex-col gap-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-base font-semibold text-text-primary leading-tight">PostGIS</h3>
                                <p class="text-xs font-mono text-text-tertiary mt-0.5">postgis/postgis:17-3.5</p>
                            </div>
                        </div>
                        <span class="text-[10px] uppercase tracking-widest font-medium text-amber-400 border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">AMD only</span>
                    </div>
                    <p class="text-xs text-text-secondary leading-relaxed">
                        Extensions géospatiales natives pour la cartographie et l'analyse de données localisées.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] text-amber-400 border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 rounded-full">Géospatial</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Rasters</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">GEOS/GDAL</span>
                    </div>
                </div>
                <template x-if="selectedType === 'postgis/postgis:17-3.5-alpine'">
                    <div class="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                    </div>
                </template>
            </div>

            {{-- PGVector --}}
            <div class="relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200 group"
                 style="background-color: rgba(15,23,42,0.7); backdrop-filter: blur(12px);"
                 :class="selectedType === 'pgvector/pgvector:pg17'
                     ? 'border-violet-600 shadow-[0_0_30px_rgba(139,92,246,0.2)] -translate-y-0.5'
                     : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(139,92,246,0.5)] hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:-translate-y-0.5'"
                 x-on:click="!selecting && (selectedType = 'pgvector/pgvector:pg17')">
                <div class="absolute inset-0 pointer-events-none transition-opacity duration-200"
                     :class="selectedType === 'pgvector/pgvector:pg17' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                     style="background: linear-gradient(to bottom right, rgba(139,92,246,0.1), transparent);"></div>
                <div class="relative p-6 flex flex-col gap-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-base font-semibold text-text-primary leading-tight">PGVector v17</h3>
                                <p class="text-xs font-mono text-text-tertiary mt-0.5">pgvector/pgvector:pg17</p>
                            </div>
                        </div>
                        <span class="text-[10px] uppercase tracking-widest font-medium text-violet-400 border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">AI/ML</span>
                    </div>
                    <p class="text-xs text-text-secondary leading-relaxed">
                        Stockage vectoriel natif pour les embeddings et les workloads IA avec recherche de similarité.
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="text-[10px] text-violet-400 border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 rounded-full">Embeddings</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">Similarité cosinus</span>
                        <span class="text-[10px] text-text-tertiary border border-[rgba(255,255,255,0.07)] bg-white/[0.03] px-2 py-0.5 rounded-full">AMD + ARM</span>
                    </div>
                </div>
                <template x-if="selectedType === 'pgvector/pgvector:pg17'">
                    <div class="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                    </div>
                </template>
            </div>

        </div>

        {{-- Action footer --}}
        <div class="flex flex-col sm:flex-row items-center justify-end gap-3">
            <button type="button" onclick="window.history.back()"
                    class="w-full sm:w-auto px-8 py-3 text-xs font-semibold uppercase tracking-widest
                           flex items-center justify-center gap-2
                           border border-[rgba(255,255,255,0.1)] rounded-xl
                           text-text-secondary bg-transparent
                           hover:border-primary-500/40 hover:bg-primary-500/5 hover:text-text-primary
                           transition-all duration-200">
                Annuler
            </button>
            <button type="button"
                    x-on:click="if (selectedType && !selecting) { selecting = true; $wire.setPostgresqlType(selectedType); }"
                    :disabled="!selectedType || selecting"
                    :class="(!selectedType || selecting) ? 'opacity-50 cursor-not-allowed' : ''"
                    class="inner-button w-full sm:w-auto px-8 py-3 text-xs flex items-center justify-center gap-2">
                <template x-if="!selecting">
                    <span class="flex items-center gap-2">
                        Continuer la configuration
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/>
                        </svg>
                    </span>
                </template>
                <template x-if="selecting">
                    <span class="flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Connexion...
                    </span>
                </template>
            </button>
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
