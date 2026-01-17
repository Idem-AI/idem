<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Configuration | Coolify
    </x-slot>
    
    {{-- Header avec titre et breadcrumb --}}
    <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">Configuration</h1>
        <p class="text-gray-400">Manage your application settings and deployment options</p>
    </div>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    <div class="flex flex-col lg:flex-row gap-8 mt-8">
        {{-- Sidebar Navigation Moderne --}}
        <div class="lg:w-64 flex-shrink-0">
            <nav class="sticky top-6 space-y-1">
                {{-- Section: Configuration --}}
                <div class="mb-6">
                    <div class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 px-3">
                        Configuration
                    </div>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.configuration') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.configuration', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <span>General</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.advanced') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.advanced', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                        </svg>
                        <span>Advanced</span>
                    </a>

                    @if ($application->destination->server->isSwarm())
                        <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                            :class="'{{ request()->routeIs('project.application.swarm') }}' === '1' 
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                            href="{{ route('project.application.swarm', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                            </svg>
                            <span>Swarm Config</span>
                        </a>
                    @endif
                </div>

                {{-- Section: Environment --}}
                <div class="mb-6">
                    <div class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 px-3">
                        Environment
                    </div>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.environment-variables') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.environment-variables', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                        </svg>
                        <span>Variables</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.persistent-storage') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.persistent-storage', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path>
                        </svg>
                        <span>Storage</span>
                    </a>

                    @if ($application->git_based())
                        <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                            :class="'{{ request()->routeIs('project.application.source') }}' === '1' 
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                            href="{{ route('project.application.source', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                            </svg>
                            <span>Git Source</span>
                        </a>
                    @endif
                </div>

                {{-- Section: Deployment & Operations --}}
                <div class="mb-6">
                    <div class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 px-3">
                        Deployment
                    </div>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.servers') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.servers', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                        </svg>
                        <span>Servers</span>
                        @if (str($application->status)->contains('degraded') || $application->server_status == false)
                            <span class="w-2 h-2 bg-red-500 rounded-full"></span>
                        @endif
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.scheduled-tasks.show') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.scheduled-tasks.show', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>Scheduled Tasks</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.webhooks') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.webhooks', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        <span>Webhooks</span>
                    </a>

                    @if ($application->deploymentType() !== 'deploy_key')
                        <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                            :class="'{{ request()->routeIs('project.application.preview-deployments') }}' === '1' 
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                            href="{{ route('project.application.preview-deployments', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                            <span>Preview Deployments</span>
                        </a>
                    @endif

                    @if ($application->build_pack !== 'dockercompose')
                        <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                            :class="'{{ request()->routeIs('project.application.healthcheck') }}' === '1' 
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                            href="{{ route('project.application.healthcheck', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span>Healthcheck</span>
                        </a>
                    @endif

                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.rollback') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.rollback', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"></path>
                        </svg>
                        <span>Rollback</span>
                    </a>
                </div>

                {{-- Section: Monitoring --}}
                <div class="mb-6">
                    <div class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 px-3">
                        Monitoring
                    </div>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.resource-limits') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.resource-limits', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                        <span>Resource Limits</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.resource-operations') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.resource-operations', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        <span>Operations</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.metrics') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.metrics', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>Metrics</span>
                    </a>
                </div>

                {{-- Section: Other --}}
                <div class="mb-6">
                    <div class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 px-3">
                        Other
                    </div>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.application.tags') }}' === '1' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'"
                        href="{{ route('project.application.tags', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                        </svg>
                        <span>Tags</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10'
                        :class="'{{ request()->routeIs('project.application.danger') }}' === '1' 
                            ? 'bg-red-500/10 border border-red-500/30' 
                            : ''"
                        href="{{ route('project.application.danger', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'application_uuid' => $application->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        <span>Danger Zone</span>
                    </a>
                </div>
            </nav>
        </div>

        {{-- Main Content --}}
        <div class="flex-1 min-w-0">
            @if ($currentRoute === 'project.application.configuration')
                <livewire:project.application.general :application="$application" />
            @elseif ($currentRoute === 'project.application.swarm' && $application->destination->server->isSwarm())
                <livewire:project.application.swarm :application="$application" />
            @elseif ($currentRoute === 'project.application.advanced')
                <livewire:project.application.advanced :application="$application" />
            @elseif ($currentRoute === 'project.application.environment-variables')
                <livewire:project.shared.environment-variable.all :resource="$application" />
            @elseif ($currentRoute === 'project.application.persistent-storage')
                <livewire:project.service.storage :resource="$application" />
            @elseif ($currentRoute === 'project.application.source' && $application->git_based())
                <livewire:project.application.source :application="$application" />
            @elseif ($currentRoute === 'project.application.servers')
                <livewire:project.shared.destination :resource="$application" />
            @elseif ($currentRoute === 'project.application.scheduled-tasks.show')
                <livewire:project.shared.scheduled-task.all :resource="$application" />
            @elseif ($currentRoute === 'project.application.webhooks')
                <livewire:project.shared.webhooks :resource="$application" />
            @elseif ($currentRoute === 'project.application.preview-deployments')
                <livewire:project.application.previews :application="$application" />
            @elseif ($currentRoute === 'project.application.healthcheck' && $application->build_pack !== 'dockercompose')
                <livewire:project.application.health-check :application="$application" />
            @elseif ($currentRoute === 'project.application.rollback')
                <livewire:project.shared.rollback :resource="$application" />
            @elseif ($currentRoute === 'project.application.resource-limits')
                <livewire:project.shared.resource-limits :resource="$application" />
            @elseif ($currentRoute === 'project.application.resource-operations')
                <livewire:project.shared.resource-operations :resource="$application" />
            @elseif ($currentRoute === 'project.application.metrics')
                <livewire:project.shared.metrics :resource="$application" />
            @elseif ($currentRoute === 'project.application.tags')
                <livewire:project.shared.tags :resource="$application" />
            @elseif ($currentRoute === 'project.application.danger')
                <livewire:project.shared.danger :resource="$application" />
            @endif
        </div>
    </div>
</div>
