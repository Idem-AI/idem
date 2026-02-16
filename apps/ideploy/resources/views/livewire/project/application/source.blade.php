<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-2xl font-bold text-light">
                <span class="i-underline">Git Source</span>
            </h2>
            @can('update', $application)
                <x-forms.button form="sourceForm" type="submit">Save</x-forms.button>
            @endcan
        </div>
        <p class="text-sm text-light opacity-70">Code source of your application.</p>
    </div>

    <form wire:submit='submit' id="sourceForm" class="flex flex-col gap-6">
        {{-- Quick Links --}}
        <div class="glass-card p-4">
            <div class="flex flex-wrap items-center gap-4">
                <a target="_blank" class="hover:no-underline flex items-center gap-1"
                    href="{{ $application?->gitBranchLocation }}">
                    Open Repository
                    <x-external-link />
                </a>
                @if (data_get($application, 'source.is_public') === false)
                    <a target="_blank" class="hover:no-underline flex items-center gap-1"
                        href="{{ getInstallationPath($application->source) }}">
                        Open Git App
                        <x-external-link />
                    </a>
                @endif
                <a target="_blank" class="flex hover:no-underline items-center gap-1"
                    href="{{ $application?->gitCommits }}">
                    Open Commits on Git
                    <x-external-link />
                </a>
            </div>
        </div>

        {{-- Repository Configuration --}}
        <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-accent mb-4">Repository Configuration</h3>
            <div class="flex flex-col gap-3">
                @if (!$privateKeyId)
                    <div class="text-sm text-light opacity-70 mb-2">
                        Currently connected source: <span class="font-semibold text-warning">{{ data_get($application, 'source.name', 'No source connected') }}</span>
                    </div>
                @endif
                <div class="flex gap-2">
                <x-forms.input placeholder="coollabsio/coolify-example" id="gitRepository" label="Repository"
                    canGate="update" :canResource="$application" />
                    <x-forms.input placeholder="main" id="gitBranch" label="Branch" canGate="update" :canResource="$application" />
                </div>
                <div class="flex items-end gap-2">
                <x-forms.input placeholder="HEAD" id="gitCommitSha" placeholder="HEAD" label="Commit SHA"
                        canGate="update" :canResource="$application" />
                </div>
            </div>
        </div>

        {{-- Deploy Key Section --}}
        @if ($privateKeyId)
            <div class="glass-card p-6">
                <h3 class="text-lg font-semibold text-accent mb-4">Deploy Key</h3>
                <div class="text-sm text-light opacity-70 mb-4">
                    Currently attached Private Key: <span class="font-semibold text-warning">{{ $privateKeyName }}</span>
                </div>

                @can('update', $application)
                    <h4 class="text-sm font-medium text-light mb-2">Select another Private Key</h4>
                    <div class="flex flex-wrap gap-2">
                    @foreach ($privateKeys as $key)
                        <x-forms.button wire:click="setPrivateKey('{{ $key->id }}')">{{ $key->name }}
                        </x-forms.button>
                    @endforeach
                </div>
            @endcan
        @else
            @can('update', $application)
                <div class="glass-card p-6">
                    <h3 class="text-lg font-semibold text-accent mb-4">Change Git Source</h3>
                    <div class="grid grid-cols-1 gap-2">
                        @forelse ($sources as $source)
                            <div wire:key="{{ $source->name }}">
                                <x-modal-confirmation title="Change Git Source" :actions="['Change git source to ' . $source->name]" :buttonFullWidth="true"
                                    :isHighlightedButton="$application->source_id === $source->id" :disabled="$application->source_id === $source->id"
                                    submitAction="changeSource({{ $source->id }}, {{ $source->getMorphClass() }})"
                                    :confirmWithText="true" confirmationText="Change Git Source"
                                    confirmationLabel="Please confirm changing the git source by entering the text below"
                                    shortConfirmationLabel="Confirmation Text" :confirmWithPassword="false">
                                    <x-slot:customButton>
                                        <div class="flex items-center gap-2">
                                            <div class="box-title">
                                                {{ $source->name }}
                                                @if ($application->source_id === $source->id)
                                                    <span class="text-xs">(current)</span>
                                                @endif
                                            </div>
                                            <div class="box-description">
                                                {{ $source->organization ?? 'Personal Account' }}
                                            </div>
                                        </div>
                                    </x-slot:customButton>
                                </x-modal-confirmation>
                            </div>
                        @empty
                            <div>No other sources found</div>
                        @endforelse
                    </div>
                </div>
            @endcan
        @endif
    </form>
</div>
