@props([
    'buttons' => [],
    'class' => 'flex gap-3'
])

<div class="{{ $class }}">
    @foreach ($buttons as $button)
        <button 
            type="{{ $button['type'] ?? 'button' }}"
            @class([
                'px-6 py-2.5 rounded-lg font-semibold uppercase tracking-wide transition-all duration-300',
                'inner-button' => $button['variant'] === 'primary',
                'outer-button' => $button['variant'] === 'secondary',
                'danger-button' => $button['variant'] === 'danger',
                $button['class'] ?? ''
            ])
            @if (isset($button['disabled'])) disabled @endif
            @if (isset($button['wire'])) wire:click="{{ $button['wire'] }}" @endif
            @if (isset($button['onclick'])) onclick="{{ $button['onclick'] }}" @endif
        >
            @if (isset($button['icon']))
                <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {!! $button['icon'] !!}
                </svg>
            @endif
            {{ $button['label'] ?? 'Button' }}
        </button>
    @endforeach
</div>
