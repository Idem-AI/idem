<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-slot:title>
        Dashboard | Ideploy
    </x-slot>

    @if (session('error'))
        <span x-data x-init="$wire.emit('error', '{{ session('error') }}')" />
    @endif

    @if (request()->query->get('success'))
        <div class="mb-10 font-bold alert alert-success">
            Your subscription has been activated! Welcome onboard! It could take a few seconds before your
            subscription is activated.<br> Please be patient.
        </div>
    @endif

    {{-- Projects Section --}}
    <section class="mb-8">
        <h2 class="text-2xl font-light mb-4 text-gray-100">Projects</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {{-- Create New Project Card --}}
            @can('createAnyResource')
            <x-modal-input buttonTitle="" title="New Project">
                <x-slot:content>
                    <div class="group cursor-pointer bg-[#151b2e] border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl p-6 transition-all duration-300 hover:bg-[#1a2137] min-h-[240px] flex items-center justify-center">
                        <div class="text-center">
                            <div class="w-12 h-12 mx-auto mb-3 bg-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                </svg>
                            </div>
                            <h3 class="text-base font-semibold text-gray-200 mb-1">Create a new project</h3>
                            <p class="text-xs text-gray-500">Start a new project</p>
                        </div>
                    </div>
                </x-slot:content>
                <livewire:project.add-empty />
            </x-modal-input>
            @endcan

            {{-- Project Cards --}}
            @foreach ($projects as $project)
                @php
                    // Calcul des statistiques détaillées
                    $totalResources = 0;
                    $activeResources = 0;
                    $resourceTypes = [];

                    foreach ($project->environments ?? [] as $environment) {
                        // Applications
                        if (isset($environment->applications)) {
                            $totalResources += $environment->applications->count();
                            $activeResources += $environment->applications->where('status', 'running')->count();
                            if ($environment->applications->count() > 0 && !in_array('Web Application', $resourceTypes)) {
                                $resourceTypes[] = 'Web Application';
                            }
                        }

                        // Services
                        if (isset($environment->services)) {
                            $totalResources += $environment->services->count();
                            $activeResources += $environment->services->filter(fn($s) => $s->status() === 'running')->count();
                            if ($environment->services->count() > 0 && !in_array('Service', $resourceTypes)) {
                                $resourceTypes[] = 'Service';
                            }
                        }

                        // Databases
                        $dbTypes = ['postgresqls', 'mysqls', 'mariadbs', 'mongodbs', 'redis'];
                        foreach ($dbTypes as $dbType) {
                            if (isset($environment->$dbType) && $environment->$dbType->count() > 0) {
                                $totalResources += $environment->$dbType->count();
                                $activeResources += $environment->$dbType->where('status', 'running')->count();
                                if (!in_array('Database', $resourceTypes)) {
                                    $resourceTypes[] = 'Database';
                                }
                            }
                        }
                    }

                    $inactiveResources = $totalResources - $activeResources;

                    // Générer des tags catégories
                    $categoryTags = [];
                    if ($project->id % 3 == 0) $categoryTags[] = 'Companies';
                    if ($project->id % 2 == 0) $categoryTags[] = 'Students';
                    if ($project->id % 5 == 0) $categoryTags[] = 'Regional';
                    if (empty($categoryTags)) $categoryTags[] = 'Local';
                @endphp

                <a href="{{ $project->navigateTo() }}" class="group block">
                    <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300 min-h-[260px] flex flex-col">
                        {{-- Header avec Logo et Titre --}}
                        <div class="p-4 border-b border-gray-700/50">
                            <div class="flex items-start gap-3">
                                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                                    <span class="text-lg font-bold text-white">{{ strtoupper(substr($project->name, 0, 1)) }}</span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h3 class="text-base font-semibold text-gray-100 group-hover:text-blue-400 transition-colors mb-1 truncate">
                                        {{ $project->name }}
                                    </h3>
                                    <p class="text-xs text-gray-400 line-clamp-1">
                                        {{ $project->description ?: 'No description available' }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {{-- Resources Summary --}}
                        <div class="p-3 bg-gray-900/30">
                            <div class="grid grid-cols-3 gap-2">
                                {{-- Total --}}
                                <div class="text-center">
                                    <div class="text-lg font-bold text-blue-400">{{ $totalResources }}</div>
                                    <div class="text-[10px] text-gray-500 uppercase tracking-wide">Total</div>
                                </div>
                                {{-- Active --}}
                                <div class="text-center">
                                    <div class="text-lg font-bold text-green-400">{{ $activeResources }}</div>
                                    <div class="text-[10px] text-gray-500 uppercase tracking-wide">Active</div>
                                </div>
                                {{-- Inactive --}}
                                <div class="text-center">
                                    <div class="text-lg font-bold text-gray-400">{{ $inactiveResources }}</div>
                                    <div class="text-[10px] text-gray-500 uppercase tracking-wide">Inactive</div>
                                </div>
                            </div>
                        </div>

                        {{-- Tags Section --}}
                        <div class="p-3 flex-grow">
                            <div class="space-y-2">
                                {{-- Resource Type Tags --}}
                                @if(count($resourceTypes) > 0)
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    @foreach($resourceTypes as $type)
                                        <span class="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-gray-700/50 text-gray-300 rounded border border-gray-600">
                                            {{ $type }}
                                        </span>
                                    @endforeach
                                </div>
                                @endif

                                {{-- Category Tags --}}
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    @foreach($categoryTags as $tag)
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded
                                            @if($tag === 'Companies') bg-red-500/20 text-red-400 border border-red-500/30
                                            @elseif($tag === 'Students') bg-purple-500/20 text-purple-400 border border-purple-500/30
                                            @elseif($tag === 'Regional') bg-orange-500/20 text-orange-400 border border-orange-500/30
                                            @else bg-orange-500/20 text-orange-400 border border-orange-500/30
                                            @endif">
                                            <span class="w-1 h-1 rounded-full
                                                @if($tag === 'Companies') bg-red-400
                                                @elseif($tag === 'Students') bg-purple-400
                                                @elseif($tag === 'Regional') bg-orange-400
                                                @else bg-orange-400
                                                @endif"></span>
                                            {{ $tag }}
                                        </span>
                                    @endforeach
                                </div>
                            </div>
                        </div>

                        {{-- Footer avec Date --}}
                        <div class="px-4 py-2 bg-gray-900/20 border-t border-gray-700/50">
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] text-gray-500">Updated {{ $project->updated_at->format('M j, Y') }}</span>
                                <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </a>
            @endforeach
        </div>

        @if ($projects->count() === 0)
            <div class="flex flex-col gap-4 items-center justify-center py-12">
                <div class='text-xl font-semibold text-gray-400'>No projects found.</div>
                <p class="text-sm text-gray-500">Create your first project to get started</p>
            </div>
        @endif
    </section>

    {{-- Servers Section --}}
    <section>
        <div class="flex items-center gap-2 mb-4">
            <h2 class="text-2xl font-light text-gray-100">Servers</h2>
            @if ($servers->count() > 0 && $privateKeys->count() > 0)
                <x-modal-input buttonTitle="Add" title="New Server" :closeOutside="false">
                    <x-slot:content>
                        <button class="flex items-center justify-center size-8 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </button>
                    </x-slot:content>
                    <livewire:server.create />
                </x-modal-input>
            @endif
        </div>

        @if ($servers->count() > 0)
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @foreach ($servers as $server)
                    @php
                        $totalResources = 0;
                        $activeResources = 0;
                        $hasIssues = false;

                        foreach ($server->destinations() ?? [] as $destination) {
                            $totalResources += $destination->applications->count();
                            $activeResources += $destination->applications->where('status', 'running')->count();
                        }

                        if (!$server->isFunctional()) {
                            $hasIssues = true;
                        }
                    @endphp

                    <a href="{{ route('server.show', ['server_uuid' => $server->uuid]) }}" class="group block">
                        <div @class([
                            'rounded-xl p-4 transition-all duration-300 min-h-[200px] flex flex-col',
                            'bg-[#151b2e] hover:bg-[#1a2137] border hover:border-gray-600' => true,
                            'border-emerald-500/30' => $server->isFunctional() && !$hasIssues,
                            'border-red-500/30' => $hasIssues,
                            'border-gray-700' => !$server->isFunctional() && !$hasIssues,
                        ])>
                            <div class="flex items-start justify-between mb-3">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <h3 class="text-base font-semibold text-gray-100 group-hover:text-blue-400 transition-colors">
                                            {{ $server->name }}
                                        </h3>
                                        @if($hasIssues)
                                            <span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded">
                                                Issues
                                            </span>
                                        @endif
                                    </div>
                                    <p class="text-xs text-gray-400 truncate">
                                        {{ $server->description ?: $server->ip }}
                                    </p>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-2 mb-3">
                                <div @class([
                                    'rounded-md p-2 text-center',
                                    'bg-blue-50 dark:bg-blue-950/20' => true,
                                ])>
                                    <div class="text-xl font-bold text-blue-400">{{ $totalResources }}</div>
                                    <div class="text-[10px] text-gray-400 mt-0.5">Resources</div>
                                </div>
                                <div @class([
                                    'rounded-md p-2 text-center',
                                    'bg-green-50 dark:bg-green-950/20' => $server->isFunctional() && !$hasIssues,
                                    'bg-red-50 dark:bg-red-950/20' => $hasIssues || !$server->isFunctional(),
                                ])>
                                    <div @class([
                                        'text-xl font-bold',
                                        'text-green-400' => $server->isFunctional() && !$hasIssues,
                                        'text-red-400' => $hasIssues || !$server->isFunctional(),
                                    ])>{{ $activeResources }}</div>
                                    <div class="text-[10px] text-gray-400 mt-0.5">Active</div>
                                </div>
                            </div>

                            <div class="mt-auto pt-3 border-t border-gray-700">
                                <div class="flex items-center justify-between text-[10px] text-gray-500">
                                    <span class="truncate">{{ $server->ip }}</span>
                                    <span class="inline-flex items-center gap-1 ml-2">
                                        <span @class([
                                            'w-1.5 h-1.5 rounded-full',
                                            'bg-green-400' => $server->isFunctional(),
                                            'bg-red-400' => !$server->isFunctional(),
                                        ])></span>
                                        {{ $server->isFunctional() ? 'Online' : 'Offline' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </a>
                @endforeach
            </div>
        @else
            @if ($privateKeys->count() === 0)
                <div class="flex flex-col gap-4 items-center justify-center py-12">
                    <div class='text-xl font-semibold text-gray-400'>No private keys found.</div>
                    <div class="text-gray-500">Before you can add your server, first
                        <x-modal-input buttonTitle="add a private key" title="New Private Key">
                            <livewire:security.private-key.create />
                        </x-modal-input>
                    </div>
                </div>
            @else
                <div class="flex flex-col gap-4 items-center justify-center py-12">
                    <div class='text-xl font-semibold text-gray-400'>No servers found.</div>
                    <x-modal-input buttonTitle="Add Your First Server" title="New Server" :closeOutside="false">
                        <livewire:server.create />
                    </x-modal-input>
                </div>
            @endif
        @endif
    </section>
</div>
