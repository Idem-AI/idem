<div>
    <x-slot:title>{{ data_get_str($application, 'name')->limit(10) }} > Deployments | Coolify</x-slot>
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />
    
    {{-- Header Idem Style --}}
    <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
            <div>
                <h1 class="text-2xl font-bold text-light">
                    <span class="i-underline">Deployments</span>
                </h1>
                <p class="text-sm text-light opacity-70 mt-1">View and manage your application deployments</p>
            </div>
            @if ($deployments_count > 0)
                <div class="glass-card px-4 py-2">
                    <span class="text-sm text-light opacity-80">Total: </span>
                    <span class="text-lg font-bold text-accent">{{ $deployments_count }}</span>
                </div>
            @endif
        </div>
    </div>

    <div class="flex flex-col gap-4 pb-10" @if (!$skip) wire:poll.5000ms='reloadDeployments' @endif>
        {{-- Filters & Pagination --}}
        <div class="glass-card p-4 mb-4">
            <div class="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4">
                {{-- Filter Form --}}
                <form class="flex items-end gap-3 flex-1">
                    <div class="flex-1 max-w-xs">
                        <x-forms.input id="pull_request_id" type="number" min="1" label="Pull Request ID" placeholder="e.g., 123"></x-forms.input>
                    </div>
                    <x-forms.button type="submit" class="bg-accent hover:bg-accent/90">
                        <span class="flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Filter
                        </span>
                    </x-forms.button>
                    @if ($pull_request_id)
                        <x-forms.button type="button" wire:click="clearFilter" class="bg-warning/20 hover:bg-warning/30 text-warning border-warning/30">
                            <span class="flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Clear
                            </span>
                        </x-forms.button>
                    @endif
                </form>

                {{-- Pagination --}}
                @if ($deployments_count > 0)
                    <div class="flex items-center gap-3">
                        <button 
                            wire:click="previousPage('{{ $defaultTake }}')"
                            @if (!$showPrev) disabled @endif
                            class="flex items-center justify-center w-10 h-10 rounded-lg transition-all"
                            :class="{{ $showPrev ? 'true' : 'false' }} ? 'bg-accent/10 text-accent hover:bg-accent/20' : 'bg-white/5 text-light/30 cursor-not-allowed'">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div class="px-4 py-2 glass-card">
                            <span class="text-sm text-light font-medium">
                                Page <span class="text-accent">{{ $currentPage }}</span> of {{ ceil($deployments_count / $defaultTake) }}
                            </span>
                        </div>
                        <button 
                            wire:click="nextPage('{{ $defaultTake }}')"
                            @if (!$showNext) disabled @endif
                            class="flex items-center justify-center w-10 h-10 rounded-lg transition-all"
                            :class="{{ $showNext ? 'true' : 'false' }} ? 'bg-accent/10 text-accent hover:bg-accent/20' : 'bg-white/5 text-light/30 cursor-not-allowed'">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                @endif
            </div>
        </div>
        {{-- Deployments List --}}
        @forelse ($deployments as $deployment)
            <div @class([
                'glass-card p-5 transition-all hover:border-accent/30',
                'border-l-4 border-accent animate-pulse' =>
                    data_get($deployment, 'status') === 'in_progress',
                'border-l-4 border-primary' =>
                    data_get($deployment, 'status') === 'queued',
                'border-l-4 border-light/20' =>
                    data_get($deployment, 'status') === 'cancelled-by-user',
                'border-l-4 border-danger' => data_get($deployment, 'status') === 'failed',
                'border-l-4 border-success' => data_get($deployment, 'status') === 'finished',
            ])>
                <a href="{{ $current_url . '/' . data_get($deployment, 'deployment_uuid') }}" class="block group">
                    <div class="flex flex-col">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-3">
                                <span @class([
                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
                                    'bg-accent/20 text-accent border-accent/30' =>
                                        data_get($deployment, 'status') === 'in_progress',
                                    'bg-primary/20 text-primary border-primary/30' =>
                                        data_get($deployment, 'status') === 'queued',
                                    'bg-danger/20 text-danger border-danger/30' =>
                                        data_get($deployment, 'status') === 'failed',
                                    'bg-success/20 text-success border-success/30' =>
                                        data_get($deployment, 'status') === 'finished',
                                    'bg-light/10 text-light/70 border-light/20' =>
                                        data_get($deployment, 'status') === 'cancelled-by-user',
                                ])>
                                    @php
                                        $statusText = match (data_get($deployment, 'status')) {
                                            'finished' => 'Success',
                                            'in_progress' => 'In Progress',
                                            'cancelled-by-user' => 'Cancelled',
                                            'queued' => 'Queued',
                                            default => ucfirst(data_get($deployment, 'status')),
                                        };
                                    @endphp
                                    @if (data_get($deployment, 'status') === 'in_progress')
                                        <span class="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                                    @endif
                                    {{ $statusText }}
                                </span>
                                
                                {{-- Deployment Type Badge --}}
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 text-light/70 border border-white/10">
                                    @if (data_get($deployment, 'is_webhook'))
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Webhook
                                    @elseif (data_get($deployment, 'rollback') === true)
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        Rollback
                                    @elseif (data_get($deployment, 'is_api'))
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        API
                                    @else
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Manual
                                    @endif
                                </span>
                                
                                @if (data_get($deployment, 'pull_request_id'))
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        PR #{{ data_get($deployment, 'pull_request_id') }}
                                    </span>
                                @endif
                            </div>
                            
                            <svg class="w-5 h-5 text-light/40 group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        @if (data_get($deployment, 'status') !== 'queued')
                            <div class="text-light opacity-70 text-sm space-y-1">
                                <div class="flex items-center gap-2">
                                    <svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span class="font-medium">Started:</span>
                                    {{ formatDateInServerTimezone(data_get($deployment, 'created_at'), data_get($application, 'destination.server')) }}
                                </div>
                                @if ($deployment->status !== 'in_progress' && $deployment->status !== 'cancelled-by-user')
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span class="font-medium">Ended:</span>
                                        {{ formatDateInServerTimezone(data_get($deployment, 'finished_at'), data_get($application, 'destination.server')) }}
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span class="font-medium">Duration:</span>
                                        <span class="text-accent font-semibold">{{ calculateDuration(data_get($deployment, 'created_at'), data_get($deployment, 'finished_at')) }}</span>
                                    </div>
                                    <div class="text-xs opacity-60">
                                        Finished {{ \Carbon\Carbon::parse(data_get($deployment, 'finished_at'))->diffForHumans() }}
                                    </div>
                                @elseif($deployment->status === 'in_progress')
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span class="font-medium">Running for:</span>
                                        <span class="text-accent font-semibold">{{ calculateDuration(data_get($deployment, 'created_at'), now()) }}</span>
                                    </div>
                                @endif
                            </div>
                        @endif

                        <div class="text-light opacity-70 text-sm mt-3 pt-3 border-t border-white/10">
                            @if (data_get($deployment, 'commit'))
                                <div x-data="{ expanded: false }">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <div class="flex items-center gap-2">
                                            <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                            </svg>
                                            <span class="font-medium">Commit:</span>
                                            <a href="{{ $application->gitCommitLink(data_get($deployment, 'commit')) }}"
                                                target="_blank" class="font-mono text-accent hover:text-accent/80 underline transition-colors">
                                                {{ substr(data_get($deployment, 'commit'), 0, 7) }}
                                            </a>
                                        </div>
                                        @if ($deployment->commitMessage())
                                            <span class="text-light/40">•</span>
                                            <a href="{{ $application->gitCommitLink(data_get($deployment, 'commit')) }}"
                                                target="_blank"
                                                class="text-light opacity-80 hover:text-accent truncate max-w-md underline transition-colors">
                                                {{ Str::before($deployment->commitMessage(), "\n") }}
                                            </a>
                                            @if ($deployment->commitMessage() !== Str::before($deployment->commitMessage(), "\n"))
                                                <button @click="expanded = !expanded"
                                                    class="text-light/60 hover:text-accent flex items-center gap-1 transition-colors">
                                                    <svg x-bind:class="{ 'rotate-180': expanded }"
                                                        class="w-4 h-4 transition-transform" viewBox="0 0 24 24">
                                                        <path fill="none" stroke="currentColor"
                                                            stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2" d="m6 9l6 6l6-6" />
                                                    </svg>
                                                </button>
                                            @endif
                                        @endif
                                    </div>
                                    @if ($deployment->commitMessage())
                                        <div x-show="expanded" x-transition:enter="transition ease-out duration-200"
                                            x-transition:enter-start="opacity-0 transform -translate-y-2"
                                            x-transition:enter-end="opacity-100 transform translate-y-0"
                                            class="mt-2 ml-6 p-3 glass-card text-light opacity-70 text-sm">
                                            {{ Str::after($deployment->commitMessage(), "\n") }}
                                        </div>
                                    @endif
                                </div>
                            @endif
                        </div>

                        @if (data_get($deployment, 'server_name') && $application->additional_servers->count() > 0)
                            <div class="flex items-center gap-2 text-light opacity-70 text-sm mt-3 pt-3 border-t border-white/10">
                                <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                </svg>
                                <span class="font-medium">Server:</span>
                                <span class="text-accent">{{ data_get($deployment, 'server_name') }}</span>
                            </div>
                        @endif
                    </div>
                </a>
            </div>
        @empty
            <div class="glass-card p-12 text-center">
                <svg class="w-16 h-16 mx-auto text-light/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p class="text-light opacity-60 text-lg">No deployments found</p>
                <p class="text-light opacity-40 text-sm mt-2">Deploy your application to see deployment history here</p>
            </div>
        @endforelse
    </div>
</div>
