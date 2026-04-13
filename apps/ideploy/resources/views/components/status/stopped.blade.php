@props([
    'status' => 'Stopped',
    'noLoading' => false,
])
<div class="flex items-center gap-2">
    @if (!$noLoading)
        <x-loading wire:loading.delay.longer />
    @endif
    <span wire:loading.remove.delay.longer class="flex items-center">
        <div class="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div class="w-2 h-2 rounded-full bg-red-400"></div>
            <span class="text-xs font-semibold text-red-400">{{ str($status)->before(':')->headline() }}</span>
        </div>
    </span>
</div>
