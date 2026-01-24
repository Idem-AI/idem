<div class="min-h-screen bg-[#0a0e1a]">
    <!-- Header -->
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p class="text-gray-400">Manage all teams and their members</p>
    </div>

    <!-- Stats Overview -->
    @if($stats)
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <!-- Total Users -->
            <div class="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-6 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 group">
                <div class="flex items-start justify-between mb-4">
                    <div class="p-3 bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                        <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                        </svg>
                    </div>
                </div>
                <div>
                    <p class="text-gray-400 text-sm font-medium mb-1">Total Users</p>
                    <p class="text-4xl font-bold text-white mb-2">{{ $stats['users']['total'] ?? 0 }}</p>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                            {{ $stats['users']['admins'] ?? 0 }} admins
                        </span>
                    </div>
                </div>
            </div>

            <!-- Total Teams -->
            <div class="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-6 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 group">
                <div class="flex items-start justify-between mb-4">
                    <div class="p-3 bg-green-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                        <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                    </div>
                </div>
                <div>
                    <p class="text-gray-400 text-sm font-medium mb-1">Total Teams</p>
                    <p class="text-4xl font-bold text-white mb-2">{{ $stats['teams']['total'] ?? 0 }}</p>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                            {{ $stats['teams']['active'] ?? 0 }} active
                        </span>
                    </div>
                </div>
            </div>

            <!-- Total Servers -->
            <div class="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 group">
                <div class="flex items-start justify-between mb-4">
                    <div class="p-3 bg-purple-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                        <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                        </svg>
                    </div>
                </div>
                <div>
                    <p class="text-gray-400 text-sm font-medium mb-1">Total Servers</p>
                    <p class="text-4xl font-bold text-white mb-2">{{ $stats['servers']['total'] ?? 0 }}</p>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                            {{ $stats['servers']['managed'] ?? 0 }} managed
                        </span>
                    </div>
                </div>
            </div>

            <!-- Monthly Revenue -->
            <div class="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl p-6 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 group">
                <div class="flex items-start justify-between mb-4">
                    <div class="p-3 bg-amber-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                        <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
                <div>
                    <p class="text-gray-400 text-sm font-medium mb-1">Monthly Revenue</p>
                    <p class="text-4xl font-bold text-white mb-2">${{ number_format($stats['revenue']['monthly'] ?? 0, 0) }}</p>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                            ARR: ${{ number_format($stats['revenue']['annual'] ?? 0, 0) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    @endif

    <!-- Tabs -->
    <div class="mb-8">
        <div class="bg-[#0f1419] rounded-xl p-2 inline-flex gap-2">
            <button wire:click="switchTab('overview')" 
                    class="px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 {{ $selectedTab === 'overview' ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    Overview
                </span>
            </button>
            <button wire:click="switchTab('teams')" 
                    class="px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 {{ $selectedTab === 'teams' ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    Teams
                </span>
            </button>
            <button wire:click="switchTab('users')" 
                    class="px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 {{ $selectedTab === 'users' ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                    </svg>
                    Users
                </span>
            </button>
            <button wire:click="switchTab('servers')" 
                    class="px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 {{ $selectedTab === 'servers' ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800/50' }}">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                    </svg>
                    Servers
                </span>
            </button>
        </div>
    </div>

    <!-- Tab Content -->
    <div>
        @if($selectedTab === 'overview')
            <!-- Overview Content -->
            <div class="bg-[#0f1419] rounded-xl p-8 border border-gray-800/50">
                <h3 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <div class="p-2 bg-blue-500/20 rounded-lg">
                        <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                    </div>
                    Platform Overview
                </h3>
                
                @if($stats && isset($stats['teams_by_plan']))
                    <div class="space-y-4">
                        <p class="text-gray-300 font-semibold text-lg mb-4">Teams by Plan</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            @foreach($stats['teams_by_plan'] as $plan => $count)
                                <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-200">
                                    <div class="flex justify-between items-center">
                                        <span class="text-gray-300 capitalize font-medium">{{ $plan }}</span>
                                        <span class="bg-blue-500/20 px-4 py-2 rounded-lg text-blue-400 font-bold text-lg">{{ $count }}</span>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endif
            </div>
        @endif

        @if($selectedTab === 'teams')
            <!-- Teams Management -->
            <div class="bg-[#0f1419] rounded-xl p-8 border border-gray-800/50">
                <h3 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <div class="p-2 bg-green-500/20 rounded-lg">
                        <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                    </div>
                    Teams Management
                </h3>
                <div class="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
                    <p class="text-gray-300 text-lg mb-4">
                        Use the API or visit the dedicated page for full teams management.
                    </p>
                    <a href="{{ route('idem.admin.teams') }}" class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg border border-blue-500/30 hover:border-blue-500/50 transition-all duration-200 font-medium">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                        Go to Teams Management
                    </a>
                </div>
            </div>
        @endif

        @if($selectedTab === 'users')
            <!-- Users Management -->
            <div class="bg-[#0f1419] rounded-xl p-8 border border-gray-800/50">
                <h3 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <div class="p-2 bg-purple-500/20 rounded-lg">
                        <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                        </svg>
                    </div>
                    Users Management
                </h3>
                <p class="text-gray-300 mb-6 text-lg">Promote or demote users</p>
                
                <!-- Simple user search -->
                <div class="mb-6">
                    <div class="relative">
                        <input type="text" 
                               wire:model.debounce.500ms="searchTerm" 
                               placeholder="Search users by email..."
                               class="w-full bg-gray-800/50 text-white px-5 py-4 pl-12 rounded-xl border border-gray-700/50 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200">
                        <svg class="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </div>
                </div>
                
                <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div class="flex items-start gap-3">
                        <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <p class="text-blue-300 text-sm">
                            Full user management features available via API endpoints
                        </p>
                    </div>
                </div>
            </div>
        @endif

        @if($selectedTab === 'servers')
            <!-- Servers Management -->
            <div class="bg-[#0f1419] rounded-xl p-8 border border-gray-800/50">
                <h3 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <div class="p-2 bg-amber-500/20 rounded-lg">
                        <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                        </svg>
                    </div>
                    IDEM Managed Servers
                </h3>
                <div class="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
                    <p class="text-gray-300 text-lg mb-4">
                        View and manage all IDEM managed servers from the dedicated management page.
                    </p>
                    <a href="{{ route('idem.admin.servers') }}" class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg border border-blue-500/30 hover:border-blue-500/50 transition-all duration-200 font-medium">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                        Go to Servers Management
                    </a>
                </div>
            </div>
        @endif
    </div>

    <!-- Loading Overlay -->
    <div wire:loading class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-[#0f1419] rounded-xl p-8 border border-gray-700/50 shadow-2xl">
            <div class="flex flex-col items-center gap-4">
                <div class="relative">
                    <div class="animate-spin rounded-full h-16 w-16 border-4 border-gray-700"></div>
                    <div class="animate-spin rounded-full h-16 w-16 border-4 border-t-blue-500 absolute top-0 left-0"></div>
                </div>
                <p class="text-white font-medium text-lg">Loading...</p>
            </div>
        </div>
    </div>
</div>
