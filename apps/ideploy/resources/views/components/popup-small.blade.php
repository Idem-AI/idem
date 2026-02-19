@props(['title' => 'Default title', 'description' => 'Default Description', 'buttonText' => 'Default Button Text'])
<div x-data="{
    bannerVisible: true,
    bannerVisibleAfter: 100
}" x-show="bannerVisible" x-transition:enter="transition ease-out duration-300"
    x-transition:enter-start="translate-y-full opacity-0" x-transition:enter-end="translate-y-0 opacity-100"
    x-transition:leave="transition ease-in duration-200" x-transition:leave-start="translate-y-0 opacity-100"
    x-transition:leave-end="translate-y-full opacity-0" x-init="setTimeout(() => { bannerVisible = true }, bannerVisibleAfter);"
    class="fixed bottom-6 right-6 h-auto duration-300 ease-out max-w-md z-50" x-cloak>
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 via-yellow-500/10 to-orange-500/10 border border-orange-500/30 shadow-2xl shadow-orange-500/20 backdrop-blur-sm">
        {{-- Glow effect --}}
        <div class="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-yellow-500/5"></div>
        
        <div class="relative flex items-start gap-4 p-5">
            @if (isset($icon))
                <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <div class="text-white scale-75">
                        {{ $icon }}
                    </div>
                </div>
            @endif

            <div class="flex-1 min-w-0">
                <h4 class="text-base font-bold text-white mb-1">
                    {{ $title }}
                </h4>
                <div class="text-sm text-gray-300">{{ $description }}</div>
            </div>
            
            <button @click="bannerVisible=false" class="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center group">
                <svg class="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    </div>
</div>
