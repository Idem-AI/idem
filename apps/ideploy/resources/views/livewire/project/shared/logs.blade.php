<div>
    <x-slot:title>
        {{ data_get_str($resource, 'name')->limit(10) }} > Logs | Coolify
    </x-slot>
    <livewire:project.shared.configuration-checker :resource="$resource" />
    @if ($type === 'application')
        <livewire:project.application.heading :application="$resource" />
        <div class="mb-8">
            <div class="flex items-center gap-3 mb-6">
                <div class="icon-container">
                    <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-light">
                        <span class="i-underline">Application Logs</span>
                    </h2>
                    <p class="text-sm text-light opacity-70 mt-1">Real-time container logs and output</p>
                </div>
            </div>
            @if (str($status)->contains('exited'))
                <div class="pt-4">The resource is not running.</div>
            @else
                <div class="pt-2" wire:loading wire:target="loadAllContainers">
                    Loading containers...
                </div>
                <div x-init="$wire.loadAllContainers()" wire:loading.remove wire:target="loadAllContainers">
                    @forelse ($servers as $server)
                        <div class="section-card mb-4">
                            <div class="flex items-center gap-2 mb-4">
                                <span class="category-badge">Server</span>
                                <h3 class="text-lg font-semibold text-light">{{ $server->name }}</h3>
                            </div>
                            @if ($server->isFunctional())
                                @if (isset($serverContainers[$server->id]) && count($serverContainers[$server->id]) > 0)
                                    @foreach ($serverContainers[$server->id] as $container)
                                        <livewire:project.shared.get-logs
                                            wire:key="{{ data_get($container, 'ID', uniqid()) }}" :server="$server"
                                            :resource="$resource" :container="data_get($container, 'Names')" />
                                    @endforeach
                                @else
                                    <div class="pt-2">No containers are running on server: {{ $server->name }}</div>
                                @endif
                            @else
                                <div class="pt-2">Server {{ $server->name }} is not functional.</div>
                            @endif
                        </div>
                    @empty
                        <div>No functional server found for the application.</div>
                    @endforelse
                </div>
            @endif
        </div>
    @elseif ($type === 'database')
        <livewire:project.database.heading :database="$resource" />
        <div class="mb-8">
            <div class="flex items-center gap-3 mb-6">
                <div class="icon-container">
                    <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-light">
                        <span class="i-underline">Database Logs</span>
                    </h2>
                    <p class="text-sm text-light opacity-70 mt-1">Real-time database logs and output</p>
                </div>
            </div>
            @if (str($status)->contains('exited'))
                <div class="pt-4">The resource is not running.</div>
            @else
                <div class="pt-2" wire:loading wire:target="loadAllContainers">
                    Loading containers...
                </div>
                <div x-init="$wire.loadAllContainers()" wire:loading.remove wire:target="loadAllContainers">
                    @forelse ($containers as $container)
                        @if (data_get($servers, '0'))
                            <livewire:project.shared.get-logs wire:key='{{ $container }}' :server="data_get($servers, '0')"
                                :resource="$resource" :container="$container" />
                        @else
                            <div>No functional server found for the database.</div>
                        @endif
                    @empty
                        <div class="pt-2">No containers are running.</div>
                    @endforelse
                </div>
            @endif
        </div>
    @elseif ($type === 'service')
        <livewire:project.service.heading :service="$resource" :parameters="$parameters" :query="$query" title="Logs" />
        <div class="mb-8">
            <div class="flex items-center gap-3 mb-6">
                <div class="icon-container">
                    <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-light">
                        <span class="i-underline">Service Logs</span>
                    </h2>
                    <p class="text-sm text-light opacity-70 mt-1">Real-time service logs and output</p>
                </div>
            </div>
            @if (str($status)->contains('exited'))
                <div class="pt-4">The resource is not running.</div>
            @else
                <div class="pt-2" wire:loading wire:target="loadAllContainers">
                    Loading containers...
                </div>
                <div x-init="$wire.loadAllContainers()" wire:loading.remove wire:target="loadAllContainers">
                    @forelse ($containers as $container)
                        @if (data_get($servers, '0'))
                            <livewire:project.shared.get-logs wire:key='{{ $container }}' :server="data_get($servers, '0')"
                                :resource="$resource" :container="$container" />
                        @else
                            <div>No functional server found for the service.</div>
                        @endif
                    @empty
                        <div class="pt-2">No containers are running.</div>
                    @endforelse
                </div>
            @endif
        </div>
    @endif
</div>
