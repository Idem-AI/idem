<div>
    {{-- Header --}}
    <div class="mb-6 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
        <div class="flex items-center justify-between gap-4 mb-2">
            <h1 class="text-2xl font-bold text-white">Create a new Application</h1>
            <div class="flex items-center gap-2">
                <x-modal-input buttonTitle="+ Add GitHub App" title="New GitHub App" closeOutside="false">
                    <livewire:source.github.create />
                </x-modal-input>
                @if ($repositories->count() > 0)
                    <a target="_blank" class="flex hover:no-underline" href="{{ getInstallationPath($github_app) }}">
                        <button class="outer-button">
                            Change Repositories on GitHub
                            <x-external-link />
                        </button>
                    </a>
                @endif
            </div>
        </div>
        <p class="text-sm text-gray-400">Deploy any public or private Git repositories through a GitHub App</p>
    </div>
    @if ($github_apps->count() !== 0)
        <div class="flex flex-col gap-2">
            @if ($current_step === 'github_apps')
                <h2 class="text-xl font-bold text-white mb-4">Select a Github App</h2>
                <div class="flex flex-col justify-center gap-2 text-left">
                    @foreach ($github_apps as $ghapp)
                        <div class="flex items-center gap-3">
                            <div class="flex-1 flex items-center gap-4 px-5 py-4 bg-[#0f1724] border border-gray-800 rounded-xl cursor-pointer hover:bg-[#151b2e] hover:border-blue-500/50 transition-all duration-200"
                                wire:click.prevent="loadRepositories({{ $ghapp->id }})"
                                wire:key="{{ $ghapp->id }}">
                                <div class="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                                    </svg>
                                </div>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-sm font-semibold text-white truncate">{{ data_get($ghapp, 'name') }}</span>
                                    <span class="text-xs text-gray-500 truncate">{{ data_get($ghapp, 'html_url') }}</span>
                                </div>
                                <svg class="w-4 h-4 text-gray-600 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </div>
                            <div class="flex flex-col items-center justify-center">
                                <x-loading wire:loading wire:target="loadRepositories({{ $ghapp->id }})" />
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif
            @if ($current_step === 'repository')
                @if ($repositories->count() > 0)
                    <div class="flex flex-col gap-2 pb-6">
                        <div class="flex gap-2">
                            <x-forms.select class="w-full" label="Repository" wire:model="selected_repository_id">
                                @foreach ($repositories as $repo)
                                    @if ($loop->first)
                                        <option selected value="{{ data_get($repo, 'id') }}">
                                            {{ data_get($repo, 'name') }}
                                        </option>
                                    @else
                                        <option value="{{ data_get($repo, 'id') }}">{{ data_get($repo, 'name') }}
                                        </option>
                                    @endif
                                @endforeach
                            </x-forms.select>
                        </div>
                        <x-forms.button wire:click.prevent="loadBranches"> Load Repository </x-forms.button>
                    </div>
                @else
                    <div>No repositories found. Check your GitHub App configuration.</div>
                @endif
                @if ($branches->count() > 0)
                    <h2 class="text-xl font-bold text-white mb-4">Configuration</h2>
                    <div class="flex flex-col gap-4">
                        <form class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50" wire:submit='submit'>
                            <div class="flex flex-col gap-2 pb-6">
                                <div class="flex gap-2">
                                    <x-forms.select id="selected_branch_name" label="Branch">
                                        <option value="default" disabled selected>Select a branch</option>
                                        @foreach ($branches as $branch)
                                            @if ($loop->first)
                                                <option selected value="{{ data_get($branch, 'name') }}">
                                                    {{ data_get($branch, 'name') }}
                                                </option>
                                            @else
                                                <option value="{{ data_get($branch, 'name') }}">
                                                    {{ data_get($branch, 'name') }}
                                                </option>
                                            @endif
                                        @endforeach
                                    </x-forms.select>
                                    <x-forms.select wire:model.live="build_pack" label="Build Pack" required>
                                        <option value="nixpacks">Nixpacks</option>
                                        <option value="static">Static</option>
                                        <option value="dockerfile">Dockerfile</option>
                                        <option value="dockercompose">Docker Compose</option>
                                    </x-forms.select>
                                    @if ($is_static)
                                        <x-forms.input id="publish_directory" label="Publish Directory"
                                            helper="If there is a build process involved (like Svelte, React, Next, etc..), please specify the output directory for the build assets." />
                                    @endif
                                </div>
                                @if ($build_pack === 'dockercompose')
                                    <div x-data="{ baseDir: '{{ $base_directory }}', composeLocation: '{{ $docker_compose_location }}' }" class="gap-2 flex flex-col">
                                        <x-forms.input placeholder="/" wire:model.blur="base_directory"
                                            label="Base Directory"
                                            helper="Directory to use as root. Useful for monorepos."
                                            x-model="baseDir" />
                                        <x-forms.input placeholder="/docker-compose.yaml"
                                            wire:model.blur="docker_compose_location" label="Docker Compose Location"
                                            helper="It is calculated together with the Base Directory."
                                            x-model="composeLocation" />
                                        <div class="pt-2">
                                            <span>
                                                Compose file location in your repository: </span><span
                                                class='dark:text-warning'
                                                x-text='(baseDir === "/" ? "" : baseDir) + (composeLocation.startsWith("/") ? composeLocation : "/" + composeLocation)'></span>
                                        </div>
                                    </div>
                                @else
                                    <x-forms.input wire:model="base_directory" label="Base Directory"
                                        helper="Directory to use as root. Useful for monorepos." />
                                @endif
                                @if ($show_is_static)
                                    <x-forms.input type="number" id="port" label="Port" :readonly="$is_static || $build_pack === 'static'"
                                        helper="The port your application listens on." />
                                    <div class="w-52">
                                        <x-forms.checkbox instantSave id="is_static" label="Is it a static site?"
                                            helper="If your application is a static site or the final build assets should be served as a static site, enable this." />
                                    </div>
                                @endif
                            </div>
                            <x-forms.button type="submit">
                                Continue
                            </x-forms.button>
                @endif
            @endif
        </div>
    @else
        <div class="hero">
            No GitHub Application found. Please create a new GitHub Application.
        </div>
    @endif
</div>
