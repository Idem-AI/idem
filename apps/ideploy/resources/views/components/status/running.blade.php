@props([
    'status' => 'Running',
    'title' => null,
    'lastDeploymentLink' => null,
    'noLoading' => false,
])
@php
    $isRunning = str($status)->lower()->contains('running');
    $isStopped = str($status)->lower()->contains('stopped') || str($status)->lower()->contains('exited');
    $isUnhealthy = str($status)->lower()->contains('unhealthy');
    $isRestarting = str($status)->lower()->contains('restarting');
    
    // Déterminer la couleur du badge
    if ($isRunning && !$isUnhealthy) {
        $badgeColor = 'green';
        $dotClass = 'bg-green-400 animate-pulse';
        $textClass = 'text-green-400';
        $bgClass = 'bg-green-500/10';
        $borderClass = 'border-green-500/30';
    } elseif ($isUnhealthy) {
        $badgeColor = 'yellow';
        $dotClass = 'bg-yellow-400 animate-pulse';
        $textClass = 'text-yellow-400';
        $bgClass = 'bg-yellow-500/10';
        $borderClass = 'border-yellow-500/30';
    } elseif ($isRestarting) {
        $badgeColor = 'blue';
        $dotClass = 'bg-blue-400 animate-spin';
        $textClass = 'text-blue-400';
        $bgClass = 'bg-blue-500/10';
        $borderClass = 'border-blue-500/30';
    } else {
        $badgeColor = 'gray';
        $dotClass = 'bg-gray-400';
        $textClass = 'text-gray-400';
        $bgClass = 'bg-gray-500/10';
        $borderClass = 'border-gray-500/30';
    }
    
    $showUnhealthyHelper =
        !str($status)->startsWith('Proxy') &&
        !str($status)->contains('(') &&
        str($status)->contains('unhealthy');
@endphp

<div class="flex items-center gap-2">
    {{-- Badge moderne avec status --}}
    <div class="flex items-center gap-2 px-3 py-1.5 {{ $bgClass }} border {{ $borderClass }} rounded-lg transition-all">
        <div class="w-2 h-2 rounded-full {{ $dotClass }}"></div>
        <span class="text-xs font-semibold {{ $textClass }}" @if ($title) title="{{ $title }}" @endif>
            @if ($lastDeploymentLink)
                <a href="{{ $lastDeploymentLink }}" target="_blank" class="hover:underline">
                    {{ str($status)->before(':')->headline() }}
                </a>
            @else
                {{ str($status)->before(':')->headline() }}
            @endif
        </span>
    </div>
    
    {{-- Helper pour unhealthy --}}
    @if ($showUnhealthyHelper)
        <x-helper
            helper="Unhealthy state. <span class='text-yellow-400'>This doesn't mean that the resource is malfunctioning.</span><br><br>- If the resource is accessible, it indicates that no health check is configured - it is not mandatory.<br>- If the resource is not accessible (returning 404 or 503), it may indicate that a health check is needed and has not passed. <span class='text-yellow-400'>Your action is required.</span><br><br>More details in the <a href='https://coolify.io/docs/knowledge-base/proxy/traefik/healthchecks' class='underline text-blue-400 hover:text-blue-300' target='_blank'>documentation</a>.">
            <x-slot:icon>
                <svg class="w-4 h-4 text-yellow-400" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor"
                        d="M240.26 186.1L152.81 34.23a28.74 28.74 0 0 0-49.62 0L15.74 186.1a27.45 27.45 0 0 0 0 27.71A28.31 28.31 0 0 0 40.55 228h174.9a28.31 28.31 0 0 0 24.79-14.19a27.45 27.45 0 0 0 .02-27.71m-20.8 15.7a4.46 4.46 0 0 1-4 2.2H40.55a4.46 4.46 0 0 1-4-2.2a3.56 3.56 0 0 1 0-3.73L124 46.2a4.77 4.77 0 0 1 8 0l87.44 151.87a3.56 3.56 0 0 1 .02 3.73M116 136v-32a12 12 0 0 1 24 0v32a12 12 0 0 1-24 0m28 40a16 16 0 1 1-16-16a16 16 0 0 1 16 16">
                    </path>
                </svg>
            </x-slot:icon>
        </x-helper>
    @endif
</div>
