@php
    $dashboardLoginUrl = rtrim(config('idem.dashboard_url', env('IDEM_DASHBOARD_URL', 'http://localhost:4200')), '/') . '/login?redirect=ideploy';
@endphp
<div class="min-h-screen text-white" style="font-family: 'Jura', sans-serif;">
    <x-slot:title>iDeploy — Deploy with confidence</x-slot>

    {{-- ================================================================
         NAVBAR
    ================================================================ --}}
    <nav class="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
            {{-- Logo --}}
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 bg-primary/20 border border-primary/40 rounded-xl flex items-center justify-center">
                    <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                    </svg>
                </div>
                <span class="text-xl font-bold text-white tracking-wide">iDeploy</span>
            </div>

            {{-- Nav links --}}
            <div class="hidden md:flex items-center gap-8">
                <a href="#features" class="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
                <a href="#how-it-works" class="text-sm text-gray-400 hover:text-white transition-colors">How it works</a>
                <a href="#pricing" class="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            </div>

            {{-- CTA / User Menu --}}
            @auth
                <div class="relative" x-data="{ open: false }">
                    {{-- User Button --}}
                    <button @click="open = !open" @click.away="open = false"
                        class="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                        <div class="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                            <span class="text-sm font-bold text-primary">{{ strtoupper(substr(auth()->user()->name ?? auth()->user()->email, 0, 1)) }}</span>
                        </div>
                        <span class="text-sm font-medium text-white hidden md:block">{{ auth()->user()->name ?? explode('@', auth()->user()->email)[0] }}</span>
                        <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': open }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {{-- Dropdown Menu --}}
                    <div x-show="open" x-transition:enter="transition ease-out duration-200"
                        x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100"
                        x-transition:leave="transition ease-in duration-150"
                        x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95"
                        class="absolute right-0 mt-2 w-56 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
                        style="display: none;">

                        {{-- User Info --}}
                        <div class="px-4 py-3 border-b border-white/10">
                            <p class="text-sm font-medium text-white">{{ auth()->user()->name ?? 'User' }}</p>
                            <p class="text-xs text-gray-400 truncate">{{ auth()->user()->email }}</p>
                        </div>

                        {{-- Menu Items --}}
                        <div class="py-2">
                            <a href="{{ route('dashboard') }}" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Dashboard
                            </a>
                            <a href="{{ route('profile') }}" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Profile
                            </a>
                        </div>

                        {{-- Logout --}}
                        <div class="border-t border-white/10 py-2">
                            <button wire:click="logout" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            @else
                <div class="flex items-center gap-3">
                    <a href="{{ $dashboardLoginUrl }}" class="outer-button button-sm">
                        Sign in
                    </a>
                    <a href="{{ $dashboardLoginUrl }}" class="inner-button button-sm">
                        Get started
                    </a>
                </div>
            @endauth
        </div>
    </nav>

    {{-- ================================================================
         HERO
    ================================================================ --}}
    <section class="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {{-- Background glow --}}
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-20 blur-3xl"
                style="background: radial-gradient(ellipse, #1447e6 0%, transparent 70%);">
            </div>
            <div class="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full opacity-10 blur-3xl"
                style="background: radial-gradient(ellipse, #22d3ee 0%, transparent 70%);">
            </div>
        </div>

        <div class="relative max-w-5xl mx-auto px-6 text-center">
            {{-- Badge --}}
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30 text-sm text-primary font-semibold mb-8">
                <span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Open-source · Self-hostable · Production-ready
            </div>

            {{-- Headline --}}
            <h1 class="font-bold text-white leading-tight mb-6"
                style="font-size: clamp(2.5rem, 6vw, 5rem); letter-spacing: -0.03em;">
                Deploy your apps<br>
                <span class="i-underline" style="color: #22d3ee;">with confidence</span>
            </h1>

            {{-- Sub --}}
            <p class="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                iDeploy is a self-hostable platform to deploy and manage your applications, databases and services —
                without the complexity of Kubernetes or the cost of cloud platforms.
            </p>

            {{-- CTAs --}}
            <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <a href="{{ $dashboardLoginUrl }}" class="inner-button button-lg w-full sm:w-auto">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Start deploying free
                </a>
                <a href="#how-it-works" class="outer-button button-lg w-full sm:w-auto">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    See how it works
                </a>
            </div>

            {{-- Stats --}}
            <div class="grid grid-cols-3 gap-6 max-w-lg mx-auto">
                <div class="text-center">
                    <div class="text-3xl font-bold text-white mb-1">10k+</div>
                    <div class="text-xs text-gray-500 uppercase tracking-wide">Deployments</div>
                </div>
                <div class="text-center border-x border-white/10">
                    <div class="text-3xl font-bold text-white mb-1">99.9%</div>
                    <div class="text-xs text-gray-500 uppercase tracking-wide">Uptime</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-white mb-1">25+</div>
                    <div class="text-xs text-gray-500 uppercase tracking-wide">Frameworks</div>
                </div>
            </div>
        </div>
    </section>

    {{-- ================================================================
         FEATURES
    ================================================================ --}}
    <section id="features" class="py-24 px-6">
        <div class="max-w-7xl mx-auto">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-bold text-white mb-4">Everything you need to deploy</h2>
                <p class="text-gray-400 max-w-xl mx-auto">From simple web apps to complex microservices, iDeploy handles it all on your own infrastructure.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {{-- Feature 1 --}}
                <div class="glass-card p-6">
                    <div class="w-12 h-12 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center mb-5">
                        <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-2">Any Language, Any Framework</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Deploy Node.js, Python, PHP, Go, Ruby and more. Works with Next.js, Laravel, Django, Rails out of the box.</p>
                </div>

                {{-- Feature 2 --}}
                <div class="glass-card p-6">
                    <div class="w-12 h-12 bg-accent-500/20 border border-accent-500/30 rounded-xl flex items-center justify-center mb-5">
                        <svg class="w-6 h-6 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-2">Managed Databases</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">PostgreSQL, MySQL, MongoDB, Redis — provisioned in seconds with automatic backups and point-in-time recovery.</p>
                </div>

                {{-- Feature 3 --}}
                <div class="glass-card p-6">
                    <div class="w-12 h-12 bg-green-500/20 border border-green-500/30 rounded-xl flex items-center justify-center mb-5">
                        <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-2">Automatic SSL & CDN</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Free SSL certificates via Let's Encrypt, automatic renewals, and edge caching for maximum performance.</p>
                </div>

                {{-- Feature 4 --}}
                <div class="glass-card p-6">
                    <div class="w-12 h-12 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center mb-5">
                        <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-2">CI/CD Pipelines</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Connect your GitHub, GitLab or Bitbucket repo. Push to deploy with zero-downtime rolling updates.</p>
                </div>

                {{-- Feature 5 --}}
                <div class="glass-card p-6">
                    <div class="w-12 h-12 bg-yellow-500/20 border border-yellow-500/30 rounded-xl flex items-center justify-center mb-5">
                        <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-2">Real-time Monitoring</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">CPU, memory, network — live metrics per container. Instant alerts via email, Slack or Telegram.</p>
                </div>

                {{-- Feature 6 --}}
                <div class="glass-card p-6">
                    <div class="w-12 h-12 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center justify-center mb-5">
                        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-2">Self-hosted on Your Infra</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Your servers, your data. Deploy on any VPS, bare metal or cloud provider. No vendor lock-in.</p>
                </div>
            </div>
        </div>
    </section>

    {{-- ================================================================
         HOW IT WORKS
    ================================================================ --}}
    <section id="how-it-works" class="py-24 px-6">
        <div class="max-w-5xl mx-auto">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-bold text-white mb-4">Deploy in 3 steps</h2>
                <p class="text-gray-400">From code to production in minutes.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                {{-- Step 1 --}}
                <div class="relative text-center">
                    <div class="w-16 h-16 mx-auto mb-6 bg-primary/20 border-2 border-primary/40 rounded-2xl flex items-center justify-center">
                        <span class="text-2xl font-bold text-primary">1</span>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-3">Connect your server</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Add any Linux server via SSH. iDeploy installs Docker and configures everything automatically.</p>
                    {{-- Connector --}}
                    <div class="hidden md:block absolute top-8 left-full w-full h-px border-t border-dashed border-white/10 -translate-x-8"></div>
                </div>

                {{-- Step 2 --}}
                <div class="relative text-center">
                    <div class="w-16 h-16 mx-auto mb-6 bg-accent-500/20 border-2 border-accent-500/40 rounded-2xl flex items-center justify-center">
                        <span class="text-2xl font-bold text-accent-500">2</span>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-3">Link your repository</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Connect GitHub, GitLab or Bitbucket. Choose your branch and let iDeploy build your app.</p>
                    <div class="hidden md:block absolute top-8 left-full w-full h-px border-t border-dashed border-white/10 -translate-x-8"></div>
                </div>

                {{-- Step 3 --}}
                <div class="text-center">
                    <div class="w-16 h-16 mx-auto mb-6 bg-green-500/20 border-2 border-green-500/40 rounded-2xl flex items-center justify-center">
                        <span class="text-2xl font-bold text-green-400">3</span>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-3">Go live instantly</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Your app is live with SSL, a custom domain, and automatic deploys on every push.</p>
                </div>
            </div>
        </div>
    </section>

    {{-- ================================================================
         FROM APPGEN BANNER (if coming from AppGen)
    ================================================================ --}}
    @if(request()->has('from') && request()->get('from') === 'appgen')
    <section class="py-12 px-6">
        <div class="max-w-3xl mx-auto">
            <div class="glass-card p-6 border border-primary/30">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-bold text-white mb-1">Your app is ready to deploy!</h3>
                        <p class="text-sm text-gray-400">Sign in or create an account to deploy your generated application directly from AppGen.</p>
                    </div>
                    <a href="{{ $dashboardLoginUrl }}" class="inner-button button-sm flex-shrink-0">
                        Sign in & Deploy
                    </a>
                </div>
            </div>
        </div>
    </section>
    @endif

    {{-- ================================================================
         CTA FINAL
    ================================================================ --}}
    <section id="pricing" class="py-24 px-6">
        <div class="max-w-3xl mx-auto text-center">
            <div class="glass-card p-12 relative overflow-hidden">
                {{-- Glow bg --}}
                <div class="absolute inset-0 pointer-events-none overflow-hidden">
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-15 blur-3xl"
                        style="background: radial-gradient(ellipse, #1447e6 0%, transparent 70%);">
                    </div>
                </div>

                <div class="relative">
                    <div class="w-16 h-16 mx-auto mb-6 bg-primary/20 border border-primary/40 rounded-2xl flex items-center justify-center">
                        <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                        </svg>
                    </div>
                    <h2 class="text-4xl font-bold text-white mb-4">Ready to deploy?</h2>
                    <p class="text-gray-400 mb-8 leading-relaxed">
                        Join thousands of developers who trust iDeploy to ship faster.<br>Free to self-host. Forever open-source.
                    </p>
                    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a href="{{ $dashboardLoginUrl }}" class="inner-button button-lg w-full sm:w-auto">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Get started — it's free
                        </a>
                        <a href="https://github.com/idem-africa/ideploy" target="_blank" class="outer-button button-lg w-full sm:w-auto">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/>
                            </svg>
                            View on GitHub
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- ================================================================
         FOOTER
    ================================================================ --}}
    <footer class="py-10 px-6 border-t border-white/5">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                    </svg>
                </div>
                <span class="text-sm font-semibold text-gray-400">iDeploy</span>
            </div>
            <p class="text-xs text-gray-600">© {{ date('Y') }} iDeploy · Part of the Idem ecosystem</p>
            <div class="flex items-center gap-6">
                <a href="{{ $dashboardLoginUrl }}" class="text-xs text-gray-500 hover:text-white transition-colors">Sign in</a>
                <a href="https://github.com/idem-africa/ideploy" target="_blank" class="text-xs text-gray-500 hover:text-white transition-colors">GitHub</a>
            </div>
        </div>
    </footer>
</div>
