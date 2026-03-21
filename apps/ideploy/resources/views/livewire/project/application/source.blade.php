<div>
    {{-- Header Idem Style --}}
    <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
                <div class="icon-container">
                    <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-light">
                        <span class="i-underline">Git Source</span>
                    </h2>
                    <p class="text-sm text-light opacity-70 mt-1">Manage your application's code repository</p>
                </div>
            </div>
            @can('update', $application)
                <button form="sourceForm" type="submit" class="inner-button">
                    <svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                </button>
            @endcan
        </div>
    </div>

    <form wire:submit='submit' id="sourceForm" class="flex flex-col gap-6">
        {{-- Quick Links --}}
        <div class="section-card">
            <div class="flex items-center gap-2 mb-4">
                <span class="category-badge">Quick Links</span>
                <h3 class="text-lg font-semibold text-light">Repository Links</h3>
            </div>
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
        <div class="section-card">
            <div class="flex items-center gap-2 mb-4">
                <span class="category-badge">Configuration</span>
                <h3 class="text-lg font-semibold text-light">Repository Configuration</h3>
            </div>
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
            <div class="section-card">
                <div class="flex items-center gap-2 mb-4">
                    <span class="category-badge">Security</span>
                    <h3 class="text-lg font-semibold text-light">Deploy Key</h3>
                </div>
                <div class="text-sm text-light opacity-70 mb-4">
                    Currently attached Private Key: <span class="font-semibold text-warning">{{ $privateKeyName }}</span>
                </div>

                @can('update', $application)
                    <h4 class="text-sm font-medium text-light mb-2">Select another Private Key</h4>
                    <div class="flex flex-wrap gap-2">
                    @foreach ($privateKeys as $key)
                        <button wire:click="setPrivateKey('{{ $key->id }}')" class="outer-button">{{ $key->name }}</button>
                    @endforeach
                </div>
            @endcan
        @else
            @can('update', $application)
                <div class="section-card">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="category-badge">Source</span>
                        <h3 class="text-lg font-semibold text-light">Change Git Source</h3>
                    </div>
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
