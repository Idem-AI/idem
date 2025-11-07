<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-slot:title>
        Shared Variables | Coolify
    </x-slot>
    
    {{-- Header --}}
    <div class="mb-6">
        <h1 class="text-3xl font-light text-gray-100 mb-2">Shared Variables</h1>
        <p class="text-sm text-gray-400">Set Team / Project / Environment wide variables.</p>
    </div>

    {{-- Variables Scopes Grid --}}
    <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <a href="{{ route('shared-variables.team.index') }}" class="group block">
            <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300">
                {{-- Header --}}
                <div class="p-5 border-b border-gray-700/50">
                    <div class="flex items-start gap-3">
                        {{-- Icon --}}
                        <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                            </svg>
                        </div>
                        
                        {{-- Info --}}
                        <div class="flex-1 min-w-0">
                            <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors mb-1">Team wide</h3>
                            <p class="text-sm text-gray-400">Usable for all resources in a team</p>
                        </div>
                    </div>
                </div>
                
                {{-- Footer --}}
                <div class="px-5 py-4 bg-gray-900/20">
                    <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2 text-gray-400">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                            </svg>
                            <span>Global Scope</span>
                        </div>
                        <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                </div>
            </div>
        </a>

        <a href="{{ route('shared-variables.project.index') }}" class="group block">
            <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300">
                {{-- Header --}}
                <div class="p-5 border-b border-gray-700/50">
                    <div class="flex items-start gap-3">
                        {{-- Icon --}}
                        <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                            </svg>
                        </div>
                        
                        {{-- Info --}}
                        <div class="flex-1 min-w-0">
                            <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors mb-1">Project wide</h3>
                            <p class="text-sm text-gray-400">Usable for all resources in a project</p>
                        </div>
                    </div>
                </div>
                
                {{-- Footer --}}
                <div class="px-5 py-4 bg-gray-900/20">
                    <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2 text-gray-400">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                            </svg>
                            <span>Project Scope</span>
                        </div>
                        <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                </div>
            </div>
        </a>

        <a href="{{ route('shared-variables.environment.index') }}" class="group block">
            <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300">
                {{-- Header --}}
                <div class="p-5 border-b border-gray-700/50">
                    <div class="flex items-start gap-3">
                        {{-- Icon --}}
                        <div class="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        
                        {{-- Info --}}
                        <div class="flex-1 min-w-0">
                            <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors mb-1">Environment wide</h3>
                            <p class="text-sm text-gray-400">Usable for all resources in an environment</p>
                        </div>
                    </div>
                </div>
                
                {{-- Footer --}}
                <div class="px-5 py-4 bg-gray-900/20">
                    <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2 text-gray-400">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                            </svg>
                            <span>Environment Scope</span>
                        </div>
                        <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                </div>
            </div>
        </a>
    </div>
</div>
