@props([
    'label' => null,
    'helper' => null,
    'required' => false,
    'error' => null,
    'rows' => 4,
])

<div class="space-y-2">
    @if($label)
        <label {{ $attributes->only('for') }} class="block text-sm font-medium text-gray-300">
            {{ $label }}
            @if($required)
                <span class="text-red-400">*</span>
            @endif
        </label>
    @endif

    <textarea {{ $attributes->merge([
        'rows' => $rows,
        'class' => 'w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none ' . ($error ? 'border-red-500/50' : '')
    ]) }}>{{ $slot }}</textarea>

    @if($helper && !$error)
        <p class="text-xs text-gray-500">{{ $helper }}</p>
    @endif

    @if($error)
        <p class="text-xs text-red-400">{{ $error }}</p>
    @endif
</div>
