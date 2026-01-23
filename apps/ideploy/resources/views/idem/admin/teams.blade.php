<x-layout>
    <div class="container mx-auto px-4 py-8">
        <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                👥 Teams Management
            </h1>
            <p class="mt-2 text-gray-600 dark:text-gray-400">
                Manage all teams and their subscriptions
            </p>
        </div>

        <div class="bg-white dark:bg-coolgray-100 shadow overflow-hidden sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-coolgray-200">
                <thead class="bg-gray-50 dark:bg-coolgray-200">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Team Name
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Subscription Plan
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Members
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Apps / Servers
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                        </th>
                        <th scope="col" class="relative px-6 py-3">
                            <span class="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-coolgray-100 divide-y divide-gray-200 dark:divide-coolgray-200">
                    @forelse($teams as $team)
                        <tr class="hover:bg-gray-50 dark:hover:bg-coolgray-200">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium text-gray-900 dark:text-white">
                                    {{ $team->name }}
                                </div>
                                <div class="text-sm text-gray-500 dark:text-gray-400">
                                    ID: {{ $team->id }}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                    {{ $team->idem_subscription_plan === 'free' ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300' : 
                                       ($team->idem_subscription_plan === 'basic' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 
                                       ($team->idem_subscription_plan === 'pro' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' : 
                                       'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300')) }}">
                                    {{ ucfirst($team->idem_subscription_plan ?? 'free') }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {{ $team->members_count ?? 0 }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                <div class="flex space-x-3">
                                    <span title="Applications">
                                        📱 {{ $team->idem_apps_count ?? 0 }}
                                    </span>
                                    <span title="Servers">
                                        🖥️ {{ $team->idem_servers_count ?? 0 }}
                                    </span>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                @if($team->idem_subscription_expires_at && $team->idem_subscription_expires_at < now())
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                        Expired
                                    </span>
                                @else
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                        Active
                                    </span>
                                @endif
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <a href="#" class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300">
                                    Manage
                                </a>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                No teams found
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        @if($teams->hasPages())
            <div class="mt-4">
                {{ $teams->links() }}
            </div>
        @endif
    </div>
</x-layout>
