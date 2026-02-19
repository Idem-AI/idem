{{-- Modern IDEM Navbar/Sidebar inspired by the design --}}
<nav class="flex flex-col flex-1 bg-gradient-to-b from-[#0a0e1a] via-[#0d1117] to-[#0a0e1a] backdrop-blur-xl"
    x-data="{
        switchWidth() {
                if (this.full === 'full') {
                    localStorage.setItem('pageWidth', 'center');
                } else {
                    localStorage.setItem('pageWidth', 'full');
                }
                window.location.reload();
            },
            setZoom(zoom) {
                localStorage.setItem('zoom', zoom);
                window.location.reload();
            },
            init() {
                this.full = localStorage.getItem('pageWidth');
                this.zoom = localStorage.getItem('zoom');
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    const userSettings = localStorage.getItem('theme');
                    if (userSettings !== 'system') {
                        return;
                    }
                    if (e.matches) {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                });
                this.queryTheme();
                this.checkZoom();
            },
            setTheme(type) {
                this.theme = type;
                localStorage.setItem('theme', type);
                this.queryTheme();
            },
            queryTheme() {
                const darkModePreference = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const userSettings = localStorage.getItem('theme') || 'dark';
                localStorage.setItem('theme', userSettings);
                if (userSettings === 'dark') {
                    document.documentElement.classList.add('dark');
                    this.theme = 'dark';
                } else if (userSettings === 'light') {
                    document.documentElement.classList.remove('dark');
                    this.theme = 'light';
                } else if (darkModePreference) {
                    this.theme = 'system';
                    document.documentElement.classList.add('dark');
                } else if (!darkModePreference) {
                    this.theme = 'system';
                    document.documentElement.classList.remove('dark');
                }
            },
            checkZoom() {
                if (this.zoom === null) {
                    this.setZoom(100);
                }
                if (this.zoom === '90') {
                    const style = document.createElement('style');
                    style.textContent = `
                                                    html {
                                                        font-size: 93.75%;
                                                    }
                                
                                                    :root {
                                                        --vh: 1vh;
                                                    }
                                
                                                    @media (min-width: 1024px) {
                                                        html {
                                                            font-size: 87.5%;
                                                        }
                                                    }
                                                `;
                    document.head.appendChild(style);
                }
            }
    }">
    
    {{-- Header avec Logo --}}
    <div class="px-4 py-5 border-b border-white/5 relative overflow-hidden">
        {{-- Background Pattern --}}
        <div class="absolute inset-0 opacity-5">
            <div class="absolute inset-0" style="background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0); background-size: 24px 24px;"></div>
        </div>
        
        {{-- IDEM Logo --}}
        <div class="relative flex items-center gap-3 mb-4 group">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                ID
            </div>
            <span class="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">IDEM</span>
        </div>
        
        {{-- Team Selector --}}
        <div class="w-full">
            <livewire:switch-team />
        </div>
    </div>

    {{-- Navigation Menu --}}
    <ul role="list" class="flex flex-col flex-1 px-3 py-4 gap-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
        {{-- Admin Panel - Toujours visible pour les admins --}}
        @auth
            @if(auth()->user()->idem_role === 'admin')
                <li>
                    <a href="{{ route('idem.admin.dashboard') }}" 
                       class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('idem/admin*') ? 'bg-gradient-to-r from-red-500/20 to-red-600/10 text-white shadow-lg shadow-red-500/20' : 'text-red-400 hover:text-white hover:bg-red-500/10' }}">
                        {{-- Glow Effect --}}
                        <div class="absolute inset-0 bg-gradient-to-r from-red-500/0 to-red-600/0 group-hover:from-red-500/10 group-hover:to-red-600/5 transition-all duration-300 rounded-xl"></div>
                        
                        <div class="relative flex items-center gap-3 flex-1">
                            <div class="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center group-hover:bg-red-500/30 group-hover:border-red-500/50 group-hover:scale-110 transition-all duration-300">
                                <svg class="w-5 h-5 text-red-400 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
                                </svg>
                            </div>
                            <span class="font-bold">Admin Panel</span>
                            <span class="ml-auto px-2.5 py-1 text-[10px] font-bold bg-red-500 text-white rounded-full shadow-lg shadow-red-500/30 group-hover:shadow-red-500/50 transition-all">ADMIN</span>
                        </div>
                    </a>
                </li>
                
                {{-- Divider après Admin Panel --}}
                <li class="my-3">
                    <div class="relative h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent">
                        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/50 to-transparent blur-sm"></div>
                    </div>
                </li>
            @endif
        @endauth
        
        @if (isSubscribed() || !isCloud())
            {{-- Dashboard --}}
            <li>
                <a href="/" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('/') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    {{-- Glow Effect --}}
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('/') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('/') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                            </svg>
                        </div>
                        <span>Dashboard</span>
                    </div>
                </a>
            </li>

            {{-- Projects --}}
            <li>
                <a href="/projects" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('project/*') || request()->is('projects') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('project/*') || request()->is('projects') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('project/*') || request()->is('projects') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M12 4l-8 4l8 4l8 -4l-8 -4"/>
                                <path d="M4 12l8 4l8 -4"/>
                                <path d="M4 16l8 4l8 -4"/>
                            </svg>
                        </div>
                        <span>Projects</span>
                    </div>
                </a>
            </li>

            {{-- Servers --}}
            <li>
                <a href="/servers" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('server/*') || request()->is('servers') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('server/*') || request()->is('servers') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('server/*') || request()->is('servers') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M3 4m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"/>
                                <path d="M15 20h-9a3 3 0 0 1 -3 -3v-2a3 3 0 0 1 3 -3h12"/>
                                <path d="M7 8v.01"/>
                                <path d="M7 16v.01"/>
                                <path d="M20 15l-2 3h3l-2 3"/>
                            </svg>
                        </div>
                        <span>Servers</span>
                    </div>
                </a>
            </li>

            {{-- Sources --}}
            <li>
                <a href="{{ route('source.all') }}" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('source*') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('source*') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('source*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 15 15">
                                <path fill="currentColor" d="m6.793 1.207l.353.354l-.353-.354ZM1.207 6.793l-.353-.354l.353.354Zm0 1.414l.354-.353l-.354.353Zm5.586 5.586l-.354.353l.354-.353Zm1.414 0l-.353-.354l.353.354Zm5.586-5.586l.353.354l-.353-.354Zm0-1.414l-.354.353l.354-.353ZM8.207 1.207l.354-.353l-.354.353ZM6.44.854L.854 6.439l.707.707l5.585-5.585L6.44.854ZM.854 8.56l5.585 5.585l.707-.707l-5.585-5.585l-.707.707Zm7.707 5.585l5.585-5.585l-.707-.707l-5.585 5.585l.707.707Zm5.585-7.707L8.561.854l-.707.707l5.585 5.585l.707-.707Zm0 2.122a1.5 1.5 0 0 0 0-2.122l-.707.707a.5.5 0 0 1 0 .708l.707.707ZM6.44 14.146a1.5 1.5 0 0 0 2.122 0l-.707-.707a.5.5 0 0 1-.708 0l-.707.707ZM.854 6.44a1.5 1.5 0 0 0 0 2.122l.707-.707a.5.5 0 0 1 0-.708L.854 6.44Zm6.292-4.878a.5.5 0 0 1 .708 0L8.56.854a1.5 1.5 0 0 0-2.122 0l.707.707Zm-2 1.293l1 1l.708-.708l-1-1l-.708.708ZM7.5 5a.5.5 0 0 1-.5-.5H6A1.5 1.5 0 0 0 7.5 6V5Zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 9 4.5H8ZM7.5 4a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 7.5 3v1Zm0-1A1.5 1.5 0 0 0 6 4.5h1a.5.5 0 0 1 .5-.5V3Zm.646 2.854l1.5 1.5l.707-.708l-1.5-1.5l-.707.708ZM10.5 8a.5.5 0 0 1-.5-.5H9A1.5 1.5 0 0 0 10.5 9V8Zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 12 7.5h-1Zm-.5-.5a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 10.5 6v1Zm0-1A1.5 1.5 0 0 0 9 7.5h1a.5.5 0 0 1 .5-.5V6ZM7 5.5v4h1v-4H7Zm.5 5.5a.5.5 0 0 1-.5-.5H6A1.5 1.5 0 0 0 7.5 12v-1Zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 9 10.5H8Zm-.5-.5a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 7.5 9v1Zm0-1A1.5 1.5 0 0 0 6 10.5h1a.5.5 0 0 1 .5-.5V9Z"/>
                            </svg>
                        </div>
                        <span>Sources</span>
                    </div>
                </a>
            </li>

            {{-- Destinations --}}
            <li>
                <a href="{{ route('destination.index') }}" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('destination*') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('destination*') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('destination*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4L3 8v12l6-3l6 3l6-4V4l-6 3l-6-3zm-2 8.001V12m4 .001V12m3-2l2 2m2 2l-2-2m0 0l2-2m-2 2l-2 2"/>
                            </svg>
                        </div>
                        <span>Destinations</span>
                    </div>
                </a>
            </li>

            {{-- S3 Storages --}}
            <li>
                <a href="{{ route('storage.index') }}" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('storages*') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('storages*') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('storages*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <g stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                                    <path d="M4 6a8 3 0 1 0 16 0A8 3 0 1 0 4 6"/>
                                    <path d="M4 6v6a8 3 0 0 0 16 0V6"/>
                                    <path d="M4 12v6a8 3 0 0 0 16 0v-6"/>
                                </g>
                            </svg>
                        </div>
                        <span>S3 Storages</span>
                    </div>
                </a>
            </li>

            {{-- Settings (Admin Only) --}}
            @auth
                @if(auth()->user()->idem_role === 'admin')
                    <li>
                        <a href="{{ route('settings.index') }}" 
                           class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('settings*') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                            <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                            <div class="relative flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg {{ request()->is('settings*') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                                    <svg class="w-5 h-5 {{ request()->is('settings*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                        <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/>
                                        <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>
                                    </svg>
                                </div>
                                <span>Settings</span>
                            </div>
                        </a>
                    </li>
                @endif
            @endauth

            {{-- Divider --}}
            <li class="my-3">
                <div class="relative h-px bg-gradient-to-r from-transparent via-white/10 to-transparent">
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm"></div>
                </div>
            </li>

            {{-- Shared Variables --}}
            <li>
                <a href="{{ route('shared-variables.index') }}" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('shared-variables*') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('shared-variables*') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('shared-variables*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <g stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                                    <path d="M5 4C2.5 9 2.5 14 5 20M19 4c2.5 5 2.5 10 0 16M9 9h1c1 0 1 1 2.016 3.527C13 15 13 16 14 16h1"/>
                                    <path d="M8 16c1.5 0 3-2 4-3.5S14.5 9 16 9"/>
                                </g>
                            </svg>
                        </div>
                        <span>Shared Variables</span>
                    </div>
                </a>
            </li>

            {{-- Notifications --}}
            <li>
                <a href="{{ route('notifications.email') }}" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('notifications*') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('notifications*') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('notifications*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6M9 17v1a3 3 0 0 0 6 0v-1"/>
                            </svg>
                        </div>
                        <span>Notifications</span>
                    </div>
                </a>
            </li>

            {{-- Keys & Tokens --}}
            <li>
                <a href="{{ route('security.private-key.index') }}" 
                   class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden {{ request()->is('security*') ? 'bg-white/5 text-white shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5' }}">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-600/0 group-hover:from-blue-500/5 group-hover:to-indigo-600/5 transition-all duration-300 rounded-xl"></div>
                    <div class="relative flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg {{ request()->is('security*') ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20' }} flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                            <svg class="w-5 h-5 {{ request()->is('security*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-400' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1-4.069 0l-.301-.301l-6.558 6.558a2 2 0 0 1-1.239.578L5.172 21H4a1 1 0 0 1-.993-.883L3 20v-1.172a2 2 0 0 1 .467-1.284l.119-.13L4 17h2v-2h2v-2l2.144-2.144l-.301-.301a2.877 2.877 0 0 1 0-4.069l2.643-2.643a2.877 2.877 0 0 1 4.069 0zM15 9h.01"/>
                            </svg>
                        </div>
                        <span>Keys & Tokens</span>
                    </div>
                </a>
            </li>


        @endif
    </ul>

    {{-- Footer with Settings --}}
    <div class="px-3 py-4 border-t border-white/5 relative overflow-hidden">
        {{-- Background Pattern --}}
        <div class="absolute inset-0 opacity-5">
            <div class="absolute inset-0" style="background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0); background-size: 24px 24px;"></div>
        </div>
        
        <div class="relative flex items-center justify-between">
            <livewire:settings-dropdown />
            
            {{-- Search Button --}}
            <button @click="$dispatch('open-global-search')" type="button" title="Search (Press / or ⌘K)"
                class="group flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 text-gray-400 hover:text-white text-sm border border-white/10 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10">
                <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <kbd class="px-2 py-1 text-xs font-semibold bg-black/40 border border-white/10 rounded group-hover:border-blue-500/30 transition-colors">/</kbd>
            </button>
        </div>
    </div>
</nav>
