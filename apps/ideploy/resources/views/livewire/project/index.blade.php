<div>
    <x-slot:title>Projects | iDeploy</x-slot>

    <style>
        .pj-glass {
            background:rgba(30,41,59,0.42);
            backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
            border:1px solid rgba(255,255,255,0.08);
            border-radius:.65rem;
            transition:border-color .25s,box-shadow .25s,transform .25s;
            display:flex;flex-direction:column;height:100%;
        }
        .pj-glass:hover{border-color:rgba(37,99,235,.42);box-shadow:0 0 18px rgba(37,99,235,.14);transform:translateY(-2px);}
        .pj-add-card{
            border:2px dashed rgba(67,70,85,.45);border-radius:.65rem;
            background:transparent;cursor:pointer;width:100%;height:100%;min-height:220px;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            transition:border-color .2s,background .2s;
        }
        .pj-add-card:hover{border-color:rgba(180,197,255,.5);background:rgba(37,99,235,.03);}
        .pj-add-card:hover .pj-add-ico{background:#2563eb;color:#fff;}
        .pj-add-card:hover .pj-add-label{color:#fff;}
        .pj-sbox{background:#131b2e;border:1px solid rgba(67,70,85,.22);border-radius:.45rem;}
        .msi{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;line-height:1;vertical-align:middle;}
        .msi.f{font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;}
        @keyframes pp{0%,100%{opacity:1}50%{opacity:.35}}
        .pp{animation:pp 2s ease infinite;}
    </style>

    <div style="min-height:100%;padding-bottom:48px;
                background:#020617;
                background-image:radial-gradient(circle at 2px 2px,rgba(255,255,255,.05) 1px,transparent 0);
                background-size:40px 40px;color:#dae2fd;">

        {{-- ── Header ── --}}
        <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:32px;">
            <div>
                <h1 style="font-family:'Playfair Display',serif;font-size:44px;font-weight:700;line-height:1.2;letter-spacing:-.02em;color:#fff;margin:0 0 7px;">Projects</h1>
                <p style="color:#c3c6d7;font-size:14px;line-height:1.55;max-width:480px;margin:0;">
                    Orchestrate your cloud infrastructure across multi-region deployments and edge nodes.
                </p>
            </div>

            {{-- Modal trigger — the ONLY x-modal-input on this page --}}
            @can('createAnyResource')
            <x-modal-input buttonTitle="" title="New Project" minWidth="40rem" :hideHeader="true">
                <x-slot:content>
                    <button id="pj-open-modal"
                            style="display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border-radius:8px;
                                   border:none;cursor:pointer;font-size:13px;font-weight:700;letter-spacing:.05em;
                                   text-transform:uppercase;background:#2563eb;color:#fff;
                                   box-shadow:0 4px 14px rgba(37,99,235,.3);transition:background .15s,transform .1s;"
                            onmouseover="this.style.background='#1d4ed8';"
                            onmouseout="this.style.background='#2563eb';">
                        <span class="msi" style="font-size:17px;">add</span>ADD PROJECT
                    </button>
                </x-slot:content>
                <livewire:project.add-empty />
            </x-modal-input>
            @endcan
        </div>

        {{-- ── Infrastructure Banner ── --}}
        <div style="position:relative;overflow:hidden;height:190px;margin-bottom:32px;
                    border-radius:.65rem;border:1px solid rgba(67,70,85,.3);
                    background:radial-gradient(ellipse at 20% 60%,rgba(37,99,235,.18) 0%,transparent 55%),
                               radial-gradient(ellipse at 78% 28%,rgba(96,1,209,.14) 0%,transparent 50%),
                               linear-gradient(135deg,rgba(19,27,46,.96),rgba(6,14,32,.99));">
            <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.12;" preserveAspectRatio="xMidYMid slice">
                <line x1="6%" y1="40%" x2="26%" y2="66%" stroke="#b4c5ff" stroke-width="1"/>
                <line x1="26%" y1="66%" x2="50%" y2="34%" stroke="#b4c5ff" stroke-width="1"/>
                <line x1="50%" y1="34%" x2="74%" y2="70%" stroke="#b4c5ff" stroke-width="1"/>
                <line x1="74%" y1="70%" x2="94%" y2="28%" stroke="#b4c5ff" stroke-width="1"/>
                <circle cx="6%"  cy="40%" r="3" fill="#b4c5ff"/>
                <circle cx="26%" cy="66%" r="3" fill="#b4c5ff"/>
                <circle cx="50%" cy="34%" r="5.5" fill="#2563eb"/>
                <circle cx="74%" cy="70%" r="3" fill="#b4c5ff"/>
                <circle cx="94%" cy="28%" r="3" fill="#b4c5ff"/>
            </svg>
            <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(2,6,23,.88),transparent 55%);"></div>
            <div style="position:absolute;bottom:0;left:0;right:0;padding:16px 20px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <div>
                    <span style="display:inline-block;padding:2px 8px;border-radius:4px;margin-bottom:5px;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;background:rgba(180,197,255,.18);color:#b4c5ff;border:1px solid rgba(180,197,255,.35);">Real-time Analytics</span>
                    <h3 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:#fff;margin:0;">Infrastructure Overview</h3>
                </div>
                <div style="display:flex;gap:24px;">
                    <div style="text-align:right;">
                        <p style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:500;letter-spacing:.1em;color:#b4c5ff;text-transform:uppercase;margin:0 0 2px;">Active Nodes</p>
                        <p style="font-size:28px;font-weight:700;color:#fff;line-height:1;margin:0;">{{ $servers }}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:500;letter-spacing:.1em;color:#89ceff;text-transform:uppercase;margin:0 0 2px;">Projects</p>
                        <p style="font-size:28px;font-weight:700;color:#fff;line-height:1;margin:0;">{{ count($projects) }}</p>
                    </div>
                </div>
            </div>
        </div>

        {{-- ── Grid — display:table per row, cannot stagger ── --}}
        @php
            $canCreate = auth()->user()?->can('createAnyResource') ?? false;
            $variants  = [
                ['ico'=>'folder_managed','color'=>'#b4c5ff'],
                ['ico'=>'terminal',      'color'=>'#89ceff'],
                ['ico'=>'cloud_sync',    'color'=>'#d2bbff'],
                ['ico'=>'database',      'color'=>'#4ade80'],
                ['ico'=>'rocket_launch', 'color'=>'#fbbf24'],
            ];
            $vi = 0;

            // Build flat list: add-card marker first (if allowed), then projects
            $items = collect();
            if ($canCreate) $items->push('__add__');
            foreach ($projects as $p) $items->push($p);

            $rows = $items->chunk(3);
        @endphp

        @foreach($rows as $row)
        <div style="display:table;table-layout:fixed;width:100%;border-collapse:separate;border-spacing:12px 0;margin-bottom:12px;margin-left:-12px;width:calc(100% + 24px);">
            @php $colIndex = 0; @endphp
            @foreach($row as $item)
            <div style="display:table-cell;width:33.33%;vertical-align:top;">
                @if($item === '__add__')
                {{-- Add-card --}}
                <button class="pj-add-card" onclick="document.getElementById('pj-open-modal')?.click();">
                    <div class="pj-add-ico" style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:11px;background:#2d3449;color:#c3c6d7;transition:all .22s;">
                        <span class="msi" style="font-size:24px;">add</span>
                    </div>
                    <p class="pj-add-label" style="font-size:12px;font-weight:700;color:#c3c6d7;margin:0 0 3px;transition:color .22s;">Create New Workspace</p>
                    <p style="font-size:11px;color:rgba(195,198,215,.42);margin:0;">Spin up a new cloud environment</p>
                </button>

                @else
                {{-- Project card --}}
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
                <a href="{{ $item->navigateTo() }}" style="text-decoration:none;display:block;height:100%;">
                    <div class="pj-glass">
                        <div style="padding:15px 15px 0;">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                                <div style="width:38px;height:38px;border-radius:.45rem;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#2d3449;border:1px solid rgba(67,70,85,.32);color:{{$v['color']}};">
                                    <span class="msi f" style="font-size:20px;">{{$v['ico']}}</span>
                                </div>
                                <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:9999px;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:{{$sbg}};color:{{$stx}};border:1px solid {{$sbd}};">
                                    <span class="{{$pulse?'pp':''}}" style="width:5px;height:5px;border-radius:50%;background:{{$sdot}};flex-shrink:0;"></span>{{$st}}
                                </span>
                            </div>
                            <h4 style="font-size:14px;font-weight:600;color:#fff;margin:0 0 3px;line-height:1.3;">{{$item->name}}</h4>
                            <p style="font-size:12px;color:#c3c6d7;line-height:1.5;margin:0 0 11px;{{!$item->description?'opacity:.42;font-style:italic;':''}}display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                                {{$item->description?:'No description'}}
                            </p>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
                                <div class="pj-sbox" style="padding:8px 10px;">
                                    <p style="font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8d919a;margin:0 0 2px;">Resources</p>
                                    <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#b4c5ff;margin:0;">{{$tot}} Instance{{$tot!==1?'s':''}}</p>
                                </div>
                                <div class="pj-sbox" style="padding:8px 10px;">
                                    <p style="font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8d919a;margin:0 0 2px;">Deployments</p>
                                    <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#89ceff;margin:0;">{{$act}} Active</p>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top:auto;padding:9px 15px;border-top:1px solid rgba(67,70,85,.2);display:flex;justify-content:space-between;align-items:center;">
                            @if($item->canUpdate)
                            <a href="{{ $item->settingsRoute }}" wire:navigate @click.stop
                               style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#8d919a;text-decoration:none;"
                               onmouseover="this.style.color='#dae2fd';" onmouseout="this.style.color='#8d919a';">
                                <span class="msi" style="font-size:14px;">settings</span>Settings
                            </a>
                            @else<span></span>@endif
                            <span style="display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:700;color:#b4c5ff;">
                                View Details<span class="msi" style="font-size:13px;">arrow_forward_ios</span>
                            </span>
                        </div>
                    </div>
                </a>
                @endif
            </div>
            @php $colIndex++; @endphp
            @endforeach

            {{-- Fill empty cells --}}
            @for($f=$row->count();$f<3;$f++)
            <div style="display:table-cell;width:33.33%;"></div>
            @endfor
        </div>
        @endforeach

        {{-- Ambient glows --}}
        <div style="position:fixed;top:0;right:0;width:50%;height:50%;pointer-events:none;z-index:0;filter:blur(120px);background:rgba(180,197,255,.04);"></div>
        <div style="position:fixed;bottom:0;left:0;width:33%;height:33%;pointer-events:none;z-index:0;filter:blur(100px);background:rgba(210,187,255,.04);"></div>
    </div>
</div>
