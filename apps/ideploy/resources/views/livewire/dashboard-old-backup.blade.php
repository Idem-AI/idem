<div>
    <x-slot:title>
        Dashboard | Ideploy
    </x-slot>
    @if (session('error'))
        <span x-data x-init="$wire.emit('error', '{{ session('error') }}')" />
    @endif
    <h1>Dashboard</h1>
    <div class="subtitle">Your self-hosted infrastructure.</div>
    @if (request()->query->get('success'))
        <div class=" mb-10 font-bold alert alert-success">
            Your subscription has been activated! Welcome onboard! It could take a few seconds before your
            subscription is activated.<br> Please be patient.
        </div>
    @endif

    <section class="-mt-2">
        <div class="flex items-center gap-2 pb-2">
            <h3>Projects</h3>
            @if ($projects->count() > 0)
                <x-modal-input buttonTitle="Add" title="New Project">
                    <x-slot:content>
                        <button
                            class="flex items-center justify-center size-4 text-white rounded hover:bg-coolgray-400 dark:hover:bg-coolgray-300 cursor-pointer">
                            <svg class="size-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </button>
                    </x-slot:content>
                    <livewire:project.add-empty />
                </x-modal-input>
            @endif
        </div>
        @if ($projects->count() > 0)
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                @foreach ($projects as $project)
                    @php
                        // Calcul des statistiques
                        $totalResources = 0;
                        $activeResources = 0;
                        $resourceTypes = [];

                        foreach ($project->environments ?? [] as $environment) {
                            // Applications
                            if (isset($environment->applications)) {
                                $totalResources += $environment->applications->count();
                                $activeResources += $environment->applications->where('status', 'running')->count();
                                if ($environment->applications->count() > 0 && !in_array('Apps', $resourceTypes)) {
                                    $resourceTypes[] = 'Apps';
                                }
                            }

                            // Services
                            if (isset($environment->services)) {
                                $totalResources += $environment->services->count();
                                $activeResources += $environment->services->filter(fn($s) => $s->status() === 'running')->count();
                                if ($environment->services->count() > 0 && !in_array('Services', $resourceTypes)) {
                                    $resourceTypes[] = 'Services';
                                }
                            }

                            // PostgreSQL
                            if (isset($environment->postgresqls)) {
                                $totalResources += $environment->postgresqls->count();
                                $activeResources += $environment->postgresqls->where('status', 'running')->count();
                                if ($environment->postgresqls->count() > 0 && !in_array('PostgreSQL', $resourceTypes)) {
                                    $resourceTypes[] = 'PostgreSQL';
                                }
                            }

                            // MySQL
                            if (isset($environment->mysqls)) {
                                $totalResources += $environment->mysqls->count();
                                $activeResources += $environment->mysqls->where('status', 'running')->count();
                                if ($environment->mysqls->count() > 0 && !in_array('MySQL', $resourceTypes)) {
                                    $resourceTypes[] = 'MySQL';
                                }
                            }

                            // MariaDB
                            if (isset($environment->mariadbs)) {
                                $totalResources += $environment->mariadbs->count();
                                $activeResources += $environment->mariadbs->where('status', 'running')->count();
                                if ($environment->mariadbs->count() > 0 && !in_array('MariaDB', $resourceTypes)) {
                                    $resourceTypes[] = 'MariaDB';
                                }
                            }

                            // MongoDB
                            if (isset($environment->mongodbs)) {
                                $totalResources += $environment->mongodbs->count();
                                $activeResources += $environment->mongodbs->where('status', 'running')->count();
                                if ($environment->mongodbs->count() > 0 && !in_array('MongoDB', $resourceTypes)) {
                                    $resourceTypes[] = 'MongoDB';
                                }
                            }

                            // Redis
                            if (isset($environment->redis)) {
                                $totalResources += $environment->redis->count();
                                $activeResources += $environment->redis->where('status', 'running')->count();
                                if ($environment->redis->count() > 0 && !in_array('Redis', $resourceTypes)) {
                                    $resourceTypes[] = 'Redis';
                                }
                            }
                        }

                        $resourceTypes = array_unique($resourceTypes);
                    @endphp

                    {{-- Project Card --}}
                    <div class="relative bg-white dark:bg-coolgray-100 rounded-lg border border-neutral-200 dark:border-coolgray-200 hover:border-neutral-300 dark:hover:border-coolgray-300 transition-all group">
                        <a href="{{ $project->navigateTo() }}" class="absolute inset-0 z-0"></a>

                        {{-- Header Section --}}
                        <div class="p-4 border-b border-neutral-200 dark:border-coolgray-200">
                            <div class="flex items-start justify-between mb-3">
                                <div class="flex-1">
                                    <h3 class="text-lg font-semibold text-black dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {{ $project->name }}
                                    </h3>
                                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {{ $project->description ?: 'No description' }}
                                    </p>
                                </div>
                            </div>

                            {{-- Action Buttons --}}
                            <div class="relative z-10 flex items-center gap-2">
                                @if ($project->environments->first())
                                    @can('createAnyResource')
                                        <a href="{{ route('project.resource.create', [
                                                'project_uuid' => $project->uuid,
                                                'environment_uuid' => $project->environments->first()->uuid,
                                            ]) }}"
                                            class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-lg hover:scale-105">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                            </svg>
                                            Add
                                        </a>
                                    @endcan
                                @endif
                                @can('update', $project)
                                    <a href="{{ route('project.edit', ['project_uuid' => $project->uuid]) }}"
                                        class="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-coolgray-200 hover:bg-gray-200 dark:hover:bg-coolgray-300 text-gray-700 dark:text-gray-300 rounded-lg transition-all hover:scale-105">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        </svg>
                                    </a>
                                @endcan
                            </div>
                        </div>

                        {{-- Summary Stats - Petites boxes compactes --}}
                        <div class="p-4">
                            <div class="grid grid-cols-3 gap-2">
                                {{-- Total Resources --}}
                                <div class="bg-blue-50 dark:bg-blue-950/20 rounded-md p-2 text-center">
                                    <div class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ $totalResources }}</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Total</div>
                                </div>

                                {{-- Active Resources --}}
                                <div class="bg-green-50 dark:bg-green-950/20 rounded-md p-2 text-center">
                                    <div class="text-xl font-bold text-green-600 dark:text-green-400">{{ $activeResources }}</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Active</div>
                                </div>

                                {{-- Inactive Resources --}}
                                <div class="bg-gray-50 dark:bg-gray-950/20 rounded-md p-2 text-center">
                                    <div class="text-xl font-bold text-gray-600 dark:text-gray-400">{{ $totalResources - $activeResources }}</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Inactive</div>
                                </div>
                            </div>

                            {{-- Resource Types --}}
                            @if(count($resourceTypes) > 0)
                                <div class="mt-3 pt-3 border-t border-neutral-200 dark:border-coolgray-200">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-xs text-gray-500 dark:text-gray-400">Types:</span>
                                        @foreach($resourceTypes as $type)
                                            <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                {{ $type }}
                                            </span>
                                        @endforeach
                                    </div>
                                </div>
                            @endif
                        </div>
                    </div>
                @endforeach
            </div>
        @else
            <div class="flex flex-col gap-1">
                <div class='font-bold dark:text-warning'>No projects found.</div>
                <div class="flex items-center gap-1">
                    <x-modal-input buttonTitle="Add" title="New Project">
                        <livewire:project.add-empty />
                    </x-modal-input> your first project or
                    go to the <a class="underline dark:text-white" href="{{ route('onboarding') }}">onboarding</a> page.
                </div>
            </div>
        @endif
    </section>

    <section>
        <div class="flex items-center gap-2 pb-2">
            <h3>Servers</h3>
            @if ($servers->count() > 0 && $privateKeys->count() > 0)
                <x-modal-input buttonTitle="Add" title="New Server" :closeOutside="false">
                    <x-slot:content>
                        <button
                            class="flex items-center justify-center size-4 text-white rounded hover:bg-coolgray-400 dark:hover:bg-coolgray-300 cursor-pointer">
                            <svg class="size-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </button>
                    </x-slot:content>
                    <livewire:server.create />
                </x-modal-input>
            @endif
        </div>
        @if ($servers->count() > 0)
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                @foreach ($servers as $server)
                    @php
                        // Calcul des statistiques du serveur
                        $totalResources = 0;
                        $activeResources = 0;
                        $resourceTypes = [];

                        try {
                            foreach ($server->destinations() as $destination) {
                                $apps = $destination->applications ?? collect();
                                foreach ($apps as $app) {
                                    $totalResources++;
                                    if ($app->status === 'running') $activeResources++;
                                }
                                if ($apps->count() > 0 && !in_array('Apps', $resourceTypes)) {
                                    $resourceTypes[] = 'Apps';
                                }
                            }
                        } catch (\Exception $e) {
                            // Ignore errors
                        }

                        try {
                            $services = $server->services()->get();
                            if ($services) {
                                foreach ($services as $service) {
                                    $totalResources++;
                                    if ($service->status() === 'running') $activeResources++;
                                    if (!in_array('Services', $resourceTypes)) {
                                        $resourceTypes[] = 'Services';
                                    }
                                }
                            }
                        } catch (\Exception $e) {
                            // Ignore errors
                        }

                        if ($server->standaloneDatabases) {
                            foreach ($server->standaloneDatabases as $db) {
                                $totalResources++;
                                if ($db->status === 'running') $activeResources++;
                                if (!in_array('DBs', $resourceTypes)) {
                                    $resourceTypes[] = 'DBs';
                                }
                            }
                        }

                        $isReachable = $server->settings->is_reachable ?? true;
                        $isUsable = $server->settings->is_usable ?? true;
                        $isDisabled = $server->settings->force_disabled ?? false;
                        $hasIssues = !$isReachable || !$isUsable || $isDisabled;
                    @endphp

                    {{-- Server Card --}}
                    <div class="relative bg-white dark:bg-coolgray-100 rounded-lg border @if($hasIssues) border-red-500 dark:border-red-500 @else border-neutral-200 dark:border-coolgray-200 @endif hover:border-neutral-300 dark:hover:border-coolgray-300 transition-all group">
                        <a href="{{ route('server.show', ['server_uuid' => data_get($server, 'uuid')]) }}" class="absolute inset-0 z-0"></a>

                        {{-- Header Section --}}
                        <div class="p-4 border-b border-neutral-200 dark:border-coolgray-200">
                            <div class="flex items-start justify-between mb-3">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <h3 class="text-lg font-semibold text-black dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {{ $server->name }}
                                        </h3>
                                        @if($isReachable && $isUsable && !$isDisabled)
                                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                                                <span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                                                Online
                                            </span>
                                        @else
                                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                                                <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                                                Offline
                                            </span>
                                        @endif
                                    </div>
                                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {{ $server->description ?: 'No description' }}
                                    </p>

                                    {{-- Error Messages --}}
                                    @if($hasIssues)
                                        <div class="mt-2 flex flex-wrap gap-1">
                                            @if (!$isReachable)
                                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded">
                                                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                                    </svg>
                                                    Not reachable
                                                </span>
                                            @endif
                                            @if (!$isUsable)
                                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded">
                                                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                    </svg>
                                                    Not usable
                                                </span>
                                            @endif
                                            @if ($isDisabled)
                                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded">
                                                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                                    </svg>
                                                    Force disabled
                                                </span>
                                            @endif
                                        </div>
                                    @endif
                                </div>
                            </div>
                        </div>

                        {{-- Summary Stats - Petites boxes compactes --}}
                        <div class="p-4">
                            <div class="grid grid-cols-3 gap-2">
                                {{-- Total Resources --}}
                                <div class="bg-blue-50 dark:bg-blue-950/20 rounded-md p-2 text-center">
                                    <div class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ $totalResources }}</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Total</div>
                                </div>

                                {{-- Active Resources --}}
                                <div class="bg-green-50 dark:bg-green-950/20 rounded-md p-2 text-center">
                                    <div class="text-xl font-bold text-green-600 dark:text-green-400">{{ $activeResources }}</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Active</div>
                                </div>

                                {{-- Inactive Resources --}}
                                <div class="bg-gray-50 dark:bg-gray-950/20 rounded-md p-2 text-center">
                                    <div class="text-xl font-bold text-gray-600 dark:text-gray-400">{{ $totalResources - $activeResources }}</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Inactive</div>
                                </div>
                            </div>

                            {{-- Resource Types --}}
                            @if(count($resourceTypes) > 0)
                                <div class="mt-3 pt-3 border-t border-neutral-200 dark:border-coolgray-200">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-xs text-gray-500 dark:text-gray-400">Deployed:</span>
                                        @foreach($resourceTypes as $type)
                                            <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                {{ $type }}
                                            </span>
                                        @endforeach
                                    </div>
                                </div>
                            @else
                                <div class="mt-3 pt-3 border-t border-neutral-200 dark:border-coolgray-200">
                                    <p class="text-xs text-gray-500 dark:text-gray-400 text-center">No resources deployed yet</p>
                                </div>
                            @endif
                        </div>
                    </div>
                @endforeach
            </div>
        @else
            @if ($privateKeys->count() === 0)
                <div class="flex flex-col gap-1">
                    <div class='font-bold dark:text-warning'>No private keys found.</div>
                    <div class="flex items-center gap-1">Before you can add your server, first <x-modal-input
                            buttonTitle="add" title="New Private Key">
                            <livewire:security.private-key.create from="server" />
                        </x-modal-input> a private key
                        or
                        go to the <a class="underline dark:text-white" href="{{ route('onboarding') }}">onboarding</a>
                        page.
                    </div>
                </div>
            @else
                <div class="flex flex-col gap-1">
                    <div class='font-bold dark:text-warning'>No servers found.</div>
                    <div class="flex items-center gap-1">
                        <x-modal-input buttonTitle="Add" title="New Server" :closeOutside="false">
                            <livewire:server.create />
                        </x-modal-input> your first server
                        or
                        go to the <a class="underline dark:text-white" href="{{ route('onboarding') }}">onboarding</a>
                        page.
                    </div>
                </div>
            @endif
        @endif
    </section>
</div>
