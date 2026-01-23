<div class="min-h-screen p-6">
    {{-- Header avec glass effect --}}
    <div class="glass-card p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h1 class="text-3xl font-bold text-glow-primary" style="background: linear-gradient(135deg, var(--color-primary), var(--color-accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    🛡️ IDEM Admin Panel
                </h1>
                <p class="mt-2 text-gray-400">Manage servers, teams, and users</p>
            </div>
            
            {{-- Search Bar --}}
            <div class="w-96">
                <input 
                    type="text" 
                    wire:model.live.debounce.300ms="searchTerm" 
                    placeholder="Search..." 
                    class="input w-full"
                >
            </div>
        </div>

        {{-- Tabs Navigation --}}
        <div class="flex gap-2 border-b border-glass-border pb-2">
            <button 
                wire:click="switchTab('servers')" 
                class="px-4 py-2 rounded-t-lg transition-all {{ $activeTab === 'servers' ? 'inner-button' : 'outer-button opacity-70 hover:opacity-100' }}">
                🖥️ IDEM Servers
            </button>
            <button 
                wire:click="switchTab('client-servers')" 
                class="px-4 py-2 rounded-t-lg transition-all {{ $activeTab === 'client-servers' ? 'inner-button' : 'outer-button opacity-70 hover:opacity-100' }}">
                💼 Client Servers
            </button>
            <button 
                wire:click="switchTab('teams')" 
                class="px-4 py-2 rounded-t-lg transition-all {{ $activeTab === 'teams' ? 'inner-button' : 'outer-button opacity-70 hover:opacity-100' }}">
                👥 Teams
            </button>
            <button 
                wire:click="switchTab('users')" 
                class="px-4 py-2 rounded-t-lg transition-all {{ $activeTab === 'users' ? 'inner-button' : 'outer-button opacity-70 hover:opacity-100' }}">
                👤 Users
            </button>
        </div>
    </div>

    {{-- Content Area --}}
    <div class="glass-card p-6">
        @if($activeTab === 'servers')
            {{-- IDEM Managed Servers --}}
            <h2 class="text-2xl font-bold mb-4 text-white">IDEM Managed Servers</h2>
            
            @if(isset($servers) && $servers->isEmpty())
                <div class="text-center py-12 text-gray-400">
                    <svg class="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <p>No IDEM managed servers found</p>
                </div>
            @else
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    @foreach($servers as $server)
                        <div class="glass p-4 rounded-lg hover:glow-primary transition-all">
                            <div class="flex justify-between items-start mb-3">
                                <h3 class="font-bold text-white">{{ $server->name }}</h3>
                                <span class="px-2 py-1 text-xs rounded {{ $server->idem_load_score < 50 ? 'bg-green-500/20 text-green-300' : ($server->idem_load_score < 80 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300') }}">
                                    Load: {{ $server->idem_load_score }}%
                                </span>
                            </div>
                            <p class="text-sm text-gray-400 mb-2">{{ $server->ip }}</p>
                            @if($server->description)
                                <p class="text-xs text-gray-500">{{ $server->description }}</p>
                            @endif
                            <a href="{{ route('server.show', $server->uuid) }}" class="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300">
                                View Details →
                            </a>
                        </div>
                    @endforeach
                </div>
                
                <div class="mt-6">
                    {{ $servers->links() }}
                </div>
            @endif

        @elseif($activeTab === 'client-servers')
            {{-- Client Servers --}}
            <h2 class="text-2xl font-bold mb-4 text-white">Client Servers</h2>
            
            @if(isset($clientServers) && $clientServers->isEmpty())
                <div class="text-center py-12 text-gray-400">
                    <p>No client servers found</p>
                </div>
            @else
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="border-b border-glass-border">
                            <tr class="text-left text-gray-400">
                                <th class="pb-3">Server Name</th>
                                <th class="pb-3">IP Address</th>
                                <th class="pb-3">Team</th>
                                <th class="pb-3">Status</th>
                                <th class="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($clientServers as $server)
                                <tr class="border-b border-glass-border/50 hover:bg-white/5">
                                    <td class="py-3 text-white">{{ $server->name }}</td>
                                    <td class="py-3 text-gray-400 font-mono text-sm">{{ $server->ip }}</td>
                                    <td class="py-3 text-gray-400">{{ $server->team->name ?? 'N/A' }}</td>
                                    <td class="py-3">
                                        @if($server->settings->is_reachable ?? false)
                                            <span class="text-green-400">● Online</span>
                                        @else
                                            <span class="text-red-400">● Offline</span>
                                        @endif
                                    </td>
                                    <td class="py-3">
                                        <a href="{{ route('server.show', $server->uuid) }}" class="text-blue-400 hover:text-blue-300 text-sm">
                                            View →
                                        </a>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                
                <div class="mt-6">
                    {{ $clientServers->links() }}
                </div>
            @endif

        @elseif($activeTab === 'teams')
            {{-- Teams --}}
            <h2 class="text-2xl font-bold mb-4 text-white">Teams Management</h2>
            
            @if(isset($teams) && $teams->isEmpty())
                <div class="text-center py-12 text-gray-400">
                    <p>No teams found</p>
                </div>
            @else
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="border-b border-glass-border">
                            <tr class="text-left text-gray-400">
                                <th class="pb-3">Team Name</th>
                                <th class="pb-3">Plan</th>
                                <th class="pb-3">Members</th>
                                <th class="pb-3">Apps / Servers</th>
                                <th class="pb-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($teams as $team)
                                <tr class="border-b border-glass-border/50 hover:bg-white/5">
                                    <td class="py-3 text-white">{{ $team->name }}</td>
                                    <td class="py-3">
                                        <span class="px-2 py-1 text-xs rounded {{ $team->idem_subscription_plan === 'free' ? 'bg-gray-500/20 text-gray-300' : ($team->idem_subscription_plan === 'basic' ? 'bg-blue-500/20 text-blue-300' : ($team->idem_subscription_plan === 'pro' ? 'bg-purple-500/20 text-purple-300' : 'bg-yellow-500/20 text-yellow-300')) }}">
                                            {{ ucfirst($team->idem_subscription_plan ?? 'free') }}
                                        </span>
                                    </td>
                                    <td class="py-3 text-gray-400">{{ $team->members_count ?? 0 }}</td>
                                    <td class="py-3 text-gray-400">
                                        📱 {{ $team->idem_apps_count ?? 0 }} / 🖥️ {{ $team->idem_servers_count ?? 0 }}
                                    </td>
                                    <td class="py-3">
                                        @if($team->idem_subscription_expires_at && $team->idem_subscription_expires_at < now())
                                            <span class="text-red-400">Expired</span>
                                        @else
                                            <span class="text-green-400">Active</span>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                
                <div class="mt-6">
                    {{ $teams->links() }}
                </div>
            @endif

        @elseif($activeTab === 'users')
            {{-- Users --}}
            <h2 class="text-2xl font-bold mb-4 text-white">Users Management</h2>
            
            @if(isset($users) && $users->isEmpty())
                <div class="text-center py-12 text-gray-400">
                    <p>No users found</p>
                </div>
            @else
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="border-b border-glass-border">
                            <tr class="text-left text-gray-400">
                                <th class="pb-3">User</th>
                                <th class="pb-3">Email</th>
                                <th class="pb-3">Role</th>
                                <th class="pb-3">Team</th>
                                <th class="pb-3">Created</th>
                                <th class="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($users as $user)
                                <tr class="border-b border-glass-border/50 hover:bg-white/5">
                                    <td class="py-3">
                                        <div class="flex items-center gap-3">
                                            <div class="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                                {{ strtoupper(substr($user->name, 0, 1)) }}
                                            </div>
                                            <span class="text-white">{{ $user->name }}</span>
                                        </div>
                                    </td>
                                    <td class="py-3 text-gray-400">{{ $user->email }}</td>
                                    <td class="py-3">
                                        @if($user->idem_role === 'admin')
                                            <span class="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300">
                                                🛡️ Admin
                                            </span>
                                        @else
                                            <span class="px-2 py-1 text-xs rounded bg-gray-500/20 text-gray-300">
                                                👤 Member
                                            </span>
                                        @endif
                                    </td>
                                    <td class="py-3 text-gray-400">
                                        {{ $user->currentTeam->name ?? 'N/A' }}
                                    </td>
                                    <td class="py-3 text-gray-400 text-sm">
                                        {{ $user->created_at->diffForHumans() }}
                                    </td>
                                    <td class="py-3">
                                        @if($user->idem_role === 'admin')
                                            <button wire:click="demoteUser({{ $user->id }})" class="text-yellow-400 hover:text-yellow-300 text-sm">
                                                Demote
                                            </button>
                                        @else
                                            <button wire:click="promoteUser({{ $user->id }})" class="text-blue-400 hover:text-blue-300 text-sm">
                                                Promote
                                            </button>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                
                <div class="mt-6">
                    {{ $users->links() }}
                </div>
            @endif
        @endif
    </div>
</div>
