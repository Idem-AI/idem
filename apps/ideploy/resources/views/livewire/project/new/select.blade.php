<div x-data="searchResources()" x-init="$wire.loadServers; window.addEventListener('scroll', () => isSticky = window.pageYOffset > 100); loadResources()" class="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1419] to-[#0a0e1a] p-6">
    {{-- Header Époustouflant --}}
    <div class="mb-8">
        {{-- Header Principal avec Gradient --}}
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/10 via-primary/5 to-transparent border border-accent/20 p-8 mb-6">
            {{-- Background Pattern --}}
            <div class="absolute inset-0 opacity-5">
                <div class="absolute inset-0" style="background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0); background-size: 32px 32px;"></div>
            </div>
            
            <div class="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div class="flex items-center gap-4">
                    <div class="icon-container w-16 h-16">
                        <svg class="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-4xl font-bold text-light mb-2">
                            <span class="i-underline">Create New Resource</span>
                        </h1>
                        <p class="text-light/70 text-lg">Deploy applications, databases, and services to your infrastructure</p>
                    </div>
                </div>
                
                <div class="w-full lg:w-96">
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <svg class="w-5 h-5 text-light/40 group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <x-forms.select wire:model.live="selectedEnvironment" class="pl-10 pr-10 bg-black/40 border-white/10 text-light focus:border-accent/50 focus:ring-2 focus:ring-accent/20 hover:border-accent/30 transition-all">
                            @foreach ($environments as $environment)
                                <option value="{{ $environment->name }}">{{ $environment->name }}</option>
                            @endforeach
                        </x-forms.select>
                        <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg class="w-4 h-4 text-light/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {{-- Barre de Recherche Moderne --}}
        <div class="sticky z-10 top-4 py-2">
            <div class="relative">
                <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <svg class="w-5 h-5 text-light/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                </div>
                <input 
                    autocomplete="off" 
                    x-ref="searchInput" 
                    x-model="search" 
                    placeholder="Search resources... (press / to focus)"
                    @keydown.window.slash.prevent="$refs.searchInput.focus()"
                    class="w-full pl-12 pr-20 py-4 bg-black/40 border border-white/10 rounded-xl text-light placeholder-light/40 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all backdrop-blur-sm"
                    :class="isSticky ? 'shadow-lg shadow-accent/20' : ''">
                <div class="absolute inset-y-0 right-0 flex items-center gap-2 pr-4">
                    <span class="text-xs text-light/40 px-2 py-1 bg-white/5 rounded border border-white/10">/</span>
                    <button x-show="search.length > 0" @click="search = ''" class="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <svg class="w-4 h-4 text-light/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    @if ($current_step === 'type')
        <div>
            {{-- Loading State --}}
            <div x-show="loading" class="flex items-center justify-center py-20">
                <div class="text-center">
                    <div class="relative">
                        <div class="inline-block animate-spin rounded-full h-16 w-16 border-4 border-accent/20 border-t-accent"></div>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <svg class="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                    </div>
                    <p class="mt-6 text-base text-light/70">Loading resources...</p>
                </div>
            </div>

            <div x-show="!loading" class="space-y-12">
                {{-- Git Based Applications --}}
                <div x-show="filteredGitBasedApplications.length > 0">
                    <div class="mb-6 flex items-center gap-3">
                        <div class="icon-container">
                            <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-2xl font-bold text-light">Applications</h2>
                            <p class="text-sm text-light/60">Deploy applications from Git repositories</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        <template x-for="application in filteredGitBasedApplications" :key="application.name">
                            <div x-on:click='setType(application.id)'
                                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                                class="group relative glass-card p-5 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10 overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
                                
                                {{-- Glow Effect --}}
                                <div class="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                                
                                {{-- Logo Section --}}
                                <div class="relative flex items-center justify-center mb-4">
                                    <div class="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border border-blue-500/20 flex items-center justify-center overflow-hidden group-hover:border-blue-500/40 group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                                        <img :src="application.logo" class="w-12 h-12 object-contain transition-transform group-hover:scale-110 group-hover:rotate-3" />
                                    </div>
                                    {{-- Badge Git --}}
                                    <div class="absolute -top-1 -right-1 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-[10px] font-semibold text-blue-400 backdrop-blur-sm">GIT</div>
                                </div>

                                {{-- Header avec nom --}}
                                <div class="relative text-center">
                                    <h3 class="text-base font-semibold text-light group-hover:text-blue-400 transition-colors truncate mb-2" x-text="application.name"></h3>
                                    <p class="text-sm text-light/60 line-clamp-2 min-h-[2.5rem]" x-html="window.sanitizeHTML(application.description)"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Docker Based Applications --}}
                <div x-show="filteredDockerBasedApplications.length > 0">
                    <div class="mb-6 flex items-center gap-3">
                        <div class="icon-container">
                            <svg class="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-2xl font-bold text-light">Docker Applications</h2>
                            <p class="text-sm text-light/60">Deploy containerized applications with Docker</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        <template x-for="application in filteredDockerBasedApplications" :key="application.name">
                            <div x-on:click="setType(application.id)"
                                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                                class="group relative glass-card p-5 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
                                
                                {{-- Glow Effect --}}
                                <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-blue-600/0 group-hover:from-cyan-500/5 group-hover:to-blue-600/5 transition-all duration-300 rounded-xl"></div>
                                
                                {{-- Logo Section --}}
                                <div class="relative flex items-center justify-center mb-4">
                                    <div class="w-20 h-20 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 flex items-center justify-center overflow-hidden group-hover:border-cyan-500/40 group-hover:shadow-lg group-hover:shadow-cyan-500/20 transition-all duration-300">
                                        <img :src="application.logo" class="w-12 h-12 object-contain transition-transform group-hover:scale-110 group-hover:rotate-3" />
                                    </div>
                                    {{-- Badge Docker --}}
                                    <div class="absolute -top-1 -right-1 px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-[10px] font-semibold text-cyan-400 backdrop-blur-sm flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185"/></svg>
                                        DOCKER
                                    </div>
                                </div>

                                {{-- Header avec nom --}}
                                <div class="relative text-center">
                                    <h3 class="text-base font-semibold text-light group-hover:text-cyan-400 transition-colors truncate mb-2" x-text="application.name"></h3>
                                    <p class="text-sm text-light/60 line-clamp-2 min-h-[2.5rem]" x-text="application.description"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Databases --}}
                <div x-show="filteredDatabases.length > 0">
                    <div class="mb-6 flex items-center gap-3">
                        <div class="icon-container">
                            <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-2xl font-bold text-light">Databases</h2>
                            <p class="text-sm text-light/60">Popular database engines for your applications</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        <template x-for="database in filteredDatabases" :key="database.id">
                            <div x-on:click="setType(database.id)"
                                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                                class="group relative glass-card p-5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
                                
                                {{-- Glow Effect --}}
                                <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-600/0 group-hover:from-indigo-500/5 group-hover:to-purple-600/5 transition-all duration-300 rounded-xl"></div>
                                
                                {{-- Animated Background Pulse --}}
                                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                    <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-600/5 animate-pulse"></div>
                                </div>
                                
                                {{-- Logo Section --}}
                                <div class="relative flex items-center justify-center mb-4">
                                    <div class="w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border border-indigo-500/20 flex items-center justify-center overflow-hidden group-hover:border-indigo-500/40 group-hover:shadow-lg group-hover:shadow-indigo-500/20 transition-all duration-300">
                                        <span x-show="database.logo" x-html="database.logo" class="text-4xl transition-transform group-hover:scale-110 group-hover:rotate-6"></span>
                                    </div>
                                    {{-- Badge Database --}}
                                    <div class="absolute -top-1 -right-1 px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-[10px] font-semibold text-indigo-400 backdrop-blur-sm flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>
                                        DB
                                    </div>
                                </div>

                                {{-- Header avec nom --}}
                                <div class="relative text-center">
                                    <h3 class="text-base font-semibold text-light group-hover:text-indigo-400 transition-colors truncate mb-2" x-text="database.name"></h3>
                                    <p class="text-sm text-light/60 line-clamp-2 min-h-[2.5rem]" x-text="database.description"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Services --}}
                <div x-show="filteredServices.length > 0">
                    <div class="mb-6 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="icon-container">
                                <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                                </svg>
                            </div>
                            <div>
                                <h2 class="text-2xl font-bold text-light">Services</h2>
                                <p class="text-sm text-light/60">One-click services available in iDeploy</p>
                            </div>
                        </div>
                        <button x-on:click="loadResources" 
                                class="outer-button px-4 py-2 flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Reload
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        <template x-for="service in filteredServices" :key="service.name">
                            <div x-on:click="setType('one-click-service-' + service.name)"
                                :class="{ 'cursor-pointer': !selecting, 'cursor-not-allowed opacity-50': selecting }"
                                class="group relative glass-card p-5 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
                                
                                {{-- Glow Effect --}}
                                <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-teal-600/0 group-hover:from-emerald-500/5 group-hover:to-teal-600/5 transition-all duration-300 rounded-xl"></div>
                                
                                {{-- Logo Section --}}
                                <div class="relative flex items-center justify-center mb-4">
                                    <div class="w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-600/10 border border-emerald-500/20 flex items-center justify-center overflow-hidden group-hover:border-emerald-500/40 group-hover:shadow-lg group-hover:shadow-emerald-500/20 transition-all duration-300">
                                        <template x-if="service.logo">
                                            <img :src='service.logo'
                                                class="w-12 h-12 object-contain transition-transform group-hover:scale-110 group-hover:rotate-3"
                                                x-on:error.window="$event.target.src = service.logo_github_url"
                                                onerror="this.onerror=null; this.src=this.getAttribute('data-fallback');"
                                                x-on:error="$event.target.src = '/coolify-logo.svg'"
                                                :data-fallback='service.logo_github_url' />
                                        </template>
                                    </div>
                                    {{-- Badge One-Click --}}
                                    <div class="absolute -top-1 -right-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[10px] font-semibold text-emerald-400 backdrop-blur-sm flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                        1-CLICK
                                    </div>
                                </div>

                                {{-- Header avec nom et documentation --}}
                                <div class="relative text-center">
                                    <div class="flex items-center justify-center gap-2 mb-2">
                                        <h3 class="text-base font-semibold text-light group-hover:text-emerald-400 transition-colors truncate" x-text="service.name"></h3>
                                        <a x-show="service.documentation" 
                                           :href="service.documentation" 
                                           target="_blank"
                                           onclick="event.stopPropagation()"
                                           class="flex-shrink-0 text-light/40 hover:text-emerald-400 transition-colors">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                            </svg>
                                        </a>
                                    </div>
                                    <p class="text-sm text-light/60 line-clamp-2 min-h-[2.5rem]" x-text="service.slogan"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Empty State --}}
                <div x-show="filteredGitBasedApplications.length === 0 && filteredDockerBasedApplications.length === 0 && filteredDatabases.length === 0 && filteredServices.length === 0 && loading === false"
                     class="py-20 text-center">
                    <div class="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-accent/10 to-primary/5 border border-accent/20 mb-6">
                        <svg class="w-12 h-12 text-accent/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-light mb-2">No resources found</h3>
                    <p class="text-light/60 mb-6">Try adjusting your search query or clear the search</p>
                    <button @click="search = ''" class="inner-button px-6 py-3">
                        <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear Search
                    </button>
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
