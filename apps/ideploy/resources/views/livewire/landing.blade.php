<div class="min-h-screen text-white relative overflow-hidden" style="font-family: 'Jura', sans-serif;">
    <x-slot:title>EPLOY — Deploy with confidence</x-slot>

    {{-- Universal Background Orbs / Figma-esque floating gradients --}}
    <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div class="absolute top-[-10%] left-[-10%] w-[60rem] h-[60rem] rounded-full opacity-10 blur-3xl mix-blend-screen"
            style="background: radial-gradient(circle, var(--color-primary-500) 0%, transparent 60%);"></div>
        <div class="absolute top-[30%] right-[-10%] w-[50rem] h-[50rem] rounded-full opacity-15 blur-3xl mix-blend-screen"
            style="background: radial-gradient(circle, var(--color-accent-500) 0%, transparent 60%);"></div>
        <div class="absolute bottom-[-10%] left-[20%] w-[70rem] h-[70rem] rounded-full opacity-10 blur-3xl mix-blend-screen"
            style="background: radial-gradient(circle, var(--color-secondary-500) 0%, transparent 60%);"></div>
    </div>

    @include('livewire.landing.hero')
    @include('livewire.landing.features')
    @include('livewire.landing.how-it-works')
    @include('livewire.landing.pricing')
    @include('livewire.landing.footer')
</div>
