@php
    $dashboardLoginUrl = rtrim(config('idem.dashboard_url', env('IDEM_DASHBOARD_URL', 'http://localhost:4200')), '/') . '/login?redirect=ideploy';
@endphp

{{-- CTA --}}
<section id="pricing" class="py-32 px-6 relative z-10">
    <div class="max-w-4xl mx-auto text-center">
        <div class="glass-card p-16 relative overflow-hidden" style="border-radius: 40px">
            <div class="absolute inset-0 pointer-events-none overflow-hidden">
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-30 blur-3xl mix-blend-screen"
                    style="background: radial-gradient(circle, var(--color-primary-500) 0%, transparent 70%);"></div>
            </div>

            <div class="relative">
                <div class="w-20 h-20 mx-auto mb-8 bg-primary/20 border-2 border-primary/40 rounded-[2rem] flex items-center justify-center shadow-2xl">
                    <svg class="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                    </svg>
                </div>
                <h2 class="text-5xl font-bold text-white mb-6 tracking-tighter">Ready to deploy?</h2>
                <p class="text-xl text-gray-300 mb-12 leading-relaxed max-w-2xl mx-auto font-light">
                    Join thousands of elite developers who extensively trust EPLOY to ship faster and better.<br>Completely free to self-host. Forever strictly open-source.
                </p>
                <div class="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <a href="{{ $dashboardLoginUrl }}" class="inner-button button-xl w-full sm:w-auto shadow-2xl hover:scale-105 transition-transform duration-300">
                        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Get Started Instantly
                    </a>
                    <a href="https://github.com/coollabsio/coolify" target="_blank" class="outer-button button-xl w-full sm:w-auto shadow-2xl hover:scale-105 transition-transform duration-300 border-white/20">
                        <svg class="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24">
                            <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/>
                        </svg>
                        View Repository
                    </a>
                </div>
            </div>
        </div>
    </div>
</section>
