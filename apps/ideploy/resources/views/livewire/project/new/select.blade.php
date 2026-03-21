<div x-data="searchResources(@js($preloadedResources))" x-init="window.addEventListener('scroll', () => isSticky = window.pageYOffset > 100); loadServicesOnly()" class="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1419] to-[#0a0e1a] p-6">
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
                
                <div class="w-full lg:w-64">
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                            <svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <select wire:model.live="selectedEnvironment"
                            class="w-full pl-9 pr-8 py-2.5 bg-violet-600/20 border border-violet-500/40 text-violet-100 rounded-xl text-sm font-semibold focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 hover:bg-violet-600/30 hover:border-violet-400/60 transition-all cursor-pointer appearance-none">
                            @foreach ($environments as $environment)
                                <option value="{{ $environment->name }}" class="bg-[#1a1f2e] text-white">{{ $environment->name }}</option>
                            @endforeach
                        </select>
                        <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {{-- No full page loading state - static data renders immediately --}}

            <div class="space-y-12">
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
                                :style="`border-color: ${database.brand_border}; --db-color: ${database.brand_color}`"
                                class="group relative glass-card p-5 overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg">
                                
                                {{-- Brand Glow Effect on hover --}}
                                <div class="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    :style="`background: radial-gradient(ellipse at center, ${database.brand_bg} 0%, transparent 70%)`"></div>
                                
                                {{-- Logo Section with brand colors --}}
                                <div class="relative flex items-center justify-center mb-4">
                                    <div class="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-110"
                                        :style="`background: ${database.brand_bg}; border: 1px solid ${database.brand_border}`">
                                        {{-- DB Brand Icons --}}
                                        <template x-if="database.logo_icon === 'postgresql'">
                                            <svg viewBox="0 0 128 128" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg"><path fill="#336791" d="M93.809 92.112c.785-6.533.55-7.492 5.416-6.433l1.235.109c3.742.17 8.637-.602 11.513-1.938 6.191-2.873 9.861-7.668 3.758-6.409-13.924 2.873-14.892-1.842-14.892-1.842 14.75-21.899 20.937-49.678 15.627-56.51C101.305 3.16 78.201 11.91 77.798 12.127l-.135.026c-2.751-.573-5.833-.913-9.291-.968-6.301-.104-11.082 1.652-14.714 4.402 0 0-44.726-18.41-42.636 23.17.442 8.851 12.69 66.98 27.31 49.417 5.334-6.415 10.489-11.837 10.489-11.837 2.559 1.701 5.622 2.567 8.834 2.255l.249-.212c-.078.796-.044 1.575.1 2.498-3.758 4.203-2.656 4.944-10.172 6.492-7.604 1.566-3.136 4.358-.221 5.089 3.538.884 11.712 2.139 17.252-5.604l-.219.882c1.478 1.179 1.375 8.484 1.583 13.703.209 5.219.558 10.086 1.622 12.955 1.064 2.867 2.317 10.261 12.201 8.14 8.253-1.773 14.574-4.319 15.147-28.001"/><path fill="#fff" d="M75.557 125.9c-8.672 0-14.375-3.39-17.83-6.632-2.612-2.464-3.641-5.631-4.262-7.527l-.267-.792c-1.244-3.363-1.667-8.2-1.916-14.428a245.35 245.35 0 01-.093-2.923c-.021-.747-.047-1.683-.084-2.665a18.777 18.777 0 01-4.964 1.569c-3.078.527-6.392.356-9.844-.508-2.435-.609-4.967-1.872-6.407-3.819-4.205 3.685-8.215 3.183-10.398 2.455-3.859-1.286-7.309-4.897-10.543-11.046-2.311-4.377-4.546-10.083-6.64-16.953-3.655-11.966-5.973-24.574-6.175-28.702-.648-12.956 2.837-22.222 10.357-27.554 11.871-8.387 29.851-3.456 36.41-1.219 4.404-2.655 9.589-3.949 15.444-3.856 3.144.051 6.138.328 8.927.823 2.9-.912 8.632-2.222 15.19-2.143 12.087.144 22.11 4.858 28.975 13.629 4.898 6.255 2.474 19.391.596 26.685-2.644 10.234-7.278 21.119-12.96 30.598 1.545.011 3.785-.175 6.967-.832 6.284-1.298 8.119 2.073 8.613 3.578 1.997 6.047-6.68 10.625-9.387 11.877-3.469 1.61-9.121 2.593-13.755 2.378l-.201-.013-1.218-.107-.12 1.014-.115.87-.092.697c-.127 1.087-.156 2.134-.185 3.263l-.022.778c-.095 3.849-.186 7.514-1.025 12.073-1.196 6.557-4.327 11.162-9.567 14.079-3.303 1.832-7.09 2.81-10.935 2.81zm-10.6-10.783c.974 2.601 2.419 5.056 5.271 7.749 4.378 4.135 11.453 5.589 18.344 4.044 8.266-1.775 14.548-7.254 15.082-28.001 0 0 .062-.716.097-1.04.074-.63.126-1.147.19-1.71l.252-2.145 2.098.207c3.62.357 8.985-.432 12.218-1.94 2.512-1.168 6.274-3.52 7.022-5.793.016-.05.032-.14-.017-.169-.267-.163-1.248.027-2.068.199-3.768.779-7.03 1.053-10.04.83-2.163-.163-4.06-.602-5.73-1.321l-.988-.435.527-.952c5.347-9.653 9.929-20.432 12.551-30.597 2.065-7.999 3.437-18.617.443-22.508-5.941-7.589-14.601-11.611-25.117-11.736-5.484-.065-11.271 1.274-14.081 2.139l-.411.127-.399-.077c-2.669-.537-5.83-.836-9.146-.889-5.37-.087-9.833 1.18-13.278 3.768l-.485.358-.562-.215c-5.937-2.266-24.255-8.164-34.527-.958-6.315 4.428-9.266 12.72-8.675 24.651.185 3.711 2.43 16.113 5.991 27.703 2.003 6.566 4.14 11.981 6.281 16.092 2.582 4.895 5.21 7.693 7.782 8.546 1.538.513 3.289.201 5.205-1.938l1.578-1.79 1.391 1.936c.892 1.242 2.452 2.107 4.436 2.612 2.905.726 6.018.841 8.743.318a13.945 13.945 0 004.67-1.897l1.578-1.049.468 1.781c.076.289.159.577.249.867zm36.282-5.612l.018-.091.018-.091z"/></svg>
                                        </template>
                                        <template x-if="database.logo_icon === 'mysql'">
                                            <svg viewBox="0 0 24 24" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg"><path d="M16.405 5.501c-.115 0-.193.014-.274.033v.013h.014c.054.104.146.18.214.274.054.107.1.214.154.32l.014-.015c.094-.066.14-.172.14-.333-.04-.047-.046-.094-.08-.14-.04-.067-.126-.1-.182-.152zM5.77 18.695h-.927a50.854 50.854 0 00-.27-4.41l-1.15 4.41H2.45l-1.52-4.41 0 0-.26 4.41H-.27C-.05 15.891 0 12.97 0 12.005h1.627l1.492 4.26 1.482-4.26H6.27c-.013 2.36-.076 5.35-.5 6.69zm4.3 0H8.23c0 2.44-.083 3.15 0 5.9h1.832c0-3.39.105-4.11.008-5.9zM9.34 8.445c-.013.12-.055.207-.13.283-.076.073-.165.107-.267.107-.092 0-.168-.03-.23-.09-.062-.06-.105-.148-.122-.255a1.004 1.004 0 01-.022-.195c0-.143.026-.258.077-.346a.292.292 0 01.272-.134c.094 0 .171.03.231.09.063.06.105.148.122.255.01.062.017.127.017.2 0 .04-.007.08-.015.12l-.012-.035zm9.54 0c-.014.12-.056.207-.13.283-.076.073-.165.107-.268.107-.092 0-.168-.03-.23-.09-.062-.06-.105-.148-.122-.255a1.004 1.004 0 01-.022-.195c0-.143.026-.258.078-.346a.292.292 0 01.272-.134c.094 0 .17.03.23.09.062.06.105.148.122.255.01.062.018.127.018.2 0 .04-.007.08-.016.12l-.012-.035zm4.41 10.25h-1.77v-4.41L21 14.285l-.01 4.41zm.046-5.82l-1.77-2.55h1.82l-.05 2.55zM18 15.57l-2.24-2.545v2.544H18z" fill="#E48E00"/></svg>
                                        </template>
                                        <template x-if="database.logo_icon === 'mariadb'">
                                            <svg viewBox="0 0 24 24" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg"><path d="M22.844 2.012c-.615-.025-1.277.12-1.764.608l-.088.1c-.57.62-1.094 1.005-1.78 1.38-.7.38-1.592.685-2.88.93-5.113.975-7.405 5.273-9.534 9.398L7.054 14c-1.148-.584-2.174-.666-3.09-.514-.913.152-1.72.535-2.42.924l-.394.228.416.194c1.048.49 1.787 1.062 2.246 1.598a4.3 4.3 0 01.555.873c-.264.45-.527.9-.752 1.353-.505 1.033-.793 2.086-.387 3.18l.047.123.127.036c2.416.656 3.816-.13 5.296-.986 1.02-.586 2.084-1.196 3.467-1.537a11.85 11.85 0 013.656-.284c.886.052 1.83.185 2.775.394.478.106.852.254 1.16.438.308.184.547.405.703.662.306.51.322 1.13.098 1.925l-.107.388.39-.102c3.29-.855 5.798-3.338 5.8-10.768l.002-1.068c0-4.43-.023-6.44-1.018-8.246-.453-.822-1.025-1.29-1.64-1.314zm.097.855c.437.017.887.39 1.282 1.111.924 1.677.946 3.56.946 7.98v.014l-.002 1.068c-.002 7.08-2.288 9.446-5.102 10.278.14-.73.076-1.365-.254-1.936-.203-.338-.495-.62-.857-.84-.362-.22-.791-.385-1.296-.498a20.99 20.99 0 00-2.863-.407 12.69 12.69 0 00-3.913.303c-1.481.37-2.601 1.018-3.638 1.612-1.417.815-2.716 1.56-4.82.99-.261-.82-.074-1.667.388-2.626.24-.49.51-.988.789-1.47l.143-.247-.17-.228a5.132 5.132 0 00-.668-1.072c-.43-.526-1.065-1.07-1.948-1.574.6-.32 1.253-.603 1.99-.726.77-.128 1.63-.063 2.602.42l.564.288.275-.558c2.108-4.278 4.323-8.38 9.126-9.306 1.355-.258 2.326-.589 3.095-1.005.755-.41 1.339-.852 1.963-1.53l.073-.084c.43-.432.99-.565 1.515-.543z" fill="#C0765A"/></svg>
                                        </template>
                                        <template x-if="database.logo_icon === 'redis'">
                                            <svg viewBox="0 0 24 24" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg"><path d="M10.97 3.704L8.347 5.01l2.625 1.305 2.623-1.305zm-3.5 1.74L5 6.75l2.62 1.305 2.624-1.305zm7 0l-2.47 1.305 2.47 1.305 2.625-1.305zm-10.5 1.74L1.5 8.49l2.62 1.304L6.74 8.49zm7 0l-2.47 1.304 2.47 1.305 2.625-1.305zm7 0l-2.47 1.304 2.47 1.305 2.624-1.305zm-13 2.653v2.61l2.62 1.305V9.933zm6.5 0v2.61l2.62 1.305V9.933zm6.5 0v2.61l2.62 1.305V9.933zM4.47 10.62L1.5 12.105l2.97 1.478v-2.963zm6.5 0l-2.97 1.485 2.97 1.478V10.62zm6.5 0l-2.97 1.485 2.97 1.478V10.62zM12 14.29l-10.5 5.2 10.5 3.21 10.5-3.21zm0 1.3l7.7 3.9-7.7 2.35-7.7-2.35z" fill="#DC382D"/></svg>
                                        </template>
                                        <template x-if="database.logo_icon === 'mongodb'">
                                            <svg viewBox="0 0 24 24" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg"><path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 003.639-8.464c.01-.814-.103-1.662-.197-2.218zm-5.336 8.195s0-8.291.275-8.29c.213 0 .49 10.695.49 10.695-.381-.045-.765-1.76-.765-2.405z" fill="#13AA52"/></svg>
                                        </template>
                                        <template x-if="database.logo_icon === 'clickhouse'">
                                            <svg viewBox="0 0 24 24" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg"><path d="M21.333 10.667H20V13.333H21.333V10.667ZM18.667 10.667H17.333V13.333H18.667V10.667ZM16 10.667H14.667V13.333H16V10.667ZM13.333 10.667H12V13.333H13.333V10.667ZM10.667 8H9.333V16H10.667V8ZM8 10.667H6.667V13.333H8V10.667ZM5.333 10.667H4V13.333H5.333V10.667ZM2.667 10.667H1.333V13.333H2.667V10.667Z" fill="#FAFF69"/></svg>
                                        </template>
                                        <template x-if="database.logo_icon === 'keydb'">
                                            <svg viewBox="0 0 24 24" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#F5C518" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                        </template>
                                        <template x-if="database.logo_icon === 'dragonfly'">
                                            <svg viewBox="0 0 24 24" class="w-12 h-12" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c-1.5 0-3 .5-4 1.5L3 8c-1 1-1.5 2.5-1.5 4s.5 3 1.5 4l5 4.5c1 1 2.5 1.5 4 1.5s3-.5 4-1.5l5-4.5c1-1 1.5-2.5 1.5-4s-.5-3-1.5-4L16 3.5C15 2.5 13.5 2 12 2z" stroke="#FF6B35" stroke-width="1.5" fill="rgba(255,107,53,0.15)" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="#FF6B35"/></svg>
                                        </template>
                                    </div>
                                    {{-- Badge Database --}}
                                    <div class="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm flex items-center gap-1"
                                        :style="`background: ${database.brand_bg}; border: 1px solid ${database.brand_border}; color: ${database.brand_color}`">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>
                                        DB
                                    </div>
                                </div>

                                {{-- Header avec nom --}}
                                <div class="relative text-center">
                                    <h3 class="text-base font-semibold text-light transition-colors truncate mb-2"
                                        :style="`color: inherit`"
                                        x-text="database.name"></h3>
                                    <p class="text-sm text-light/60 line-clamp-2 min-h-[2.5rem]" x-text="database.description"></p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                {{-- Services --}}
                <div>
                    <div class="mb-6 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="icon-container">
                                <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                                </svg>
                            </div>
                            <div class="flex items-center gap-3">
                                <div>
                                    <h2 class="text-2xl font-bold text-light">Services</h2>
                                    <p class="text-sm text-light/60">One-click services available in iDeploy</p>
                                </div>
                                <div x-show="loadingServices" class="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                    <div class="w-3 h-3 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin"></div>
                                    <span class="text-xs text-emerald-400">Loading...</span>
                                </div>
                            </div>
                        </div>
                        <button x-on:click="loadServicesOnly" :disabled="loadingServices"
                                class="outer-button px-4 py-2 flex items-center gap-2 disabled:opacity-50">
                            <svg class="w-4 h-4" :class="loadingServices ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Reload
                        </button>
                    </div>

                    {{-- Skeleton loader while services load --}}
                    <div x-show="loadingServices && services.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        <template x-for="i in 8" :key="i">
                            <div class="glass-card p-5 animate-pulse">
                                <div class="flex items-center justify-center mb-4">
                                    <div class="w-20 h-20 rounded-xl bg-white/5"></div>
                                </div>
                                <div class="h-4 bg-white/5 rounded mb-2"></div>
                                <div class="h-3 bg-white/5 rounded w-3/4 mx-auto"></div>
                            </div>
                        </template>
                    </div>
                    
                    <div x-show="filteredServices.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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

                {{-- Empty State (only when search has text and nothing matches) --}}
                <div x-show="search.length > 0 && filteredGitBasedApplications.length === 0 && filteredDockerBasedApplications.length === 0 && filteredDatabases.length === 0 && filteredServices.length === 0 && !loadingServices"
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

                function searchResources(preloaded) {
                    return {
                        search: '',
                        loadingServices: false,
                        isSticky: false,
                        selecting: false,
                        services: [],
                        gitBasedApplications: preloaded?.gitBasedApplications ?? [],
                        dockerBasedApplications: preloaded?.dockerBasedApplications ?? [],
                        databases: preloaded?.databases ?? [],
                        setType(type) {
                            if (this.selecting) return;
                            this.selecting = true;
                            this.$wire.setType(type);
                        },
                        async loadServicesOnly() {
                            this.loadingServices = true;
                            try {
                                const result = await this.$wire.loadServices();
                                if (result?.services) {
                                    this.services = result.services;
                                }
                            } finally {
                                this.loadingServices = false;
                            }
                            this.$nextTick(() => {
                                if (this.$refs.searchInput) this.$refs.searchInput.focus();
                            });
                        },
                        async loadResources() {
                            await this.loadServicesOnly();
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
