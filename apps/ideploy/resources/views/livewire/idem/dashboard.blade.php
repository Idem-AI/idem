<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {{-- Page Header --}}
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            📊 IDEM Dashboard
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
            Overview of your subscription and resources
        </p>
    </div>

    {{-- Subscription Banner --}}
    <livewire:idem.subscription-banner />

    {{-- Quick Stats Grid --}}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {{-- Current Plan --}}
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <span class="text-2xl">💼</span>
                        </div>
                    </div>
                    <div class="ml-4 flex-1">
                        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Current Plan</p>
                        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                            {{ ucfirst($stats['subscription']['plan']) }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {{-- Applications --}}
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                            <span class="text-2xl">📱</span>
                        </div>
                    </div>
                    <div class="ml-4 flex-1">
                        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Applications</p>
                        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                            {{ $stats['apps']['total'] }}
                        </p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {{ $stats['apps']['on_idem'] }} on IDEM • {{ $stats['apps']['on_personal'] }} personal
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {{-- Personal Servers --}}
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <span class="text-2xl">🖥️</span>
                        </div>
                    </div>
                    <div class="ml-4 flex-1">
                        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Personal Servers</p>
                        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                            {{ $stats['servers']['personal'] }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {{-- Monthly Cost --}}
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="p-6">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                            <span class="text-2xl">💰</span>
                        </div>
                    </div>
                    <div class="ml-4 flex-1">
                        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Cost</p>
                        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                            ${{ number_format($stats['subscription']['plan']['price'] ?? 0, 2) }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {{-- Quotas Detail --}}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {{-- Apps Quota --}}
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="p-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    📱 Applications Quota
                </h3>
                <livewire:idem.quota-badge type="apps" :showDetails="true" />
                
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-gray-600 dark:text-gray-400">On IDEM Servers:</span>
                        <span class="font-medium text-gray-900 dark:text-white">{{ $stats['apps']['on_idem'] }}</span>
                    </div>
                    <div class="flex items-center justify-between text-sm mt-2">
                        <span class="text-gray-600 dark:text-gray-400">On Personal Servers:</span>
                        <span class="font-medium text-gray-900 dark:text-white">{{ $stats['apps']['on_personal'] }}</span>
                    </div>
                </div>
            </div>
        </div>

        {{-- Servers Quota --}}
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="p-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    🖥️ Servers Quota
                </h3>
                <livewire:idem.quota-badge type="servers" :showDetails="true" />
                
                @if($stats['quotas']['servers']['percentage'] >= 80 && !$stats['quotas']['servers']['unlimited'])
                    <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p class="text-sm text-yellow-800 dark:text-yellow-300">
                            💡 <strong>Tip:</strong> Upgrade to add more personal servers or use IDEM managed servers (unlimited).
                        </p>
                    </div>
                @endif
            </div>
        </div>
    </div>

    {{-- Plan Features --}}
    <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                ✨ Your Plan Features
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @foreach(json_decode($stats['subscription']['plan']['features'] ?? '[]', true) as $feature)
                    <div class="flex items-start">
                        <svg class="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span class="text-sm text-gray-700 dark:text-gray-300">{{ $feature }}</span>
                    </div>
                @endforeach
            </div>

            @if($stats['subscription']['plan'] === 'free')
                <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium text-blue-900 dark:text-blue-200">Ready to scale?</p>
                            <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                Upgrade to unlock more applications, personal servers, and advanced features.
                            </p>
                        </div>
                        <a href="{{ route('idem.subscription') }}" 
                           class="ml-4 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md whitespace-nowrap transition-colors">
                            Upgrade Plan →
                        </a>
                    </div>
                </div>
            @endif
        </div>
    </div>

    {{-- Quick Actions --}}
    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <a href="{{ route('project.index') }}" 
           class="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <span class="text-3xl">➕</span>
                </div>
                <div class="ml-4">
                    <h4 class="text-lg font-semibold text-gray-900 dark:text-white">New Application</h4>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Deploy a new app</p>
                </div>
            </div>
        </a>

        <a href="{{ route('server.index') }}" 
           class="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <span class="text-3xl">🖥️</span>
                </div>
                <div class="ml-4">
                    <h4 class="text-lg font-semibold text-gray-900 dark:text-white">Add Server</h4>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Connect your server</p>
                </div>
            </div>
        </a>

        <a href="{{ route('idem.subscription') }}" 
           class="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <span class="text-3xl">⚙️</span>
                </div>
                <div class="ml-4">
                    <h4 class="text-lg font-semibold text-gray-900 dark:text-white">Manage Subscription</h4>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Update your plan</p>
                </div>
            </div>
        </a>
    </div>
</div>
