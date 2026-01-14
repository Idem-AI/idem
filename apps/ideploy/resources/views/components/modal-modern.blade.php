@props([
    'title' => 'Modal',
    'maxWidth' => '2xl',
    'show' => false,
])

@php
$maxWidthClass = [
    'sm' => 'sm:max-w-sm',
    'md' => 'sm:max-w-md',
    'lg' => 'sm:max-w-lg',
    'xl' => 'sm:max-w-xl',
    '2xl' => 'sm:max-w-2xl',
    '3xl' => 'sm:max-w-3xl',
    '4xl' => 'sm:max-w-4xl',
    '5xl' => 'sm:max-w-5xl',
][$maxWidth];
@endphp

<div x-data="{ show: @js($show) }" 
     x-on:open-modal.window="show = true"
     x-on:close-modal.window="show = false"
     x-on:keydown.escape.window="show = false"
     x-show="show"
     class="fixed inset-0 z-50 overflow-y-auto"
     style="display: none;">
    
    {{-- Backdrop --}}
    <div x-show="show" 
         x-transition:enter="ease-out duration-300"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="ease-in duration-200"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0"
         class="fixed inset-0 bg-black/80 backdrop-blur-sm"
         @click="show = false">
    </div>

    {{-- Modal Container --}}
    <div class="flex min-h-full items-center justify-center p-4">
        <div x-show="show"
             x-transition:enter="ease-out duration-300"
             x-transition:enter-start="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
             x-transition:enter-end="opacity-100 translate-y-0 sm:scale-100"
             x-transition:leave="ease-in duration-200"
             x-transition:leave-start="opacity-100 translate-y-0 sm:scale-100"
             x-transition:leave-end="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
             class="relative w-full {{ $maxWidthClass }} bg-[#0a0e1a] rounded-xl shadow-2xl border border-gray-800/50 overflow-hidden"
             @click.stop>
            
            {{-- Header --}}
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
                <h3 class="text-lg font-semibold text-white">{{ $title }}</h3>
                <button @click="show = false" 
                        class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            {{-- Content --}}
            <div class="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {{ $slot }}
            </div>
        </div>
    </div>
</div>
