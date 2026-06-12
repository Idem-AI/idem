<div>
    <x-slot:title>Dashboard | iDeploy</x-slot>

    @if (session('error'))
        <span x-data x-init="$wire.emit('error', '{{ session('error') }}')" />
    @endif

    @if (request()->query->get('success'))
        <div class="mx-6 mt-6 p-4 rounded-xl border border-green-500/30 text-green-300 font-medium text-sm"
             style="background:rgba(26,35,54,0.7)">
            ✅ Your subscription has been activated! Welcome onboard!
        </div>
    @endif

    <style>
        .mi-panel {
            background: rgba(26, 35, 54, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(141, 145, 154, 0.18);
            border-radius: 0.75rem;
        }
        .mi-card-hover {
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .mi-card-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
            border-color: rgba(37,99,235,0.4);
        }
        .mi-stat {
            background: #1a2336;
            border: 1px solid rgba(67,71,78,0.4);
            border-radius: 0.5rem;
        }
        .mi-stat-active {
            background: rgba(74,222,128,0.08);
            border: 1px solid rgba(74,222,128,0.25);
            border-radius: 0.5rem;
        }
        .mi-stat-red {
            background: rgba(255,180,171,0.08);
            border: 1px solid rgba(255,180,171,0.25);
            border-radius: 0.5rem;
        }
    </style>

    {{-- Dot grid background --}}
    <div class="min-h-full" style="background-image:linear-gradient(to right,rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.04) 1px,transparent 1px);background-size:40px 40px;">
        <div class="max-w-7xl mx-auto p-6 lg:p-8">

            {{-- ── Header ── --}}
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-white mb-1.5">Dashboard</h1>
                <p class="text-sm text-gray-400">{{ count($projects) }} projects • {{ count($servers) }} servers</p>
            </div>

            {{-- ── AI Banner ── --}}
            <div class="mi-panel p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                 style="border-left:4px solid #2563eb;">
                <div class="flex items-start gap-4">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                         style="background:rgba(37,99,235,0.12);">
                        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <h2 class="font-semibold text-base text-white">AI Smart Deploy</h2>
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                                  style="background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.3);">SOON</span>
                        </div>
                        <p class="text-xs text-gray-400">Intelligent deployment with deep code analysis • 10+ languages • 25+ frameworks</p>
                    </div>
                </div>
                <button disabled class="px-4 py-2 rounded-lg text-sm font-medium border cursor-not-allowed shrink-0"
                        style="background:rgba(255,255,255,0.04);color:#6b7280;border-color:rgba(255,255,255,0.1);">
                    Coming Soon
                </button>
            </div>

            {{-- ── Projects ── --}}
            <div class="mb-10">
                <div class="flex items-center gap-2 mb-6">
                    <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                    <h2 class="font-semibold text-sm text-white uppercase tracking-widest">Projects</h2>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {{-- Create card --}}
                    @can('createAnyResource')
                    <x-modal-input buttonTitle="" title="New Project">
                        <x-slot:content>
                            <button class="mi-panel mi-card-hover w-full flex flex-col items-center justify-center min-h-[280px] group"
                                    style="border-style:dashed;border-width:2px;border-color:rgba(67,71,78,0.6);">
                                <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform"
                                     style="background:rgba(37,99,235,0.1);">
                                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                    </svg>
                                </div>
                                <h3 class="font-semibold text-sm text-white mb-2">CREATE NEW PROJECT</h3>
                                <p class="text-sm text-gray-400">Start building something amazing</p>
                            </button>
                        </x-slot:content>
                        <livewire:project.add-empty />
                    </x-modal-input>
                    @endcan

                    {{-- Project cards --}}
                    @foreach ($projects as $project)
                        @php
                            $totalResources  = 0;
                            $activeResources = 0;
                            $resourceTypes   = [];

                            foreach ($project->environments ?? [] as $env) {
                                if (isset($env->applications)) {
                                    $apps = $env->applications;
                                    $totalResources  += $apps->count();
                                    $activeResources += $apps->filter(fn($a) => is_string($a->status ?? null) && str_starts_with($a->status, 'running'))->count();
                                    if ($apps->count() > 0 && !in_array('Web Application', $resourceTypes)) $resourceTypes[] = 'Web Application';
                                }
                                if (isset($env->services)) {
                                    $sv = $env->services;
                                    $totalResources  += $sv->count();
                                    $activeResources += $sv->filter(fn($s) => is_string($s->status ?? null) && str_starts_with($s->status, 'running'))->count();
                                    if ($sv->count() > 0 && !in_array('Service', $resourceTypes)) $resourceTypes[] = 'Service';
                                }
                                foreach (['postgresqls','mysqls','mariadbs','mongodbs','redis'] as $db) {
                                    if (isset($env->$db) && $env->$db->count() > 0) {
                                        $dbs = $env->$db;
                                        $totalResources  += $dbs->count();
                                        $activeResources += $dbs->filter(fn($d) => is_string($d->status ?? null) && str_starts_with($d->status, 'running'))->count();
                                        if (!in_array('Database', $resourceTypes)) $resourceTypes[] = 'Database';
                                    }
                                }
                            }
                            $inactive = $totalResources - $activeResources;

                            $tags = [];
                            if ($project->id % 3 == 0) $tags[] = ['l'=>'Companies','bg'=>'rgba(255,180,171,0.12)','br'=>'rgba(255,180,171,0.3)','tc'=>'#ffb4ab','dc'=>'#ffb4ab'];
                            if ($project->id % 2 == 0) $tags[] = ['l'=>'Students', 'bg'=>'rgba(168,85,247,0.12)','br'=>'rgba(168,85,247,0.3)','tc'=>'#c084fc','dc'=>'#c084fc'];
                            if ($project->id % 5 == 0) $tags[] = ['l'=>'Regional', 'bg'=>'rgba(251,146,60,0.12)','br'=>'rgba(251,146,60,0.3)', 'tc'=>'#fb923c','dc'=>'#fb923c'];
                            if (empty($tags))           $tags[] = ['l'=>'Local',    'bg'=>'rgba(251,146,60,0.12)','br'=>'rgba(251,146,60,0.3)', 'tc'=>'#fb923c','dc'=>'#fb923c'];
                        @endphp

                        <a href="{{ $project->navigateTo() }}" class="group block">
                            <div class="mi-panel mi-card-hover flex flex-col min-h-[280px]">

                                {{-- Body --}}
                                <div class="p-6 flex-1 flex flex-col" style="border-bottom:1px solid rgba(67,71,78,0.3);">
                                    {{-- Title row --}}
                                    <div class="flex items-start gap-4 mb-4">
                                        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-blue-400 font-bold text-xl shrink-0"
                                             style="background:rgba(37,99,235,0.18);">
                                            {{ strtoupper(substr($project->name, 0, 1)) }}
                                        </div>
                                        <div class="min-w-0">
                                            <h3 class="font-semibold text-base text-white mb-1 truncate">{{ $project->name }}</h3>
                                            <p class="text-xs text-gray-400 line-clamp-2 {{ !$project->description ? 'italic' : '' }}">
                                                {{ $project->description ?: 'No description available' }}
                                            </p>
                                        </div>
                                    </div>

                                    {{-- Stats --}}
                                    <div class="grid grid-cols-3 gap-3 mb-4">
                                        <div class="mi-stat p-3 text-center">
                                            <div class="text-xl font-semibold text-blue-400 mb-1">{{ $totalResources }}</div>
                                            <div class="text-[10px] text-gray-500 uppercase tracking-wide">TOTAL</div>
                                        </div>
                                        <div class="mi-stat-active p-3 text-center">
                                            <div class="flex items-center justify-center gap-1.5 mb-1">
                                                <div class="w-2 h-2 rounded-full" style="background:#4ade80;"></div>
                                                <span class="text-xl font-semibold" style="color:#4ade80;">{{ $activeResources }}</span>
                                            </div>
                                            <div class="text-[10px] uppercase tracking-wide" style="color:#4ade80;">ACTIVE</div>
                                        </div>
                                        <div class="mi-stat p-3 text-center">
                                            <div class="text-xl font-semibold text-white mb-1">{{ $inactive }}</div>
                                            <div class="text-[10px] text-gray-500 uppercase tracking-wide">INACTIVE</div>
                                        </div>
                                    </div>

                                    {{-- Tags --}}
                                    <div class="flex flex-wrap gap-2 mt-auto">
                                        @foreach($resourceTypes as $type)
                                            <span class="px-2.5 py-1 rounded text-[11px]"
                                                  style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#9ca3af;">
                                                {{ $type }}
                                            </span>
                                        @endforeach
                                        @foreach($tags as $t)
                                            <span class="px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5"
                                                  style="background:{{ $t['bg'] }};border:1px solid {{ $t['br'] }};color:{{ $t['tc'] }};">
                                                <span class="w-1.5 h-1.5 rounded-full inline-block" style="background:{{ $t['dc'] }};"></span>
                                                {{ $t['l'] }}
                                            </span>
                                        @endforeach
                                    </div>
                                </div>

                                {{-- Footer --}}
                                <div class="px-4 py-3 flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition-colors rounded-b-xl"
                                     style="background:rgba(6,14,32,0.3);">
                                    <span>Updated {{ $project->updated_at->format('M j, Y') }}</span>
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                    </svg>
                                </div>
                            </div>
                        </a>
                    @endforeach
                </div>

                @if ($projects->count() === 0)
                    <div class="flex flex-col items-center justify-center py-12 gap-3">
                        <div class="text-base font-semibold text-gray-400">No projects found.</div>
                        <p class="text-sm text-gray-500">Create your first project to get started</p>
                    </div>
                @endif
            </div>

            {{-- ── Servers ── --}}
            <div>
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                        </svg>
                        <h2 class="font-semibold text-sm text-white uppercase tracking-widest">Servers</h2>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                             style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.2);">
                            <div class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                            <span class="text-xs font-semibold text-blue-400">{{ count($servers) }} {{ count($servers) === 1 ? 'SERVER' : 'SERVERS' }}</span>
                        </div>
                        @if ($servers->count() > 0 && $privateKeys->count() > 0)
                            <x-modal-input buttonTitle="" title="New Server" :closeOutside="false">
                                <x-slot:content>
                                    <button class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-300 transition-colors hover:bg-white/10"
                                            style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        ADD SERVER
                                    </button>
                                </x-slot:content>
                                <livewire:server.create />
                            </x-modal-input>
                        @endif
                    </div>
                </div>

                @if ($servers->count() > 0)
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        @foreach ($servers as $server)
                            @php
                                $sTotal   = 0;
                                $sActive  = 0;
                                $sIssues  = !$server->isFunctional();
                                foreach ($server->destinations() ?? [] as $dest) {
                                    $sTotal  += $dest->applications->count();
                                    $sActive += $dest->applications->where('status','running')->count();
                                }
                            @endphp
                            <a href="{{ route('server.show', ['server_uuid' => $server->uuid]) }}" class="group block">
                                <div class="mi-panel mi-card-hover p-6 flex flex-col min-h-[200px]"
                                     style="{{ $server->isFunctional() ? '' : 'border-color:rgba(255,180,171,0.25);' }}">
                                    <div class="flex items-start gap-3 mb-4">
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 mb-1">
                                                <h3 class="text-base font-semibold text-white truncate">{{ $server->name }}</h3>
                                                @if($sIssues)
                                                    <span class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded"
                                                          style="background:rgba(255,180,171,0.12);color:#ffb4ab;border:1px solid rgba(255,180,171,0.3);">Issues</span>
                                                @endif
                                            </div>
                                            <p class="text-xs text-gray-400 truncate">{{ $server->description ?: $server->ip }}</p>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-2 gap-3 mb-4">
                                        <div class="mi-stat p-3 text-center">
                                            <div class="text-2xl font-semibold text-blue-400 mb-1">{{ $sTotal }}</div>
                                            <div class="text-[10px] text-gray-500 uppercase">Resources</div>
                                        </div>
                                        <div class="p-3 text-center {{ $server->isFunctional() ? 'mi-stat-active' : 'mi-stat-red' }}">
                                            <div class="flex items-center justify-center gap-1.5 mb-1">
                                                @if($server->isFunctional())
                                                    <div class="w-1.5 h-1.5 rounded-full animate-pulse" style="background:#4ade80;"></div>
                                                @endif
                                                <span class="text-2xl font-semibold" style="color:{{ $server->isFunctional() ? '#4ade80' : '#ffb4ab' }};">{{ $sActive }}</span>
                                            </div>
                                            <div class="text-[10px] text-gray-500 uppercase">Active</div>
                                        </div>
                                    </div>

                                    <div class="mt-auto pt-4 flex items-center justify-between"
                                         style="border-top:1px solid rgba(67,71,78,0.3);">
                                        <span class="text-xs text-gray-500 font-mono truncate">{{ $server->ip }}</span>
                                        <span class="flex items-center gap-1.5 shrink-0 ml-2">
                                            <span class="w-1.5 h-1.5 rounded-full"
                                                  style="background:{{ $server->isFunctional() ? '#4ade80' : '#ef4444' }};{{ $server->isFunctional() ? 'animation:pulse 2s infinite;' : '' }}"></span>
                                            <span class="text-xs font-semibold" style="color:{{ $server->isFunctional() ? '#4ade80' : '#f87171' }};">
                                                {{ $server->isFunctional() ? 'ONLINE' : 'OFFLINE' }}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </a>
                        @endforeach
                    </div>
                @else
                    @if ($privateKeys->count() === 0)
                        <div class="flex flex-col items-center justify-center py-12 gap-3">
                            <div class="text-base font-semibold text-gray-400">No private keys found.</div>
                            <p class="text-sm text-gray-500">Before you can add your server, first
                                <x-modal-input buttonTitle="add a private key" title="New Private Key">
                                    <livewire:security.private-key.create />
                                </x-modal-input>
                            </p>
                        </div>
                    @else
                        <div class="flex flex-col items-center justify-center py-12 gap-3">
                            <div class="text-base font-semibold text-gray-400">No servers found.</div>
                            <x-modal-input buttonTitle="Add Your First Server" title="New Server" :closeOutside="false">
                                <livewire:server.create />
                            </x-modal-input>
                        </div>
                    @endif
                @endif
            </div>

        </div>
    </div>
</div>
