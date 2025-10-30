<div>
    @if($showUpgradePrompt && !session('idem_banner_dismissed'))
        {{-- Upgrade Prompt Banner --}}
        <div class="relative bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-l-4 border-yellow-400 p-4 mb-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center flex-1">
                    <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div class="flex-1">
                        <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            ⚠️ You're approaching your plan limits
                        </h3>
                        <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                            Upgrade to {{ $plan['name'] === 'free' ? 'Basic' : 'Pro' }} for more resources and features.
                        </p>
                    </div>
                </div>
                <div class="flex items-center space-x-3 ml-4">
                    <a href="{{ route('idem.subscription') }}" 
                       class="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-md transition-colors">
                        ⬆️ Upgrade Now
                    </a>
                    @if($dismissible)
                        <button wire:click="dismiss" 
                                class="text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    @endif
                </div>
            </div>
        </div>
    @endif

    {{-- Subscription Info Banner (subtle, always visible) --}}
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-4 shadow-sm">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <div class="flex items-center">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                        {{ $plan['name'] === 'free' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' : 
                           ($plan['name'] === 'basic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                           ($plan['name'] === 'pro' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 
                           'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200')) }}">
                        @if($plan['name'] === 'free')
                            🆓 Free Plan
                        @elseif($plan['name'] === 'basic')
                            💼 Basic Plan
                        @elseif($plan['name'] === 'pro')
                            🚀 Pro Plan
                        @else
                            👑 Enterprise Plan
                        @endif
                    </span>
                </div>
                
                <div class="hidden sm:flex items-center space-x-4 text-sm">
                    <div class="flex items-center">
                        <span class="text-gray-600 dark:text-gray-400 mr-1">Apps:</span>
                        <livewire:idem.quota-badge type="apps" :compact="true" />
                    </div>
                    <div class="flex items-center">
                        <span class="text-gray-600 dark:text-gray-400 mr-1">Servers:</span>
                        <livewire:idem.quota-badge type="servers" :compact="true" />
                    </div>
                </div>
            </div>

            <div class="flex items-center space-x-2">
                <a href="{{ route('idem.subscription') }}" 
                   class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                    Manage Subscription
                </a>
            </div>
        </div>

        {{-- Mobile quotas --}}
        <div class="sm:hidden mt-3 flex items-center space-x-4 text-sm">
            <div class="flex items-center">
                <span class="text-gray-600 dark:text-gray-400 mr-1">Apps:</span>
                <livewire:idem.quota-badge type="apps" :compact="true" />
            </div>
            <div class="flex items-center">
                <span class="text-gray-600 dark:text-gray-400 mr-1">Servers:</span>
                <livewire:idem.quota-badge type="servers" :compact="true" />
            </div>
        </div>
    </div>
</div>
