<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-slot:title>
        {{ data_get_str($project, 'name')->limit(10) }} > Resources | Ideploy
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
                class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                <template x-for="item in filteredApplications" :key="item.uuid">
                    <div>
                        <a class="group block" :href="item.hrefLink">
                            <div class="relative bg-gradient-to-br from-[#151b2e] to-[#0f1419] hover:from-[#1a2137] hover:to-[#141920] border border-gray-700/50 hover:border-blue-500/50 rounded-xl overflow-hidden transition-all duration-300 min-h-[200px] flex flex-col shadow-lg hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 group">
                                {{-- Header --}}
                                <div class="p-4 border-b border-gray-700/50">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 mb-1">
                                                <h3 class="text-base font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate" x-text="item.name"></h3>
                                                {{-- Status Badge --}}
                                                <template x-if="item.status.startsWith('running')">
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                                        Running
                                                    </span>
                                                </template>
                                                <template x-if="item.status.startsWith('exited')">
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                        Exited
                                                    </span>
                                                </template>
                                                <template x-if="item.status.startsWith('starting')">
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                                                        Starting
                                                    </span>
                                                </template>
                                                <template x-if="item.status.startsWith('restarting')">
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                                                        Restarting
                                                    </span>
                                                </template>
                                                <template x-if="item.status.startsWith('degraded')">
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                                        Degraded
                                                    </span>
                                                </template>
                                            </div>
                                            <p class="text-xs text-gray-400 line-clamp-1" x-text="item.description || 'No description'"></p>
                                        </div>
                                    </div>
                                </div>

                                {{-- Content --}}
                                <div class="p-4 flex-grow">
                                    <div class="space-y-2">
                                        <div class="flex items-center gap-2">
                                            <svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                            </svg>
                                            <span class="text-xs text-gray-400 truncate" x-text="item.fqdn || 'No FQDN configured'"></span>
                                        </div>
                                        <template x-if="item.server_status == false">
                                            <div class="flex items-center gap-2 text-xs text-red-400">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                                </svg>
                                                <span>Server has problems</span>
                                            </div>
                                        </template>
                                    </div>
                                </div>

                                {{-- Footer with Tags --}}
                                <div class="px-4 py-3 bg-gray-900/20 border-t border-gray-700/50">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <template x-for="tag in item.tags">
                                            <a :href="`/tags/${tag.name}`" class="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors" x-text="tag.name">
                                            </a>
                                        </template>
                                        <a :href="`${item.hrefLink}/tags`" class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-gray-700/50 text-gray-400 border border-gray-600 rounded hover:bg-gray-700 transition-colors">
                                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                            </svg>
                                            Add tag
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
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
                class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <template x-for="item in filteredDatabases" :key="item.uuid">
                    <x-resource-card />
                </template>
            </div>
            <template x-if="filteredServices.length > 0">
                <h2 class="pt-6 pb-4 text-xl font-light text-gray-100">Services</h2>
            </template>
            <div x-show="filteredServices.length > 0"
                class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <template x-for="item in filteredServices" :key="item.uuid">
                    <x-resource-card />
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
