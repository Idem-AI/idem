<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-2xl font-bold text-light">
                <span class="i-underline">Environment Variables</span>
            </h2>
            @can('manageEnvironment', $resource)
                <div class="flex items-center gap-2">
                    <x-modal-input buttonTitle="+ Add" title="New Environment Variable" :closeOutside="false">
                        <livewire:project.shared.environment-variable.add />
                    </x-modal-input>
                    <x-forms.button wire:click='switch'>{{ $view === 'normal' ? 'Developer view' : 'Normal view' }}</x-forms.button>
                </div>
            @endcan
        </div>
        <p class="text-sm text-light opacity-70">Environment variables (secrets) for this resource.</p>
    </div>

    <div class="flex flex-col gap-6">
        {{-- Settings Section --}}
        @if ($resourceClass === 'App\Models\Application')
            <div class="glass-card p-6">
                <h3 class="text-lg font-semibold text-accent mb-4">Configuration</h3>
                <div class="flex flex-col gap-3">
                @if (data_get($resource, 'build_pack') !== 'dockercompose')
                    <div class="w-64">
                        @can('manageEnvironment', $resource)
                            <x-forms.checkbox id="is_env_sorting_enabled" label="Sort alphabetically"
                                helper="Turn this off if one environment is dependent on another. It will be sorted by creation order (like you pasted them or in the order you created them)."
                                instantSave></x-forms.checkbox>
                        @else
                            <x-forms.checkbox id="is_env_sorting_enabled" label="Sort alphabetically"
                                helper="Turn this off if one environment is dependent on another. It will be sorted by creation order (like you pasted them or in the order you created them)."
                                disabled></x-forms.checkbox>
                        @endcan
                    </div>
                @endif
                <div>
                    @can('manageEnvironment', $resource)
                        <x-forms.checkbox id="use_build_secrets" label="Use Docker Build Secrets"
                            helper="Enable Docker BuildKit secrets for enhanced security during builds. Secrets won't be exposed in the final image. Requires Docker 18.09+ with BuildKit support."
                            instantSave></x-forms.checkbox>
                    @else
                        <x-forms.checkbox id="use_build_secrets" label="Use Docker Build Secrets"
                            helper="Enable Docker BuildKit secrets for enhanced security during builds. Secrets won't be exposed in the final image. Requires Docker 18.09+ with BuildKit support."
                            disabled></x-forms.checkbox>
                    @endcan
                </div>
                </div>
            </div>
        @endif
        
        {{-- Warning for Hardcoded Variables --}}
        @if ($resource->type() === 'service' || $resource?->build_pack === 'dockercompose')
            <div class="glass-card p-4 bg-warning/10">
                <div class="flex items-center gap-2 text-warning">
                <svg class="hidden w-4 h-4 dark:text-warning lg:block" viewBox="0 0 256 256"
                    xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor"
                        d="M240.26 186.1L152.81 34.23a28.74 28.74 0 0 0-49.62 0L15.74 186.1a27.45 27.45 0 0 0 0 27.71A28.31 28.31 0 0 0 40.55 228h174.9a28.31 28.31 0 0 0 24.79-14.19a27.45 27.45 0 0 0 .02-27.71m-20.8 15.7a4.46 4.46 0 0 1-4 2.2H40.55a4.46 4.46 0 0 1-4-2.2a3.56 3.56 0 0 1 0-3.73L124 46.2a4.77 4.77 0 0 1 8 0l87.44 151.87a3.56 3.56 0 0 1 .02 3.73M116 136v-32a12 12 0 0 1 24 0v32a12 12 0 0 1-24 0m28 40a16 16 0 1 1-16-16a16 16 0 0 1 16 16">
                    </path>
                </svg>
                    <span class="text-sm font-medium">Hardcoded variables are not shown here.</span>
                </div>
            </div>
        @endif

        {{-- Production Variables Section --}}
        @if ($view === 'normal')
            <div class="glass-card p-6">
                <div class="mb-4">
                    <h3 class="text-lg font-semibold text-accent mb-1">Production Environment Variables</h3>
                    <p class="text-sm text-light opacity-60">Environment (secrets) variables for Production.</p>
                </div>
                @forelse ($this->environmentVariables as $env)
                    <livewire:project.shared.environment-variable.show wire:key="environment-{{ $env->id }}"
                        :env="$env" :type="$resource->type()" />
                @empty
                    <div class="text-center py-8 text-light opacity-60">
                        <p>No environment variables found.</p>
                    </div>
                @endforelse
            </div>
            {{-- Preview Variables Section --}}
            @if ($resource->type() === 'application' && $resource->environment_variables_preview->count() > 0 && $showPreview)
                <div class="glass-card p-6">
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold text-accent mb-1">Preview Deployments Environment Variables</h3>
                        <p class="text-sm text-light opacity-60">Environment (secrets) variables for Preview Deployments.</p>
                    </div>
                    @foreach ($this->environmentVariablesPreview as $env)
                        <livewire:project.shared.environment-variable.show wire:key="environment-{{ $env->id }}"
                            :env="$env" :type="$resource->type()" />
                    @endforeach
                </div>
            @endif
        @else
            {{-- Developer View --}}
            <div class="glass-card p-6">
                <form wire:submit.prevent='submit' class="flex flex-col gap-4">
            @can('manageEnvironment', $resource)
                <x-forms.textarea rows="10" class="whitespace-pre-wrap" id="variables" wire:model="variables"
                    label="Production Environment Variables"></x-forms.textarea>

                @if ($showPreview)
                    <x-forms.textarea rows="10" class="whitespace-pre-wrap"
                        label="Preview Deployments Environment Variables" id="variablesPreview"
                        wire:model="variablesPreview"></x-forms.textarea>
                @endif

                    <x-forms.button type="submit" class="btn btn-primary">Save All Environment Variables</x-forms.button>
                @else
                    <x-forms.textarea rows="10" class="whitespace-pre-wrap" id="variables" wire:model="variables"
                        label="Production Environment Variables" disabled></x-forms.textarea>

                    @if ($showPreview)
                        <x-forms.textarea rows="10" class="whitespace-pre-wrap"
                            label="Preview Deployments Environment Variables" id="variablesPreview"
                            wire:model="variablesPreview" disabled></x-forms.textarea>
                    @endif
                @endcan
                </form>
            </div>
        @endif
    </div>
</div>
