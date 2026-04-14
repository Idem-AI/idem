<div x-data x-init="$nextTick(() => { if ($refs.autofocusInput) $refs.autofocusInput.focus(); })">
    {{-- Header --}}
    <div class="mb-6 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
        <div class="flex items-center gap-3 mb-2">
            <div class="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
            </div>
            <div>
                <h1 class="text-2xl font-bold text-white">Create a new Application</h1>
                <p class="text-sm text-gray-400">Deploy any public Git repository with automatic builds and deployments</p>
            </div>
        </div>
    </div>

    {{-- Repository URL Form --}}
    <form class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50" wire:submit='loadBranch'>
        <div class="flex flex-col gap-4">
            {{-- URL input + Check button --}}
            <div class="flex gap-3 items-end">
                <div class="flex-1">
                    <x-forms.input required id="repository_url" label="Repository URL (https://)"
                        helper="{!! __('repository.url') !!}" autofocus />
                </div>
                <button type="submit" class="inner-button px-5 py-2.5 flex items-center gap-2 whitespace-nowrap">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Check repository
                </button>
            </div>

            {{-- Info hint --}}
            <div class="flex items-start gap-3 px-4 py-3 bg-[#0a0e1a] border border-gray-800 rounded-lg">
                <svg class="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="text-sm text-gray-400">
                    For example application deployments, checkout
                    <a class="text-blue-400 hover:text-blue-300 underline font-medium"
                        href="https://github.com/Idem-AI/ideploy-examples" target="_blank">iDeploy Examples</a>.
                </p>
            </div>
        </div>
    </form>

    @if ($branchFound)
        @if ($rate_limit_remaining && $rate_limit_reset)
            <div class="flex items-center gap-2 mt-4 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-400">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                Rate limit
                <x-helper helper="Rate limit remaining: {{ $rate_limit_remaining }}<br>Rate limit reset at: {{ $rate_limit_reset }} UTC" />
            </div>
        @endif

        {{-- Application Configuration Form --}}
        <form class="flex flex-col gap-5 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50 mt-4" wire:submit='submit'>

            {{-- Section header --}}
            <div class="flex items-center gap-3 pb-4 border-b border-gray-800/60">
                <div class="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                </div>
                <div>
                    <h2 class="text-sm font-semibold text-white">Application Configuration</h2>
                    <p class="text-xs text-gray-500">Configure how your application will be built and deployed</p>
                </div>
            </div>

            <div class="flex flex-col gap-4">
                {{-- Branch + re-check + Build Pack row --}}
                <div class="flex gap-3 items-end">
                    <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                            Branch
                            <x-helper helper="Change the branch to deploy. Click the check button to verify it exists." />
                        </label>
                        <div class="flex gap-2">
                            <x-forms.input id="git_branch" wire:model="git_branch" placeholder="main" class="flex-1" />
                            <button type="button" wire:click="loadBranch" title="Re-check branch"
                                class="outer-button px-4 py-2.5 flex items-center gap-1.5 whitespace-nowrap">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                </svg>
                                Check
                            </button>
                        </div>
                    </div>
                    <div class="flex-1">
                        <x-forms.select wire:model.live="build_pack" label="Build Pack" required>
                            <option value="nixpacks">Nixpacks</option>
                            <option value="static">Static</option>
                            <option value="dockerfile">Dockerfile</option>
                            <option value="dockercompose">Docker Compose</option>
                        </x-forms.select>
                    </div>
                    @if ($isStatic)
                        <div class="flex-1">
                            <x-forms.input id="publish_directory" label="Publish Directory"
                                helper="Output directory for build assets (e.g. /dist, /build)." />
                        </div>
                    @endif
                </div>

                @if ($build_pack === 'dockercompose')
                    <div x-data="{ baseDir: '{{ $base_directory }}', composeLocation: '{{ $docker_compose_location }}' }" class="flex flex-col gap-3">
                        <x-forms.input placeholder="/" wire:model.blur="base_directory" label="Base Directory"
                            helper="Directory to use as root. Useful for monorepos." x-model="baseDir" />
                        <x-forms.input placeholder="/docker-compose.yaml" wire:model.blur="docker_compose_location"
                            label="Docker Compose Location" helper="It is calculated together with the Base Directory."
                            x-model="composeLocation" />
                        <div class="flex items-center gap-2 px-3 py-2 bg-[#0a0e1a] border border-gray-800 rounded-lg text-xs text-gray-400">
                            <svg class="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            Compose location:
                            <span class="text-yellow-400 font-medium"
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
                    <x-forms.checkbox instantSave id="isStatic" label="Is it a static site?"
                        helper="If your application is a static site or the final build assets should be served as a static site, enable this." />
                @endif
            </div>

            {{-- Continue button --}}
            <div class="pt-2 border-t border-gray-800/60">
                <button type="submit" wire:loading.attr="disabled"
                    class="inner-button w-full py-3 flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed">
                    <span wire:loading.remove class="flex items-center gap-2">
                        Continue
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                        </svg>
                    </span>
                    <span wire:loading class="flex items-center gap-2">
                        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Creating application...
                    </span>
                </button>
            </div>
        </form>
    @endif
</div>
