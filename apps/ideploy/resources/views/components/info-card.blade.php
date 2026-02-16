@props([
    'type' => 'info', // info, warning, danger, success
    'title' => '',
    'icon' => null,
])

@php
$borderColors = [
    'info' => 'border-accent',
    'warning' => 'border-warning',
    'danger' => 'border-danger',
    'success' => 'border-success',
];

$iconColors = [
    'info' => 'text-accent',
    'warning' => 'text-warning',
    'danger' => 'text-danger',
    'success' => 'text-success',
];

$bgColors = [
    'info' => 'bg-accent/10',
    'warning' => 'bg-warning/10',
    'danger' => 'bg-danger/10',
    'success' => 'bg-success/10',
];

$borderColor = $borderColors[$type] ?? $borderColors['info'];
$iconColor = $iconColors[$type] ?? $iconColors['info'];
$bgColor = $bgColors[$type] ?? $bgColors['info'];
@endphp

<div class="glass-card p-4 border-l-4 {{ $borderColor }}">
    <div class="flex items-start gap-3">
        @if ($icon)
            <div class="flex items-center justify-center w-10 h-10 rounded-lg {{ $bgColor }} flex-shrink-0">
                <div class="{{ $iconColor }}">
                    {!! $icon !!}
                </div>
            </div>
        @endif
        <div class="flex-1">
            @if ($title)
                <h4 class="text-sm font-semibold text-light mb-2">{{ $title }}</h4>
            @endif
            <div class="text-sm text-light opacity-80">
                {{ $slot }}
            </div>
        </div>
    </div>
</div>
