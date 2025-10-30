<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-slot:title>
        Projects | Coolify
    </x-slot>
    
    {{-- Header --}}
    <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
            <h1 class="text-3xl font-light text-gray-100">Projects</h1>
            @can('createAnyResource')
                <x-modal-input buttonTitle="+ Add" title="New Project">
                    <x-slot:content>
                        <button class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-lg hover:scale-105">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                            </svg>
                            Add
                        </button>
                    </x-slot:content>
                    <livewire:project.add-empty />
                </x-modal-input>
            @endcan
        </div>
        <p class="text-sm text-gray-400">All your projects are here.</p>
    </div>

    {{-- Projects Grid --}}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3" x-data="{ projects: @js($projects) }">
        <template x-for="project in projects" :key="project.uuid">
            <div class="group">
                <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer" @click="$wire.navigateToProject(project.uuid)">
                    {{-- Header --}}
                    <div class="p-5 border-b border-gray-700/50">
                        <div class="flex items-start gap-3">
                            {{-- Project Icon --}}
                            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                </svg>
                            </div>
                            
                            {{-- Project Info --}}
                            <div class="flex-1 min-w-0">
                                <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors mb-1 truncate" x-text="project.name"></h3>
                                <p class="text-sm text-gray-400 line-clamp-2" x-text="project.description || 'No description'"></p>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Actions Footer --}}
                    <div class="px-5 py-4 bg-gray-900/20 border-t border-gray-700/50" x-show="project.canUpdate || project.canCreateResource">
                        <div class="flex items-center gap-3">
                            <a wire:click.stop 
                               x-show="project.addResourceRoute"
                               :href="project.addResourceRoute"
                               class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:scale-105">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                </svg>
                                Add Resource
                            </a>
                            <a wire:click.stop
                               x-show="project.canUpdate"
                               :href="`/project/${project.uuid}/edit`"
                               class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg transition-all hover:scale-105">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                </svg>
                                Settings
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
    
    {{-- Empty State --}}
    <div x-show="projects.length === 0" class="flex flex-col items-center justify-center py-16">
        <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-300 mb-2">No projects yet</h3>
        <p class="text-sm text-gray-500 mb-4">Create your first project to get started</p>
        @can('createAnyResource')
            <x-modal-input buttonTitle="Create Project" title="New Project">
                <livewire:project.add-empty />
            </x-modal-input>
        @endcan
    </div>
</div>
