<div x-data="searchResources()" x-init="$wire.loadServers; window.addEventListener('scroll', () => isSticky = window.pageYOffset > 100); loadResources()">
    {{-- Header Section --}}
    <div class="mb-8">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-3xl font-bold text-white mb-2">Create New Resource</h1>
                <p class="text-base text-gray-400">Deploy applications, databases, and services to your infrastructure</p>
            </div>
            <div class="w-full lg:w-96">
                <x-forms.select wire:model.live="selectedEnvironment" class="bg-[#0a0a0a] border-gray-800">
                    @foreach ($environments as $environment)
                        <option value="{{ $environment->name }}">{{ $environment->name }}</option>
                    @endforeach
                </x-forms.select>
            </div>
        </div>

        {{-- Search Bar --}}
        <div class="sticky z-10 top-10 py-2">
            <div class="relative">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input 
                    autocomplete="off" 
                    x-ref="searchInput" 
                    x-model="search" 
                    placeholder="Search resources... (press / to focus)"
                    @keydown.window.slash.prevent="$refs.searchInput.focus()"
                    class="w-full pl-12 pr-16 py-4 bg-[#0a0a0a] border rounded-xl text-white placeholder-gray-500 transition-all text-base"
                    :class="isSticky ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-gray-800 focus:border-blue-500'">
                <span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 px-2 py-1 bg-gray-800/50 rounded border border-gray-700">/</span>
            </div>
        </div>
    </div>

    @if ($current_step === 'type')
        <div>
            {{-- Loading State --}}
            <div x-show="loading" class="flex items-center justify-center py-20">
                <div class="text-center">
                    <div class="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
                    <p class="mt-6 text-base text-gray-400">Loading resources...</p>
                </div>
            </div>

            <div x-show="!loading" class="space-y-12">
                {{-- Git Based Applications --}}
                <div x-show="filteredGitBasedApplications.length > 0">
                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-white mb-2">Applications</h2>
                        <p class="text-sm text-gray-400 uppercase tracking-wide">Git Based</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <template x-for="application in filteredGitBasedApplications" :key="application.name">
                            <div x-on:click='setType(application.id)'
                                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                                class="group relative bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 transition-all hover:border-blue-500 hover:bg-[#0f0f0f]">
                                
                                {{-- Category Tag --}}
                                <div class="absolute top-4 left-4">
                                    <span class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Application</span>
                                </div>
                                
                                {{-- Logo --}}
                                <div class="flex items-center justify-center py-8 mt-6">
                                    <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center overflow-hidden">
                                        <img :src="application.logo" class="w-12 h-12 object-contain transition-transform group-hover:scale-110" />
                                    </div>
                                </div>
                                
                                {{-- Content --}}
                                <div class="text-center mt-4">
                                    <h3 class="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors" x-text="application.name"></h3>
                                    <p class="text-sm text-gray-400 line-clamp-2" x-html="window.sanitizeHTML(application.description)"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Docker Based Applications --}}
                <div x-show="filteredDockerBasedApplications.length > 0">
                    <div class="mb-6">
                        <p class="text-sm text-gray-400 uppercase tracking-wide">Docker Based</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <template x-for="application in filteredDockerBasedApplications" :key="application.name">
                            <div x-on:click="setType(application.id)"
                                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                                class="group relative bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 transition-all hover:border-blue-500 hover:bg-[#0f0f0f]">
                                
                                {{-- Category Tag --}}
                                <div class="absolute top-4 left-4">
                                    <span class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Docker</span>
                                </div>
                                
                                {{-- Logo --}}
                                <div class="flex items-center justify-center py-8 mt-6">
                                    <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center overflow-hidden">
                                        <img :src="application.logo" class="w-12 h-12 object-contain transition-transform group-hover:scale-110" />
                                    </div>
                                </div>
                                
                                {{-- Content --}}
                                <div class="text-center mt-4">
                                    <h3 class="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors" x-text="application.name"></h3>
                                    <p class="text-sm text-gray-400 line-clamp-2" x-text="application.description"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Databases --}}
                <div x-show="filteredDatabases.length > 0">
                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-white mb-2">Databases</h2>
                        <p class="text-sm text-gray-400">Popular database engines for your applications</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <template x-for="database in filteredDatabases" :key="database.id">
                            <div x-on:click="setType(database.id)"
                                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                                class="group relative bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 transition-all hover:border-green-500 hover:bg-[#0f0f0f]">
                                
                                {{-- Category Tag --}}
                                <div class="absolute top-4 left-4">
                                    <span class="text-xs text-green-500 uppercase tracking-wider font-semibold">Database</span>
                                </div>
                                
                                {{-- Logo --}}
                                <div class="flex items-center justify-center py-8 mt-6">
                                    <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 flex items-center justify-center">
                                        <span x-show="database.logo" x-html="database.logo" class="text-4xl transition-transform group-hover:scale-110"></span>
                                    </div>
                                </div>
                                
                                {{-- Content --}}
                                <div class="text-center mt-4">
                                    <h3 class="text-lg font-bold text-white mb-2 group-hover:text-green-400 transition-colors" x-text="database.name"></h3>
                                    <p class="text-sm text-gray-400 line-clamp-2" x-text="database.description"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Services --}}
                <div x-show="filteredServices.length > 0">
                    <div class="mb-6 flex items-center justify-between">
                        <div>
                            <h2 class="text-2xl font-bold text-white mb-2">Services</h2>
                            <p class="text-sm text-gray-400">One-click services and integrations</p>
                        </div>
                        <button x-on:click="loadResources" 
                                class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg border border-gray-700 transition-all">
                            Reload List
                        </button>
                    </div>

                    <div class="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p class="text-sm text-blue-300">
                            <strong>Note:</strong> The respective trademarks mentioned here are owned by the respective companies. 
                            Use of them does not imply any affiliation or endorsement. 
                            <a class="underline hover:text-blue-200" target="_blank" href="https://coolify.io/docs/services/overview">Learn more →</a>
                        </p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <template x-for="service in filteredServices" :key="service.name">
                            <div x-on:click="setType('one-click-service-' + service.name)"
                                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                                class="group relative bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 transition-all hover:border-purple-500 hover:bg-[#0f0f0f]">
                                
                                {{-- Category Tag --}}
                                <div class="absolute top-4 left-4">
                                    <span class="text-xs text-purple-500 uppercase tracking-wider font-semibold">Service</span>
                                </div>

                                {{-- Documentation Link --}}
                                <div class="absolute top-4 right-4" x-show="service.documentation">
                                    <a :href="service.documentation" 
                                       target="_blank"
                                       onclick="event.stopPropagation()"
                                       class="text-xs text-gray-500 hover:text-blue-400 transition-colors">
                                        Docs →
                                    </a>
                                </div>
                                
                                {{-- Logo --}}
                                <div class="flex items-center justify-center py-8 mt-6">
                                    <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center overflow-hidden">
                                        <template x-if="service.logo">
                                            <img :src='service.logo'
                                                class="w-12 h-12 object-contain transition-transform group-hover:scale-110"
                                                x-on:error.window="$event.target.src = service.logo_github_url"
                                                onerror="this.onerror=null; this.src=this.getAttribute('data-fallback');"
                                                x-on:error="$event.target.src = '/coolify-logo.svg'"
                                                :data-fallback='service.logo_github_url' />
                                        </template>
                                    </div>
                                </div>
                                
                                {{-- Content --}}
                                <div class="text-center mt-4">
                                    <h3 class="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors" x-text="service.name"></h3>
                                    <p class="text-sm text-gray-400 line-clamp-2" x-text="service.slogan"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Empty State --}}
                <div x-show="filteredGitBasedApplications.length === 0 && filteredDockerBasedApplications.length === 0 && filteredDatabases.length === 0 && filteredServices.length === 0 && loading === false"
                     class="py-20 text-center">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800/50 mb-6">
                        <svg class="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">No resources found</h3>
                    <p class="text-gray-400">Try adjusting your search query</p>
                </div>
            </div>

            <script>
                function sortFn(a, b) {
                    return a.name.localeCompare(b.name)
                }

                function searchResources() {
                    return {
                        search: '',
                        loading: false,
                        isSticky: false,
                        selecting: false,
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
                            const {
                                services,
                                gitBasedApplications,
                                dockerBasedApplications,
                                databases
                            } = await this.$wire.loadServices();
                            this.services = services;
                            this.gitBasedApplications = gitBasedApplications;
                            this.dockerBasedApplications = dockerBasedApplications;
                            this.databases = databases;
                            this.loading = false;
                            this.$nextTick(() => {
                                this.$refs.searchInput.focus();
                            });
                        },
                        filterAndSort(items, isSort = true) {
                            const searchLower = this.search.trim().toLowerCase();

                            if (searchLower === '') {
                                return isSort ? Object.values(items).sort(sortFn) : Object.values(items);
                            }
                            const filtered = Object.values(items).filter(item => {
                                return (item.name?.toLowerCase().includes(searchLower) ||
                                    item.description?.toLowerCase().includes(searchLower) ||
                                    item.slogan?.toLowerCase().includes(searchLower))
                            })
                            return isSort ? filtered.sort(sortFn) : filtered;
                        },
                        get filteredGitBasedApplications() {
                            if (this.gitBasedApplications.length === 0) {
                                return [];
                            }
                            return [
                                this.gitBasedApplications,
                            ].flatMap((items) => this.filterAndSort(items, false));
                        },
                        get filteredDockerBasedApplications() {
                            if (this.dockerBasedApplications.length === 0) {
                                return [];
                            }
                            return [
                                this.dockerBasedApplications,
                            ].flatMap((items) => this.filterAndSort(items, false));
                        },
                        get filteredDatabases() {
                            if (this.databases.length === 0) {
                                return [];
                            }
                            return [
                                this.databases,
                            ].flatMap((items) => this.filterAndSort(items, false));
                        },
                        get filteredServices() {
                            if (this.services.length === 0) {
                                return [];
                            }
                            return [
                                this.services,
                            ].flatMap((items) => this.filterAndSort(items, true));
                        }
                    }
                }
            </script>
        </div>
    @endif
    
    {{-- Autres steps (deployment-choice, servers, destinations, etc.) - À garder de l'ancien fichier --}}
    @include('livewire.project.new.partials.other-steps')
</div>
