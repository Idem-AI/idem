{{-- Modern Top Navbar with Credits Display --}}
<div class="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-[#0a0e1a] border-b border-gray-800/50">
    {{-- Left: Page Title or Breadcrumb --}}
    <div class="flex items-center gap-4">
        <h1 class="text-xl font-semibold text-white">
            {{ $title ?? 'Dashboard' }}
        </h1>
    </div>

    {{-- Right: Subscription Info, Credits and User Menu --}}
    <div class="flex items-center gap-3">
        @auth
            @php
                $isAdmin = auth()->user()->isIdemAdmin();
                $team = auth()->user()->currentTeam();
                $credits = $team->idem_credits ?? 0;
                $plan = $team->idem_subscription_plan ?? 'free';
                $appsUsed = $team->idem_apps_count ?? 0;
                $appsLimit = $team->idem_app_limit ?? 2;
                
                // Count actual servers from the team
                $serversUsed = $team->servers()->count();
                $serversLimit = $team->idem_server_limit ?? 0;
                
                // Plan colors
                $planColors = [
                    'free' => ['bg' => 'bg-gray-600/20', 'text' => 'text-gray-400', 'border' => 'border-gray-600/30'],
                    'basic' => ['bg' => 'bg-blue-600/20', 'text' => 'text-blue-400', 'border' => 'border-blue-600/30'],
                    'pro' => ['bg' => 'bg-purple-600/20', 'text' => 'text-purple-400', 'border' => 'border-purple-600/30'],
                    'enterprise' => ['bg' => 'bg-amber-600/20', 'text' => 'text-amber-400', 'border' => 'border-amber-600/30'],
                ];
                $colors = $planColors[$plan] ?? $planColors['free'];
            @endphp
            
            {{-- Masquer les badges pour les admins --}}
            @if(!$isAdmin)
                {{-- Plan Badge (Clickable) --}}
                <a href="{{ route('idem.subscription') }}" class="flex items-center gap-2 px-3 py-2 {{ $colors['bg'] }} rounded-lg border {{ $colors['border'] }} hover:opacity-80 transition-opacity cursor-pointer">
                    <svg class="w-4 h-4 {{ $colors['text'] }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                    </svg>
                    <span class="text-xs font-bold {{ $colors['text'] }} uppercase">{{ $plan }}</span>
                </a>
                
                {{-- Apps Quota --}}
                <div class="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                    <span class="text-xs font-medium text-gray-400">Apps:</span>
                    <span class="text-xs font-bold {{ $appsUsed >= $appsLimit ? 'text-red-400' : 'text-blue-400' }}">{{ $appsUsed }}/{{ $appsLimit }}</span>
                </div>
                
                {{-- Servers Quota (always shown, free plan has 2 servers) --}}
                <div class="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                    </svg>
                    <span class="text-xs font-medium text-gray-400">Servers:</span>
                    <span class="text-xs font-bold {{ $serversUsed >= $serversLimit ? 'text-red-400' : 'text-green-400' }}">{{ $serversUsed }}/{{ $serversLimit > 0 ? $serversLimit : 2 }}</span>
                </div>
                
                {{-- Credits Display --}}
                <div class="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="text-xs font-medium text-gray-400">Credits:</span>
                    <span class="text-xs font-bold text-emerald-400">{{ number_format($credits) }}</span>
                </div>
            @else
                {{-- Badge Admin --}}
                <div class="flex items-center gap-2 px-3 py-2 bg-red-600/20 rounded-lg border border-red-600/30">
                    <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span class="text-xs font-bold text-red-400 uppercase">ADMIN</span>
                </div>
            @endif
        @endauth

        {{-- User Profile Dropdown --}}
        <div x-data="{ open: false }" class="relative">
            <button @click="open = !open" class="flex items-center gap-2 p-2 hover:bg-gray-800/50 rounded-lg transition-colors">
                @if(auth()->user()->photo_url)
                    <img src="{{ auth()->user()->photo_url }}" 
                         alt="{{ auth()->user()->name }}" 
                         class="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/30"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center hidden">
                        <span class="text-sm font-bold text-white">
                            {{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}
                        </span>
                    </div>
                @else
                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span class="text-sm font-bold text-white">
                            {{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}
                        </span>
                    </div>
                @endif
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
            
            {{-- Dropdown Menu --}}
            <div x-show="open" @click.away="open = false" x-cloak
                 class="absolute right-0 mt-2 w-56 bg-[#0a0e1a] border border-gray-700/50 rounded-lg shadow-xl z-50">
                <div class="px-4 py-3 border-b border-gray-700/50">
                    <p class="text-sm font-medium text-white">{{ auth()->user()->name }}</p>
                    <p class="text-xs text-gray-400 truncate">{{ auth()->user()->email }}</p>
                </div>
                <div class="py-2">
                    <a href="{{ route('profile') }}" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        Profile
                    </a>
                    <a href="{{ route('team.index') }}" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                        Teams
                    </a>
                    <div class="border-t border-gray-700/50 my-2"></div>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit" class="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-800/50 transition-colors">
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
