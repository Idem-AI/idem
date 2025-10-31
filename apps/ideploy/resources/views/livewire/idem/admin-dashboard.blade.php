<div>
    <!-- Stats Overview -->
    @if($stats)
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <!-- Total Users -->
            <div class="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-slate-400 text-sm">{{ __('Total Users') }}</p>
                        <p class="text-3xl font-bold text-white">{{ $stats['users']['total'] ?? 0 }}</p>
                        <p class="text-xs text-slate-500 mt-1">{{ $stats['users']['admins'] ?? 0 }} admins</p>
                    </div>
                    <svg class="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                    </svg>
                </div>
            </div>

            <!-- Total Teams -->
            <div class="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-slate-400 text-sm">{{ __('Total Teams') }}</p>
                        <p class="text-3xl font-bold text-white">{{ $stats['teams']['total'] ?? 0 }}</p>
                        <p class="text-xs text-slate-500 mt-1">{{ $stats['teams']['active'] ?? 0 }} active</p>
                    </div>
                    <svg class="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                </div>
            </div>

            <!-- Total Servers -->
            <div class="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-slate-400 text-sm">{{ __('Total Servers') }}</p>
                        <p class="text-3xl font-bold text-white">{{ $stats['servers']['total'] ?? 0 }}</p>
                        <p class="text-xs text-slate-500 mt-1">{{ $stats['servers']['managed'] ?? 0 }} IDEM managed</p>
                    </div>
                    <svg class="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                    </svg>
                </div>
            </div>

            <!-- Monthly Revenue -->
            <div class="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-slate-400 text-sm">{{ __('Monthly Revenue') }}</p>
                        <p class="text-3xl font-bold text-white">${{ number_format($stats['revenue']['monthly'] ?? 0, 0) }}</p>
                        <p class="text-xs text-slate-500 mt-1">ARR: ${{ number_format($stats['revenue']['annual'] ?? 0, 0) }}</p>
                    </div>
                    <svg class="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
            </div>
        </div>
    @endif

    <!-- Tabs -->
    <div class="mb-6">
        <div class="border-b border-slate-700">
            <nav class="-mb-px flex space-x-8">
                <button wire:click="switchTab('overview')" 
                        class="border-b-2 py-4 px-1 text-sm font-medium {{ $selectedTab === 'overview' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300' }}">
                    {{ __('Overview') }}
                </button>
                <button wire:click="switchTab('teams')" 
                        class="border-b-2 py-4 px-1 text-sm font-medium {{ $selectedTab === 'teams' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300' }}">
                    {{ __('Teams') }}
                </button>
                <button wire:click="switchTab('users')" 
                        class="border-b-2 py-4 px-1 text-sm font-medium {{ $selectedTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300' }}">
                    {{ __('Users') }}
                </button>
                <button wire:click="switchTab('servers')" 
                        class="border-b-2 py-4 px-1 text-sm font-medium {{ $selectedTab === 'servers' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300' }}">
                    {{ __('Servers') }}
                </button>
            </nav>
        </div>
    </div>

    <!-- Tab Content -->
    <div>
        @if($selectedTab === 'overview')
            <!-- Overview Content -->
            <div class="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <h3 class="text-xl font-bold text-white mb-4">{{ __('Platform Overview') }}</h3>
                
                @if($stats && isset($stats['teams_by_plan']))
                    <div class="space-y-3">
                        <p class="text-slate-300 font-semibold mb-2">{{ __('Teams by Plan') }}</p>
                        @foreach($stats['teams_by_plan'] as $plan => $count)
                            <div class="flex justify-between items-center">
                                <span class="text-slate-400 capitalize">{{ $plan }}</span>
                                <span class="bg-slate-700 px-3 py-1 rounded text-white font-semibold">{{ $count }}</span>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
        @endif

        @if($selectedTab === 'teams')
            <!-- Teams Management -->
            <div class="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <h3 class="text-xl font-bold text-white mb-4">{{ __('Teams Management') }}</h3>
                <p class="text-slate-400">
                    {{ __('Use the API or visit') }} <a href="{{ route('idem.admin.teams') }}" class="text-blue-400 hover:text-blue-300">{{ __('Teams Management Page') }}</a>
                </p>
            </div>
        @endif

        @if($selectedTab === 'users')
            <!-- Users Management -->
            <div class="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <h3 class="text-xl font-bold text-white mb-4">{{ __('Users Management') }}</h3>
                <p class="text-slate-400 mb-4">{{ __('Promote or demote users') }}</p>
                
                <!-- Simple user search -->
                <div class="mb-4">
                    <input type="text" 
                           wire:model.debounce.500ms="searchTerm" 
                           placeholder="{{ __('Search users by email...') }}"
                           class="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none">
                </div>
                
                <div class="text-slate-400 text-sm">
                    {{ __('Note: Full user management features available via API endpoints') }}
                </div>
            </div>
        @endif

        @if($selectedTab === 'servers')
            <!-- Servers Management -->
            <div class="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
                <h3 class="text-xl font-bold text-white mb-4">{{ __('IDEM Managed Servers') }}</h3>
                <p class="text-slate-400">
                    {{ __('View and manage IDEM servers at') }} <a href="{{ route('idem.admin.servers') }}" class="text-blue-400 hover:text-blue-300">{{ __('Servers Management Page') }}</a>
                </p>
            </div>
        @endif
    </div>

    <!-- Loading Overlay -->
    <div wire:loading class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-lg p-6">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p class="text-white mt-4">{{ __('Loading...') }}</p>
        </div>
    </div>
</div>
