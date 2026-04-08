@php
    $dashboardLoginUrl = rtrim(config('idem.dashboard_url', env('IDEM_DASHBOARD_URL', 'http://localhost:4200')), '/') . '/login?redirect=ideploy';
@endphp
{{-- Navbar --}}
<nav class="fixed top-0 left-0 right-0 z-50 px-6 py-4">
    <div class="max-w-7xl mx-auto flex items-center justify-between backdrop-blur-md bg-transparent rounded-full px-4 py-2 border border-white/5">
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 flex items-center justify-center glow-primary rounded-full">
                <img src="{{ asset('ideploy-logo.svg') }}" alt="EPLOY Logo" class="w-7 h-7 object-contain">
            </div>
            <span class="text-2xl font-bold tracking-tight text-white">EPLOY</span>
        </div>

        @auth
            <div class="relative" x-data="{ open: false }">
                <button @click="open = !open" @click.away="open = false"
                    class="flex items-center gap-3 px-4 py-2 rounded-full glass-dark hover:bg-white/10 transition-all border border-white/10">
                    <div class="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                        <span class="text-xs font-bold text-primary">{{ strtoupper(substr(auth()->user()->name ?? auth()->user()->email, 0, 1)) }}</span>
                    </div>
                    <span class="text-sm font-medium text-white hidden md:block">{{ auth()->user()->name ?? explode('@', auth()->user()->email)[0] }}</span>
                    <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': open }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <div x-show="open" x-transition class="absolute right-0 mt-2 w-56 rounded-2xl glass-dark border border-white/10 shadow-2xl overflow-hidden" style="display: none;">
                    <div class="px-4 py-3 border-b border-white/10">
                        <p class="text-sm font-medium text-white">{{ auth()->user()->name ?? 'User' }}</p>
                        <p class="text-xs text-gray-400 truncate">{{ auth()->user()->email }}</p>
                    </div>
                    <div class="py-2">
                        <a href="{{ route('dashboard') }}" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                            Dashboard
                        </a>
                        <a href="{{ route('profile') }}" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                            Profile
                        </a>
                    </div>
                    <div class="border-t border-white/10 py-2">
                        <button wire:click="logout" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        @else
            <a href="{{ $dashboardLoginUrl }}" class="inner-button button-sm px-6">Sign In</a>
        @endauth
    </div>
</nav>

{{-- Hero Section --}}
<section class="relative z-10 min-h-[95vh] flex flex-col items-center justify-center px-6 pt-24 pb-12">
    <div class="text-center max-w-5xl mx-auto mt-10">
        <!-- Figma-like badge -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 glass-bg-subtle backdrop-blur-md mb-10 transition-transform hover:scale-105 cursor-default shadow-lg text-glow-accent">
            <span class="w-2 h-2 rounded-full bg-accent-500 animate-pulse"></span>
            <span class="text-sm font-semibold tracking-wide text-accent-500">EPLOY is now Open Source</span>
        </div>

        <h1 class="font-bold leading-[1.05] mb-8 tracking-tighter" style="font-size: clamp(3.5rem, 9vw, 7.5rem);">
            Deploy faster.<br>
            <span class="text-transparent bg-clip-text" style="background-image: var(--gradient-accent)">Scale freely.</span>
        </h1>

        <p class="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-14 leading-relaxed font-light">
            The modern, self-hostable platform designed to deploy and manage your applications, databases, and services with absolute zero friction.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a href="{{ $dashboardLoginUrl }}" class="inner-button button-xl w-full sm:w-auto shadow-2xl hover:scale-105 transition-transform duration-300">
                <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Deploy your App
            </a>
            <a href="https://github.com/coollabsio/coolify" target="_blank" class="outer-button button-xl w-full sm:w-auto shadow-2xl hover:scale-105 transition-transform duration-300 flex items-center justify-center border-white/20">
                <svg class="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                View on GitHub
            </a>
        </div>
        
        <!-- Dashboard preview mockup - Figma style floating window -->
        <div class="mt-24 relative mx-auto max-w-5xl glass-card rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl p-3" style="background: var(--glass-bg-subtle)">
            <div class="absolute inset-0 bg-gradient-to-t from-[#06080d] via-transparent to-transparent z-10 pointer-events-none"></div>
            <div class="bg-black/60 backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/5">
                <!-- Fake Window Header -->
                <div class="flex items-center px-5 py-4 border-b border-white/5 bg-white/5">
                    <div class="flex gap-2.5">
                        <div class="w-3.5 h-3.5 rounded-full bg-red-500/80"></div>
                        <div class="w-3.5 h-3.5 rounded-full bg-yellow-500/80"></div>
                        <div class="w-3.5 h-3.5 rounded-full bg-green-500/80"></div>
                    </div>
                </div>
                <!-- Fake Window Content Grid -->
                <div class="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="glass-card p-6 h-40 flex flex-col justify-between rounded-2xl hover:-translate-y-1 transition-transform">
                        <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center outline outline-1 outline-primary/40">
                            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <div class="space-y-3">
                            <div class="h-2.5 w-1/2 bg-white/10 rounded-full"></div>
                            <div class="h-2.5 w-3/4 bg-white/5 rounded-full"></div>
                        </div>
                    </div>
                    <div class="glass-card p-6 h-40 flex flex-col justify-between rounded-2xl hover:-translate-y-1 transition-transform shadow-[0_0_30px_rgba(34,211,238,0.15)] outline outline-1 outline-accent-500/30">
                        <div class="w-10 h-10 rounded-xl bg-accent-500/20 flex items-center justify-center outline outline-1 outline-accent-500/40">
                            <svg class="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <div class="flex flex-col gap-3">
                            <div class="h-2.5 w-full bg-accent-500/30 rounded-full"></div>
                            <div class="h-2.5 w-2/3 bg-white/10 rounded-full"></div>
                        </div>
                    </div>
                    <div class="glass-card p-6 h-40 flex flex-col justify-between rounded-2xl hover:-translate-y-1 transition-transform">
                         <div class="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center outline outline-1 outline-green-500/40">
                            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <div class="space-y-3">
                            <div class="h-2.5 w-1/3 bg-white/10 rounded-full"></div>
                            <div class="h-2.5 w-1/2 bg-white/5 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
