{{-- Navbar: Restored Glassmorphism --}}
<nav class="fixed top-0 left-0 right-0 z-50 px-6 py-5 bg-[#06080d]/60 backdrop-blur-xl border-b border-white/5">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
            <div class=" flex items-center justify-center">
                <img src="{{ asset('ideploy-logo.png') }}" alt="EPLOY Logo" class="w-[150px] h-auto object-cover drop-shadow-[0_0_15px_var(--color-primary-500)]">
            </div>
        </div>

        <div class="hidden md:flex items-center gap-8">
            <a href="#showcase" class="text-sm font-semibold text-white/70 hover:text-white transition-colors">Showcase</a>
            <a href="#features" class="text-sm font-semibold text-white/70 hover:text-white transition-colors">Platform</a>
            <a href="#pricing" class="text-sm font-semibold text-white/70 hover:text-white transition-colors">Pricing</a>
        </div>

        @auth
            <div class="relative" x-data="{ open: false }">
                <button @click="open = !open" @click.away="open = false"
                    class="flex items-center gap-4 p-1 rounded-full hover:bg-white/5 transition-all border border-white/10 glass-card">
                    <img src="{{ auth()->user()->photo_url ?? 'https://ui-avatars.com/api/?name='.urlencode(auth()->user()->name ?? auth()->user()->email).'&color=7F9CF5&background=EBF4FF' }}" 
                         alt="{{ auth()->user()->name }}" 
                         class="w-8 h-8 rounded-full object-cover border border-white/20 shadow-sm">
                </button>

                <div x-show="open" x-transition class="absolute right-0 mt-2 w-56 rounded-xl glass-card overflow-hidden" style="display: none;">
                    <div class="py-2">
                        <a href="{{ route('dashboard') }}" class="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white">
                            Dashboard
                        </a>
                        <button wire:click="logout" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-white/5">
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        @else
            <div class="flex items-center gap-4">
                <a href="{{ $dashboardLoginUrl }}" class="hidden sm:block text-sm font-semibold text-white/70 hover:text-white">Log in</a>
                <a href="{{ $dashboardLoginUrl }}" class="inner-button text-sm px-5 py-2.5">Get started</a>
            </div>
        @endauth
    </div>
</nav>

{{-- Hero Section: Image Background + Glass Mockup --}}
<section class="relative min-h-screen flex flex-col justify-center px-6 pt-32 pb-16 overflow-hidden">
    <!-- Subtle Server Background (Requested) -->
    <div class="absolute inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-[#06080d]/50 via-[#06080d]/70 to-[#06080d] z-10"></div>
        <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2000&auto=format&fit=crop" alt="Server Room" class="w-full h-full object-cover opacity-40 mix-blend-lighten filter grayscale-[50%]">
    </div>

    <div class="relative z-10 max-w-5xl mx-auto w-full flex flex-col items-center text-center px-4">
        <!-- Text content -->
        <div class="max-w-4xl mx-auto">
            <h1 class="font-black leading-[1.05] mb-8 text-white break-words" style="font-size: clamp(3.8rem, 8vw, 7.5rem); letter-spacing: -0.04em; text-shadow: 0 0 40px rgba(0,0,0,0.5);">
                Deploy apps,<br>
                <span class="i-underline text-secondary">Not servers</span>
            </h1>

            <p class="text-[20px] md:text-[24px] text-white/70 mb-12 max-w-2xl mx-auto font-medium leading-relaxed drop-shadow-md">
                The leading platform to deploy, scale, and secure your applications without leaving your workspace. Powered by Idem.
            </p>

            <div class="flex flex-col sm:flex-row gap-6 justify-center">
                <a href="{{ $dashboardLoginUrl }}" class="inner-button px-12 py-5 text-xl shadow-[0_0_50px_rgba(var(--color-primary-500-rgb),0.4)]">
                    Get started for free
                </a>
                <a href="https://github.com/coollabsio/coolify" target="_blank" class="outer-button px-12 py-5 text-xl">
                    Talk to sales
                </a>
            </div>
        </div>
    </div>
</section>
