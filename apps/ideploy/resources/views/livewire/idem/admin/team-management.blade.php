<div class="min-h-screen bg-[#0a0e1a]">
    {{-- Header --}}
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Team Management</h1>
        <p class="text-gray-400">Manage all teams and their members</p>
    </div>

    {{-- Search --}}
    <div class="mb-6">
        <div class="relative max-w-md">
            <input type="text" wire:model.live="search" placeholder="Search teams by name..." 
                   class="w-full bg-[#0f1419] text-white px-5 py-4 pl-12 rounded-xl border border-gray-700/50 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200">
            <svg class="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
        </div>
    </div>

    {{-- Teams Grid --}}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @forelse($teams as $team)
            <div class="bg-[#0f1419] rounded-xl p-6 border border-gray-800/50 hover:border-blue-500/30 transition-all duration-300 group">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <h3 class="font-bold text-white text-xl mb-2">{{ $team->name }}</h3>
                        @if($team->personal_team)
                            <span class="inline-flex items-center px-3 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                                </svg>
                                Personal
                            </span>
                        @endif
                    </div>
                </div>

                {{-- Stats --}}
                <div class="grid grid-cols-3 gap-3 mb-5">
                    <div class="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg p-3 text-center border border-blue-500/20">
                        <div class="text-2xl font-bold text-blue-400 mb-1">{{ $team->members_count }}</div>
                        <div class="text-xs text-gray-400 font-medium">Members</div>
                    </div>
                    
                    <div class="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-lg p-3 text-center border border-green-500/20">
                        <div class="text-2xl font-bold text-green-400 mb-1">{{ $team->projects()->count() }}</div>
                        <div class="text-xs text-gray-400 font-medium">Projects</div>
                    </div>
                    
                    <div class="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg p-3 text-center border border-purple-500/20">
                        <div class="text-2xl font-bold text-purple-400 mb-1">{{ $team->servers()->count() }}</div>
                        <div class="text-xs text-gray-400 font-medium">Servers</div>
                    </div>
                </div>

                {{-- Subscription Plan --}}
                @if($team->idem_subscription_plan)
                    <div class="mb-4 flex items-center gap-2">
                        <span class="text-xs text-gray-400 font-medium">Plan:</span>
                        <span class="inline-flex items-center px-3 py-1 text-sm font-bold bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                            {{ ucfirst($team->idem_subscription_plan) }}
                        </span>
                    </div>
                @endif

                {{-- Actions --}}
                <div class="flex items-center gap-3 pt-4 border-t border-gray-700/50">
                    <button wire:click="showDetails({{ $team->id }})" 
                            class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg border border-blue-500/30 hover:border-blue-500/50 transition-all duration-200 font-medium text-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        Details
                    </button>
                    
                    <button wire:click="deleteTeam({{ $team->id }})" 
                            onclick="return confirm('Delete this team? This action cannot be undone.')"
                            class="inline-flex items-center justify-center p-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/30 hover:border-red-500/50 transition-all duration-200">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </div>
        @empty
            <div class="col-span-full">
                <div class="bg-[#0f1419] rounded-xl p-12 border border-gray-800/50 text-center">
                    <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    <p class="text-gray-400 text-lg">No teams found.</p>
                </div>
            </div>
        @endforelse
    </div>

    {{-- Pagination --}}
    <div class="mt-4">
        {{ $teams->links() }}
    </div>

    {{-- Team Details Modal --}}
    @if($showDetailsModal && $selectedTeam)
        <div class="fixed inset-0 z-50 overflow-y-auto">
            <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {{-- Backdrop --}}
                <div class="fixed inset-0 transition-opacity bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75" 
                     wire:click="closeDetailsModal"></div>

                {{-- Modal --}}
                <div class="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white dark:bg-coolgray-100 rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
                    <div class="absolute top-0 right-0 pt-4 pr-4">
                        <button wire:click="closeDetailsModal" class="text-gray-400 hover:text-gray-500">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    <div class="sm:flex sm:items-start">
                        <div class="w-full mt-3 text-center sm:mt-0 sm:text-left">
                            <h3 class="text-xl font-bold leading-6 dark:text-white mb-4">
                                {{ $selectedTeam->name }}
                            </h3>

                            {{-- Team Info --}}
                            <div class="grid grid-cols-2 gap-4 mb-6">
                                <div class="box p-4">
                                    <div class="text-sm text-gray-500 dark:text-gray-400">Created</div>
                                    <div class="text-lg font-semibold dark:text-white">
                                        {{ $selectedTeam->created_at->format('M d, Y') }}
                                    </div>
                                </div>
                                <div class="box p-4">
                                    <div class="text-sm text-gray-500 dark:text-gray-400">Subscription Plan</div>
                                    <div class="text-lg font-semibold dark:text-white">
                                        {{ ucfirst($selectedTeam->idem_subscription_plan ?? 'None') }}
                                    </div>
                                </div>
                            </div>

                            {{-- Members --}}
                            <div class="mb-6">
                                <h4 class="font-semibold dark:text-white mb-3">Members ({{ $selectedTeam->members->count() }})</h4>
                                <div class="space-y-2">
                                    @foreach($selectedTeam->members as $member)
                                        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-coolgray-200 rounded-lg">
                                            <div class="flex items-center gap-3">
                                                <img class="h-8 w-8 rounded-full" 
                                                     src="https://ui-avatars.com/api/?name={{ urlencode($member->name) }}&background=3b82f6&color=fff" 
                                                     alt="{{ $member->name }}">
                                                <div>
                                                    <div class="text-sm font-medium dark:text-white">{{ $member->name }}</div>
                                                    <div class="text-xs text-gray-500 dark:text-gray-400">{{ $member->email }}</div>
                                                </div>
                                            </div>
                                            <div>
                                                @if($member->pivot->role === 'owner')
                                                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                                        Owner
                                                    </span>
                                                @else
                                                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded">
                                                        Member
                                                    </span>
                                                @endif
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>

                            {{-- Resources Summary --}}
                            <div class="grid grid-cols-2 gap-4">
                                <div class="box p-4">
                                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">Projects</div>
                                    <div class="text-2xl font-bold dark:text-white">{{ $selectedTeam->projects->count() }}</div>
                                </div>
                                <div class="box p-4">
                                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">Servers</div>
                                    <div class="text-2xl font-bold dark:text-white">{{ $selectedTeam->servers->count() }}</div>
                                </div>
                            </div>

                            {{-- Close Button --}}
                            <div class="mt-6">
                                <button wire:click="closeDetailsModal" class="button w-full">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @endif
</div>
