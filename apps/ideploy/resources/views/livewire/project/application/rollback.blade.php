<div x-init="$wire.loadImages">
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <div class="icon-container">
                    <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-light">
                        <span class="i-underline">Rollback</span>
                    </h2>
                    <p class="text-sm text-light opacity-70 mt-1">Rollback to a previously built image quickly</p>
                </div>
            </div>
            @can('view', $application)
                <button wire:click='loadImages(true)' class="outer-button">
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reload Images
                </button>
            @endcan
        </div>
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
                                    <button disabled class="outer-button opacity-50 cursor-not-allowed" title="This image is currently running">
                                        <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Current
                                    </button>
                                @else
                                    <button wire:click="rollbackImage('{{ data_get($image, 'tag') }}')" class="inner-button">
                                        <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4z" />
                                        </svg>
                                        Rollback
                                    </button>
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
