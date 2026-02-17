<div x-data="{
    initLoadingCompose: $wire.entangle('initLoadingCompose'),
    canUpdate: @js(auth()->user()->can('update', $application)),
    shouldDisable() {
        return this.initLoadingCompose || !this.canUpdate;
    },
    // Accordion state - only essential sections open by default
    sections: {
        basic: true,
        build: false,
        domains: false,
        registry: false,
        network: false,
        labels: false,
        deployment: false,
        advanced: false
    },
    toggleSection(section) {
        this.sections[section] = !this.sections[section];
    }
}">
    <form wire:submit='submit' class="max-w-6xl pb-32">
        {{-- Header Sticky Idem Style --}}
        <div class="sticky top-0 z-20 glass-card -mx-4 px-6 py-5 mb-8 border-b border-glass">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-light">
                        <span class="i-underline">General Configuration</span>
                    </h1>
                    <p class="text-sm text-light opacity-70 mt-1.5">Configure your application's core settings and deployment options</p>
                </div>
                @can('update', $application)
                    <button type="submit" class="inner-button">
                        <svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                    </button>
                @endcan
            </div>
        </div>

        <div class="space-y-8">
            {{-- Section: Application URLs --}}
            @php
                $hasUrls = (data_get($application, 'fqdn') || 
                           collect(json_decode($application->docker_compose_domains))->count() > 0 ||
                           data_get($application, 'previews', collect([]))->count() > 0 ||
                           data_get($application, 'ports_mappings_array')) &&
                           data_get($application, 'settings.is_raw_compose_deployment_enabled') !== true;
            @endphp
            
            @if ($hasUrls)
                <div class="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-xl p-6">
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                            </svg>
                            🔗 Application URLs
                        </h3>
                        <p class="text-sm text-gray-400 mt-1">Active URLs and endpoints for your application</p>
                    </div>

                    <div class="grid grid-cols-1 gap-3">
                        {{-- Git Repository Link --}}
                        @if (data_get($application, 'gitBranchLocation'))
                            <a target="_blank" href="{{ $application->gitBranchLocation }}" 
                               class="group flex items-center gap-3 p-4 bg-gray-900/50 hover:bg-gray-900/70 border border-gray-700 hover:border-gray-600 rounded-lg transition-all">
                                <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 group-hover:bg-gray-700 transition-colors">
                                    <x-git-icon git="{{ $application->source?->getMorphClass() }}" class="w-5 h-5" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium text-white group-hover:text-green-400 transition-colors">Git Repository</div>
                                    <div class="text-xs text-gray-400 truncate">{{ $application->gitBranchLocation }}</div>
                                </div>
                                <svg class="w-5 h-5 text-gray-500 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                </svg>
                            </a>
                        @endif

                        {{-- Docker Compose Domains --}}
                        @if (data_get($application, 'build_pack') === 'dockercompose')
                            @foreach (collect(json_decode($application->docker_compose_domains)) as $fqdn)
                                @if (data_get($fqdn, 'domain'))
                                    @foreach (explode(',', data_get($fqdn, 'domain')) as $domain)
                                        <a target="_blank" href="{{ getFqdnWithoutPort($domain) }}" 
                                           class="group flex items-center gap-3 p-4 bg-gray-900/50 hover:bg-gray-900/70 border border-gray-700 hover:border-green-500 rounded-lg transition-all">
                                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                                                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                                                </svg>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-medium text-white group-hover:text-green-400 transition-colors">Application URL</div>
                                                <div class="text-xs text-gray-400 truncate">{{ getFqdnWithoutPort($domain) }}</div>
                                            </div>
                                            <svg class="w-5 h-5 text-gray-500 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                            </svg>
                                        </a>
                                    @endforeach
                                @endif
                            @endforeach
                        @endif

                        {{-- Regular FQDN --}}
                        @if (data_get($application, 'fqdn'))
                            @foreach (str(data_get($application, 'fqdn'))->explode(',') as $fqdn)
                                <a target="_blank" href="{{ getFqdnWithoutPort($fqdn) }}" 
                                   class="group flex items-center gap-3 p-4 bg-gray-900/50 hover:bg-gray-900/70 border border-gray-700 hover:border-green-500 rounded-lg transition-all">
                                    <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                                        <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                                        </svg>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-sm font-medium text-white group-hover:text-green-400 transition-colors">Application URL</div>
                                        <div class="text-xs text-gray-400 truncate">{{ getFqdnWithoutPort($fqdn) }}</div>
                                    </div>
                                    <svg class="w-5 h-5 text-gray-500 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                    </svg>
                                </a>
                            @endforeach
                        @endif

                        {{-- Preview Deployments --}}
                        @if (data_get($application, 'previews', collect())->count() > 0)
                            <div class="pt-2 border-t border-gray-700">
                                <div class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 px-1">Preview Deployments</div>
                                @if (data_get($application, 'build_pack') === 'dockercompose')
                                    @foreach ($application->previews as $preview)
                                        @foreach (collect(json_decode($preview->docker_compose_domains)) as $fqdn)
                                            @if (data_get($fqdn, 'domain'))
                                                @foreach (explode(',', data_get($fqdn, 'domain')) as $domain)
                                                    <a target="_blank" href="{{ getFqdnWithoutPort($domain) }}" 
                                                       class="group flex items-center gap-3 p-4 bg-purple-900/10 hover:bg-purple-900/20 border border-purple-500/30 hover:border-purple-500 rounded-lg transition-all mb-2">
                                                        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                                                            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                                            </svg>
                                                        </div>
                                                        <div class="flex-1 min-w-0">
                                                            <div class="text-sm font-medium text-white group-hover:text-purple-400 transition-colors">
                                                                PR #{{ data_get($preview, 'pull_request_id') }}
                                                            </div>
                                                            <div class="text-xs text-gray-400 truncate">{{ getFqdnWithoutPort($domain) }}</div>
                                                        </div>
                                                        <svg class="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                                        </svg>
                                                    </a>
                                                @endforeach
                                            @endif
                                        @endforeach
                                    @endforeach
                                @else
                                    @foreach (data_get($application, 'previews') as $preview)
                                        @if (data_get($preview, 'fqdn'))
                                            <a target="_blank" href="{{ getFqdnWithoutPort(data_get($preview, 'fqdn')) }}" 
                                               class="group flex items-center gap-3 p-4 bg-purple-900/10 hover:bg-purple-900/20 border border-purple-500/30 hover:border-purple-500 rounded-lg transition-all mb-2">
                                                <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                                                    <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                                    </svg>
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <div class="text-sm font-medium text-white group-hover:text-purple-400 transition-colors">
                                                        PR #{{ data_get($preview, 'pull_request_id') }}
                                                    </div>
                                                    <div class="text-xs text-gray-400 truncate">{{ data_get($preview, 'fqdn') }}</div>
                                                </div>
                                                <svg class="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                                </svg>
                                            </a>
                                        @endif
                                    @endforeach
                                @endif
                            </div>
                        @endif

                        {{-- Port Mappings --}}
                        @if (data_get($application, 'ports_mappings_array'))
                            <div class="pt-2 border-t border-gray-700">
                                <div class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 px-1">Port Mappings</div>
                                @foreach ($application->ports_mappings_array as $port)
                                    @if ($application->destination->server->id === 0)
                                        <a target="_blank" href="http://localhost:{{ explode(':', $port)[0] }}" 
                                           class="group flex items-center gap-3 p-4 bg-gray-900/50 hover:bg-gray-900/70 border border-gray-700 hover:border-cyan-500 rounded-lg transition-all mb-2">
                                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                                                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                </svg>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">Port {{ $port }}</div>
                                                <div class="text-xs text-gray-400 truncate">http://localhost:{{ explode(':', $port)[0] }}</div>
                                            </div>
                                            <svg class="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                            </svg>
                                        </a>
                                    @else
                                        <a target="_blank" href="http://{{ $application->destination->server->ip }}:{{ explode(':', $port)[0] }}" 
                                           class="group flex items-center gap-3 p-4 bg-gray-900/50 hover:bg-gray-900/70 border border-gray-700 hover:border-cyan-500 rounded-lg transition-all mb-2">
                                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                                                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                                                </svg>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">Server Port</div>
                                                <div class="text-xs text-gray-400 truncate">{{ $application->destination->server->ip }}:{{ explode(':', $port)[0] }}</div>
                                            </div>
                                            <svg class="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                            </svg>
                                        </a>
                                        @if (count($application->additional_servers) > 0)
                                            @foreach ($application->additional_servers as $server)
                                                <a target="_blank" href="http://{{ $server->ip }}:{{ explode(':', $port)[0] }}" 
                                                   class="group flex items-center gap-3 p-4 bg-gray-900/50 hover:bg-gray-900/70 border border-gray-700 hover:border-cyan-500 rounded-lg transition-all mb-2">
                                                    <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                                                        <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                                                        </svg>
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">Additional Server</div>
                                                        <div class="text-xs text-gray-400 truncate">{{ $server->ip }}:{{ explode(':', $port)[0] }}</div>
                                                    </div>
                                                    <svg class="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                                    </svg>
                                                </a>
                                            @endforeach
                                        @endif
                                    @endif
                                @endforeach
                            </div>
                        @endif
                    </div>
                </div>
            @endif

            {{-- Section: Basic Information --}}
            <div class="glass-card overflow-hidden hover:border-accent/30 transition-colors">
                <button type="button" @click="toggleSection('basic')" class="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                            <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div class="text-left">
                            <h3 class="text-lg font-semibold text-light">Basic Information</h3>
                            <p class="text-xs text-light opacity-60">Application name and description</p>
                        </div>
                    </div>
                    <svg class="w-5 h-5 text-light transition-transform" :class="sections.basic ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                
                <div x-show="sections.basic" x-collapse class="px-6 pb-6">
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        <x-forms.input x-bind:disabled="shouldDisable()" id="name" label="Name" required />
                        <x-forms.input x-bind:disabled="shouldDisable()" id="description" label="Description" />
                    </div>
                </div>
            </div>

            {{-- Section: Build Configuration --}}
            @if (!$application->dockerfile && $application->build_pack !== 'dockerimage')
                <div class="glass-card p-6 hover:border-accent/30 transition-colors">
                    <x-section-header 
                        title="Build Pack"
                        description="Choose how to build your application">
                        <x-slot:icon>
                            <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </x-slot:icon>
                    </x-section-header>

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <x-forms.select x-bind:disabled="shouldDisable()" wire:model.live="build_pack" label="Build Pack" required>
                            <option value="nixpacks">Nixpacks</option>
                            <option value="buildpacks">Cloud Native Buildpacks</option>
                            <option value="static">Static</option>
                            <option value="dockerfile">Dockerfile</option>
                            <option value="dockercompose">Docker Compose</option>
                        </x-forms.select>
                        
                        @if ($application->settings->is_static || $application->build_pack === 'static')
                            <x-forms.select x-bind:disabled="!canUpdate" id="static_image" label="Static Image" required>
                                <option value="nginx:alpine">nginx:alpine</option>
                                <option disabled value="apache:alpine">apache:alpine</option>
                            </x-forms.select>
                        @endif
                    </div>

                    @if ($application->could_set_build_commands())
                        <div class="mt-6 space-y-3">
                            <x-forms.checkbox instantSave id="is_static" label="Is it a static site?"
                                helper="If your application is a static site or the final build assets should be served as a static site, enable this."
                                x-bind:disabled="!canUpdate" />
                            
                            @if ($application->settings->is_static && $application->build_pack !== 'static')
                                <x-forms.checkbox label="Is it a SPA (Single Page Application)?"
                                    helper="If your application is a SPA, enable this." id="is_spa" instantSave
                                    x-bind:disabled="!canUpdate"></x-forms.checkbox>
                            @endif
                        </div>
                    @endif

                    @if ($application->settings->is_static || $application->build_pack === 'static')
                        <div class="mt-6">
                            <x-forms.textarea id="custom_nginx_configuration"
                                placeholder="Empty means default configuration will be used." 
                                label="Custom Nginx Configuration"
                                helper="You can add custom Nginx configuration here." 
                                x-bind:disabled="!canUpdate" />
                            @can('update', $application)
                                <button wire:click="generateNginxConfiguration" class="inner-button mt-3">
                                    Generate Default Nginx Configuration
                                </button>
                            @endcan
                        </div>
                    @endif
                </div>
            @endif

            {{-- Section: Domains & Routing --}}
            @if ($application->build_pack !== 'dockercompose')
                <div class="glass-card p-6 hover:border-success/30 transition-colors">
                    <div class="mb-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-success/10">
                                <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">Domains & Routing</h3>
                                <p class="text-xs text-light opacity-60">Configure your application's public URLs</p>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div class="flex items-end gap-3">
                            @if ($application->settings->is_container_label_readonly_enabled == false)
                                <x-forms.input placeholder="https://coolify.io" wire:model="application.fqdn"
                                    label="Domains" readonly
                                    helper="Readonly labels are disabled. You can set the domains in the labels section."
                                    x-bind:disabled="!canUpdate" />
                            @else
                                <x-forms.input placeholder="https://app.example.com" wire:model="application.fqdn"
                                    label="Domains"
                                    helper="You can specify one domain with path or more with comma. You can specify a port to bind the domain to.<br><br><span class='text-helper'>Example</span><br>- https://app.example.com<br>- https://api.example.com:3000"
                                    x-bind:disabled="!canUpdate" />
                                @can('update', $application)
                                    <button wire:click="getWildcardDomain" class="inner-button whitespace-nowrap">
                                        Generate Domain
                                    </button>
                                @endcan
                            @endif
                        </div>

                        <div class="flex items-end gap-3">
                            @if ($application->settings->is_container_label_readonly_enabled == false)
                                @if ($application->redirect === 'both')
                                    <x-forms.input label="Direction" value="Allow www & non-www." readonly
                                        helper="Readonly labels are disabled. You can set the direction in the labels section."
                                        x-bind:disabled="!canUpdate" />
                                @elseif ($application->redirect === 'www')
                                    <x-forms.input label="Direction" value="Redirect to www." readonly
                                        helper="Readonly labels are disabled. You can set the direction in the labels section."
                                        x-bind:disabled="!canUpdate" />
                                @elseif ($application->redirect === 'non-www')
                                    <x-forms.input label="Direction" value="Redirect to non-www." readonly
                                        helper="Readonly labels are disabled. You can set the direction in the labels section."
                                        x-bind:disabled="!canUpdate" />
                                @endif
                            @else
                                <x-forms.select label="Direction" id="redirect" required
                                    helper="You must need to add www and non-www as an A DNS record."
                                    x-bind:disabled="!canUpdate">
                                    <option value="both">Allow www & non-www.</option>
                                    <option value="www">Redirect to www.</option>
                                    <option value="non-www">Redirect to non-www.</option>
                                </x-forms.select>
                                @if ($application->settings->is_container_label_readonly_enabled)
                                    @can('update', $application)
                                        <x-modal-confirmation title="Confirm Redirection Setting?" buttonTitle="Set Direction"
                                            submitAction="setRedirect" :actions="['All traffic will be redirected to the selected direction.']"
                                            confirmationText="{{ $application->fqdn . '/' }}"
                                            confirmationLabel="Please confirm the execution of the action by entering the Application URL below"
                                            shortConfirmationLabel="Application URL" :confirmWithPassword="false"
                                            step2ButtonText="Set Direction">
                                            <x-slot:customButton>
                                                <div class="whitespace-nowrap">Set Direction</div>
                                            </x-slot:customButton>
                                        </x-modal-confirmation>
                                    @endcan
                                @endif
                            @endif
                        </div>
                    </div>
                </div>
            @endif

            {{-- Section: Docker Registry --}}
            @if ($application->build_pack !== 'dockercompose')
                <div class="glass-card p-6 hover:border-accent/30 transition-colors">
                    <div class="mb-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                                <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">Docker Registry</h3>
                                <p class="text-xs text-light opacity-60">
                                    @if ($application->build_pack !== 'dockerimage' && !$application->destination->server->isSwarm())
                                        Push the built image to a docker registry. <a class='underline text-accent hover:text-accent/80' href='https://coolify.io/docs/knowledge-base/docker/registry' target='_blank'>Learn more</a>
                                    @else
                                        Configure your Docker image source
                                    @endif
                                </p>
                            </div>
                        </div>
                    </div>

                    @if ($application->destination->server->isSwarm() && $application->build_pack !== 'dockerimage')
                        <div class="mb-4 glass-card p-4 border-l-4 border-warning">
                            <div class="flex items-start gap-3">
                                <svg class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <p class="text-sm text-warning font-medium">Docker Swarm Requirement</p>
                                    <p class="text-xs text-warning opacity-80 mt-1">
                                        Docker Swarm requires the image to be available in a registry. <a class="underline font-semibold hover:text-warning/80" href="https://coolify.io/docs/knowledge-base/docker/registry" target="_blank">Learn more</a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    @endif

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        @if ($application->build_pack === 'dockerimage')
                            @if ($application->destination->server->isSwarm())
                                <x-forms.input required id="docker_registry_image_name" label="Docker Image" x-bind:disabled="!canUpdate" />
                                <x-forms.input id="docker_registry_image_tag" label="Docker Image Tag or Hash"
                                    helper="Enter a tag (e.g., 'latest', 'v1.2.3') or SHA256 hash"
                                    x-bind:disabled="!canUpdate" />
                            @else
                                <x-forms.input id="docker_registry_image_name" label="Docker Image" x-bind:disabled="!canUpdate" />
                                <x-forms.input id="docker_registry_image_tag" label="Docker Image Tag or Hash"
                                    helper="Enter a tag (e.g., 'latest', 'v1.2.3') or SHA256 hash"
                                    x-bind:disabled="!canUpdate" />
                            @endif
                        @else
                            @if ($application->destination->server->isSwarm() || $application->additional_servers->count() > 0 || $application->settings->is_build_server_enabled)
                                <x-forms.input id="docker_registry_image_name" required label="Docker Image"
                                    placeholder="ghcr.io/myorg/myimage" x-bind:disabled="!canUpdate" />
                                <x-forms.input id="docker_registry_image_tag"
                                    helper="If set, it will tag the built image with this tag too."
                                    placeholder="latest" label="Docker Image Tag"
                                    x-bind:disabled="!canUpdate" />
                            @else
                                <x-forms.input id="docker_registry_image_name"
                                    helper="Empty means it won't push the image to a docker registry."
                                    placeholder="ghcr.io/myorg/myimage"
                                    label="Docker Image" x-bind:disabled="!canUpdate" />
                                <x-forms.input id="docker_registry_image_tag"
                                    placeholder="latest"
                                    helper="If set, it will tag the built image with this tag too."
                                    label="Docker Image Tag" x-bind:disabled="!canUpdate" />
                            @endif
                        @endif
                    </div>
                </div>
            @endif

            {{-- Section: Build Configuration --}}
            <div class="glass-card p-6 hover:border-warning/30 transition-colors">
                <div class="mb-6">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
                            <svg class="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-light">Build</h3>
                            <p class="text-xs text-light opacity-60">Configure build commands and directories</p>
                        </div>
                    </div>
                </div>

                @if ($application->build_pack === 'dockerimage')
                    <x-forms.input
                        helper="You can add custom docker run options that will be used when your container is started."
                        placeholder="--cap-add SYS_ADMIN --device=/dev/fuse"
                        id="custom_docker_run_options" label="Custom Docker Options"
                        x-bind:disabled="!canUpdate" />
                @else
                    @if ($application->could_set_build_commands())
                        @if ($application->build_pack === 'nixpacks')
                            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                <x-forms.input helper="If you modify this, you probably need to have a nixpacks.toml"
                                    id="install_command" label="Install Command"
                                    x-bind:disabled="!canUpdate" />
                                <x-forms.input helper="If you modify this, you probably need to have a nixpacks.toml"
                                    id="build_command" label="Build Command"
                                    x-bind:disabled="!canUpdate" />
                                <x-forms.input helper="If you modify this, you probably need to have a nixpacks.toml"
                                    id="start_command" label="Start Command"
                                    x-bind:disabled="!canUpdate" />
                            </div>
                            <div class="glass-card p-3 mb-6">
                                <p class="text-xs text-light opacity-70">
                                    💡 Nixpacks will detect the required configuration automatically.
                                    <a class="underline text-accent hover:text-accent/80 font-medium" href="https://coolify.io/docs/applications/">Framework Specific Docs</a>
                                </p>
                            </div>
                        @elseif ($application->build_pack === 'buildpacks')
                            <div class="space-y-4 mb-6">
                                <x-forms.select id="buildpacks_builder" label="Builder" 
                                    helper="Cloud Native Buildpacks builder to use for building your application"
                                    x-bind:disabled="!canUpdate">
                                    <option value="paketobuildpacks/builder:base">Paketo Base (Recommended)</option>
                                    <option value="paketobuildpacks/builder:full">Paketo Full (All Languages)</option>
                                    <option value="paketobuildpacks/builder:tiny">Paketo Tiny (Minimal)</option>
                                    <option value="heroku/builder:22">Heroku-22</option>
                                    <option value="heroku/builder:20">Heroku-20</option>
                                    <option value="gcr.io/buildpacks/builder:v1">Google Cloud Buildpacks</option>
                                </x-forms.select>
                                
                                <x-forms.input 
                                    id="buildpacks_custom" 
                                    label="Custom Buildpacks (Optional)" 
                                    placeholder="docker://gcr.io/paketo-buildpacks/nodejs"
                                    helper="Comma-separated list of custom buildpacks to use."
                                    x-bind:disabled="!canUpdate" />
                                
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <x-forms.input 
                                        id="install_command" 
                                        label="Install Command"
                                        x-bind:disabled="!canUpdate" />
                                    <x-forms.input 
                                        id="build_command" 
                                        label="Build Command"
                                        x-bind:disabled="!canUpdate" />
                                    <x-forms.input 
                                        id="start_command" 
                                        label="Start Command"
                                        x-bind:disabled="!canUpdate" />
                                </div>
                            </div>
                            <div class="glass-card p-3 mb-6">
                                <p class="text-xs text-light opacity-70">
                                    💡 Cloud Native Buildpacks will auto-detect your application type.
                                    <a class="underline text-accent hover:text-accent/80 font-medium" href="https://buildpacks.io/" target="_blank">Buildpacks Documentation</a>
                                </p>
                            </div>
                        @endif
                    @endif

                    @if ($application->build_pack === 'dockercompose')
                        @can('update', $application)
                            <div x-init="$wire.dispatch('loadCompose', true)">
                        @else
                            <div>
                        @endcan
                            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                                <x-forms.input x-bind:disabled="shouldDisable()" placeholder="/"
                                    id="base_directory" label="Base Directory"
                                    helper="Directory to use as root. Useful for monorepos." />
                                <x-forms.input x-bind:disabled="shouldDisable()"
                                    placeholder="/docker-compose.yaml"
                                    id="docker_compose_location" label="Docker Compose Location"
                                    helper="Path to your docker-compose file" />
                            </div>

                            <div class="mb-4">
                                <x-forms.checkbox instantSave
                                    id="is_preserve_repository_enabled"
                                    label="Preserve Repository During Deployment"
                                    helper="Git repository will be copied to the deployment directory."
                                    x-bind:disabled="shouldDisable()" />
                            </div>

                            <div class="glass-card p-4 border-l-4 border-warning mb-4">
                                <div class="flex items-start gap-3">
                                    <svg class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p class="text-sm text-warning">The following commands are for advanced use cases. Only modify if you know what you're doing.</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <x-forms.input x-bind:disabled="shouldDisable()"
                                    placeholder="docker compose build"
                                    id="docker_compose_custom_build_command"
                                    label="Custom Build Command" />
                                <x-forms.input x-bind:disabled="shouldDisable()"
                                    placeholder="docker compose up -d"
                                    id="docker_compose_custom_start_command"
                                    label="Custom Start Command" />
                            </div>

                            @if ($this->application->is_github_based() && !$this->application->is_public_repository())
                                <div class="mt-4">
                                    <x-forms.textarea
                                        placeholder="services/api/**"
                                        id="watch_paths"
                                        label="Watch Paths"
                                        helper="Pattern matching to filter Git webhook deployments."
                                        x-bind:disabled="shouldDisable()" />
                                </div>
                            @endif
                        </div>
                    @else
                        <div class="space-y-4">
                            <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                <x-forms.input placeholder="/" id="base_directory"
                                    label="Base Directory"
                                    helper="Directory to use as root. Useful for monorepos."
                                    x-bind:disabled="!canUpdate" />
                                
                                @if ($application->build_pack === 'dockerfile' && !$application->dockerfile)
                                    <x-forms.input placeholder="/Dockerfile" id="dockerfile_location"
                                        label="Dockerfile Location"
                                        helper="Path to your Dockerfile"
                                        x-bind:disabled="!canUpdate" />
                                @endif

                                @if ($application->build_pack === 'dockerfile')
                                    <x-forms.input id="dockerfile_target_build"
                                        label="Docker Build Stage Target"
                                        helper="Useful for multi-stage builds"
                                        x-bind:disabled="!canUpdate" />
                                @endif
                                
                                @if ($application->could_set_build_commands())
                                    @if ($application->settings->is_static)
                                        <x-forms.input placeholder="/dist" id="publish_directory"
                                            label="Publish Directory" required x-bind:disabled="!canUpdate" />
                                    @else
                                        <x-forms.input placeholder="/" id="publish_directory"
                                            label="Publish Directory" x-bind:disabled="!canUpdate" />
                                    @endif
                                @endif
                            </div>

                            @if ($this->application->is_github_based() && !$this->application->is_public_repository())
                                <x-forms.textarea
                                    placeholder="src/pages/**"
                                    id="watch_paths"
                                    label="Watch Paths"
                                    helper="Pattern matching to filter Git webhook deployments."
                                    x-bind:disabled="!canUpdate" />
                            @endif

                            <x-forms.input
                                helper="Custom docker run options for your container."
                                placeholder="--cap-add SYS_ADMIN --device=/dev/fuse"
                                id="custom_docker_run_options" label="Custom Docker Options"
                                x-bind:disabled="!canUpdate" />

                            @if ($application->build_pack !== 'dockercompose')
                                <x-forms.checkbox
                                    helper="Use a build server to build your application."
                                    instantSave id="is_build_server_enabled"
                                    label="Use a Build Server?" x-bind:disabled="!canUpdate" />
                            @endif
                        </div>
                    @endif
                @endif
            </div>

            {{-- Section: Docker Compose Details --}}
            @if ($application->build_pack === 'dockercompose')
                <div class="glass-card p-6 hover:border-accent/30 transition-colors">
                    <div class="mb-6 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                                <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">Docker Compose</h3>
                                <p class="text-xs text-light opacity-60">View and manage your compose configuration</p>
                            </div>
                        </div>
                        @can('update', $application)
                            <button wire:target='initLoadingCompose' class="inner-button"
                                x-on:click="$wire.dispatch('loadCompose', false)">
                                Reload Compose File
                            </button>
                        @endcan
                    </div>

                    @if ($application->settings->is_raw_compose_deployment_enabled)
                        <x-forms.textarea rows="10" readonly id="docker_compose_raw"
                            label="Docker Compose Content"
                            helper="You need to modify the docker compose file in the git repository."
                            monacoEditorLanguage="yaml" useMonacoEditor />
                    @else
                        @if ((int) $application->compose_parsing_version >= 3)
                            <x-forms.textarea rows="10" readonly id="docker_compose_raw"
                                label="Docker Compose Content (raw)"
                                helper="You need to modify the docker compose file in the git repository."
                                monacoEditorLanguage="yaml" useMonacoEditor />
                        @else
                            <x-forms.textarea rows="10" readonly id="docker_compose"
                                label="Docker Compose Content"
                                helper="You need to modify the docker compose file in the git repository."
                                monacoEditorLanguage="yaml" useMonacoEditor />
                        @endif
                    @endif

                    <div class="mt-4">
                        <x-forms.checkbox label="Escape special characters in labels?"
                            helper="By default, $ is escaped. Turn this off to use env variables inside labels."
                            id="is_container_label_escape_enabled" instantSave
                            x-bind:disabled="!canUpdate"></x-forms.checkbox>
                    </div>
                </div>
            @endif

            {{-- Section: Dockerfile --}}
            @if ($application->dockerfile)
                <div class="glass-card p-6 hover:border-accent/30 transition-colors">
                    <div class="mb-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                                <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">Dockerfile</h3>
                                <p class="text-xs text-light opacity-60">Edit your Dockerfile configuration</p>
                            </div>
                        </div>
                    </div>
                    
                    <x-forms.textarea label="Dockerfile" id="dockerfile" monacoEditorLanguage="dockerfile"
                        useMonacoEditor rows="6" x-bind:disabled="!canUpdate"> </x-forms.textarea>
                </div>
            @endif

            {{-- Section: Network --}}
            @if ($application->build_pack !== 'dockercompose')
                <div class="glass-card p-6 hover:border-primary/30 transition-colors">
                    <div class="mb-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">Network</h3>
                                <p class="text-xs text-light opacity-60">Configure ports and network aliases</p>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        @if ($application->settings->is_static || $application->build_pack === 'static')
                            <x-forms.input id="ports_exposes" label="Ports Exposes" readonly
                                x-bind:disabled="!canUpdate" />
                        @else
                            @if ($application->settings->is_container_label_readonly_enabled === false)
                                <x-forms.input placeholder="3000,3001" id="ports_exposes"
                                    label="Ports Exposes" readonly
                                    helper="Readonly labels are disabled."
                                    x-bind:disabled="!canUpdate" />
                            @else
                                <x-forms.input placeholder="3000,3001" id="ports_exposes"
                                    label="Ports Exposes" required
                                    helper="Comma separated list of ports your application uses."
                                    x-bind:disabled="!canUpdate" />
                            @endif
                        @endif
                        
                        @if (!$application->destination->server->isSwarm())
                            <x-forms.input placeholder="3000:3000" id="ports_mappings" label="Ports Mappings"
                                helper="Map ports to the host system."
                                x-bind:disabled="!canUpdate" />
                            
                            <x-forms.input id="custom_network_aliases" label="Network Aliases"
                                helper="Custom network aliases for Docker network."
                                wire:model="custom_network_aliases" x-bind:disabled="!canUpdate" />
                        @endif
                    </div>
                </div>

                {{-- Section: HTTP Basic Auth --}}
                <div class="glass-card p-6 hover:border-warning/30 transition-colors">
                    <div class="mb-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
                                <svg class="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">HTTP Basic Authentication</h3>
                                <p class="text-xs text-light opacity-60">Add password protection to your application</p>
                            </div>
                        </div>
                    </div>

                    <x-forms.checkbox helper="This will add the proper proxy labels to the container." instantSave
                        label="Enable HTTP Basic Authentication" id="is_http_basic_auth_enabled"
                        x-bind:disabled="!canUpdate" />

                    @if ($application->is_http_basic_auth_enabled)
                        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                            <x-forms.input id="http_basic_auth_username" label="Username" required
                                x-bind:disabled="!canUpdate" />
                            <x-forms.input id="http_basic_auth_password" type="password" label="Password"
                                required x-bind:disabled="!canUpdate" />
                        </div>
                    @endif
                </div>

                {{-- Section: Container Labels --}}
                <div class="glass-card p-6 hover:border-accent/30 transition-colors">
                    <div class="mb-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                                <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-light">Container Labels</h3>
                                <p class="text-xs text-light opacity-60">Manage Docker container labels for proxy configuration</p>
                            </div>
                        </div>
                    </div>

                    @if ($application->settings->is_container_label_readonly_enabled)
                        <x-forms.textarea readonly disabled label="Container Labels" rows="15" id="customLabels"
                            monacoEditorLanguage="ini" useMonacoEditor x-bind:disabled="!canUpdate"></x-forms.textarea>
                    @else
                        <x-forms.textarea label="Container Labels" rows="15" id="customLabels"
                            monacoEditorLanguage="ini" useMonacoEditor x-bind:disabled="!canUpdate"></x-forms.textarea>
                    @endif

                    <div class="mt-4 space-y-3">
                        <x-forms.checkbox label="Readonly labels"
                            helper="Labels are readonly by default. Disable to edit labels directly."
                            id="is_container_label_readonly_enabled" instantSave
                            x-bind:disabled="!canUpdate"></x-forms.checkbox>
                        
                        <x-forms.checkbox label="Escape special characters in labels?"
                            helper="By default, $ is escaped. Turn this off to use env variables inside labels."
                            id="is_container_label_escape_enabled" instantSave
                            x-bind:disabled="!canUpdate"></x-forms.checkbox>
                    </div>

                    @can('update', $application)
                        <div class="mt-6">
                            <x-modal-confirmation title="Confirm Labels Reset to Coolify Defaults?"
                                buttonTitle="Reset Labels to Defaults" buttonFullWidth submitAction="resetDefaultLabels(true)"
                                :actions="['All your custom proxy labels will be lost.', 'Proxy labels will be reset to defaults.']" 
                                confirmationText="{{ $application->fqdn . '/' }}"
                                confirmationLabel="Please confirm by entering the Application URL"
                                shortConfirmationLabel="Application URL" :confirmWithPassword="false"
                                step2ButtonText="Permanently Reset Labels" />
                        </div>
                    @endcan
                </div>
            @endif

            {{-- Section: Pre/Post Deployment --}}
            <div class="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                        <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                        </svg>
                        Pre/Post Deployment Commands
                    </h3>
                    <p class="text-sm text-gray-400 mt-1">Run commands before and after deployment</p>
                </div>

                <div class="space-y-4">
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <x-forms.input x-bind:disabled="shouldDisable()" placeholder="php artisan migrate"
                            id="pre_deployment_command" label="Pre-deployment Command"
                            helper="Command to execute before deployment begins." />
                        @if ($application->build_pack === 'dockercompose')
                            <x-forms.input x-bind:disabled="shouldDisable()" id="pre_deployment_command_container"
                                label="Container Name"
                                helper="Leave blank if your application only has one container." />
                        @endif
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <x-forms.input x-bind:disabled="shouldDisable()" placeholder="php artisan cache:clear"
                            id="post_deployment_command" label="Post-deployment Command"
                            helper="Command to execute after deployment completes." />
                        @if ($application->build_pack === 'dockercompose')
                            <x-forms.input x-bind:disabled="shouldDisable()"
                                id="post_deployment_command_container" label="Container Name"
                                helper="Leave blank if your application only has one container." />
                        @endif
                    </div>
                </div>
            </div>

            {{-- IDEM: Deployment Configuration Section --}}
            @if (isset($application->idem_deploy_on_managed))
                <div class="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6">
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                            <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path>
                            </svg>
                            🚀 Deployment Configuration
                        </h3>
                        <p class="text-sm text-gray-400 mt-1">IDEM managed deployment options</p>
                    </div>

                    <div class="p-5 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-300">Deployment Type:</p>
                                <p class="mt-2 text-base font-semibold text-white">
                                    @if($application->idem_deploy_on_managed ?? true)
                                        <span class="inline-flex items-center gap-2">
                                            <span class="text-blue-400">☁️ IDEM Managed Servers</span>
                                            @if($application->assignedServer ?? null)
                                                <span class="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                                                    {{ $application->assignedServer->name }}
                                                </span>
                                            @endif
                                        </span>
                                    @else
                                        <span class="text-purple-400">🖥️ Your Personal Server</span>
                                    @endif
                                </p>
                                
                                @if($application->idem_deploy_on_managed ?? false)
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        <span class="inline-flex items-center gap-1 text-xs text-gray-400">
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                                            Automatic load balancing
                                        </span>
                                        <span class="inline-flex items-center gap-1 text-xs text-gray-400">
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                                            High availability
                                        </span>
                                        <span class="inline-flex items-center gap-1 text-xs text-gray-400">
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                                            No maintenance
                                        </span>
                                    </div>
                                    @if($application->idem_server_strategy)
                                        <p class="mt-2 text-xs text-gray-400">
                                            Strategy: <span class="font-medium text-gray-300">{{ ucfirst(str_replace('_', ' ', $application->idem_server_strategy)) }}</span>
                                        </p>
                                    @endif
                                @endif
                            </div>
                            
                            <a href="{{ route('application.deployment', ['application_uuid' => $application->uuid]) }}" 
                               class="ml-4 inline-flex items-center px-4 py-2.5 border border-gray-600 shadow-sm text-sm font-medium rounded-lg text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
                               x-bind:disabled="!canUpdate">
                                ⚙️ Configure
                            </a>
                        </div>
                    </div>

                    <div class="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p class="text-sm text-blue-300">
                            💡 <strong>Tip:</strong> You can deploy on IDEM managed servers (recommended) or use your own servers. 
                            <a href="{{ route('application.deployment', ['application_uuid' => $application->uuid]) }}" class="underline font-medium hover:text-blue-200">Configure now</a>
                        </p>
                    </div>
                </div>
            @endif
        </div>
    </form>

    <x-domain-conflict-modal :conflicts="$domainConflicts" :showModal="$showDomainConflictModal" confirmAction="confirmDomainUsage" />

    @script
        <script>
            $wire.$on('loadCompose', (isInit = true) => {
                $wire.initLoadingCompose = true;
                $wire.loadComposeFile(isInit);
            });
        </script>
    @endscript
</div>
