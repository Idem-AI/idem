<div x-data="{ showTooltip: false }" @mouseenter="showTooltip = true" @mouseleave="showTooltip = false" {{ $attributes->merge(['class' => 'relative inline-block']) }}>
    <div class="cursor-pointer text-blue-500 hover:text-blue-400 transition-colors">
        @isset($icon)
            {{ $icon }}
        @else
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        @endisset
    </div>
    <div x-show="showTooltip" x-cloak x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100" x-transition:leave="transition ease-in duration-150" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95" class="absolute left-0 top-6 z-50 w-64 text-xs rounded-xl bg-gray-800 border border-gray-700 text-gray-200 shadow-2xl shadow-blue-500/20">
        <div class="p-4">
            {!! $helper !!}
        </div>
    </div>
</div>
