<div x-data x-init="$nextTick(() => { if ($refs.autofocusInput) $refs.autofocusInput.focus(); })">
    {{-- Header --}}
    <div class="mb-6 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
        <h1 class="text-2xl font-bold text-white mb-2">Create a new Application</h1>
        <p class="text-sm text-gray-400">Deploy any public Git repository with automatic builds and deployments</p>
    </div>

    <!-- Repository URL Form --}}
    <form class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50" wire:submit='loadBranch'>
        <div class="flex flex-col gap-4">
            <div class="flex gap-2 items-end">
                <x-forms.input required id="repository_url" label="Repository URL (https://)"
                    helper="{!! __('repository.url') !!}" autofocus />
                <button type="submit" class="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Check repository
                </button>
            </div>
            <div class="p-4 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg">
                <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <div class="text-sm text-gray-300">
                        For example application deployments, checkout <a class="text-[#4F46E5] hover:text-[#6366F1] underline font-medium"
                            href="https://github.com/coollabsio/ideploy-examples/" target="_blank">Ideploy Examples</a>.
                    </div>
                </div>
            </div>
        </div>
    </form>

    @if ($branchFound)
        @if ($rate_limit_remaining && $rate_limit_reset)
            <div class="flex gap-2 py-2">
                <div>Rate Limit</div>
                <x-helper
                    helper="Rate limit remaining: {{ $rate_limit_remaining }}<br>Rate limit reset at: {{ $rate_limit_reset }} UTC" />
            </div>
        @endif

        <!-- Application Configuration Form --}}
        <form class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50 mt-6" wire:submit='submit'>
            <div class="flex flex-col gap-2 pb-6">
                <div class="flex gap-2">
                    @if ($git_source === 'other')
                        <x-forms.input id="git_branch" label="Branch"
                            helper="You can select other branches after configuration is done." />
                    @else
                        <x-forms.input disabled id="git_branch" label="Branch"
                            helper="You can select other branches after configuration is done." />
                    @endif
                    <x-forms.select wire:model.live="build_pack" label="Build Pack" required>
                        <option value="nixpacks">Nixpacks</option>
                        <option value="static">Static</option>
                        <option value="dockerfile">Dockerfile</option>
                        <option value="dockercompose">Docker Compose</option>
                    </x-forms.select>
                    @if ($isStatic)
                        <x-forms.input id="publish_directory" label="Publish Directory"
                            helper="If there is a build process involved (like Svelte, React, Next, etc..), please specify the output directory for the build assets." />
                    @endif
                </div>
                @if ($build_pack === 'dockercompose')
                    <div x-data="{ baseDir: '{{ $base_directory }}', composeLocation: '{{ $docker_compose_location }}' }" class="gap-2 flex flex-col">
                        <x-forms.input placeholder="/" wire:model.blur="base_directory" label="Base Directory"
                            helper="Directory to use as root. Useful for monorepos." x-model="baseDir" />
                        <x-forms.input placeholder="/docker-compose.yaml" wire:model.blur="docker_compose_location"
                            label="Docker Compose Location" helper="It is calculated together with the Base Directory."
                            x-model="composeLocation" />
                        <div class="pt-2">
                            <span>
                                Compose file location in your repository: </span><span class='dark:text-warning'
                                x-text='(baseDir === "/" ? "" : baseDir) + (composeLocation.startsWith("/") ? composeLocation : "/" + composeLocation)'></span>
                        </div>
                    </div>
                @else
                    <x-forms.input wire:model="base_directory" label="Base Directory"
                        helper="Directory to use as root. Useful for monorepos." />
                @endif
                @if ($show_is_static)
                    <x-forms.input type="number" id="port" label="Port" :readonly="$isStatic || $build_pack === 'static'"
                        helper="The port your application listens on." />
                    <div class="w-64">
                        <x-forms.checkbox instantSave id="isStatic" label="Is it a static site?"
                            helper="If your application is a static site or the final build assets should be served as a static site, enable this." />
                    </div>
                @endif
            </div>
            <x-forms.button type="submit">
                Continue
            </x-forms.button>
        </form>
    @endif
</div>
