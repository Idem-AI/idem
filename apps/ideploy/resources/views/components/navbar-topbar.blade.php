{{-- Top Navbar --}}
<div class="flex items-center justify-between px-6 h-16 z-20"
     style="background:#131b2e; border-bottom:1px solid rgba(67,71,78,0.5);"
     x-data="{}">

    {{-- Left: Logo --}}
    <div class="flex items-center gap-4">
        <img src="{{ asset('ideploy-logo.png') }}" alt="iDeploy" class="h-8 w-auto object-contain">
    </div>

    {{-- Right: Badges + User --}}
    <div class="flex items-center gap-3">
        @auth
            @php
                $isAdmin = auth()->user()->isIdemAdmin();
                $team = auth()->user()->currentTeam();
                $plan = $team->idem_subscription_plan ?? 'free';
                $appsUsed = $team->idem_apps_count ?? 0;
                $appsLimit = $team->idem_app_limit ?? 2;
                $serversUsed = $team->servers()->count();
                $serversLimit = $team->idem_server_limit ?? 0;
                $planColors = [
                    'free'       => ['bg' => 'rgba(107,114,128,0.15)', 'text' => '#9ca3af', 'border' => 'rgba(107,114,128,0.25)'],
                    'basic'      => ['bg' => 'rgba(37,99,235,0.15)',   'text' => '#60a5fa', 'border' => 'rgba(37,99,235,0.25)'],
                    'pro'        => ['bg' => 'rgba(124,58,237,0.15)',  'text' => '#a78bfa', 'border' => 'rgba(124,58,237,0.25)'],
                    'enterprise' => ['bg' => 'rgba(217,119,6,0.15)',   'text' => '#fbbf24', 'border' => 'rgba(217,119,6,0.25)'],
                ];
                $colors = $planColors[$plan] ?? $planColors['free'];
            @endphp

            @if($isAdmin)
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
                     style="background:rgba(255,180,171,0.1);border:1px solid rgba(255,180,171,0.25);color:#ffb4ab;">
                    <i class="fa-solid fa-shield-halved text-xs"></i>
                    <span style="font-size:11px;font-weight:700;letter-spacing:.05em;">ADMIN</span>
                </div>
            @else
                @php
                    $appsPercent = $appsLimit > 0 ? min(100, round(($appsUsed / $appsLimit) * 100)) : 0;
                    $appsAtLimit = $appsUsed >= $appsLimit;
                    $serversDisplayLimit = $serversLimit > 0 ? $serversLimit : 2;
                    $serversPercent = $serversDisplayLimit > 0 ? min(100, round(($serversUsed / $serversDisplayLimit) * 100)) : 0;
                    $serversAtLimit = $serversUsed >= $serversDisplayLimit;
                @endphp

                {{-- Plan Badge --}}
                <a href="{{ route('idem.subscription') }}"
                   class="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                   style="background:{{ $colors['bg'] }};border:1px solid {{ $colors['border'] }};color:{{ $colors['text'] }};">
                    <i class="fa-solid fa-star text-[10px]"></i>
                    <span style="font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">{{ $plan }}</span>
                </a>

                {{-- Apps Quota --}}
                <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md"
                     style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);"
                     title="{{ $appsUsed }}/{{ $appsLimit }} apps">
                    <i class="fa-solid fa-cube text-[10px]" style="color:{{ $appsAtLimit ? '#ffb4ab' : '#60a5fa' }};"></i>
                    <div class="flex flex-col gap-0.5">
                        <div class="flex items-center justify-between gap-2">
                            <span style="font-size:9px;font-weight:500;color:#8d919a;text-transform:uppercase;letter-spacing:.05em;">Apps</span>
                            <span style="font-size:9px;font-weight:700;color:{{ $appsAtLimit ? '#ffb4ab' : '#e3e1e6' }};">{{ $appsUsed }}/{{ $appsLimit }}</span>
                        </div>
                        <div class="w-14 h-0.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.1);">
                            <div class="h-full rounded-full" style="width:{{ $appsPercent }}%;background:{{ $appsAtLimit ? '#ef4444' : '#2563eb' }};"></div>
                        </div>
                    </div>
                </div>

                {{-- Servers Quota --}}
                <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md"
                     style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);"
                     title="{{ $serversUsed }}/{{ $serversDisplayLimit }} servers">
                    <i class="fa-solid fa-server text-[10px]" style="color:{{ $serversAtLimit ? '#ffb4ab' : '#4ade80' }};"></i>
                    <div class="flex flex-col gap-0.5">
                        <div class="flex items-center justify-between gap-2">
                            <span style="font-size:9px;font-weight:500;color:#8d919a;text-transform:uppercase;letter-spacing:.05em;">Srv</span>
                            <span style="font-size:9px;font-weight:700;color:{{ $serversAtLimit ? '#ffb4ab' : '#e3e1e6' }};">{{ $serversUsed }}/{{ $serversDisplayLimit }}</span>
                        </div>
                        <div class="w-14 h-0.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.1);">
                            <div class="h-full rounded-full" style="width:{{ $serversPercent }}%;background:{{ $serversAtLimit ? '#ef4444' : '#4ade80' }};"></div>
                        </div>
                    </div>
                </div>
            @endif
        @endauth

        {{-- User Dropdown --}}
        <div x-data="{ open: false }" class="relative">
            <button @click="open = !open"
                    class="flex items-center gap-2 p-1.5 rounded-lg transition-colors"
                    style="hover:background:rgba(255,255,255,0.05);">
                @if(auth()->user()->photo_url)
                    <img src="{{ auth()->user()->photo_url }}"
                         alt="{{ auth()->user()->name }}"
                         class="w-8 h-8 rounded-full object-cover"
                         style="border:2px solid rgba(37,99,235,0.4);"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="w-8 h-8 rounded-full items-center justify-center hidden"
                         style="background:linear-gradient(135deg,#2563eb,#7c3aed);">
                        <span class="text-xs font-bold text-white">{{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}</span>
                    </div>
                @else
                    <div class="w-8 h-8 rounded-full flex items-center justify-center"
                         style="background:linear-gradient(135deg,#2563eb,#7c3aed);">
                        <span class="text-xs font-bold text-white">{{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}</span>
                    </div>
                @endif
                <i class="fa-solid fa-chevron-down text-[10px]" style="color:#8d919a;"></i>
            </button>

            <div x-show="open" @click.away="open = false" x-cloak
                 class="absolute right-0 mt-2 w-52 rounded-xl shadow-2xl z-50"
                 style="background:#0d1117;border:1px solid rgba(67,71,78,0.5);box-shadow:0 25px 50px rgba(0,0,0,0.6);">
                <div class="px-4 py-3" style="border-bottom:1px solid rgba(67,71,78,0.4);">
                    <p class="text-sm font-medium text-white">{{ auth()->user()->name }}</p>
                    <p class="text-xs truncate" style="color:#8d919a;">{{ auth()->user()->email }}</p>
                </div>
                <div class="py-1.5">
                    <a href="{{ route('profile') }}"
                       class="flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                       style="color:#c3c6cf;"
                       onmouseover="this.style.background='rgba(255,255,255,0.05)';this.style.color='#fff';"
                       onmouseout="this.style.background='';this.style.color='#c3c6cf';">
                        <i class="fa-solid fa-user w-4 text-center text-xs"></i>
                        Profile
                    </a>
                    <a href="{{ route('team.index') }}"
                       class="flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                       style="color:#c3c6cf;"
                       onmouseover="this.style.background='rgba(255,255,255,0.05)';this.style.color='#fff';"
                       onmouseout="this.style.background='';this.style.color='#c3c6cf';">
                        <i class="fa-solid fa-users w-4 text-center text-xs"></i>
                        Teams
                    </a>
                    <div style="border-top:1px solid rgba(67,71,78,0.4);margin:4px 0;"></div>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit"
                                class="flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors"
                                style="color:#ffb4ab;"
                                onmouseover="this.style.background='rgba(255,255,255,0.05)';"
                                onmouseout="this.style.background='';">
                            <i class="fa-solid fa-arrow-right-from-bracket w-4 text-center text-xs"></i>
                            Logout
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
