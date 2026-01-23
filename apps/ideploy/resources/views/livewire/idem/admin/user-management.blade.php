<div>
    {{-- Header --}}
    <div class="flex items-center justify-between mb-6">
        <div>
            <h2 class="text-2xl font-bold dark:text-white">User Management</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage all users and their teams</p>
        </div>
        <button wire:click="openCreateModal" class="button">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create User
        </button>
    </div>

    {{-- Search --}}
    <div class="mb-4">
        <input type="text" wire:model.live="search" placeholder="Search users by name or email..." 
               class="input w-full md:w-96">
    </div>

    {{-- Users Table --}}
    <div class="overflow-x-auto">
        <table class="w-full">
            <thead>
                <tr class="border-b dark:border-coolgray-200">
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Teams
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y dark:divide-coolgray-200">
                @forelse($users as $user)
                    <tr class="hover:bg-gray-50 dark:hover:bg-coolgray-100">
                        <td class="px-4 py-4">
                            <div class="flex items-center">
                                <div class="flex-shrink-0 h-10 w-10">
                                    <img class="h-10 w-10 rounded-full" 
                                         src="https://ui-avatars.com/api/?name={{ urlencode($user->name) }}&background=3b82f6&color=fff" 
                                         alt="{{ $user->name }}">
                                </div>
                                <div class="ml-4">
                                    <div class="text-sm font-medium dark:text-white">{{ $user->name }}</div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">
                                        ID: {{ $user->id }}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="px-4 py-4">
                            <div class="text-sm dark:text-white">{{ $user->email }}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                                {{ $user->created_at->diffForHumans() }}
                            </div>
                        </td>
                        <td class="px-4 py-4">
                            <div class="flex flex-wrap gap-1">
                                @forelse($user->teams as $team)
                                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                        {{ $team->name }}
                                    </span>
                                @empty
                                    <span class="text-xs text-gray-500 dark:text-gray-400">No team</span>
                                @endforelse
                            </div>
                        </td>
                        <td class="px-4 py-4">
                            @if($user->is_idem_admin)
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                                    Admin
                                </span>
                            @elseif($user->isOwner())
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                    Owner
                                </span>
                            @else
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded">
                                    Member
                                </span>
                            @endif
                        </td>
                        <td class="px-4 py-4">
                            @if($user->is_active ?? true)
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                    Active
                                </span>
                            @else
                                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded">
                                    Inactive
                                </span>
                            @endif
                        </td>
                        <td class="px-4 py-4">
                            <div class="flex items-center gap-2">
                                <button wire:click="toggleStatus({{ $user->id }})" 
                                        class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                        title="{{ ($user->is_active ?? true) ? 'Deactivate' : 'Activate' }}">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        @if($user->is_active ?? true)
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                        @else
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        @endif
                                    </svg>
                                </button>
                                
                                <button wire:click="deleteUser({{ $user->id }})" 
                                        onclick="return confirm('Are you sure you want to delete this user?')"
                                        class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                        title="Delete">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="6" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            No users found.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    {{-- Pagination --}}
    <div class="mt-4">
        {{ $users->links() }}
    </div>

    {{-- Create User Modal --}}
    @if($showCreateModal)
        <div class="fixed inset-0 z-50 overflow-y-auto" x-data x-init="$el.focus()" tabindex="0">
            <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {{-- Backdrop --}}
                <div class="fixed inset-0 transition-opacity bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75" 
                     wire:click="closeCreateModal"></div>

                {{-- Modal --}}
                <div class="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white dark:bg-coolgray-100 rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div class="absolute top-0 right-0 pt-4 pr-4">
                        <button wire:click="closeCreateModal" class="text-gray-400 hover:text-gray-500">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    <div class="sm:flex sm:items-start">
                        <div class="w-full mt-3 text-center sm:mt-0 sm:text-left">
                            <h3 class="text-lg font-medium leading-6 dark:text-white mb-4">
                                Create New User
                            </h3>

                            <form wire:submit="createUser" class="space-y-4">
                                {{-- Name --}}
                                <div>
                                    <label for="name" class="block text-sm font-medium dark:text-gray-300 mb-1">
                                        Name *
                                    </label>
                                    <input type="text" wire:model="name" id="name" class="input w-full" required>
                                    @error('name') <span class="text-red-500 text-xs">{{ $message }}</span> @enderror
                                </div>

                                {{-- Email --}}
                                <div>
                                    <label for="email" class="block text-sm font-medium dark:text-gray-300 mb-1">
                                        Email *
                                    </label>
                                    <input type="email" wire:model="email" id="email" class="input w-full" required>
                                    @error('email') <span class="text-red-500 text-xs">{{ $message }}</span> @enderror
                                </div>

                                {{-- Password --}}
                                <div>
                                    <label for="password" class="block text-sm font-medium dark:text-gray-300 mb-1">
                                        Password *
                                    </label>
                                    <input type="password" wire:model="password" id="password" class="input w-full" required>
                                    @error('password') <span class="text-red-500 text-xs">{{ $message }}</span> @enderror
                                </div>

                                {{-- Team Name --}}
                                <div>
                                    <label for="team_name" class="block text-sm font-medium dark:text-gray-300 mb-1">
                                        Team Name (optional)
                                    </label>
                                    <input type="text" wire:model="team_name" id="team_name" class="input w-full" 
                                           placeholder="Leave empty to use default">
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        If empty, team will be named "[Name]'s Team"
                                    </p>
                                    @error('team_name') <span class="text-red-500 text-xs">{{ $message }}</span> @enderror
                                </div>

                                {{-- Is Admin --}}
                                <div class="flex items-center">
                                    <input type="checkbox" wire:model="is_admin" id="is_admin" class="checkbox">
                                    <label for="is_admin" class="ml-2 text-sm dark:text-gray-300">
                                        Grant Administrator Role
                                    </label>
                                </div>

                                {{-- Actions --}}
                                <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                                    <button type="submit" class="button">
                                        Create User
                                    </button>
                                    <button type="button" wire:click="closeCreateModal" class="button bg-gray-500">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    @endif
</div>
