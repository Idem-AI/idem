@props([
    'id' => null,
    'label' => '',
    'description' => '',
    'icon' => null,
    'checked' => false,
    'disabled' => false,
])

<div class="flex items-center justify-between p-4 glass-card hover:border-accent/20 transition-all {{ $disabled ? 'opacity-50' : '' }}">
    <div class="flex items-center gap-3 flex-1">
        @if ($icon)
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 flex-shrink-0">
                {!! $icon !!}
            </div>
        @endif
        <div class="flex-1">
            <h4 class="text-sm font-medium text-light">{{ $label }}</h4>
            @if ($description)
                <p class="text-xs text-light/60 mt-0.5">{{ $description }}</p>
            @endif
        </div>
    </div>
    <label class="relative inline-flex items-center cursor-pointer {{ $disabled ? 'cursor-not-allowed' : '' }}">
        <input 
            type="checkbox" 
            @if($id) id="{{ $id }}" wire:model="{{ $id }}" @endif
            class="sr-only peer" 
            @if($checked) checked @endif
            @if($disabled) disabled @endif
            {{ $attributes }}
        >
        <div class="w-11 h-6 bg-white/10 peer-focus:ring-2 peer-focus:ring-accent/20 rounded-full peer 
                    peer-checked:after:translate-x-full peer-checked:bg-accent 
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                    after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                    transition-colors duration-200"></div>
    </label>
</div>
