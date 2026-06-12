{{-- Top Navbar - Midnight Intelligence Design --}}
<div class="flex items-center justify-between px-5 py-0 bg-[#080c18] border-b border-white/[0.06] h-16" x-data="{}">
    {{-- Left: Logo --}}
    <div class="flex items-center">
        <img src="{{ asset('ideploy-logo.png') }}" alt="iDeploy" class="h-8 w-auto object-contain">
    </div>

    {{-- Right: Badges + User --}}
    <div class="flex items-center gap-2.5">
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
                    'free'       => ['bg' => 'bg-gray-600/20', 'text' => 'text-gray-400', 'border' => 'border-gray-600/30'],
                    'basic'      => ['bg' => 'bg-blue-600/20',  'text' => 'text-blue-400',  'border' => 'border-blue-600/30'],
                    'pro'        => ['bg' => 'bg-purple-600/20','text' => 'text-purple-400','border' => 'border-purple-600/30'],
                    'enterprise' => ['bg' => 'bg-amber-600/20', 'text' => 'text-amber-400', 'border' => 'border-amber-600/30'],
                ];
                $colors = $planColors[$plan] ?? $planColors['free'];
            @endphp

            @if($isAdmin)
                <div class="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 rounded-md border border-red-500/20">
                    <svg class="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span class="text-[10px] font-bold text-red-400 uppercase tracking-wider">Admin</span>
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
                <a href="{{ route('idem.subscription') }}" class="flex items-center gap-1.5 px-2.5 py-1 {{ $colors['bg'] }} rounded-md border {{ $colors['border'] }} hover:opacity-80 transition-opacity">
                    <svg class="w-3 h-3 {{ $colors['text'] }}" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                    <span class="text-[10px] font-bold {{ $colors['text'] }} uppercase tracking-wider">{{ $plan }}</span>
                </a>

                {{-- Apps Quota --}}
                <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-md border border-white/10" title="{{ $appsUsed }}/{{ $appsLimit }} apps">
                    <svg class="w-3 h-3 {{ $appsAtLimit ? 'text-red-400' : 'text-blue-400' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                    <div class="flex flex-col gap-0.5">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[9px] font-medium text-gray-500 uppercase tracking-wider">Apps</span>
                            <span class="text-[9px] font-bold {{ $appsAtLimit ? 'text-red-400' : 'text-gray-300' }}">{{ $appsUsed }}/{{ $appsLimit }}</span>
                        </div>
                        <div class="w-14 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                            <div class="h-full rounded-full {{ $appsAtLimit ? 'bg-red-500' : 'bg-blue-500' }}" style="width: {{ $appsPercent }}%"></div>
                        </div>
                    </div>
                </div>

                {{-- Servers Quota --}}
                <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-md border border-white/10" title="{{ $serversUsed }}/{{ $serversDisplayLimit }} servers">
                    <svg class="w-3 h-3 {{ $serversAtLimit ? 'text-red-400' : 'text-emerald-400' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                    </svg>
                    <div class="flex flex-col gap-0.5">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[9px] font-medium text-gray-500 uppercase tracking-wider">Srv</span>
                            <span class="text-[9px] font-bold {{ $serversAtLimit ? 'text-red-400' : 'text-gray-300' }}">{{ $serversUsed }}/{{ $serversDisplayLimit }}</span>
                        </div>
                        <div class="w-14 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                            <div class="h-full rounded-full {{ $serversAtLimit ? 'bg-red-500' : 'bg-emerald-500' }}" style="width: {{ $serversPercent }}%"></div>
                        </div>
                    </div>
                </div>
            @endif
        @endauth

        {{-- User Dropdown --}}
        <div x-data="{ open: false }" class="relative">
            <button @click="open = !open" class="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                @if(auth()->user()->photo_url)
                    <img src="{{ auth()->user()->photo_url }}"
                         alt="{{ auth()->user()->name }}"
                         class="w-7 h-7 rounded-full object-cover ring-2 ring-blue-500/30"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center hidden">
                        <span class="text-xs font-bold text-white">{{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}</span>
                    </div>
                @else
                    <div class="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span class="text-xs font-bold text-white">{{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}</span>
                    </div>
                @endif
                <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>

            <div x-show="open" @click.away="open = false" x-cloak
                 class="absolute right-0 mt-2 w-52 bg-[#0d1117] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50">
                <div class="px-4 py-3 border-b border-white/[0.06]">
                    <p class="text-sm font-medium text-white">{{ auth()->user()->name }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ auth()->user()->email }}</p>
                </div>
                <div class="py-1.5">
                    <a href="{{ route('profile') }}" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        Profile
                    </a>
                    <a href="{{ route('team.index') }}" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                        Teams
                    </a>
                    <div class="border-t border-white/[0.06] my-1"></div>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit" class="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                            </svg>
                            Logout
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
