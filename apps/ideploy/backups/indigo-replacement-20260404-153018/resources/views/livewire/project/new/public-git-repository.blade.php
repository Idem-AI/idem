<div x-data x-init="$nextTick(() => { if ($refs.autofocusInput) $refs.autofocusInput.focus(); })">
    {{-- Header --}}
    <div class="mb-6 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
        <h1 class="text-2xl font-bold text-white mb-2">Create a new Application</h1>
        <p class="text-sm text-gray-400">Deploy any public Git repository with automatic builds and deployments</p>
    </div>

    <!-- Repository URL Form -->
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
                            href="https://github.com/Idem-AI/ideploy-examples" target="_blank">iDeploy Examples</a>.
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

        <!-- Application Configuration Form -->
        <form class="flex flex-col gap-5 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50 mt-6" wire:submit='submit'>

            {{-- Section title --}}
            <div class="pb-1 border-b border-gray-800/60">
                <h2 class="text-base font-semibold text-white">Application Configuration</h2>
                <p class="text-xs text-gray-500 mt-0.5">Configure how your application will be built and deployed</p>
            </div>

            <div class="flex flex-col gap-4">
                {{-- Branch + re-check + Build Pack row --}}
                <div class="flex gap-3 items-end">
                    <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-300 mb-1.5">
                            Branch
                            <x-helper helper="Change the branch to deploy. Click the check button to verify it exists." />
                        </label>
                        <div class="flex gap-2">
                            <input
                                type="text"
                                wire:model="git_branch"
                                id="git_branch"
                                class="flex-1 bg-gray-900/80 border border-gray-700/60 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-all"
                                placeholder="main"
                            />
                            <button
                                type="button"
                                wire:click="loadBranch"
                                title="Re-check branch"
                                class="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700/60 text-gray-300 hover:text-white rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
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
            {{-- Continue button --}}
            <div class="pt-1">
                <button
                    type="submit"
                    wire:loading.attr="disabled"
                    class="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-px active:translate-y-0">
                    <span wire:loading.remove>Continue</span>
                    <span wire:loading class="flex items-center gap-2">
                        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Creating application...
                    </span>
                    <svg wire:loading.remove class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                    </svg>
                </button>
            </div>
        </form>
    @endif
</div>
