@php
    $dashboardLoginUrl = rtrim(config('idem.dashboard_url', env('IDEM_DASHBOARD_URL', 'http://localhost:4200')), '/') . '/login?redirect=ideploy';
@endphp

{{-- Footer --}}
<footer class="py-12 px-6 border-t border-white/10 bg-transparent">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: var(--color-primary-500)">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
                </svg>
            </div>
            <span class="text-base font-black text-white tracking-tight">EPLOY</span>
        </div>
        <p class="text-sm text-white/50 font-medium">© {{ date('Y') }} EPLOY · Powered seamlessly by Idem Frameworks</p>
        <div class="flex items-center gap-8">
            <a href="{{ $dashboardLoginUrl }}" class="text-sm font-bold text-white/50 hover:text-white transition-colors">Sign In</a>
            <a href="https://github.com/coollabsio/coolify" target="_blank" class="text-sm font-bold text-white/50 hover:text-white transition-colors">GitHub Repository</a>
        </div>
    </div>
</footer>
