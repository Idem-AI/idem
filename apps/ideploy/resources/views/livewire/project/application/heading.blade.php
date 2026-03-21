<nav wire:poll.10000ms="checkStatus" class="pb-6">
    <x-resources.breadcrumbs :resource="$application" :parameters="$parameters" :title="$lastDeploymentInfo" :lastDeploymentLink="$lastDeploymentLink" />
    <div class="navbar-main">
        <nav class="flex shrink-0 gap-3 items-center whitespace-nowrap scrollbar min-h-10">
            <a class="nav-link {{ request()->routeIs('project.application.configuration') ? 'nav-link-active' : '' }}"
                href="{{ route('project.application.configuration', $parameters) }}">
                Configuration
            </a>
            <a class="nav-link {{ request()->routeIs('project.application.deployment.index') ? 'nav-link-active' : '' }}"
                href="{{ route('project.application.deployment.index', $parameters) }}">
                Deployments
            </a>
            <a class="nav-link {{ request()->routeIs('project.application.logs') ? 'nav-link-active' : '' }}"
                href="{{ route('project.application.logs', $parameters) }}">
                Logs
            </a>
            <a class="nav-link {{ request()->routeIs('project.application.security.*') ? 'nav-link-active' : '' }}"
                href="{{ route('project.application.security.overview', $parameters) }}">
                Security
            </a>
            <a class="nav-link {{ request()->routeIs('project.application.pipeline') ? 'nav-link-active' : '' }}"
                href="{{ route('project.application.pipeline', $parameters) }}">
                Pipeline
            </a>
            @if (!$application->destination->server->isSwarm())
                @can('canAccessTerminal')
                    <a class="nav-link {{ request()->routeIs('project.application.command') ? 'nav-link-active' : '' }}"
                        href="{{ route('project.application.command', $parameters) }}">
                        Terminal
                    </a>
                @endcan
            @endif
            <x-applications.links :application="$application" />
        </nav>
        <div class="flex flex-wrap gap-2 items-center">
            @if ($application->build_pack === 'dockercompose' && is_null($application->docker_compose_raw))
                <div>Please load a Compose file.</div>
            @else
                @if (!$application->destination->server->isSwarm())
                    <div>
                        <x-applications.advanced :application="$application" />
                    </div>
                @endif
                {{-- Action Buttons Group --}}
                <div class="flex flex-wrap gap-3 items-center">
                    @if (!str($application->status)->startsWith('exited'))
                        @if (!$application->destination->server->isSwarm())
                            {{-- Redeploy Button (Primary - Blue) --}}
                            <button class="inner-button px-8 py-3 flex items-center gap-2" 
                                title="Redeploy with rolling update if possible" 
                                wire:click='deploy'
                                wire:loading.attr="disabled">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5"
                                    viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"
                                    stroke-linecap="round" stroke-linejoin="round">
                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                                    <path
                                        d="M10.09 4.01l.496 -.495a2 2 0 0 1 2.828 0l7.071 7.07a2 2 0 0 1 0 2.83l-7.07 7.07a2 2 0 0 1 -2.83 0l-7.07 -7.07a2 2 0 0 1 0 -2.83l3.535 -3.535h-3.988">
                                    </path>
                                    <path d="M7.05 11.038v-3.988"></path>
                                </svg>
                                <span>REDEPLOY</span>
                            </button>
                        @endif
                        
                        @if ($application->build_pack !== 'dockercompose')
                            @if ($application->destination->server->isSwarm())
                                {{-- Update Service Button (Primary) --}}
                                <button class="inner-button px-8 py-3 flex items-center gap-2" 
                                    title="Redeploy Swarm Service with rolling update" 
                                    wire:click='deploy'
                                    wire:loading.attr="disabled">
                                    <svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <g fill="none" stroke="currentColor" stroke-linecap="round"
                                            stroke-linejoin="round" stroke-width="2">
                                            <path
                                                d="M19.933 13.041a8 8 0 1 1-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747" />
                                            <path d="M20 4v5h-5" />
                                        </g>
                                    </svg>
                                    <span>UPDATE SERVICE</span>
                                </button>
                            @else
                                {{-- Restart Button (Secondary - Gray) --}}
                                <button class="outer-button px-8 py-3 flex items-center gap-2" 
                                    title="Restart application without rebuilding" 
                                    wire:click='restart'
                                    wire:loading.attr="disabled">
                                    <svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <g fill="none" stroke="currentColor" stroke-linecap="round"
                                            stroke-linejoin="round" stroke-width="2">
                                            <path
                                                d="M19.933 13.041a8 8 0 1 1-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747" />
                                            <path d="M20 4v5h-5" />
                                        </g>
                                    </svg>
                                    <span>RESTART</span>
                                </button>
                            @endif
                        @endif
                        
                        {{-- Stop Button (Danger - Red) --}}
                        <x-modal-confirmation 
                            title="⚠️ Confirm Application Stopping?" 
                            buttonTitle="Stop"
                            submitAction="stop" 
                            :checkboxes="$checkboxes" 
                            :actions="[
                                '🛑 This application will be stopped.',
                                '⚠️ All non-persistent data will be deleted.',
                            ]" 
                            :confirmWithText="false" 
                            :confirmWithPassword="false"
                            step1ButtonText="Continue" 
                            step2ButtonText="⛔ Confirm STOP">
                            <x-slot:content>
                                <button class="inner-button bg-gradient-to-br from-red-600 to-red-500 px-8 py-3 flex items-center gap-2" 
                                    wire:loading.attr="disabled">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24"
                                        stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round"
                                        stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                                        <path d="M6 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"></path>
                                        <path d="M14 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"></path>
                                    </svg>
                                    <span>STOP</span>
                                </button>
                            </x-slot:content>
                        </x-modal-confirmation>
                    @else
                        {{-- Deploy Button (when exited) --}}
                        <button class="inner-button px-6 py-3 flex items-center gap-2" wire:click='deploy' wire:loading.attr="disabled">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5"
                                viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"
                                stroke-linecap="round" stroke-linejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M7 4v16l13 -8z" />
                            </svg>
                            <span>▶️ DEPLOY</span>
                            <span wire:loading wire:target="deploy" class="ml-1">
                                <svg class="w-4 h-4 inline-block animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                            </span>
                        </button>
                    @endif
                </div>
            @endif
        </div>
    </div>
</nav>
