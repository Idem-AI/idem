<div>
    <x-slot:title>Dashboard | iDeploy</x-slot>

    @if (session('error'))
        <span x-data x-init="$wire.emit('error', '{{ session('error') }}')" />
    @endif

    <style>
        .db-glass {
            background:rgba(30,41,59,0.4);
            backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
            border:1px solid rgba(255,255,255,0.08);
            border-radius:.75rem;
            transition:all .28s cubic-bezier(.4,0,.2,1);
            display:flex;flex-direction:column;height:100%;
        }
        .db-glass:hover{border-color:rgba(37,99,235,.4);box-shadow:0 0 20px rgba(37,99,235,.15);transform:translateY(-3px);}
        .db-add{border:2px dashed rgba(67,70,85,.4);border-radius:.75rem;background:transparent;
                transition:border-color .2s;cursor:pointer;height:100%;}
        .db-add:hover{border-color:rgba(180,197,255,.5);}
        .db-add:hover .db-ai{background:#2563eb;color:#fff;}
        .db-add:hover .db-at{color:#fff;}
        .db-stat{background:#131b2e;border:1px solid rgba(67,70,85,.22);border-radius:.5rem;}
        .db-stat-g{background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);border-radius:.5rem;}
        .db-stat-r{background:rgba(255,180,171,.08);border:1px solid rgba(255,180,171,.2);border-radius:.5rem;}
        .msi{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;line-height:1;vertical-align:middle;}
        .msi.f{font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;}
        @keyframes dbpulse{0%,100%{opacity:1}50%{opacity:.35}}
        .dbpulse{animation:dbpulse 2s ease infinite;}
    </style>

    <div style="min-height:100%;padding-bottom:48px;
                background:#020617;
                background-image:radial-gradient(circle at 2px 2px,rgba(255,255,255,.05) 1px,transparent 0);
                background-size:40px 40px;color:#dae2fd;">

        {{-- ── Header ── --}}
        <div style="margin-bottom:32px;">
            <h1 style="font-family:'Playfair Display',serif;font-size:48px;font-weight:700;
                       line-height:1.2;letter-spacing:-.02em;color:#fff;margin:0 0 6px;">Dashboard</h1>
            <p style="font-size:14px;color:#c3c6d7;margin:0;">
                {{ count($projects) }} project{{ count($projects)!==1?'s':'' }} &bull;
                {{ count($servers) }} server{{ count($servers)!==1?'s':'' }}
            </p>
        </div>

        @if (request()->query->get('success'))
        <div style="padding:12px 16px;border-radius:.5rem;margin-bottom:24px;font-size:13px;font-weight:500;
                    background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.25);color:#4ade80;">
            ✅ Your subscription has been activated! Welcome onboard!
        </div>
        @endif

        {{-- ── AI Banner ── --}}
        <div class="db-glass" style="padding:16px 20px;margin-bottom:32px;
                    border-left:4px solid #2563eb;flex-direction:row;
                    display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
            <div style="display:flex;align-items:center;gap:16px;">
                <div style="width:40px;height:40px;border-radius:.5rem;flex-shrink:0;
                            display:flex;align-items:center;justify-content:center;
                            background:rgba(37,99,235,.1);color:#2563eb;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="font-size:15px;font-weight:600;color:#fff;">AI Smart Deploy</span>
                        <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;
                                     background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.3);">SOON</span>
                    </div>
                    <p style="font-size:12px;color:#c3c6d7;margin:0;">Intelligent deployment • 10+ languages • 25+ frameworks</p>
                </div>
            </div>
            <button disabled style="padding:7px 16px;border-radius:.5rem;font-size:12px;font-weight:500;
                    background:rgba(255,255,255,.04);color:#6b7280;border:1px solid rgba(255,255,255,.1);cursor:not-allowed;">
                Coming Soon
            </button>
        </div>

        {{-- ── Projects Section ── --}}
        <div style="margin-bottom:40px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:22px;">
                <i class="fa-solid fa-layer-group" style="color:#2563eb;"></i>
                <h2 style="font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:#fff;margin:0;">Projects</h2>
            </div>

            {{-- Hidden modal — triggered by add-card onclick --}}
            @can('createAnyResource')
            <div style="position:absolute;left:-9999px;top:-9999px;" aria-hidden="true">
                <x-modal-input buttonTitle="" title="New Project" minWidth="40rem" :hideHeader="true">
                    <x-slot:content>
                        <button id="db-add-project-btn" tabindex="-1">+</button>
                    </x-slot:content>
                    <livewire:project.add-empty />
                </x-modal-input>
            </div>
            @endcan

            {{-- PHP rows of 3 — add-card first --}}
            @php
                $variants=[
                    ['ico'=>'folder_managed','color'=>'#b4c5ff'],
                    ['ico'=>'terminal',      'color'=>'#89ceff'],
                    ['ico'=>'cloud_sync',    'color'=>'#d2bbff'],
                    ['ico'=>'database',      'color'=>'#4ade80'],
                    ['ico'=>'rocket_launch', 'color'=>'#fbbf24'],
                ];
                $vi=0;
                $allItems = collect(['__add__'])->merge($projects);
                $rows = $allItems->chunk(3);
            @endphp

            @foreach($rows as $row)
            <div style="display:flex;gap:14px;margin-bottom:14px;align-items:stretch;">

                @foreach($row as $item)

                @if($item === '__add__')
                @can('createAnyResource')
                <div style="flex:1;min-width:0;min-height:240px;">
                    <div class="db-add" onclick="document.getElementById('db-add-project-btn')?.click();"
                         style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;min-height:240px;">
                        <div class="db-ai" style="width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:12px;background:#2d3449;color:#c3c6d7;transition:all .25s;">
                            <span class="msi" style="font-size:26px;">add</span>
                        </div>
                        <p class="db-at" style="font-size:13px;font-weight:700;color:#c3c6d7;margin:0 0 3px;transition:color .25s;">CREATE NEW PROJECT</p>
                        <p style="font-size:11px;color:rgba(195,198,215,.45);margin:0;text-align:center;">Start building something amazing</p>
                    </div>
                </div>
                @else
                <div style="flex:1;min-width:0;"></div>
                @endcan

                @else
                {{-- Project card — same style as projects page --}}
                @php
                    $tot=0;$act=0;
                    foreach($item->environments??[] as $env){
                        foreach(['applications','services'] as $rel){
                            if(isset($env->$rel)){$rs=$env->$rel;$tot+=$rs->count();$act+=$rs->filter(fn($x)=>is_string($x->status??null)&&str_starts_with($x->status,'running'))->count();}
                        }
                        foreach(['postgresqls','mysqls','mariadbs','mongodbs','redis'] as $db){
                            if(isset($env->$db)){$d=$env->$db;$tot+=$d->count();$act+=$d->filter(fn($x)=>is_string($x->status??null)&&str_starts_with($x->status,'running'))->count();}
                        }
                    }
                    if($act>0)    {$st='Healthy';$sbg='rgba(34,197,94,.1)'; $stx='#4ade80';$sbd='rgba(34,197,94,.2)'; $sdot='#22c55e';$pulse=true;}
                    elseif($tot>0){$st='Staging';$sbg='rgba(59,130,246,.1)';$stx='#60a5fa';$sbd='rgba(59,130,246,.2)';$sdot='#3b82f6';$pulse=false;}
                    else          {$st='Syncing';$sbg='rgba(234,179,8,.1)'; $stx='#facc15';$sbd='rgba(234,179,8,.2)'; $sdot='#eab308';$pulse=false;}
                    $v=$variants[$vi%count($variants)];$vi++;
                @endphp
                <div style="flex:1;min-width:0;">
                    <a href="{{ $item->navigateTo() }}" style="text-decoration:none;display:block;height:100%;">
                        <div class="db-glass">
                            <div style="padding:18px 18px 0;">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                                    <div style="width:40px;height:40px;border-radius:.5rem;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#2d3449;border:1px solid rgba(67,70,85,.35);color:{{$v['color']}};">
                                        <span class="msi f" style="font-size:22px;">{{$v['ico']}}</span>
                                    </div>
                                    <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:9999px;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:{{$sbg}};color:{{$stx}};border:1px solid {{$sbd}};">
                                        <span class="{{ $pulse?'dbpulse':'' }}" style="width:5px;height:5px;border-radius:50%;background:{{$sdot}};"></span>{{$st}}
                                    </span>
                                </div>
                                <h4 style="font-size:15px;font-weight:600;color:#fff;margin:0 0 4px;line-height:1.3;">{{$item->name}}</h4>
                                <p style="font-size:12px;color:#c3c6d7;line-height:1.5;margin:0 0 13px;{{!$item->description?'opacity:.45;font-style:italic;':''}}display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                                    {{$item->description?:'No description'}}
                                </p>
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:14px;">
                                    <div class="db-stat" style="padding:9px 11px;">
                                        <p style="font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8d919a;margin:0 0 2px;">Resources</p>
                                        <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#b4c5ff;margin:0;">{{$tot}} Instance{{$tot!==1?'s':''}}</p>
                                    </div>
                                    <div class="db-stat" style="padding:9px 11px;">
                                        <p style="font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8d919a;margin:0 0 2px;">Deployments</p>
                                        <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#89ceff;margin:0;">{{$act}} Active</p>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top:auto;padding:10px 18px;border-top:1px solid rgba(67,70,85,.22);display:flex;justify-content:space-between;align-items:center;">
                                @if($item->canUpdate)
                                <a href="{{ $item->settingsRoute }}" wire:navigate @click.stop
                                   style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#8d919a;text-decoration:none;"
                                   onmouseover="this.style.color='#dae2fd';" onmouseout="this.style.color='#8d919a';">
                                    <span class="msi" style="font-size:15px;">settings</span>Settings
                                </a>
                                @else<span></span>@endif
                                <span style="display:inline-flex;align-items:center;gap:2px;font-size:12px;font-weight:700;color:#b4c5ff;">
                                    View Details<span class="msi" style="font-size:14px;">arrow_forward_ios</span>
                                </span>
                            </div>
                        </div>
                    </a>
                </div>
                @endif

                @endforeach

                @for($f=$row->count();$f<3;$f++)
                <div style="flex:1;min-width:0;"></div>
                @endfor

            </div>
            @endforeach

            @if($projects->count()===0)
            <p style="text-align:center;padding:32px;color:#8d919a;font-size:14px;">No projects found. Create your first project above.</p>
            @endif
        </div>

        {{-- ── Servers Section ── --}}
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <i class="fa-solid fa-server" style="color:#2563eb;"></i>
                    <h2 style="font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:#fff;margin:0;">Servers</h2>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:.5rem;
                                background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.2);">
                        <span class="dbpulse" style="width:6px;height:6px;border-radius:50%;background:#2563eb;display:inline-block;"></span>
                        <span style="font-size:12px;font-weight:600;color:#2563eb;">{{ count($servers) }} {{ count($servers)===1?'SERVER':'SERVERS' }}</span>
                    </div>
                    @if ($servers->count()>0 && $privateKeys->count()>0)
                    <x-modal-input buttonTitle="" title="New Server" :closeOutside="false">
                        <x-slot:content>
                            <button style="display:inline-flex;align-items:center;gap:7px;padding:9px 20px;border-radius:8px;
                                           border:none;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.05em;
                                           text-transform:uppercase;background:#2563eb;color:#fff;
                                           box-shadow:0 4px 12px rgba(37,99,235,.28);transition:background .15s;"
                                    onmouseover="this.style.background='#1d4ed8';"
                                    onmouseout="this.style.background='#2563eb';">
                                <i class="fa-solid fa-plus" style="font-size:10px;"></i>ADD SERVER
                            </button>
                        </x-slot:content>
                        <livewire:server.create />
                    </x-modal-input>
                    @endif
                </div>
            </div>

            @if ($servers->count()>0)
            @php $srows = collect($servers)->chunk(3); @endphp
            @foreach($srows as $srow)
            <div style="display:flex;gap:14px;margin-bottom:14px;align-items:stretch;">
                @foreach($srow as $server)
                @php
                    $sTotal=0;$sActive=0;$sIssues=!$server->isFunctional();
                    foreach($server->destinations()??[] as $dest){
                        $sTotal+=$dest->applications->count();
                        $sActive+=$dest->applications->where('status','running')->count();
                    }
                @endphp
                <div style="flex:1;min-width:0;">
                    <a href="{{ route('server.show',['server_uuid'=>$server->uuid]) }}" style="text-decoration:none;display:block;height:100%;">
                        <div class="db-glass" style="padding:18px;{{ $sIssues?'border-color:rgba(255,180,171,.3);':'' }}">
                            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;gap:10px;">
                                <div style="min-width:0;">
                                    <h3 style="font-size:14px;font-weight:600;color:#fff;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ $server->name }}</h3>
                                    <p style="font-size:12px;color:#c3c6d7;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ $server->description?:$server->ip }}</p>
                                </div>
                                @if($sIssues)<span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;flex-shrink:0;background:rgba(255,180,171,.12);color:#ffb4ab;border:1px solid rgba(255,180,171,.3);">Issues</span>@endif
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
                                <div class="db-stat" style="padding:10px;text-align:center;">
                                    <div style="font-size:20px;font-weight:600;color:#2563eb;margin-bottom:2px;">{{ $sTotal }}</div>
                                    <div style="font-size:9px;text-transform:uppercase;color:#8d919a;">Resources</div>
                                </div>
                                <div class="{{ $server->isFunctional()?'db-stat-g':'db-stat-r' }}" style="padding:10px;text-align:center;">
                                    @if($server->isFunctional())
                                    <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:2px;">
                                        <span class="dbpulse" style="width:5px;height:5px;border-radius:50%;background:#4ade80;display:inline-block;"></span>
                                        <span style="font-size:20px;font-weight:600;color:#4ade80;">{{ $sActive }}</span>
                                    </div>
                                    @else
                                    <div style="font-size:20px;font-weight:600;color:#ffb4ab;margin-bottom:2px;">{{ $sActive }}</div>
                                    @endif
                                    <div style="font-size:9px;text-transform:uppercase;color:#8d919a;">Active</div>
                                </div>
                            </div>
                            <div style="padding-top:10px;border-top:1px solid rgba(67,70,85,.28);display:flex;align-items:center;justify-content:space-between;">
                                <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#8d919a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%;">{{ $server->ip }}</span>
                                <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;">
                                    <span style="width:6px;height:6px;border-radius:50%;background:{{ $server->isFunctional()?'#4ade80':'#ef4444' }};{{ $server->isFunctional()?'box-shadow:0 0 6px rgba(74,222,128,.5);':'' }}"></span>
                                    <span style="color:{{ $server->isFunctional()?'#4ade80':'#f87171' }};">{{ $server->isFunctional()?'ONLINE':'OFFLINE' }}</span>
                                </span>
                            </div>
                        </div>
                    </a>
                </div>
                @endforeach
                @for($f=$srow->count();$f<3;$f++)<div style="flex:1;min-width:0;"></div>@endfor
            </div>
            @endforeach
            @else
                @if($privateKeys->count()===0)
                <p style="text-align:center;padding:32px;color:#8d919a;font-size:14px;">
                    No private keys found. Before adding a server,
                    <x-modal-input buttonTitle="add a private key" title="New Private Key">
                        <livewire:security.private-key.create />
                    </x-modal-input>
                </p>
                @else
                <div style="text-align:center;padding:32px;">
                    <p style="font-size:14px;color:#8d919a;margin-bottom:12px;">No servers found.</p>
                    <x-modal-input buttonTitle="Add Your First Server" title="New Server" :closeOutside="false">
                        <livewire:server.create />
                    </x-modal-input>
                </div>
                @endif
            @endif
        </div>

        <div style="position:fixed;top:0;right:0;width:50%;height:50%;pointer-events:none;z-index:0;filter:blur(120px);background:rgba(180,197,255,.04);"></div>
        <div style="position:fixed;bottom:0;left:0;width:33%;height:33%;pointer-events:none;z-index:0;filter:blur(100px);background:rgba(210,187,255,.04);"></div>
    </div>
</div>
