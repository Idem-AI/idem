<div x-init="$wire.loadImages">
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-2xl font-bold text-light">
                <span class="i-underline">Rollback</span>
            </h2>
            @can('view', $application)
                <x-forms.button wire:click='loadImages(true)'>Reload Available Images</x-forms.button>
            @endcan
        </div>
        <p class="text-sm text-light opacity-70">You can easily rollback to a previously built (local) image quickly.</p>
    </div>

    {{-- Loading State --}}
    <div wire:target='loadImages' wire:loading class="glass-card p-6">
        <div class="flex items-center gap-3 text-light opacity-70">
            <div class="spinner"></div>
            <span>Loading available docker images...</span>
        </div>
    </div>

    {{-- Images Grid --}}
    <div wire:target='loadImages' wire:loading.remove>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            @forelse ($images as $image)
                <div class="glass-card p-5">
                    <div class="flex flex-col gap-3">
                        {{-- Image Info --}}
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    @if (data_get($image, 'is_current'))
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-success/20 text-success border border-success/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                                            LIVE
                                        </span>
                                    @endif
                                    <span class="text-sm text-light font-mono">{{ data_get($image, 'tag') }}</span>
                                </div>
                                @php
                                    $date = data_get($image, 'created_at');
                                    $interval = \Illuminate\Support\Carbon::parse($date);
                                @endphp
                                <div class="text-xs text-light opacity-60">{{ $interval->diffForHumans() }}</div>
                                <div class="text-xs text-light opacity-40">{{ $date }}</div>
                            </div>
                        </div>

                        {{-- Actions --}}
                        <div class="flex justify-end pt-2 border-t border-glass">
                            @can('deploy', $application)
                                @if (data_get($image, 'is_current'))
                                    <x-forms.button disabled tooltip="This image is currently running.">
                                        Rollback
                                    </x-forms.button>
                                @else
                                    <x-forms.button wire:click="rollbackImage('{{ data_get($image, 'tag') }}')">
                                        Rollback
                                    </x-forms.button>
                                @endif
                            @endcan
                        </div>
                    </div>
                </div>
            @empty
                <div class="glass-card p-6 lg:col-span-2">
                    <p class="text-center text-light opacity-60">No images found locally.</p>
                </div>
            @endforelse
        </div>
    </div>
</div>
