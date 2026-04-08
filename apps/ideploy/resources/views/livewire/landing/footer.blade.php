@php
    $dashboardLoginUrl = rtrim(config('idem.dashboard_url', env('IDEM_DASHBOARD_URL', 'http://localhost:4200')), '/') . '/login?redirect=ideploy';
@endphp

{{-- Footer --}}
<footer class="py-12 px-6 border-t border-white/5 relative z-10 glass-bg-dark">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center">
                <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                </svg>
            </div>
            <span class="text-base font-bold text-gray-300 tracking-tight">EPLOY</span>
        </div>
        <p class="text-sm text-gray-500 font-light">© {{ date('Y') }} EPLOY · Powered seamlessly by Idem Frameworks</p>
        <div class="flex items-center gap-8">
            <a href="{{ $dashboardLoginUrl }}" class="text-sm text-gray-500 hover:text-white transition-colors font-medium">Sign In</a>
            <a href="https://github.com/coollabsio/coolify" target="_blank" class="text-sm text-gray-500 hover:text-white transition-colors font-medium">GitHub Repository</a>
        </div>
    </div>
</footer>
