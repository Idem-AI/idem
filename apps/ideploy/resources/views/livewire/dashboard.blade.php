<div class="min-h-screen text-white" style="font-family: 'Jura', sans-serif;"> <x-slot:title> Dashboard | iDeploy </x-slot>
@if(session('error')) <span x-data x-init="$wire.emit('error', '{{ session('error') }}')" />
@endif

@if(request()->query->get('success')) <div class="mx-6 mt-6 p-4 glass-card border border-green-500/30 rounded-xl text-green-300 font-medium"> ✅ Your subscription has been activated! Welcome onboard! It could take a few seconds before your subscription is activated. Please be patient. </div>
@endif

{{-- Compact Header --}}
 <div class="px-6 pt-6 pb-3"> <div class="max-w-7xl mx-auto"> <h1 class="text-2xl font-bold text-white">Dashboard</h1> <p class="text-sm text-gray-400">{{ count($projects) }} projects • {{ count($servers) }} servers</p> </div> </div>
{{-- AI Assistant Compact --}}

<section class="px-6 pb-4"> <div class="max-w-7xl mx-auto"> <div class="glass-card p-4"> <div class="flex items-center gap-4"> <div class="w-10 h-10 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center"> <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/> </svg> </div> <div class="flex-1"> <div class="flex items-center gap-2"> <h3 class="text-lg font-bold text-white">AI Smart Deploy</h3> <span class="px-2 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full font-bold">SOON</span> </div> <p class="text-xs text-gray-300">Intelligent deployment with deep code analysis • 10+ languages • 25+ frameworks</p> </div> <div class="flex gap-2"> <button disabled class="px-4 py-2 bg-white/5 text-gray-500 rounded-lg text-sm font-bold cursor-not-allowed opacity-50">Coming Soon</button> </div> </div> </div> </div>
</section>

{{-- Projects Section --}}

<section class="px-6 pb-6"> <div class="max-w-7xl mx-auto"> <div class="flex items-center justify-between mb-4"> <div class="flex items-center gap-3"> <div class="w-10 h-10 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center"> <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path> </svg> </div> <h2 class="text-2xl font-bold text-white">PROJECTS</h2> </div> </div> <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
{{-- Create New Project Card --}}

@can('createAnyResource') <x-modal-input buttonTitle="" title="New Project"> <x-slot:content> <div class="group cursor-pointer glass-card border-2 border-dashed border-white/10 hover:border-primary/50 p-10 transition-all duration-300 min-h-[300px] flex items-center justify-center"> <div class="text-center"> <div class="w-20 h-20 mx-auto mb-5 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center"> <svg class="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/> </svg> </div> <h3 class="text-xl font-bold text-white mb-2">CREATE NEW PROJECT</h3> <p class="text-sm text-gray-400">Start building something amazing</p> </div> </div> </x-slot:content> <livewire:project.add-empty /> </x-modal-input>
@endcan

{{-- Project Cards --}}

@foreach($projects as $project)
@php
    // Calcul des statistiques détaillées
    $totalResources = 0;
    $activeResources = 0;
    $inactiveResources = 0;
    $resourceTypes = [];

    foreach ($project->environments ?? [] as $environment) {
        // Applications
        if (isset($environment->applications)) {
            $apps = $environment->applications;
            $totalResources += $apps->count();

            $activeResources += $apps->filter(function($app) {
                try {
                    $status = $app->status;
                    if (is_string($status)) {
                        return str_starts_with($status, 'running');
                    }
                    if (is_object($status) && method_exists($status, '__toString')) {
                        return str_starts_with((string)$status, 'running');
                    }
                    return false;
                } catch (\Exception $e) {
                    return false;
                }
            })->count();

            if ($apps->count() > 0 && !in_array('Web Application', $resourceTypes)) {
                $resourceTypes[] = 'Web Application';
            }
        }

        // Services
        if (isset($environment->services)) {
            $services = $environment->services;
            $totalResources += $services->count();

            $activeResources += $services->filter(function($s) {
                try {
                    $status = $s->status;
                    if (is_string($status)) {
                        return str_starts_with($status, 'running');
                    }
                    if (is_object($status) && method_exists($status, '__toString')) {
                        return str_starts_with((string)$status, 'running');
                    }
                    return false;
                } catch (\Exception $e) {
                    return false;
                }
            })->count();

            if ($services->count() > 0 && !in_array('Service', $resourceTypes)) {
                $resourceTypes[] = 'Service';
            }
        }

        // Databases
        $dbTypes = ['postgresqls', 'mysqls', 'mariadbs', 'mongodbs', 'redis'];
        foreach ($dbTypes as $dbType) {
            if (isset($environment->$dbType) && $environment->$dbType->count() > 0) {
                $dbs = $environment->$dbType;
                $totalResources += $dbs->count();

                $activeResources += $dbs->filter(function($db) {
                    try {
                        $status = $db->status;
                        if (is_string($status)) {
                            return str_starts_with($status, 'running');
                        }
                        if (is_object($status) && method_exists($status, '__toString')) {
                            return str_starts_with((string)$status, 'running');
                        }
                        return false;
                    } catch (\Exception $e) {
                        return false;
                    }
                })->count();

                if (!in_array('Database', $resourceTypes)) {
                    $resourceTypes[] = 'Database';
                }
            }
        }
    }

    $inactiveResources = $totalResources - $activeResources;

    // Catégories de tags
    $categoryTags = [];
    if ($project->team_id) {
        $team = \App\Models\Team::find($project->team_id);
        if ($team && $team->idem_subscription_plan) {
            $plan = $team->idem_subscription_plan;
            if ($plan === 'enterprise') {
                $categoryTags[] = 'Companies';
            } elseif ($plan === 'basic') {
                $categoryTags[] = 'Students';
            } else {
                $categoryTags[] = 'Regional';
            }
        }
    }
@endphp
 <a href="{{ $project->navigateTo() }}" class="group block"> <div class="glass-card border border-white/10 hover:border-primary/50 transition-all duration-300 min-h-[320px] flex flex-col">
{{-- Header avec Logo et Titre --}}
 <div class="p-6 border-b border-white/10"> <div class="flex items-start gap-4"> <div class="w-16 h-16 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center flex-shrink-0"> <span class="text-2xl font-bold text-primary">{{ strtoupper(substr($project->name, 0, 1)) }}</span> </div> <div class="flex-1 min-w-0"> <h3 class="text-xl font-bold text-white mb-2 truncate"> {{ $project->name }} </h3> <p class="text-sm text-gray-400 line-clamp-2"> {{ $project->description ?: 'No description available' }} </p> </div> </div> </div>
{{-- Resources Summary --}}
 <div class="p-6"> <div class="grid grid-cols-3 gap-3">
{{-- Total --}}
 <div class="text-center p-4 bg-primary/10 border border-primary/30 rounded-xl"> <div class="text-4xl font-bold text-primary mb-1">{{ $totalResources }}</div> <div class="text-xs text-gray-400 font-bold uppercase">Total</div> </div>
{{-- Active --}}
 <div class="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-xl"> <div class="flex items-center justify-center gap-2 mb-1"> <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div> <div class="text-4xl font-bold text-green-400">{{ $activeResources }}</div> </div> <div class="text-xs text-gray-400 font-bold uppercase">Active</div> </div>
{{-- Inactive --}}
 <div class="text-center p-4 bg-white/5 border border-white/10 rounded-xl"> <div class="text-4xl font-bold text-gray-400 mb-1">{{ $inactiveResources }}</div> <div class="text-xs text-gray-400 font-bold uppercase">Inactive</div> </div> </div> </div>
{{-- Tags Section --}}
 <div class="p-4 flex-grow"> <div class="space-y-3">
{{-- Resource Type Tags --}}

@if(count($resourceTypes) > 0) <div class="flex items-center gap-2 flex-wrap">
@foreach($resourceTypes as $type) <span class="inline-flex items-center px-3 py-1 text-xs font-semibold bg-white/5 text-gray-300 rounded-lg border border-white/10"> {{ $type }} </span>
@endforeach
 </div>
@endif

{{-- Category Tags --}}
 <div class="flex items-center gap-2 flex-wrap">
@foreach($categoryTags as $tag)
    <span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg
        @if($tag === 'Companies')
            bg-red-500/20 text-red-400 border border-red-500/40
        @elseif($tag === 'Students')
            bg-purple-500/20 text-purple-400 border border-purple-500/40
        @elseif($tag === 'Regional')
            bg-orange-500/20 text-orange-400 border border-orange-500/40
        @else
            bg-orange-500/20 text-orange-400 border border-orange-500/40
        @endif
    ">
        <span class="w-1.5 h-1.5 rounded-full
            @if($tag === 'Companies')
                bg-red-400
            @elseif($tag === 'Students')
                bg-purple-400
            @elseif($tag === 'Regional')
                bg-orange-400
            @else
                bg-orange-400
            @endif
        "></span>
        {{ $tag }}
    </span>
@endforeach
 </div> </div> </div>
{{-- Footer avec Date --}}
 <div class="px-4 py-2 border-t border-white/10"> <div class="flex items-center justify-between"> <span class="text-xs text-gray-500">Updated {{ $project->updated_at->format('M j, Y') }}</span> <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/> </svg> </div> </div> </div> </a>
@endforeach
 </div>
@if($projects->count() === 0) <div class="flex flex-col gap-4 items-center justify-center py-12"> <div class='text-xl font-semibold text-gray-400'>No projects found.</div> <p class="text-sm text-gray-500">Create your first project to get started</p> </div>
@endif

</section>

{{-- Servers Section --}}

<section class="px-6 pb-6"> <div class="max-w-7xl mx-auto"> <div class="flex items-center justify-between mb-4"> <div class="flex items-center gap-3"> <div class="w-10 h-10 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center"> <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path> </svg> </div> <h2 class="text-2xl font-bold text-white">SERVERS</h2> </div> <div class="flex items-center gap-3"> <div class="bg-primary/10 border border-primary/30 px-6 py-3 rounded-xl"> <div class="flex items-center gap-2"> <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div> <span class="text-primary text-sm font-bold tracking-wide">{{ count($servers) }} {{ count($servers) === 1 ? 'SERVER' : 'SERVERS' }}</span> </div> </div>
@if($servers->count() > 0 && $privateKeys->count() > 0) <x-modal-input buttonTitle="" title="New Server" :closeOutside="false"> <x-slot:content> <button class="inner-button flex items-center gap-2"> <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/> </svg> ADD SERVER </button> </x-slot:content> <livewire:server.create /> </x-modal-input>
@endif
 </div> </div>
@if($servers->count() > 0) <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
@foreach($servers as $server)
@php
$totalResources = 0; $activeResources = 0; $hasIssues = false; foreach ($server->destinations() ?? [] as $destination) { $totalResources += $destination->applications->count(); $activeResources += $destination->applications->where('status', 'running')->count(); } if (!$server->isFunctional()) { $hasIssues = true; }
@endphp
 <a href="{{ route('server.show', ['server_uuid' => $server->uuid]) }}" class="group block"> <div @class([ 'glass-card p-6 transition-all duration-300 min-h-[240px] flex flex-col', 'border-green-500/50 hover:border-green-500/70' => $server->isFunctional() && !$hasIssues, 'border-red-500/50 hover:border-red-500/70' => $hasIssues, 'border-white/10 hover:border-white/20' => !$server->isFunctional() && !$hasIssues, ])> <div class="flex items-start justify-between mb-3"> <div class="flex-1"> <div class="flex items-center gap-2 mb-1"> <h3 class="text-base font-semibold text-white"> {{ $server->name }} </h3>
@if($hasIssues) <span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded"> Issues </span>
@endif
 </div> <p class="text-xs text-gray-400 truncate"> {{ $server->description ?: $server->ip }} </p> </div> </div> <div class="grid grid-cols-2 gap-3 mb-4"> <div class="rounded-xl p-3 text-center bg-primary/10 border border-primary/30"> <div class="text-3xl font-bold text-primary">{{ $totalResources }}</div> <div class="text-xs text-gray-400 mt-1 font-bold uppercase">Resources</div> </div> <div @class([ 'rounded-xl p-3 text-center border', 'bg-green-500/10 border-green-500/30' => $server->isFunctional() && !$hasIssues, 'bg-red-500/10 border-red-500/30' => $hasIssues || !$server->isFunctional(), ])> <div class="flex items-center justify-center gap-2">
@if($server->isFunctional() && !$hasIssues) <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
@endif
 <div @class([ 'text-3xl font-bold', 'text-green-400' => $server->isFunctional() && !$hasIssues, 'text-red-400' => $hasIssues || !$server->isFunctional(), ])>{{ $activeResources }}</div> </div> <div @class([ 'text-xs mt-1 font-bold uppercase', 'text-gray-400' => $server->isFunctional() && !$hasIssues, 'text-gray-400' => $hasIssues || !$server->isFunctional(), ])>Active</div> </div> </div> <div class="mt-auto pt-4 border-t border-white/10"> <div class="flex items-center justify-between text-xs"> <span class="text-gray-400 truncate font-mono">{{ $server->ip }}</span> <span class="inline-flex items-center gap-1.5 ml-2"> <span @class([ 'w-2 h-2 rounded-full', 'bg-green-400 animate-pulse' => $server->isFunctional(), 'bg-red-400' => !$server->isFunctional(), ])></span> <span @class([ 'font-bold', 'text-green-400' => $server->isFunctional(), 'text-red-400' => !$server->isFunctional(), ])>{{ $server->isFunctional() ? 'ONLINE' : 'OFFLINE' }}</span> </span> </div> </div> </div> </a>
@endforeach
 </div>
@else

@if($privateKeys->count() === 0) <div class="flex flex-col gap-4 items-center justify-center py-12"> <div class='text-xl font-semibold text-gray-400'>No private keys found.</div> <div class="text-gray-500">Before you can add your server, first <x-modal-input buttonTitle="add a private key" title="New Private Key"> <livewire:security.private-key.create /> </x-modal-input> </div> </div>
@else
 <div class="flex flex-col gap-4 items-center justify-center py-12"> <div class='text-xl font-semibold text-gray-400'>No servers found.</div> <x-modal-input buttonTitle="Add Your First Server" title="New Server" :closeOutside="false"> <livewire:server.create /> </x-modal-input> </div>
@endif

@endif

</section>

</div>
