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
                <x-section-header 
                    title="Configuration"
                    description="Environment variable settings">
                    <x-slot:icon>
                        <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        </svg>
                    </x-slot:icon>
                </x-section-header>
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
            <x-info-card type="warning" title="Note">
                <x-slot:icon>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M240.26 186.1L152.81 34.23a28.74 28.74 0 0 0-49.62 0L15.74 186.1a27.45 27.45 0 0 0 0 27.71A28.31 28.31 0 0 0 40.55 228h174.9a28.31 28.31 0 0 0 24.79-14.19a27.45 27.45 0 0 0 .02-27.71m-20.8 15.7a4.46 4.46 0 0 1-4 2.2H40.55a4.46 4.46 0 0 1-4-2.2a3.56 3.56 0 0 1 0-3.73L124 46.2a4.77 4.77 0 0 1 8 0l87.44 151.87a3.56 3.56 0 0 1 .02 3.73M116 136v-32a12 12 0 0 1 24 0v32a12 12 0 0 1-24 0m28 40a16 16 0 1 1-16-16a16 16 0 0 1 16 16" />
                    </svg>
                </x-slot:icon>
                Hardcoded variables are not shown here.
            </x-info-card>
        @endif

        {{-- Production Variables Section --}}
        @if ($view === 'normal')
            <div class="glass-card p-6">
                <x-section-header 
                    title="Production Environment Variables"
                    description="Environment (secrets) variables for Production">
                    <x-slot:icon>
                        <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </x-slot:icon>
                </x-section-header>
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
