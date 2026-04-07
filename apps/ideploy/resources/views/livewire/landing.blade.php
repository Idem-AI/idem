@php
    $dashboardLoginUrl = rtrim(config('idem.dashboard_url', env('IDEM_DASHBOARD_URL', 'http://localhost:4200')), '/') . '/login?redirect=ideploy';
@endphp
<div class="min-h-screen text-white" style="font-family: 'Jura', sans-serif;">
    <x-slot:title>EPLOY — Deploy with confidence</x-slot>

    {{-- Navbar --}}
    <nav class="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 flex items-center justify-center">
                    <img src="{{ asset('ideploy-logo.svg') }}" alt="EPLOY Logo" class="w-8 h-8 object-contain">
                </div>
                <span class="text-lg font-bold tracking-tight">EPLOY</span>
            </div>

            @auth
                <div class="relative" x-data="{ open: false }">
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

                    <div x-show="open" x-transition:enter="transition ease-out duration-200"
                        x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100"
                        x-transition:leave="transition ease-in duration-150"
                        x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95"
                        class="absolute right-0 mt-2 w-56 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
                        style="display: none;">
                        <div class="px-4 py-3 border-b border-white/10">
                            <p class="text-sm font-medium text-white">{{ auth()->user()->name ?? 'User' }}</p>
                            <p class="text-xs text-gray-400 truncate">{{ auth()->user()->email }}</p>
                        </div>
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
                <a href="{{ $dashboardLoginUrl }}" class="outer-button button-sm">Sign in</a>
            @endauth
        </div>
    </nav>

    {{-- Hero --}}
    <section class="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-20 blur-3xl"
                style="background: radial-gradient(ellipse, #1447e6 0%, transparent 70%);"></div>
            <div class="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full opacity-10 blur-3xl"
                style="background: radial-gradient(ellipse, #22d3ee 0%, transparent 70%);"></div>
        </div>

        <div class="relative max-w-5xl mx-auto px-6 text-center">
            <h1 class="font-bold text-white leading-tight mb-6"
                style="font-size: clamp(2.5rem, 6vw, 5rem); letter-spacing: -0.03em;">
                Deploy your apps<br>
                <span class="i-underline" style="color: #22d3ee;">with confidence</span>
            </h1>

            <p class="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                Self-hostable platform to deploy and manage your applications, databases and services without the complexity of Kubernetes.
            </p>

            <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <a href="{{ $dashboardLoginUrl }}" class="inner-button button-lg w-full sm:w-auto">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Start deploying
                </a>
                <a href="https://github.com/coollabsio/coolify" target="_blank" class="outer-button button-lg w-full sm:w-auto flex items-center gap-4">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    View on GitHub
                </a>
            </div>

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

    {{-- Features --}}
    <section id="features" class="py-24 px-6">
        <div class="max-w-7xl mx-auto">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-bold text-white mb-4">Everything you need to deploy</h2>
                <p class="text-gray-400 max-w-xl mx-auto">From simple web apps to complex microservices, EPLOY handles it all on your own infrastructure.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

    {{-- How it works --}}
    <section id="how-it-works" class="py-24 px-6">
        <div class="max-w-5xl mx-auto">
            <div class="text-center mb-16">
                <h2 class="text-4xl font-bold text-white mb-4">Deploy in 3 steps</h2>
                <p class="text-gray-400">From code to production in minutes.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="relative text-center">
                    <div class="w-16 h-16 mx-auto mb-6 bg-primary/20 border-2 border-primary/40 rounded-2xl flex items-center justify-center">
                        <span class="text-2xl font-bold text-primary">1</span>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-3">Connect your server</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Add any Linux server via SSH. EPLOY installs Docker and configures everything automatically.</p>
                    <div class="hidden md:block absolute top-8 left-full w-full h-px border-t border-dashed border-white/10 -translate-x-8"></div>
                </div>

                <div class="relative text-center">
                    <div class="w-16 h-16 mx-auto mb-6 bg-accent-500/20 border-2 border-accent-500/40 rounded-2xl flex items-center justify-center">
                        <span class="text-2xl font-bold text-accent-500">2</span>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-3">Link your repository</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">Connect GitHub, GitLab or Bitbucket. Choose your branch and let EPLOY build your app.</p>
                    <div class="hidden md:block absolute top-8 left-full w-full h-px border-t border-dashed border-white/10 -translate-x-8"></div>
                </div>

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

    {{-- CTA --}}
    <section id="pricing" class="py-24 px-6">
        <div class="max-w-3xl mx-auto text-center">
            <div class="glass-card p-12 relative overflow-hidden">
                <div class="absolute inset-0 pointer-events-none overflow-hidden">
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-15 blur-3xl"
                        style="background: radial-gradient(ellipse, #1447e6 0%, transparent 70%);"></div>
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
                        Join thousands of developers who trust EPLOY to ship faster.<br>Free to self-host. Forever open-source.
                    </p>
                    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a href="{{ $dashboardLoginUrl }}" class="inner-button button-lg w-full sm:w-auto">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Get started
                        </a>
                        <a href="https://github.com/coollabsio/coolify" target="_blank" class="outer-button button-lg w-full sm:w-auto">
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

    {{-- Footer --}}
    <footer class="py-10 px-6 border-t border-white/5">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                    </svg>
                </div>
                <span class="text-sm font-semibold text-gray-400">EPLOY</span>
            </div>
            <p class="text-xs text-gray-600">© {{ date('Y') }} EPLOY · Powered by Idem</p>
            <div class="flex items-center gap-6">
                <a href="{{ $dashboardLoginUrl }}" class="text-xs text-gray-500 hover:text-white transition-colors">Sign in</a>
                <a href="https://github.com/coollabsio/coolify" target="_blank" class="text-xs text-gray-500 hover:text-white transition-colors">GitHub</a>
            </div>
        </div>
    </footer>
</div>
