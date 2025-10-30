{{-- Modern IDEM Navbar/Sidebar inspired by the design --}}
<nav class="flex flex-col flex-1 bg-[#0a0e1a] border-r border-gray-800/50"
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
    <div class="px-4 py-5 border-b border-gray-800/50">
        {{-- IDEM Logo --}}
        <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-blue-500/30">
                ID
            </div>
            <span class="text-lg font-bold text-white tracking-tight">IDEM</span>
        </div>
        
        {{-- Team Selector --}}
        <div class="w-full">
            <livewire:switch-team />
        </div>
    </div>

    {{-- Navigation Menu --}}
    <ul role="list" class="flex flex-col flex-1 px-3 py-4 gap-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
        @if (isSubscribed() || !isCloud())
            {{-- Dashboard --}}
            <li>
                <a href="/" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('/') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('/') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                    </svg>
                    <span>Dashboard</span>
                </a>
            </li>

            {{-- Branding --}}
            <li>
                <a href="/branding" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('branding*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('branding*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
                    </svg>
                    <span>Branding</span>
                </a>
            </li>

            {{-- Business Plan --}}
            <li>
                <a href="/business-plan" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('business-plan*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('business-plan*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span>Business Plan</span>
                </a>
            </li>

            {{-- Diagrams --}}
            <li>
                <a href="/diagrams" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('diagrams*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('diagrams*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    <span>Diagrams</span>
                </a>
            </li>

            {{-- Development --}}
            <li>
                <a href="/development" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('development*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('development*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                    </svg>
                    <span>Development</span>
                </a>
            </li>

            {{-- Deployment (Highlighted in Blue) --}}
            <li>
                <a href="/projects" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('project/*') || request()->is('projects') ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    <span>Deployment</span>
                </a>
            </li>

            {{-- Divider --}}
            <li class="my-2">
                <div class="h-px bg-gray-800/50"></div>
            </li>

            {{-- Projects --}}
            <li>
                <a href="/projects" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('project/*') || request()->is('projects') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('project/*') || request()->is('projects') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M12 4l-8 4l8 4l8 -4l-8 -4"/>
                        <path d="M4 12l8 4l8 -4"/>
                        <path d="M4 16l8 4l8 -4"/>
                    </svg>
                    <span>Projects</span>
                </a>
            </li>

            {{-- Servers --}}
            <li>
                <a href="/servers" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('server/*') || request()->is('servers') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('server/*') || request()->is('servers') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M3 4m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"/>
                        <path d="M15 20h-9a3 3 0 0 1 -3 -3v-2a3 3 0 0 1 3 -3h12"/>
                        <path d="M7 8v.01"/>
                        <path d="M7 16v.01"/>
                        <path d="M20 15l-2 3h3l-2 3"/>
                    </svg>
                    <span>Servers</span>
                </a>
            </li>

            {{-- Sources --}}
            <li>
                <a href="{{ route('source.all') }}" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('source*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('source*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" viewBox="0 0 15 15">
                        <path fill="currentColor" d="m6.793 1.207l.353.354l-.353-.354ZM1.207 6.793l-.353-.354l.353.354Zm0 1.414l.354-.353l-.354.353Zm5.586 5.586l-.354.353l.354-.353Zm1.414 0l-.353-.354l.353.354Zm5.586-5.586l.353.354l-.353-.354Zm0-1.414l-.354.353l.354-.353ZM8.207 1.207l.354-.353l-.354.353ZM6.44.854L.854 6.439l.707.707l5.585-5.585L6.44.854ZM.854 8.56l5.585 5.585l.707-.707l-5.585-5.585l-.707.707Zm7.707 5.585l5.585-5.585l-.707-.707l-5.585 5.585l.707.707Zm5.585-7.707L8.561.854l-.707.707l5.585 5.585l.707-.707Zm0 2.122a1.5 1.5 0 0 0 0-2.122l-.707.707a.5.5 0 0 1 0 .708l.707.707ZM6.44 14.146a1.5 1.5 0 0 0 2.122 0l-.707-.707a.5.5 0 0 1-.708 0l-.707.707ZM.854 6.44a1.5 1.5 0 0 0 0 2.122l.707-.707a.5.5 0 0 1 0-.708L.854 6.44Zm6.292-4.878a.5.5 0 0 1 .708 0L8.56.854a1.5 1.5 0 0 0-2.122 0l.707.707Zm-2 1.293l1 1l.708-.708l-1-1l-.708.708ZM7.5 5a.5.5 0 0 1-.5-.5H6A1.5 1.5 0 0 0 7.5 6V5Zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 9 4.5H8ZM7.5 4a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 7.5 3v1Zm0-1A1.5 1.5 0 0 0 6 4.5h1a.5.5 0 0 1 .5-.5V3Zm.646 2.854l1.5 1.5l.707-.708l-1.5-1.5l-.707.708ZM10.5 8a.5.5 0 0 1-.5-.5H9A1.5 1.5 0 0 0 10.5 9V8Zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 12 7.5h-1Zm-.5-.5a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 10.5 6v1Zm0-1A1.5 1.5 0 0 0 9 7.5h1a.5.5 0 0 1 .5-.5V6ZM7 5.5v4h1v-4H7Zm.5 5.5a.5.5 0 0 1-.5-.5H6A1.5 1.5 0 0 0 7.5 12v-1Zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 9 10.5H8Zm-.5-.5a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 7.5 9v1Zm0-1A1.5 1.5 0 0 0 6 10.5h1a.5.5 0 0 1 .5-.5V9Z"/>
                    </svg>
                    <span>Sources</span>
                </a>
            </li>

            {{-- Destinations --}}
            <li>
                <a href="{{ route('destination.index') }}" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('destination*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('destination*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4L3 8v12l6-3l6 3l6-4V4l-6 3l-6-3zm-2 8.001V12m4 .001V12m3-2l2 2m2 2l-2-2m0 0l2-2m-2 2l-2 2"/>
                    </svg>
                    <span>Destinations</span>
                </a>
            </li>

            {{-- S3 Storages --}}
            <li>
                <a href="{{ route('storage.index') }}" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('storages*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('storages*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <g stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                            <path d="M4 6a8 3 0 1 0 16 0A8 3 0 1 0 4 6"/>
                            <path d="M4 6v6a8 3 0 0 0 16 0V6"/>
                            <path d="M4 12v6a8 3 0 0 0 16 0v-6"/>
                        </g>
                    </svg>
                    <span>S3 Storages</span>
                </a>
            </li>

            {{-- Divider --}}
            <li class="my-2">
                <div class="h-px bg-gray-800/50"></div>
            </li>

            {{-- Shared Variables --}}
            <li>
                <a href="{{ route('shared-variables.index') }}" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('shared-variables*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('shared-variables*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <g stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                            <path d="M5 4C2.5 9 2.5 14 5 20M19 4c2.5 5 2.5 10 0 16M9 9h1c1 0 1 1 2.016 3.527C13 15 13 16 14 16h1"/>
                            <path d="M8 16c1.5 0 3-2 4-3.5S14.5 9 16 9"/>
                        </g>
                    </svg>
                    <span>Shared Variables</span>
                </a>
            </li>

            {{-- Notifications --}}
            <li>
                <a href="{{ route('notifications.email') }}" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('notifications*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('notifications*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6M9 17v1a3 3 0 0 0 6 0v-1"/>
                    </svg>
                    <span>Notifications</span>
                </a>
            </li>

            {{-- Keys & Tokens --}}
            <li>
                <a href="{{ route('security.private-key.index') }}" 
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->is('security*') ? 'bg-gray-800/80 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                    <svg class="w-5 h-5 {{ request()->is('security*') ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1-4.069 0l-.301-.301l-6.558 6.558a2 2 0 0 1-1.239.578L5.172 21H4a1 1 0 0 1-.993-.883L3 20v-1.172a2 2 0 0 1 .467-1.284l.119-.13L4 17h2v-2h2v-2l2.144-2.144l-.301-.301a2.877 2.877 0 0 1 0-4.069l2.643-2.643a2.877 2.877 0 0 1 4.069 0zM15 9h.01"/>
                    </svg>
                    <span>Keys & Tokens</span>
                </a>
            </li>


        @endif
    </ul>

    {{-- Footer with Settings --}}
    <div class="px-3 py-4 border-t border-gray-800/50">
        <div class="flex items-center justify-between">
            <livewire:settings-dropdown />
            
            {{-- Search Button --}}
            <button @click="$dispatch('open-global-search')" type="button" title="Search (Press / or ⌘K)"
                class="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white text-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <kbd class="px-1.5 py-0.5 text-xs font-semibold bg-gray-900 rounded">/</kbd>
            </button>
        </div>
    </div>
</nav>
