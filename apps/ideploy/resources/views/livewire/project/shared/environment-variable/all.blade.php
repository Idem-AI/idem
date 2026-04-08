<div>
    {{-- Header Idem Style --}}
    <div class="mb-10">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div class="flex items-center gap-4">
                <div class="button-icon glow-accent">
                    <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-3xl font-bold text-text-primary tracking-tight">
                        <span class="i-underline">Environment Variables</span>
                    </h2>
                    <p class="text-sm text-text-secondary mt-1">Manage secrets and configuration for this resource</p>
                </div>
            </div>
            @can('manageEnvironment', $resource)
                <div class="flex items-center gap-3">
                    <x-modal-input buttonTitle="+ Add" title="New Environment Variable" :closeOutside="false">
                        <livewire:project.shared.environment-variable.add />
                    </x-modal-input>
                    <button wire:click='switch' class="outer-button button-sm">{{ $view === 'normal' ? 'Developer view' : 'Normal view' }}</button>
                </div>
            @endcan
        </div>
    </div>

    <div class="flex flex-col gap-6">
        {{-- Settings Section --}}
        @if ($resourceClass === 'App\Models\Application')
            <div class="glass-card p-6">
                <div class="flex items-center gap-3 mb-6">
                    <span class="tag text-accent border-accent/20">Configuration</span>
                    <h3 class="text-xl font-semibold text-text-primary">Environment Variable Settings</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                @if (data_get($resource, 'build_pack') !== 'dockercompose')
                    <div class="space-y-2">
                        @can('manageEnvironment', $resource)
                            <x-forms.checkbox id="is_env_sorting_enabled" label="Sort alphabetically"
                                helper="Turn this off if one environment is dependent on another."
                                instantSave></x-forms.checkbox>
                        @else
                            <x-forms.checkbox id="is_env_sorting_enabled" label="Sort alphabetically"
                                helper="Turn this off if one environment is dependent on another."
                                disabled></x-forms.checkbox>
                        @endcan
                    </div>
                @endif
                <div class="space-y-2">
                    @can('manageEnvironment', $resource)
                        <x-forms.checkbox id="use_build_secrets" label="Use Docker Build Secrets"
                            helper="Enable Docker BuildKit secrets for enhanced security during builds."
                            instantSave></x-forms.checkbox>
                    @else
                        <x-forms.checkbox id="use_build_secrets" label="Use Docker Build Secrets"
                            helper="Enable Docker BuildKit secrets for enhanced security during builds."
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
            <div class="glass-card p-8">
                <x-section-header 
                    title="Production Environment Variables"
                    description="Secrets and configuration for Production environment">
                    <x-slot:icon>
                        <div class="p-2 bg-accent/10 rounded-lg">
                            <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </x-slot:icon>
                </x-section-header>
                
                <div class="mt-6 flex flex-col gap-2">
                    @forelse ($this->environmentVariables as $env)
                        <livewire:project.shared.environment-variable.show wire:key="environment-{{ $env->id }}"
                            :env="$env" :type="$resource->type()" />
                    @empty
                        <div class="text-center py-12 glass shadow-inner rounded-2xl border-dashed border-2 border-white/5">
                            <p class="text-text-tertiary">No environment variables found.</p>
                        </div>
                    @endforelse
                </div>
            </div>
            {{-- Preview Variables Section --}}
            @if ($resource->type() === 'application' && $resource->environment_variables_preview->count() > 0 && $showPreview)
                <div class="glass-card p-8">
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-text-primary flex items-center gap-2">
                            <span class="w-2 h-2 bg-accent rounded-full pulse-glow"></span>
                            Preview Deployments Environment Variables
                        </h3>
                        <p class="text-sm text-text-secondary mt-1 ml-4">Secrets and configuration for Preview environments.</p>
                    </div>
                    <div class="flex flex-col gap-2">
                        @foreach ($this->environmentVariablesPreview as $env)
                            <livewire:project.shared.environment-variable.show wire:key="environment-{{ $env->id }}"
                                :env="$env" :type="$resource->type()" />
                        @endforeach
                    </div>
                </div>
            @endif
        @else
            {{-- Developer View --}}
            <div class="glass-card p-8">
                <div class="mb-6">
                    <h3 class="text-xl font-bold text-text-primary">Developer View</h3>
                    <p class="text-sm text-text-secondary mt-1">Bulk manage environment variables in .env format.</p>
                </div>
                <form wire:submit.prevent='submit' class="flex flex-col gap-6">
                    @can('manageEnvironment', $resource)
                        <x-forms.textarea rows="12" class="whitespace-pre-wrap font-mono text-sm" id="variables" wire:model="variables"
                            label="Production Environment Variables"></x-forms.textarea>

                        @if ($showPreview)
                            <x-forms.textarea rows="12" class="whitespace-pre-wrap font-mono text-sm"
                                label="Preview Deployments Environment Variables" id="variablesPreview"
                                wire:model="variablesPreview"></x-forms.textarea>
                        @endif

                        <div class="flex justify-end mt-2">
                            <x-forms.button type="submit" class="inner-button w-full md:w-auto">Save All Variables</x-forms.button>
                        </div>
                    @else
                        <x-forms.textarea rows="12" class="whitespace-pre-wrap font-mono text-sm" id="variables" wire:model="variables"
                            label="Production Environment Variables" disabled></x-forms.textarea>

                        @if ($showPreview)
                            <x-forms.textarea rows="12" class="whitespace-pre-wrap font-mono text-sm"
                                label="Preview Deployments Environment Variables" id="variablesPreview"
                                wire:model="variablesPreview" disabled></x-forms.textarea>
                        @endif
                    @endcan
                </form>
            </div>
        @endif
    </div>
</div>
