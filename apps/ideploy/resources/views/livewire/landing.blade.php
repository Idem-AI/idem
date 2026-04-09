@php
    $dashboardLoginUrl = rtrim(config('idem.dashboard_url', env('IDEM_DASHBOARD_URL', 'http://localhost:4200')), '/') . '/login?redirect=ideploy';
@endphp
<div class="relative min-h-screen text-white overflow-hidden" style="font-family: 'Jura', sans-serif;">
    <x-slot:title>EPLOY — Deploy apps, not servers</x-slot>

    <!-- Global Glassmorphism Accents (Restored from styles.css intent) -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <!-- Intense primary glow -->
        <div class="absolute top-[-30%] left-[-10%] w-[1000px] h-[800px] rounded-full blur-[120px] opacity-20" style="background: radial-gradient(circle, var(--color-primary-500) 0%, transparent 70%);"></div>
        <!-- Deep accent glow -->
        <div class="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full blur-[120px] opacity-15" style="background: radial-gradient(circle, var(--color-accent-500) 0%, transparent 70%);"></div>
    </div>

    <!-- Page Content -->
    <div class="relative z-10 space-y-12">
        @include('livewire.landing.hero')
        @include('livewire.landing.marquee')
        @include('livewire.landing.showcase')
        @include('livewire.landing.pillars')
        @include('livewire.landing.features')
        @include('livewire.landing.testimonial')
        @include('livewire.landing.roles')
        @include('livewire.landing.how-it-works')
        @include('livewire.landing.pricing')
        @include('livewire.landing.footer')
    </div>
</div>
