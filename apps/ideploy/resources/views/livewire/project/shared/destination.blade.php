<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <h2 class="text-2xl font-bold text-light mb-2">
            <span class="i-underline">Servers</span>
        </h2>
        <p class="text-sm text-light opacity-70">Server related configurations.</p>
    </div>

    <div class="flex flex-col gap-6">
        {{-- Primary Server Section --}}
        <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-accent mb-4">Primary Server</h3>
            <div class="relative">
                {{-- Status Badge --}}
                @if (str($resource->realStatus())->startsWith('running'))
                    <div class="absolute -top-2 -right-2 z-10">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-success/20 text-success border border-success/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                            Running
                        </span>
                    </div>
                @elseif (str($resource->realStatus())->startsWith('exited'))
                    <div class="absolute -top-2 -right-2 z-10">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-danger/20 text-danger border border-danger/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-danger"></span>
                            Exited
                        </span>
                    </div>
                @endif

                {{-- Server Info --}}
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-2 text-light">
                        <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                        </svg>
                        <span class="font-semibold">{{ data_get($resource, 'destination.server.name') }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-light opacity-70">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                        </svg>
                        <span>Network: {{ data_get($resource, 'destination.network') }}</span>
                    </div>
                </div>

                {{-- Actions --}}
                @if ($resource?->additional_networks?->count() > 0)
                    <div class="flex gap-2 mt-4 pt-4 border-t border-glass">
                        <x-forms.button
                            wire:click="redeploy('{{ data_get($resource, 'destination.id') }}','{{ data_get($resource, 'destination.server.id') }}')">Deploy</x-forms.button>
                        @if (str($resource->realStatus())->startsWith('running'))
                            <x-forms.button isError
                                wire:click="stop('{{ data_get($resource, 'destination.server.id') }}')">Stop</x-forms.button>
                        @endif
                    </div>
                @endif
            </div>
        </div>

        {{-- Additional Servers Section --}}
        @if ($resource?->additional_networks?->count() > 0 && data_get($resource, 'build_pack') !== 'dockercompose')
            <div class="glass-card p-6">
                <h3 class="text-lg font-semibold text-accent mb-4">Additional Server(s)</h3>
                <div class="grid grid-cols-1 gap-4">
                @foreach ($resource->additional_networks as $destination)
                    <div class="glass p-5" wire:key="destination-{{ $destination->id }}">
                        <div class="relative">
                            {{-- Status Badge --}}
                            @if (str(data_get($destination, 'pivot.status'))->startsWith('running'))
                                <div class="absolute -top-2 -right-2 z-10">
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-success/20 text-success border border-success/30">
                                        <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                                        Running
                                    </span>
                                </div>
                            @elseif (str(data_get($destination, 'pivot.status'))->startsWith('exited'))
                                <div class="absolute -top-2 -right-2 z-10">
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-danger/20 text-danger border border-danger/30">
                                        <span class="w-1.5 h-1.5 rounded-full bg-danger"></span>
                                        Exited
                                    </span>
                                </div>
                            @endif

                            {{-- Server Info --}}
                            <div class="flex flex-col gap-2">
                                <div class="flex items-center gap-2 text-light">
                                    <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                                    </svg>
                                    <span class="font-semibold">{{ data_get($destination, 'server.name') }}</span>
                                </div>
                                <div class="flex items-center gap-2 text-sm text-light opacity-70">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                    </svg>
                                    <span>Network: {{ data_get($destination, 'network') }}</span>
                                </div>
                            </div>

                            {{-- Actions --}}
                            <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-glass">
                                <x-forms.button
                                    wire:click="redeploy('{{ data_get($destination, 'id') }}','{{ data_get($destination, 'server.id') }}')">Deploy</x-forms.button>
                                <x-forms.button
                                    wire:click="promote('{{ data_get($destination, 'id') }}','{{ data_get($destination, 'server.id') }}')">Promote to Primary</x-forms.button>
                                @if (data_get_str($destination, 'pivot.status')->startsWith('running'))
                                    <x-forms.button isError
                                        wire:click="stop('{{ data_get($destination, 'server.id') }}')">Stop</x-forms.button>
                                @endif
                                <x-modal-confirmation title="Confirm removing application from server?" isErrorButton
                                    buttonTitle="Remove from server"
                                    submitAction="removeServer({{ data_get($destination, 'id') }},{{ data_get($destination, 'server.id') }})"
                                    :actions="[
                                        'This will stop the all running applications on this server and remove it as a deployment destination.',
                                    ]" confirmationText="{{ data_get($destination, 'server.name') }}"
                                    confirmationLabel="Please confirm the execution of the actions by entering the Server Name below"
                                    shortConfirmationLabel="Server Name" />
                            </div>
                        </div>
                    </div>
                @endforeach
                </div>
            </div>
        @endif
        {{-- Add Another Server Section --}}
        @if ($resource->getMorphClass() === 'App\Models\Application' && data_get($resource, 'build_pack') !== 'dockercompose')
            <div class="glass-card p-6">
                @if ($resource->persistentStorages()->count() > 0)
                    <h3 class="text-lg font-semibold text-accent mb-4">Add Another Server</h3>
                    <div class="glass-card p-4 bg-warning/10">
                        <div class="flex items-start gap-3 text-warning">
                            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                            </svg>
                            <div>
                                <h4 class="font-semibold mb-1">Cannot add additional servers</h4>
                                <p class="text-sm opacity-90">This application has persistent storage volumes configured. Applications with persistent storage cannot be deployed to multiple servers as the storage would not be accessible across different servers.</p>
                            </div>
                        </div>
                    </div>
            @elseif (count($networks) > 0)
                <h3>Add another server</h3>
                <div class="grid grid-cols-1 gap-4">
                    @foreach ($networks as $network)
                        <div wire:click="addServer('{{ $network->id }}','{{ data_get($network, 'server.id') }}')"
                            class="relative flex flex-col dark:text-white box group">
                            <div>
                                <div class="box-title">
                                    Server: {{ data_get($network, 'server.name') }}
                                </div>
                                <div class="box-description">
                                    Network: {{ data_get($network, 'name') }}
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>
            @else
                <div>No additional servers available to attach.</div>
            @endif
        </div>
    @endif
</div>
