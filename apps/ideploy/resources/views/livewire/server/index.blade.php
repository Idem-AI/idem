<div>
    <x-slot:title>
        Server Infrastructure | iDeploy
    </x-slot>

    <style>
        /* ── Font helpers (fonts loaded in base.blade.php) ─────────────── */
        .mi-font-display { font-family: 'Playfair Display', Georgia, serif; }
        .mi-font-mono    { font-family: 'JetBrains Mono', 'Courier New', monospace; }
        .mi-font-body    { font-family: 'Hanken Grotesk', 'Inter', sans-serif; }

        /* ── Grid background underlay ──────────────────────────────────── */
        .mi-bg-grid {
            background-size: 40px 40px;
            background-image:
                linear-gradient(to right,  rgba(218,226,253,.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(218,226,253,.03) 1px, transparent 1px);
        }

        /* ── Primary glow ──────────────────────────────────────────────── */
        .mi-glow { box-shadow: 0 0 20px -5px rgba(37,99,235,.2); }
        .mi-glow:hover { box-shadow: 0 0 25px -5px rgba(37,99,235,.4); }

        /* ── Card online hover glow ────────────────────────────────────── */
        .mi-card-online:hover { box-shadow: 0 0 25px -5px rgba(37,99,235,.35); }
    </style>

    @php
        $activeCount  = $servers->filter(fn($s) => $s->settings->is_reachable && !$s->settings->force_disabled)->count();
        $offlineCount = $servers->filter(fn($s) => !$s->settings->is_reachable || $s->settings->force_disabled)->count();
    @endphp

    {{-- ── Grid underlay + ambient glow ──────────────────────────────────── --}}
    <div class="relative">
        <div class="absolute inset-0 mi-bg-grid pointer-events-none opacity-40 z-0"></div>
        <div class="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none z-0"
             style="background:rgba(37,99,235,.07)"></div>

        <div class="relative z-10 space-y-8">

            {{-- ── Page Header ───────────────────────────────────────────── --}}
            <div class="flex items-end justify-between border-b pb-6"
                 style="border-color:rgba(67,70,85,.3)">
                <div class="space-y-2">
                    <h2 class="mi-font-display text-[#dae2fd] tracking-tight leading-tight"
                        style="font-size:32px;font-weight:600;line-height:1.3">
                        Server Infrastructure
                    </h2>
                    <p class="mi-font-body text-[#c3c6d7] max-w-xl"
                       style="font-size:16px;line-height:1.6">
                        Monitor and orchestrate your dedicated instances across global regions.
                        All systems operating within normal parameters.
                    </p>
                </div>

                @can('createAnyResource')
                    <x-modal-input title="New Server" :closeOutside="false">
                        <x-slot:content>
                            <button class="mi-font-body mi-glow flex items-center gap-2 rounded-lg px-6 py-2.5 transition-all"
                                    style="background:#2563eb;color:#eeefff;font-size:14px;font-weight:600;border:1px solid rgba(180,197,255,.3)">
                                <span class="material-symbols-outlined" style="font-size:18px">add</span>
                                Deploy Server
                            </button>
                        </x-slot:content>
                        <livewire:server.create />
                    </x-modal-input>
                @endcan
            </div>

            {{-- ── Global Metrics Row ─────────────────────────────────────── --}}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

                @php
                    $metrics = [
                        ['label'=>'Active Nodes',     'value'=>$activeCount,      'sub'=>'of '.$servers->count(),                           'icon'=>'dns'],
                        ['label'=>'Total Servers',    'value'=>$servers->count(), 'sub'=>'instances registered',                            'icon'=>'deployed_code'],
                        ['label'=>'Offline / Disabled','value'=>$offlineCount,   'sub'=>$offlineCount>0?'need attention':'all clear',       'icon'=>'warning'],
                    ];
                @endphp

                @foreach ($metrics as $m)
                    <div class="relative overflow-hidden rounded-xl p-6 group"
                         style="background:rgba(23,31,51,.6);border:1px solid #434655;backdrop-filter:blur(8px)">
                        <div class="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                             style="background:linear-gradient(to right,transparent,rgba(37,99,235,.5),transparent)"></div>

                        <div class="flex justify-between items-start mb-4">
                            <span class="mi-font-mono uppercase tracking-wider"
                                  style="font-size:12px;color:#c3c6d7;font-weight:500;letter-spacing:.05em">
                                {{ $m['label'] }}
                            </span>
                            <span class="material-symbols-outlined" style="font-size:20px;color:#2563eb">{{ $m['icon'] }}</span>
                        </div>

                        <div class="flex items-baseline gap-3">
                            <span class="mi-font-display" style="font-size:32px;font-weight:600;color:#dae2fd;line-height:1.3">
                                {{ $m['value'] }}
                            </span>
                            <span class="mi-font-body" style="font-size:14px;color:{{ $m['label']==='Offline / Disabled' && $offlineCount>0 ? '#ffb4ab' : '#c9e6ff' }}">
                                {{ $m['sub'] }}
                            </span>
                        </div>
                    </div>
                @endforeach

            </div>

            {{-- ── Server Cards Grid ──────────────────────────────────────── --}}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                @forelse ($servers as $server)
                    @php
                        $isOnline  = $server->settings->is_reachable && !$server->settings->force_disabled;
                        $isStopped = $server->settings->force_disabled ?? false;
                        $loadPct   = min(100, max(0, (int) ($server->idem_load_score ?? 0)));
                        $ramGb     = $server->ram_mb ? round($server->ram_mb / 1024) : null;
                        $spec      = collect([
                                        $server->cpu_cores ? $server->cpu_cores.' vCPU' : null,
                                        $ramGb ? $ramGb.'GB' : null,
                                     ])->filter()->implode(' • ');
                        $hasIssues = !$server->settings->is_reachable || !$server->settings->is_usable || ($server->settings->force_disabled ?? false);
                    @endphp

                    <a href="{{ route('server.show', ['server_uuid' => $server->uuid]) }}"
                       class="{{ $isOnline ? 'mi-card-online' : '' }} group block">

                        <div class="rounded-xl flex flex-col hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                             style="background:#222a3d;border:1px solid #434655">

                            {{-- Top accent line --}}
                            <div class="absolute top-0 left-0 w-full"
                                 style="height:2px;background:{{ $isOnline ? 'rgba(37,99,235,.3)' : 'rgba(67,70,85,.3)' }}"></div>

                            {{-- Card Body --}}
                            <div class="p-5 flex-1 {{ !$isOnline ? 'opacity-80' : '' }}">

                                {{-- Header: icon + name + status --}}
                                <div class="flex justify-between items-start mb-6">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                             style="background:#0b1326;border:1px solid #434655;box-shadow:inset 0 1px 3px rgba(0,0,0,.5)">
                                            <span class="material-symbols-outlined"
                                                  style="font-size:20px;color:{{ $isOnline ? '#2563eb' : '#8d90a0' }};font-variation-settings:'FILL' 1">
                                                terminal
                                            </span>
                                        </div>
                                        <div>
                                            <h3 class="mi-font-display group-hover:text-[#b4c5ff] transition-colors leading-tight"
                                                style="font-size:18px;font-weight:600;color:#dae2fd">
                                                {{ $server->name }}
                                            </h3>
                                            <p class="mi-font-body mt-0.5 line-clamp-1"
                                               style="font-size:13px;color:#c3c6d7">
                                                {{ $server->description ?: 'No description' }}
                                            </p>
                                        </div>
                                    </div>

                                    {{-- Status badge --}}
                                    @if ($isOnline)
                                        <div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 flex-shrink-0"
                                             style="background:#0d2a1f;border:1px solid rgba(16,185,129,.3)">
                                            <div class="w-1.5 h-1.5 rounded-full animate-pulse" style="background:#10b981"></div>
                                            <span class="mi-font-mono uppercase tracking-wide"
                                                  style="font-size:11px;color:#10b981;font-weight:500">Online</span>
                                        </div>
                                    @elseif ($isStopped)
                                        <div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 flex-shrink-0"
                                             style="background:#0b1326;border:1px solid #434655">
                                            <div class="w-1.5 h-1.5 rounded-full" style="background:#434655"></div>
                                            <span class="mi-font-mono uppercase tracking-wide"
                                                  style="font-size:11px;color:#c3c6d7;font-weight:500">Stopped</span>
                                        </div>
                                    @else
                                        <div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 flex-shrink-0"
                                             style="background:rgba(147,0,10,.2);border:1px solid rgba(255,180,171,.3)">
                                            <div class="w-1.5 h-1.5 rounded-full" style="background:#ffb4ab"></div>
                                            <span class="mi-font-mono uppercase tracking-wide"
                                                  style="font-size:11px;color:#ffb4ab;font-weight:500">Offline</span>
                                        </div>
                                    @endif
                                </div>

                                {{-- Issue warnings --}}
                                @if ($hasIssues)
                                    <div class="mb-4 flex items-start gap-2 rounded-lg px-3 py-2"
                                         style="background:rgba(147,0,10,.15);border:1px solid rgba(255,180,171,.2)">
                                        <span class="material-symbols-outlined flex-shrink-0 mt-0.5"
                                              style="font-size:14px;color:#ffb4ab">warning</span>
                                        <div class="mi-font-mono space-y-0.5" style="font-size:10px;color:#ffb4ab">
                                            @if (!$server->settings->is_reachable)<div>Not reachable</div>@endif
                                            @if (!$server->settings->is_usable)<div>Not usable by iDeploy</div>@endif
                                            @if ($server->settings->force_disabled ?? false)<div>Disabled by the system</div>@endif
                                        </div>
                                    </div>
                                @endif

                                {{-- Data grid --}}
                                <div class="grid grid-cols-2 gap-y-4 gap-x-2 rounded-lg p-3 {{ !$isOnline ? 'grayscale opacity-70' : '' }}"
                                     style="background:rgba(23,31,51,.5);border:1px solid rgba(67,70,85,.3)">

                                    <div>
                                        <span class="block mi-font-mono uppercase mb-1"
                                              style="font-size:10px;color:#c3c6d7;font-weight:500;letter-spacing:.05em">IP Address</span>
                                        <span class="mi-font-mono tracking-wide"
                                              style="font-size:13px;color:#dae2fd">{{ $server->ip ?: '—' }}</span>
                                    </div>

                                    <div>
                                        <span class="block mi-font-mono uppercase mb-1"
                                              style="font-size:10px;color:#c3c6d7;font-weight:500;letter-spacing:.05em">Region</span>
                                        <span class="mi-font-mono tracking-wide"
                                              style="font-size:13px;color:#dae2fd">{{ $server->region ?: '—' }}</span>
                                    </div>

                                    <div>
                                        <span class="block mi-font-mono uppercase mb-1"
                                              style="font-size:10px;color:#c3c6d7;font-weight:500;letter-spacing:.05em">Spec</span>
                                        <span class="mi-font-mono tracking-wide"
                                              style="font-size:13px;color:#dae2fd">{{ $spec ?: '—' }}</span>
                                    </div>

                                    <div>
                                        <span class="block mi-font-mono uppercase mb-1"
                                              style="font-size:10px;color:#c3c6d7;font-weight:500;letter-spacing:.05em">Load</span>
                                        @if ($isOnline && $loadPct > 0)
                                            <div class="flex items-center gap-2">
                                                <div class="overflow-hidden rounded-full" style="height:6px;width:64px;background:#2d3449">
                                                    <div class="h-full rounded-full" style="width:{{ $loadPct }}%;background:#2563eb"></div>
                                                </div>
                                                <span class="mi-font-mono" style="font-size:11px;color:#c3c6d7">{{ $loadPct }}%</span>
                                            </div>
                                        @else
                                            <span class="mi-font-mono tracking-wide" style="font-size:13px;color:#dae2fd">--</span>
                                        @endif
                                    </div>

                                </div>
                            </div>

                            {{-- Card Footer --}}
                            <div class="px-5 py-3 rounded-b-xl flex justify-between items-center"
                                 style="border-top:1px solid #434655;background:#131b2e">
                                @if ($isOnline)
                                    <button class="mi-font-body flex items-center gap-2 transition-colors hover:text-[#dae2fd]"
                                            style="font-size:14px;color:#c3c6d7"
                                            onclick="event.preventDefault()">
                                        <span class="material-symbols-outlined" style="font-size:16px">settings</span>
                                        Configure
                                    </button>
                                    <span class="mi-font-mono flex items-center gap-0.5 uppercase tracking-wider cursor-pointer transition-colors hover:text-[#b4c5ff]"
                                          style="font-size:13px;color:#2563eb">
                                        View Details
                                        <span class="material-symbols-outlined" style="font-size:16px">chevron_right</span>
                                    </span>
                                @else
                                    <button class="mi-font-body flex items-center gap-2 transition-colors hover:text-[#dae2fd]"
                                            style="font-size:14px;color:#c3c6d7"
                                            onclick="event.preventDefault()">
                                        <span class="material-symbols-outlined" style="font-size:16px">play_arrow</span>
                                        Start
                                    </button>
                                    <span class="mi-font-mono flex items-center gap-0.5 uppercase tracking-wider cursor-pointer transition-colors hover:text-[#dae2fd]"
                                          style="font-size:13px;color:#c3c6d7">
                                        Manage
                                        <span class="material-symbols-outlined" style="font-size:16px">chevron_right</span>
                                    </span>
                                @endif
                            </div>

                        </div>
                    </a>

                @empty
                    <div class="col-span-full flex flex-col items-center justify-center py-20 text-center">
                        <div class="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                             style="background:#222a3d;border:1px solid #434655">
                            <span class="material-symbols-outlined"
                                  style="font-size:40px;color:#8d90a0;font-variation-settings:'FILL' 0">dns</span>
                        </div>
                        <h3 class="mi-font-display mb-2" style="font-size:18px;font-weight:600;color:#dae2fd">No servers yet</h3>
                        <p class="mi-font-body mb-6 max-w-sm" style="font-size:14px;color:#c3c6d7">
                            Without a server, you won't be able to deploy applications or databases.
                        </p>
                        @can('createAnyResource')
                            <x-modal-input title="New Server" :closeOutside="false">
                                <x-slot:content>
                                    <button class="mi-font-body flex items-center gap-2 rounded-lg px-6 py-2.5 transition-all"
                                            style="background:#2563eb;color:#eeefff;font-size:14px;font-weight:600">
                                        <span class="material-symbols-outlined" style="font-size:18px">add</span>
                                        Add First Server
                                    </button>
                                </x-slot:content>
                                <livewire:server.create />
                            </x-modal-input>
                        @endcan
                    </div>
                @endforelse

                {{-- ── "Provision New Server" ghost card ──────────────────── --}}
                @can('createAnyResource')
                    @if ($servers->count() > 0)
                        <x-modal-input title="New Server" :closeOutside="false">
                            <x-slot:content>
                                <button class="w-full group flex flex-col items-center justify-center p-8 rounded-xl transition-all duration-300"
                                        style="min-height:280px;background:#0b1326;border:1px dashed rgba(67,70,85,.5)"
                                        onmouseenter="this.style.borderColor='rgba(37,99,235,.5)';this.style.background='rgba(19,27,46,.5)'"
                                        onmouseleave="this.style.borderColor='rgba(67,70,85,.5)';this.style.background='#0b1326'">
                                    <div class="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all duration-300"
                                         style="background:#171f33;border:1px solid #434655"
                                         onmouseenter="this.style.transform='scale(1.1)';this.style.borderColor='rgba(37,99,235,.5)';this.style.boxShadow='0 0 15px rgba(37,99,235,.2)'"
                                         onmouseleave="this.style.transform='scale(1)';this.style.borderColor='#434655';this.style.boxShadow='none'">
                                        <span class="material-symbols-outlined" style="font-size:28px;color:#c3c6d7">add</span>
                                    </div>
                                    <span class="mi-font-display mb-1" style="font-size:18px;font-weight:600;color:#dae2fd">
                                        Provision New Server
                                    </span>
                                    <span class="mi-font-body text-center" style="font-size:14px;color:#c3c6d7;max-width:200px">
                                        Spin up a new instance in seconds.
                                    </span>
                                </button>
                            </x-slot:content>
                            <livewire:server.create />
                        </x-modal-input>
                    @endif
                @endcan

            </div>
        </div>
    </div>
</div>
