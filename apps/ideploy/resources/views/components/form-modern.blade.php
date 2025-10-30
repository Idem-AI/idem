@props([
    'title' => null,
    'description' => null,
    'submitText' => 'Save',
    'cancelText' => 'Cancel',
    'onCancel' => null,
])

<div class="space-y-6">
    @if($title || $description)
        <div class="space-y-2">
            @if($title)
                <h3 class="text-xl font-semibold text-white">{{ $title }}</h3>
            @endif
            @if($description)
                <p class="text-sm text-gray-400">{{ $description }}</p>
            @endif
        </div>
    @endif

    {{-- Form Fields --}}
    <div class="space-y-4">
        {{ $slot }}
    </div>

    {{-- Actions --}}
    <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-800/50">
        @if($onCancel)
            <button type="button" 
                    @click="{{ $onCancel }}"
                    class="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors">
                {{ $cancelText }}
            </button>
        @endif
        <button type="submit" 
                class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all shadow-lg shadow-blue-500/20">
            {{ $submitText }}
        </button>
    </div>
</div>
