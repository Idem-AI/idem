<div>
    {{-- Header --}}
    <div class="flex items-center justify-between mb-6">
        <div>
            <h2 class="text-2xl font-bold dark:text-white">Team Management</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage all teams and their members</p>
        </div>
    </div>

    {{-- Search --}}
    <div class="mb-4">
        <input type="text" wire:model.live="search" placeholder="Search teams by name..." 
               class="input w-full md:w-96">
    </div>

    {{-- Teams Grid --}}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @forelse($teams as $team)
            <div class="box p-5">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <h3 class="font-semibold dark:text-white text-lg">{{ $team->name }}</h3>
                        @if($team->personal_team)
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded mt-1">
                                Personal
                            </span>
                        @endif
                    </div>
                </div>

                {{-- Stats --}}
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <div class="bg-blue-50 dark:bg-blue-950/20 rounded-md p-2 text-center">
                        <div class="text-lg font-bold text-blue-600 dark:text-blue-400">{{ $team->members_count }}</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">Members</div>
                    </div>
                    
                    <div class="bg-green-50 dark:bg-green-950/20 rounded-md p-2 text-center">
                        <div class="text-lg font-bold text-green-600 dark:text-green-400">{{ $team->projects()->count() }}</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">Projects</div>
                    </div>
                    
                    <div class="bg-purple-50 dark:bg-purple-950/20 rounded-md p-2 text-center">
                        <div class="text-lg font-bold text-purple-600 dark:text-purple-400">{{ $team->servers()->count() }}</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">Servers</div>
                    </div>
                </div>

                {{-- Subscription Plan --}}
                @if($team->idem_subscription_plan)
                    <div class="mb-3">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Plan:</span>
                        <span class="ml-1 text-sm font-medium dark:text-white">
                            {{ ucfirst($team->idem_subscription_plan) }}
                        </span>
                    </div>
                @endif

                {{-- Actions --}}
                <div class="flex items-center gap-2 pt-3 border-t dark:border-coolgray-200">
                    <button wire:click="showDetails({{ $team->id }})" class="button text-xs flex-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        Details
                    </button>
                    
                    <button wire:click="deleteTeam({{ $team->id }})" 
                            onclick="return confirm('Delete this team? This action cannot be undone.')"
                            class="button bg-red-600 text-xs">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </div>
        @empty
            <div class="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                No teams found.
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
