<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-slot:title>
        {{ data_get_str($project, 'name')->limit(10) }} > Resources | Coolify
    </x-slot>
    <div class="flex flex-col">
        <div class="flex items-center gap-2 mb-4">
            <h1 class="text-2xl font-light text-gray-100">Resources</h1>
            @if ($environment->isEmpty())
                @can('createAnyResource')
                    <a class="button"
                        href="{{ route('project.clone-me', ['project_uuid' => data_get($project, 'uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}">
                        Clone
                    </a>
                @endcan
            @else
                @can('createAnyResource')
                    <a href="{{ route('project.resource.create', ['project_uuid' => data_get($parameters, 'project_uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}"
                        class="button">+
                        New</a>
                @endcan
                @can('createAnyResource')
                    <a class="button"
                        href="{{ route('project.clone-me', ['project_uuid' => data_get($project, 'uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}">
                        Clone
                    </a>
                @endcan
            @endif
            @can('delete', $environment)
                <livewire:project.delete-environment :disabled="!$environment->isEmpty()" :environment_id="$environment->id" />
            @endcan
        </div>
        <nav class="flex pt-2 pb-6">
            <ol class="flex items-center">
                <li class="inline-flex items-center">
                    <a class="text-xs truncate lg:text-sm"
                        href="{{ route('project.show', ['project_uuid' => data_get($parameters, 'project_uuid')]) }}">
                        {{ $project->name }}</a>
                </li>
                <li>
                    <div class="flex items-center">
                        <svg aria-hidden="true" class="w-4 h-4 mx-1 font-bold dark:text-warning" fill="currentColor"
                            viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clip-rule="evenodd"></path>
                        </svg>

                        <livewire:project.resource.environment-select :environments="$project->environments" />
                    </div>
                </li>
            </ol>
        </nav>
    </div>
    @if ($environment->isEmpty())
        @can('createAnyResource')
            <a href="{{ route('project.resource.create', ['project_uuid' => data_get($parameters, 'project_uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}"
                class="items-center justify-center box">+ Add Resource</a>
        @else
            <div
                class="flex flex-col items-center justify-center p-8 text-center border border-dashed border-neutral-300 dark:border-coolgray-300 rounded-lg">
                <h3 class="mb-2 text-lg font-semibold text-neutral-600 dark:text-neutral-400">No Resources Found</h3>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">
                    This environment doesn't have any resources yet.<br>
                    Contact your team administrator to add resources.
                </p>
            </div>
        @endcan
    @else
        <div x-data="searchComponent()">
            <x-forms.input placeholder="Search for name, fqdn..." x-model="search" id="null" />
            <template
                x-if="filteredApplications.length === 0 && filteredDatabases.length === 0 && filteredServices.length === 0">
                <div class="flex flex-col items-center justify-center p-8 text-center">
                    <div x-show="search.length > 0">
                        <p class="text-neutral-600 dark:text-neutral-400">No resource found with the search term "<span
                                class="font-semibold" x-text="search"></span>".</p>
                        <p class="text-sm text-neutral-500 dark:text-neutral-500 mt-1">Try adjusting your search
                            criteria.</p>
                    </div>
                    <div x-show="search.length === 0">
                        <p class="text-neutral-600 dark:text-neutral-400">No resources found in this environment.</p>
                        @cannot('createAnyResource')
                            <p class="text-sm text-neutral-500 dark:text-neutral-500 mt-1">Contact your team administrator
                                to add resources.</p>
                        @endcannot
                    </div>
                </div>
            </template>

            <template x-if="filteredApplications.length > 0">
                <div class="pt-6 pb-4 flex items-center gap-3">
                    <div class="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-lg border border-blue-500/30">
                        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
                        </svg>
                    </div>
                    <h2 class="text-xl font-bold text-white">Applications</h2>
                    <span class="px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30" x-text="filteredApplications.length"></span>
                </div>
            </template>
            <div x-show="filteredApplications.length > 0"
                class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <template x-for="item in filteredApplications" :key="item.uuid">
                    <a :href="item.hrefLink" class="group block">
                        <div class="relative bg-black border border-gray-800 hover:border-gray-700 rounded-lg p-5 transition-all duration-200 hover:bg-[#0a0a0a]">
                            {{-- Header avec icône framework + actions --}}
                            <div class="flex items-start justify-between gap-4 mb-4">
                                <div class="flex items-start gap-3 flex-1 min-w-0">
                                    {{-- Framework Icon --}}
                                    <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-lg border border-blue-500/30 flex items-center justify-center">
                                        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
                                        </svg>
                                    </div>
                                    
                                    {{-- Titre + description --}}
                                    <div class="flex-1 min-w-0">
                                        <h3 class="text-base font-semibold text-white group-hover:text-blue-400 transition-colors truncate mb-1" x-text="item.name"></h3>
                                        <p class="text-sm text-gray-500 truncate" x-text="item.fqdn || 'No domain configured'"></p>
                                    </div>
                                </div>
                                
                                {{-- Actions (status + menu) --}}
                                <div class="flex items-center gap-2 flex-shrink-0">
                                    {{-- Status Badge --}}
                                    <template x-if="item.status.startsWith('running')">
                                        <div class="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
                                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                            <span class="text-xs text-green-500 font-medium">Running</span>
                                        </div>
                                    </template>
                                    <template x-if="item.status.startsWith('exited')">
                                        <div class="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
                                            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                            <span class="text-xs text-red-500 font-medium">Exited</span>
                                        </div>
                                    </template>
                                    <template x-if="item.status.startsWith('starting')">
                                        <div class="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                                            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                                            <span class="text-xs text-yellow-500 font-medium">Starting</span>
                                        </div>
                                    </template>
                                    
                                    {{-- Menu 3 dots --}}
                                    <button class="p-1.5 hover:bg-gray-800 rounded-md transition-colors" @click.prevent>
                                        <svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 16 16">
                                            <circle cx="8" cy="3" r="1.5"/>
                                            <circle cx="8" cy="8" r="1.5"/>
                                            <circle cx="8" cy="13" r="1.5"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            {{-- Metadata (git + commit) --}}
                            <div class="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                <div class="flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                                    </svg>
                                    <span class="truncate" x-text="item.git_repository || 'No repository'"></span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                                    </svg>
                                    <span x-text="item.last_commit || 'Initial commit'"></span>
                                </div>
                            </div>
                            
                            {{-- Footer: Date + Branch --}}
                            <div class="flex items-center justify-between text-xs text-gray-600">
                                <div class="flex items-center gap-1">
                                    <span x-text="item.updated_at || 'Just now'"></span>
                                    <span>on</span>
                                    <div class="flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                                        </svg>
                                        <span class="font-medium" x-text="item.git_branch || 'main'"></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </template>
            </div>
            <template x-if="filteredDatabases.length > 0">
                <div class="pt-6 pb-4 flex items-center gap-3">
                    <div class="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-lg border border-indigo-500/30">
                        <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                        </svg>
                    </div>
                    <h2 class="text-xl font-bold text-white">Databases</h2>
                    <span class="px-2 py-1 text-xs font-semibold bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30" x-text="filteredDatabases.length"></span>
                </div>
            </template>
            <div x-show="filteredDatabases.length > 0"
                class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <template x-for="item in filteredDatabases" :key="item.uuid">
                    <a :href="item.hrefLink" class="group block">
                        <div class="relative bg-black border border-gray-800 hover:border-gray-700 rounded-lg p-5 transition-all duration-200 hover:bg-[#0a0a0a]">
                            {{-- Header avec icône database + actions --}}
                            <div class="flex items-start justify-between gap-4 mb-4">
                                <div class="flex items-start gap-3 flex-1 min-w-0">
                                    {{-- Database Icon --}}
                                    <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-lg border border-indigo-500/30 flex items-center justify-center">
                                        <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                                        </svg>
                                    </div>
                                    
                                    {{-- Titre + type --}}
                                    <div class="flex-1 min-w-0">
                                        <h3 class="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors truncate mb-1" x-text="item.name"></h3>
                                        <p class="text-sm text-gray-500 truncate" x-text="item.type || 'Database'"></p>
                                    </div>
                                </div>
                                
                                {{-- Actions (status + menu) --}}
                                <div class="flex items-center gap-2 flex-shrink-0">
                                    {{-- Status Badge --}}
                                    <template x-if="item.status && item.status.startsWith('running')">
                                        <div class="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
                                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                            <span class="text-xs text-green-500 font-medium">Running</span>
                                        </div>
                                    </template>
                                    <template x-if="item.status && item.status.startsWith('exited')">
                                        <div class="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
                                            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                            <span class="text-xs text-red-500 font-medium">Exited</span>
                                        </div>
                                    </template>
                                    
                                    {{-- Menu 3 dots --}}
                                    <button class="p-1.5 hover:bg-gray-800 rounded-md transition-colors" @click.prevent>
                                        <svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 16 16">
                                            <circle cx="8" cy="3" r="1.5"/>
                                            <circle cx="8" cy="8" r="1.5"/>
                                            <circle cx="8" cy="13" r="1.5"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            {{-- Metadata --}}
                            <div class="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                <div class="flex items-center gap-1.5" x-show="item.fqdn">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                    </svg>
                                    <span class="truncate" x-text="item.fqdn"></span>
                                </div>
                                <template x-if="item.server_status == false">
                                    <div class="flex items-center gap-1.5 text-red-500">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                        </svg>
                                        <span>Server issue</span>
                                    </div>
                                </template>
                            </div>
                            
                            {{-- Footer: Updated date --}}
                            <div class="flex items-center justify-between text-xs text-gray-600">
                                <span x-text="item.updated_at || 'Just now'"></span>
                            </div>
                        </div>
                    </a>
                </template>
            </div>
            <template x-if="filteredServices.length > 0">
                <div class="pt-6 pb-4 flex items-center gap-3">
                    <div class="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-lg border border-emerald-500/30">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                        </svg>
                    </div>
                    <h2 class="text-xl font-bold text-white">Services</h2>
                    <span class="px-2 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30" x-text="filteredServices.length"></span>
                </div>
            </template>
            <div x-show="filteredServices.length > 0"
                class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <template x-for="item in filteredServices" :key="item.uuid">
                    <a :href="item.hrefLink" class="group block">
                        <div class="relative bg-black border border-gray-800 hover:border-gray-700 rounded-lg p-5 transition-all duration-200 hover:bg-[#0a0a0a]">
                            {{-- Header avec icône service + actions --}}
                            <div class="flex items-start justify-between gap-4 mb-4">
                                <div class="flex items-start gap-3 flex-1 min-w-0">
                                    {{-- Service Icon --}}
                                    <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-lg border border-emerald-500/30 flex items-center justify-center">
                                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                                        </svg>
                                    </div>
                                    
                                    {{-- Titre + type --}}
                                    <div class="flex-1 min-w-0">
                                        <h3 class="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors truncate mb-1" x-text="item.name"></h3>
                                        <p class="text-sm text-gray-500 truncate" x-text="item.type || 'Service'"></p>
                                    </div>
                                </div>
                                
                                {{-- Actions (status + menu) --}}
                                <div class="flex items-center gap-2 flex-shrink-0">
                                    {{-- Status Badge --}}
                                    <template x-if="item.status && item.status.startsWith('running')">
                                        <div class="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
                                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                            <span class="text-xs text-green-500 font-medium">Running</span>
                                        </div>
                                    </template>
                                    <template x-if="item.status && item.status.startsWith('exited')">
                                        <div class="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
                                            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                            <span class="text-xs text-red-500 font-medium">Exited</span>
                                        </div>
                                    </template>
                                    
                                    {{-- Menu 3 dots --}}
                                    <button class="p-1.5 hover:bg-gray-800 rounded-md transition-colors" @click.prevent>
                                        <svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 16 16">
                                            <circle cx="8" cy="3" r="1.5"/>
                                            <circle cx="8" cy="8" r="1.5"/>
                                            <circle cx="8" cy="13" r="1.5"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            {{-- Metadata --}}
                            <div class="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                <div class="flex items-center gap-1.5" x-show="item.fqdn">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                    </svg>
                                    <span class="truncate" x-text="item.fqdn"></span>
                                </div>
                                <template x-if="item.server_status == false">
                                    <div class="flex items-center gap-1.5 text-red-500">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                        </svg>
                                        <span>Server issue</span>
                                    </div>
                                </template>
                            </div>
                            
                            {{-- Footer: Updated date --}}
                            <div class="flex items-center justify-between text-xs text-gray-600">
                                <span x-text="item.updated_at || 'Just now'"></span>
                            </div>
                        </div>
                    </a>
                </template>
            </div>
        </div>
    @endif

</div>

<script>
    function sortFn(a, b) {
        return a.name.localeCompare(b.name)
    }

    function searchComponent() {
        return {
            search: '',
            applications: @js($applications),
            postgresqls: @js($postgresqls),
            redis: @js($redis),
            mongodbs: @js($mongodbs),
            mysqls: @js($mysqls),
            mariadbs: @js($mariadbs),
            keydbs: @js($keydbs),
            dragonflies: @js($dragonflies),
            clickhouses: @js($clickhouses),
            services: @js($services),
            filterAndSort(items) {
                if (this.search === '') {
                    return Object.values(items).sort(sortFn);
                }
                const searchLower = this.search.toLowerCase();
                return Object.values(items).filter(item => {
                    return (item.name?.toLowerCase().includes(searchLower) ||
                        item.fqdn?.toLowerCase().includes(searchLower) ||
                        item.description?.toLowerCase().includes(searchLower) ||
                        item.tags?.some(tag => tag.name.toLowerCase().includes(searchLower)));
                }).sort(sortFn);
            },
            get filteredApplications() {
                return this.filterAndSort(this.applications)
            },
            get filteredDatabases() {
                return [
                    this.postgresqls,
                    this.redis,
                    this.mongodbs,
                    this.mysqls,
                    this.mariadbs,
                    this.keydbs,
                    this.dragonflies,
                    this.clickhouses,
                ].flatMap((items) => this.filterAndSort(items))
            },
            get filteredServices() {
                return this.filterAndSort(this.services)
            }
        };
    }
</script>
