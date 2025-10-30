{{-- Enhanced Resource Card Component with Type Icons --}}
<div>
    <a class="group block" :href="item.hrefLink">
        <div class="bg-gradient-to-br from-[#151b2e] to-[#0f1419] hover:from-[#1a2137] hover:to-[#141922] border-2 border-gray-700/50 hover:border-blue-500/50 rounded-2xl overflow-hidden transition-all duration-300 min-h-[240px] flex flex-col shadow-xl hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1">
            {{-- Header with Icon --}}
            <div class="p-5 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/30 to-transparent">
                <div class="flex items-start gap-3">
                    {{-- Resource Type Icon --}}
                    <div class="flex-shrink-0">
                        {{-- Docker/Application Icon --}}
                        <template x-if="item.type === 'application' || !item.type">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg ring-2 ring-blue-500/30">
                                <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185"/>
                                </svg>
                            </div>
                        </template>
                        
                        {{-- PostgreSQL Icon --}}
                        <template x-if="item.type === 'postgresql'">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg ring-2 ring-blue-600/30">
                                <svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" font-weight="bold">PG</text>
                                </svg>
                            </div>
                        </template>
                        
                        {{-- MySQL Icon --}}
                        <template x-if="item.type === 'mysql'">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg ring-2 ring-orange-500/30">
                                <svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="12" font-weight="bold">SQL</text>
                                </svg>
                            </div>
                        </template>
                        
                        {{-- MariaDB Icon --}}
                        <template x-if="item.type === 'mariadb'">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg ring-2 ring-teal-500/30">
                                <svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="11" font-weight="bold">MDB</text>
                                </svg>
                            </div>
                        </template>
                        
                        {{-- MongoDB Icon --}}
                        <template x-if="item.type === 'mongodb'">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center shadow-lg ring-2 ring-green-600/30">
                                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296 4.604-3.254 4.292-11.375z"/>
                                </svg>
                            </div>
                        </template>
                        
                        {{-- Redis Icon --}}
                        <template x-if="item.type === 'redis'">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg ring-2 ring-red-600/30">
                                <svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="13" font-weight="bold">R</text>
                                </svg>
                            </div>
                        </template>
                        
                        {{-- Service Icon (default) --}}
                        <template x-if="item.type === 'service'">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg ring-2 ring-purple-600/30">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                </svg>
                            </div>
                        </template>
                    </div>
                    
                    {{-- Title and Status --}}
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <h3 class="text-base font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate" x-text="item.name"></h3>
                        </div>
                        <p class="text-xs text-gray-400 line-clamp-1 mb-2" x-text="item.description || 'No description'"></p>
                        
                        {{-- Status Badge --}}
                        <div class="flex items-center gap-2">
                            <template x-if="item.status.startsWith('running')">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    RUNNING
                                </span>
                            </template>
                            <template x-if="item.status.startsWith('exited')">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm">
                                    <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                    STOPPED
                                </span>
                            </template>
                            <template x-if="item.status.startsWith('starting')">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm">
                                    <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                                    STARTING
                                </span>
                            </template>
                            <template x-if="item.status.startsWith('restarting')">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm">
                                    <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                                    RESTARTING
                                </span>
                            </template>
                            <template x-if="item.status.startsWith('degraded')">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm">
                                    <span class="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                    DEGRADED
                                </span>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
            
            {{-- Content --}}
            <div class="p-5 flex-grow">
                <div class="space-y-3">
                    <template x-if="item.fqdn">
                        <div class="flex items-center gap-2 bg-gray-800/30 rounded-lg px-3 py-2">
                            <svg class="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                            </svg>
                            <span class="text-xs text-gray-300 truncate font-mono" x-text="item.fqdn"></span>
                        </div>
                    </template>
                    
                    <template x-if="item.server_status == false">
                        <div class="flex items-center gap-2 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/30">
                            <svg class="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                            <span class="text-xs text-red-400 font-medium">Server has problems</span>
                        </div>
                    </template>
                </div>
            </div>
            
            {{-- Footer with Tags --}}
            <div class="px-5 py-3 bg-gradient-to-r from-gray-900/40 to-gray-800/20 border-t border-gray-700/50">
                <div class="flex items-center gap-1.5 flex-wrap min-h-[28px]">
                    <template x-for="tag in item.tags">
                        <a :href="`/tags/${tag.name}`" class="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-500/30 transition-colors shadow-sm" x-text="tag.name">
                        </a>
                    </template>
                    <a :href="`${item.hrefLink}/tags`" class="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-gray-700/50 text-gray-400 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors shadow-sm">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                        </svg>
                        Add tag
                    </a>
                </div>
            </div>
        </div>
    </a>
</div>
