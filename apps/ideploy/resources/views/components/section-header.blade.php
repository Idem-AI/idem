@props([
    'title' => '',
    'description' => '',
    'icon' => null,
])

<div class="flex items-center gap-3 mb-6">
    @if ($icon)
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 flex-shrink-0">
            {!! $icon !!}
        </div>
    @endif
    <div class="flex-1">
        <h3 class="text-lg font-semibold text-light">{{ $title }}</h3>
        @if ($description)
            <p class="text-xs text-light opacity-60 mt-0.5">{{ $description }}</p>
        @endif
    </div>
    @if (isset($actions))
        <div class="flex items-center gap-2">
            {{ $actions }}
        </div>
    @endif
</div>
