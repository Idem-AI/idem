<div x-data x-init="$wire.loadServers" class="max-w-5xl mx-auto pb-12">
    {{-- Minimal Header --}}
    <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-[rgba(255,255,255,0.05)]">
        <div class="mb-4 md:mb-0">
            <h1 class="text-sm font-medium text-text-primary">Deploy Resource</h1>
            <p class="text-xs text-text-tertiary mt-0.5">Initialize a new resource in your infrastructure</p>
        </div>
        <div class="w-full md:w-64">
            <x-forms.select wire:model.live="selectedEnvironment">
                @foreach ($environments as $environment)
                    <option value="{{ $environment->name }}">Environment: {{ $environment->name }}</option>
                @endforeach
            </x-forms.select>
        </div>
    </header>

    <div x-data="searchResources()">
        @if ($current_step === 'type')
            {{-- Pro Search Bar (Seamless) --}}
            <div x-init="window.addEventListener('scroll', () => isSticky = window.pageYOffset > 100)" class="sticky z-10 top-10 mb-6">
                <div class="relative group">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg class="w-4 h-4 text-text-tertiary group-focus-within:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>
                    <input
                        autocomplete="off"
                        x-ref="searchInput"
                        x-model="search"
                        placeholder="Search resource type..."
                        @keydown.window.slash.prevent="$refs.searchInput.focus()"
                        class="w-full pl-9 pr-10 py-2.5 bg-surface-1 border border-[rgba(255,255,255,0.05)] rounded-glass text-sm text-text-primary placeholder-text-tertiary transition-all duration-300 focus:border-primary-500 focus:shadow-[0_0_15px_rgba(20,71,230,0.1)]"
                        :class="isSticky ? 'shadow-lg shadow-black/20' : ''">
                    <div class="absolute inset-y-0 right-3 flex items-center">
                        <kbd class="text-[9px] text-text-tertiary font-medium font-mono px-1.5 py-0.5 rounded border border-[rgba(255,255,255,0.1)] bg-surface-2">/</kbd>
                    </div>
                </div>
            </div>

            {{-- Loading State --}}
            <div x-show="loading" class="flex flex-col items-center justify-center py-12 border border-[rgba(255,255,255,0.05)] rounded-glass bg-surface-1">
                <div class="w-4 h-4 rounded-full border-2 border-primary-500/20 border-t-primary-500 animate-spin mb-3"></div>
                <p class="text-[10px] uppercase tracking-widest text-text-tertiary">Indexing registry</p>
            </div>

            {{-- Unified List View --}}
            <div x-show="!loading" class="border border-[rgba(255,255,255,0.05)] rounded-glass bg-surface-1 overflow-hidden">
                
                {{-- Git Based Applications --}}
                <div x-show="filteredGitBasedApplications.length > 0">
                    <div class="bg-[rgba(255,255,255,0.02)] px-4 py-2 border-b border-[rgba(255,255,255,0.05)] flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-primary-500 mt-px"></div>
                        <span class="text-[10px] text-text-tertiary uppercase tracking-widest font-medium">Git Based Applications</span>
                    </div>
                    <div class="divide-y divide-[rgba(255,255,255,0.05)] border-b border-[rgba(255,255,255,0.05)]">
                        <template x-for="application in filteredGitBasedApplications" :key="application.name">
                            <div x-on:click='setType(application.id)'
                                 class="group relative flex items-center gap-4 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer"
                                 :class="{ 'opacity-50 cursor-not-allowed': selecting }">
                                <div class="absolute left-0 inset-y-0 w-[2px] bg-primary-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                                <div class="w-8 h-8 flex-shrink-0 opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all flex items-center justify-center bg-white/5 rounded">
                                    <img :src="application.logo" class="w-5 h-5 object-contain">
                                </div>
                                <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                                    <h3 class="text-sm font-medium text-text-primary group-hover:text-primary-400 transition-colors truncate" x-text="application.name"></h3>
                                    <p class="text-[11px] text-text-tertiary truncate max-w-xs" x-html="window.sanitizeHTML(application.description)"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Docker Based Applications --}}
                <div x-show="filteredDockerBasedApplications.length > 0">
                    <div class="bg-[rgba(255,255,255,0.02)] px-4 py-2 border-b border-[rgba(255,255,255,0.05)] flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-px"></div>
                        <span class="text-[10px] text-text-tertiary uppercase tracking-widest font-medium">Docker Based Applications</span>
                    </div>
                    <div class="divide-y divide-[rgba(255,255,255,0.05)] border-b border-[rgba(255,255,255,0.05)]">
                        <template x-for="application in filteredDockerBasedApplications" :key="application.name">
                            <div x-on:click="setType(application.id)"
                                 class="group relative flex items-center gap-4 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer"
                                 :class="{ 'opacity-50 cursor-not-allowed': selecting }">
                                <div class="absolute left-0 inset-y-0 w-[2px] bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                                <div class="w-8 h-8 flex-shrink-0 opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all flex items-center justify-center bg-white/5 rounded">
                                    <img :src="application.logo" class="w-5 h-5 object-contain">
                                </div>
                                <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                                    <h3 class="text-sm font-medium text-text-primary group-hover:text-blue-400 transition-colors truncate" x-text="application.name"></h3>
                                    <p class="text-[11px] text-text-tertiary truncate max-w-xs" x-text="application.description"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Databases --}}
                <div x-show="filteredDatabases.length > 0">
                    <div class="bg-[rgba(255,255,255,0.02)] px-4 py-2 border-b border-[rgba(255,255,255,0.05)] flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-accent-500 mt-px"></div>
                        <span class="text-[10px] text-text-tertiary uppercase tracking-widest font-medium">Databases</span>
                    </div>
                    <div class="divide-y divide-[rgba(255,255,255,0.05)] border-b border-[rgba(255,255,255,0.05)]">
                        <template x-for="database in filteredDatabases" :key="database.id">
                            <div x-on:click="setType(database.id)"
                                 class="group relative flex items-center gap-4 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer"
                                 :class="{ 'opacity-50 cursor-not-allowed': selecting }">
                                <div class="absolute left-0 inset-y-0 w-[2px] bg-accent-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                                <div class="w-8 h-8 flex-shrink-0 opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all flex items-center justify-center bg-white/5 rounded">
                                    <span x-html="database.logo" class="w-5 h-5 flex items-center justify-center"></span>
                                </div>
                                <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                                    <h3 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors truncate" x-text="database.name"></h3>
                                    <p class="text-[11px] text-text-tertiary truncate max-w-xs" x-text="database.description"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Services --}}
                <div x-show="filteredServices.length > 0">
                    <div class="bg-[rgba(255,255,255,0.02)] px-4 py-2 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between" x-init="loadResources">
                        <div class="flex items-center gap-2">
                            <div class="w-1.5 h-1.5 rounded-full bg-purple-500 mt-px"></div>
                            <span class="text-[10px] text-text-tertiary uppercase tracking-widest font-medium">One-Click Services</span>
                        </div>
                        <button x-on:click="loadResources" class="text-[9px] uppercase tracking-widest text-text-tertiary hover:text-text-primary transition-colors">Reload List</button>
                    </div>
                    <div class="divide-y divide-[rgba(255,255,255,0.05)]">
                        <template x-for="service in filteredServices" :key="service.name">
                            <div x-on:click="setType('one-click-service-' + service.name)"
                                 class="group relative flex items-center gap-4 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer"
                                 :class="{ 'opacity-50 cursor-not-allowed': selecting }">
                                <div class="absolute left-0 inset-y-0 w-[2px] bg-purple-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                                <div class="w-8 h-8 flex-shrink-0 opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all flex items-center justify-center bg-white/5 rounded">
                                    <img :src='service.logo' class="w-5 h-5 object-contain"
                                         x-on:error.window="$event.target.src = service.logo_github_url"
                                         onerror="this.onerror=null; this.src=this.getAttribute('data-fallback');"
                                         x-on:error="$event.target.src = '/logo/logo_white.png'"
                                         :data-fallback='service.logo_github_url' />
                                </div>
                                <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                                    <h3 class="text-sm font-medium text-text-primary group-hover:text-purple-400 transition-colors truncate" x-text="service.name"></h3>
                                    <div class="flex items-center gap-3">
                                        <p class="text-[11px] text-text-tertiary truncate max-w-[200px]" x-text="service.slogan"></p>
                                        <template x-if="service.documentation">
                                            <a :href="service.documentation" target="_blank" onclick="event.stopPropagation()"
                                               class="hidden sm:flex text-[10px] text-text-tertiary hover:text-primary-400 transition-colors border border-[rgba(255,255,255,0.05)] rounded px-1.5 py-0.5">
                                                Docs
                                            </a>
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Empty Search State --}}
                <div x-show="filteredGitBasedApplications.length === 0 && filteredDockerBasedApplications.length === 0 && filteredDatabases.length === 0 && filteredServices.length === 0 && !loading" 
                     class="py-12 px-6 text-center">
                    <p class="text-xs text-text-tertiary">No matching resources found in registry.</p>
                </div>
            </div>
            
            <div x-show="!loading && filteredServices.length > 0" class="mt-4 px-2 flex justify-between items-center text-[9px] text-text-tertiary">
                <p>Trademarks are owned by respective companies. Use implies no affiliation.</p>
                <a href="https://ideploy.io/docs/services/overview" target="_blank" class="hover:text-text-primary transition-colors underline">View all services</a>
            </div>

            <script>
                function searchResources() {
                    return {
                        search: '',
                        loading: false,
                        selecting: false,
                        isSticky: false,
                        services: [],
                        gitBasedApplications: [],
                        dockerBasedApplications: [],
                        databases: [],
                        setType(type) {
                            if (this.selecting) return;
                            this.selecting = true;
                            this.$wire.setType(type);
                        },
                        async loadResources() {
                            this.loading = true;
                            const { services, gitBasedApplications, dockerBasedApplications, databases } = await this.$wire.loadServices();
                            this.services = services;
                            this.gitBasedApplications = gitBasedApplications;
                            this.dockerBasedApplications = dockerBasedApplications;
                            this.databases = databases;
                            this.loading = false;
                            this.$nextTick(() => this.$refs.searchInput?.focus());
                        },
                        filterAndSort(items) {
                            const searchLower = this.search.trim().toLowerCase();
                            const array = Object.values(items);
                            if (searchLower === '') return array.sort((a,b) => a.name.localeCompare(b.name));
                            return array.filter(item => 
                                item.name?.toLowerCase().includes(searchLower) || 
                                item.description?.toLowerCase().includes(searchLower) ||
                                (item.slogan && item.slogan.toLowerCase().includes(searchLower))
                            ).sort((a,b) => a.name.localeCompare(b.name));
                        },
                        get filteredGitBasedApplications() { return this.filterAndSort(this.gitBasedApplications); },
                        get filteredDockerBasedApplications() { return this.filterAndSort(this.dockerBasedApplications); },
                        get filteredDatabases() { return this.filterAndSort(this.databases); },
                        get filteredServices() { return this.filterAndSort(this.services); }
                    }
                }
            </script>
        @endif
    </div>

    {{-- Contiguous Grid Layout for Step: Deployment Choice --}}
    @if ($current_step === 'deployment-choice')
        <div x-data="{ showNoServersModal: false }" class="border border-[rgba(255,255,255,0.05)] rounded-glass overflow-hidden bg-surface-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[rgba(255,255,255,0.05)]">
            <div wire:click="chooseIdemManaged" class="group flex-1 p-6 sm:p-8 relative cursor-pointer hover:bg-surface-2 transition-colors flex flex-col">
                <div class="absolute top-0 left-0 w-full h-[1px] bg-primary-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></div>
                <header class="flex justify-between items-start mb-6">
                    <h3 class="text-sm font-medium text-text-primary group-hover:text-primary-400 transition-colors">IDEM Managed Infrastructure</h3>
                    <span class="text-[9px] uppercase tracking-widest text-primary-400 border border-primary-500/20 px-1.5 py-0.5 rounded-sm bg-primary-500/10">Recommended</span>
                </header>
                <div class="text-xs text-text-tertiary leading-relaxed mb-8 max-w-sm flex-1">
                    <p class="mb-2">Deploy instantly on our pre-configured network.</p>
                    <ul class="space-y-1 text-[11px]">
                        <li>— Automatic load balancing</li>
                        <li>— High availability</li>
                        <li>— Zero server maintenance</li>
                    </ul>
                </div>
                <div class="text-[11px] font-medium text-text-secondary group-hover:text-primary-400 transition-colors flex items-center gap-2 mt-auto">
                    <span>Select Path</span>
                    <svg class="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </div>
            </div>
            
            <div @if(count($servers ?? []) === 0) x-on:click="showNoServersModal = true" @else wire:click="choosePersonalServers" @endif class="group flex-1 p-6 sm:p-8 relative cursor-pointer hover:bg-surface-2 transition-colors flex flex-col">
                <div class="absolute top-0 left-0 w-full h-[1px] bg-accent-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></div>
                <header class="flex justify-between items-start mb-6">
                    <h3 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors">Private Infrastructure</h3>
                </header>
                <div class="text-xs text-text-tertiary leading-relaxed mb-8 max-w-sm flex-1">
                    <p class="mb-2">Total control over hardware and networking.</p>
                    <ul class="space-y-1 text-[11px]">
                        <li>— Connect custom nodes</li>
                        <li>— Bring your own cloud</li>
                        <li>— Manual scaling configured by you</li>
                    </ul>
                </div>
                <div class="text-[11px] font-medium text-text-secondary group-hover:text-accent-400 transition-colors flex items-center gap-2 mt-auto">
                    <span>Select Path</span>
                    <svg class="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </div>
            </div>

            {{-- The No Servers Modal --}}
            <template x-teleport="body">
                <div x-show="showNoServersModal" class="fixed inset-0 z-[100] flex items-center justify-center px-4" style="display: none;">
                    <div x-show="showNoServersModal" 
                         x-transition:enter="ease-out duration-300"
                         x-transition:enter-start="opacity-0"
                         x-transition:enter-end="opacity-100"
                         x-transition:leave="ease-in duration-200"
                         x-transition:leave-start="opacity-100"
                         x-transition:leave-end="opacity-0"
                         class="fixed inset-0 bg-black/60 backdrop-blur-sm" x-on:click="showNoServersModal = false"></div>
                    
                    <div x-show="showNoServersModal"
                         x-transition:enter="ease-out duration-300"
                         x-transition:enter-start="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                         x-transition:enter-end="opacity-100 translate-y-0 sm:scale-100"
                         x-transition:leave="ease-in duration-200"
                         x-transition:leave-start="opacity-100 translate-y-0 sm:scale-100"
                         x-transition:leave-end="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                         class="relative bg-surface-1 border border-[rgba(255,255,255,0.05)] rounded-glass shadow-2xl p-6 sm:p-8 max-w-md w-full transform transition-all">
                        
                        <div class="mb-6 flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-medium text-text-primary mb-2">No Private Nodes Detected</h3>
                                <p class="text-xs text-text-tertiary leading-relaxed">You don't have any personal servers. Please add a server first or choose IDEM Managed Servers.</p>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-3 pt-6 border-t border-[rgba(255,255,255,0.05)]">
                            <button type="button" x-on:click="showNoServersModal = false" class="text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors px-3">Cancel</button>
                            <a href="/servers" class="inner-button px-5 py-2 inline-flex items-center justify-center text-xs font-medium">Add Server</a>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    @endif

    {{-- Contiguous Grid Layout for Step: Servers --}}
    @if ($current_step === 'servers')
        <div class="border border-[rgba(255,255,255,0.05)] rounded-glass overflow-hidden bg-surface-1">
            <div class="bg-[rgba(255,255,255,0.02)] px-4 py-3 border-b border-[rgba(255,255,255,0.05)] flex justify-between items-center">
                <span class="text-[10px] text-text-tertiary uppercase tracking-widest font-medium">Select Host Node</span>
                <a href="/servers" class="text-[10px] text-text-tertiary hover:text-text-primary underline transition-colors">Manage Servers</a>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0">
                @if ($onlyBuildServerAvailable)
                    <div class="col-span-full p-6 bg-orange-500/5 text-center">
                        <p class="text-[11px] text-orange-400 mb-3">No valid compute nodes available.</p>
                        <x-forms.button class="button-sm">Configure Nodes</x-forms.button>
                    </div>
                @else
                    @forelse($servers ?? [] as $index => $server)
                        <div wire:click="setServer({{ $server }})"
                             class="group relative p-5 hover:bg-surface-2 transition-colors cursor-pointer flex items-center justify-between
                                    {{ $index % 3 !== 2 ? 'lg:border-r border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index % 2 !== 1 ? 'sm:border-r lg:border-r-0 border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index >= 3 ? 'lg:border-t border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index >= 2 ? 'sm:border-t lg:border-t-0 border-[rgba(255,255,255,0.05)]' : '' }}">
                            
                            <div class="absolute inset-y-0 left-0 w-[1px] bg-primary-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                            
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <div class="w-1.5 h-1.5 rounded-full bg-green-500/50 group-hover:bg-green-400 transition-colors"></div>
                                    <h4 class="text-sm font-medium text-text-primary group-hover:text-primary-400 transition-colors truncate">{{ $server->name }}</h4>
                                </div>
                                <p class="text-[11px] text-text-tertiary pl-3.5">{{ $server->description ?: 'Status: Ready' }}</p>
                            </div>
                        </div>
                    @empty
                        <div class="col-span-full p-8 text-center">
                            <p class="text-xs text-text-tertiary">No validated servers detected.</p>
                        </div>
                    @endforelse
                @endif
            </div>
        </div>
    @endif

    {{-- Contiguous Grid for Destinations --}}
    @if ($current_step === 'destinations')
        <div class="border border-[rgba(255,255,255,0.05)] rounded-glass overflow-hidden bg-surface-1">
            <div class="bg-[rgba(255,255,255,0.02)] px-4 py-3 border-b border-[rgba(255,255,255,0.05)] flex justify-between items-center">
                <span class="text-[10px] text-text-tertiary uppercase tracking-widest font-medium">Select Network Destination</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0">
                @if ($server->isSwarm())
                    @foreach ($swarmDockers ?? [] as $index => $swarmDocker)
                        <div wire:click="setDestination('{{ $swarmDocker->uuid }}')"
                             class="group relative p-5 hover:bg-surface-2 transition-colors cursor-pointer
                                    {{ $index % 3 !== 2 ? 'lg:border-r border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index % 2 !== 1 ? 'sm:border-r lg:border-r-0 border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index >= 3 ? 'lg:border-t border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index >= 2 ? 'sm:border-t lg:border-t-0 border-[rgba(255,255,255,0.05)]' : '' }}">
                            <div class="absolute inset-y-0 left-0 w-[1px] bg-accent-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                            <h4 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors mb-1">Swarm Endpoint</h4>
                            <p class="text-[11px] text-text-tertiary">{{ $swarmDocker->name }}</p>
                        </div>
                    @endforeach
                @else
                    @foreach ($standaloneDockers ?? [] as $index => $standaloneDocker)
                        <div wire:click="setDestination('{{ $standaloneDocker->uuid }}')"
                             class="group relative p-5 hover:bg-surface-2 transition-colors cursor-pointer
                                    {{ $index % 3 !== 2 ? 'lg:border-r border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index % 2 !== 1 ? 'sm:border-r lg:border-r-0 border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index >= 3 ? 'lg:border-t border-[rgba(255,255,255,0.05)]' : '' }}
                                    {{ $index >= 2 ? 'sm:border-t lg:border-t-0 border-[rgba(255,255,255,0.05)]' : '' }}">
                            <div class="absolute inset-y-0 left-0 w-[1px] bg-accent-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                            <h4 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors mb-1">{{ $standaloneDocker->name }}</h4>
                            <p class="text-[10px] text-text-tertiary bg-white/5 inline-block px-1.5 py-0.5 rounded">{{ $standaloneDocker->network }}</p>
                        </div>
                    @endforeach
                @endif
            </div>
        </div>
    @endif

    {{-- Contiguous Grid for PostgreSQL --}}
    @if ($current_step === 'select-postgresql-type')
        <div x-data="{ selecting: false }" class="border border-[rgba(255,255,255,0.05)] rounded-glass overflow-hidden bg-surface-1">
            <div class="bg-[rgba(255,255,255,0.02)] px-4 py-3 border-b border-[rgba(255,255,255,0.05)]">
                <span class="text-[10px] text-text-tertiary uppercase tracking-widest font-medium">Select PostgreSQL Engine</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[rgba(255,255,255,0.05)]">
                <div class="group relative p-6 hover:bg-surface-2 transition-colors cursor-pointer flex flex-col"
                    :class="{ 'opacity-50 cursor-not-allowed': selecting }"
                    x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('postgres:17-alpine'))">
                    <div class="absolute inset-y-0 left-0 w-[1px] bg-primary-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    <header class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-medium text-text-primary group-hover:text-primary-400 transition-colors">Standard v17</h3>
                        <span class="text-[9px] uppercase tracking-widest text-text-tertiary border border-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded-sm bg-surface-base">Default</span>
                    </header>
                    <p class="text-xs text-text-tertiary leading-relaxed mb-6 max-w-sm flex-1">
                        Base distribution. Light, fast, and secure. Standard performance.
                    </p>
                </div>

                <div class="group relative p-6 hover:bg-surface-2 transition-colors cursor-pointer flex flex-col"
                    :class="{ 'opacity-50 cursor-not-allowed': selecting }"
                    x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('supabase/postgres:17.4.1.032'))">
                    <div class="absolute inset-y-0 left-0 w-[1px] bg-accent-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    <header class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors">Supabase Pack</h3>
                    </header>
                    <p class="text-xs text-text-tertiary leading-relaxed mb-6 max-w-sm flex-1">
                        Includes PostGIS, pgvector, and cloud extensions pre-installed.
                    </p>
                </div>

                <div class="group relative p-6 border-t border-[rgba(255,255,255,0.05)] hover:bg-surface-2 transition-colors cursor-pointer flex flex-col"
                    :class="{ 'opacity-50 cursor-not-allowed': selecting }"
                    x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('postgis/postgis:17-3.5-alpine'))">
                    <div class="absolute inset-y-0 left-0 w-[1px] bg-green-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    <header class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-medium text-text-primary group-hover:text-green-400 transition-colors">PostGIS</h3>
                        <span class="text-[9px] uppercase tracking-widest text-text-tertiary border border-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded-sm bg-surface-base">AMD only</span>
                    </header>
                    <p class="text-xs text-text-tertiary leading-relaxed mb-6 max-w-sm flex-1">
                        Geospatial extensions built-in for advanced location mapping.
                    </p>
                </div>

                <div class="group relative p-6 border-t border-[rgba(255,255,255,0.05)] hover:bg-surface-2 transition-colors cursor-pointer flex flex-col"
                    :class="{ 'opacity-50 cursor-not-allowed': selecting }"
                    x-on:click="!selecting && (selecting = true, $wire.setPostgresqlType('pgvector/pgvector:pg17'))">
                    <div class="absolute inset-y-0 left-0 w-[1px] bg-purple-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    <header class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-medium text-text-primary group-hover:text-purple-400 transition-colors">PGVector v17</h3>
                    </header>
                    <p class="text-xs text-text-tertiary leading-relaxed mb-6 max-w-sm flex-1">
                        Dedicated vector embedding store for AI/ML workloads.
                    </p>
                </div>
            </div>
        </div>
    @endif

    @if ($current_step === 'existing-postgresql')
        <div class="border border-[rgba(255,255,255,0.05)] rounded-glass bg-surface-1 p-6 sm:p-8">
            <header class="mb-6">
                <h2 class="text-sm font-medium text-text-primary">Connect Foreign URI</h2>
                <p class="text-xs text-text-tertiary mt-1">Link an existing external database.</p>
            </header>
            <form wire:submit='addExistingPostgresql' class="flex flex-col sm:flex-row gap-4">
                <div class="flex-1">
                    <x-forms.input placeholder="postgres://user:pass@host:5432/db" id="existingPostgresqlUrl" />
                </div>
                <button type="submit" class="inner-button px-6 text-xs whitespace-nowrap">Link Database</button>
            </form>
        </div>
    @endif
</div>
