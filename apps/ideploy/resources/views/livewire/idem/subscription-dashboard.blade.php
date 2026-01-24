<div>
    <!-- Current Plan Card -->
    <div class="bg-slate-800 rounded-lg shadow-xl p-6 mb-6 border border-slate-700">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold text-slate-100">{{ __('Current Plan') }}</h2>
            @if($subscription && isset($subscription['plan']))
                <span class="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">
                    {{ $subscription['plan']['display_name'] ?? 'Unknown' }}
                </span>
            @endif
        </div>
        
        @if($subscription && isset($subscription['plan']))
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300">
                <div>
                    <p class="text-sm text-slate-400">{{ __('Price') }}</p>
                    <p class="text-xl font-bold text-white">
                        ${{ number_format($subscription['plan']['price'] ?? 0, 2) }}<span class="text-sm text-slate-400">/month</span>
                    </p>
                </div>
                <div>
                    <p class="text-sm text-slate-400">{{ __('Applications Limit') }}</p>
                    <p class="text-xl font-bold text-white">
                        @php
                            $appLimit = $subscription['plan']['app_limit'] ?? $subscription['app_limit'] ?? 0;
                        @endphp
                        {{ $appLimit == 999999 ? 'Unlimited' : $appLimit }}
                    </p>
                </div>
                <div>
                    <p class="text-sm text-slate-400">{{ __('Servers Limit') }}</p>
                    <p class="text-xl font-bold text-white">
                        @php
                            $serverLimit = $subscription['plan']['server_limit'] ?? $subscription['server_limit'] ?? 0;
                        @endphp
                        {{ $serverLimit == 999999 ? 'Unlimited' : $serverLimit }}
                    </p>
                </div>
            </div>
        @else
            <p class="text-slate-400">{{ __('No active subscription') }}</p>
        @endif
    </div>

    <!-- Quota Usage -->
    @if($quotas && isset($quotas['usage']))
        <div class="bg-slate-800 rounded-lg shadow-xl p-6 mb-6 border border-slate-700">
            <h2 class="text-2xl font-bold text-slate-100 mb-6">{{ __('Quota Usage') }}</h2>
            
            <!-- Applications Usage -->
            <div class="mb-6">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-slate-300 font-semibold">{{ __('Applications') }}</span>
                    <span class="text-slate-100 font-bold">
                        {{ $quotas['usage']['apps']['current'] ?? 0 }} / {{ $quotas['usage']['apps']['limit'] ?? 0 }}
                    </span>
                </div>
                <div class="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                    @php
                        $appPercent = isset($quotas['usage']['apps']) ? $quotas['usage']['apps']['percentage'] : 0;
                        $appColor = $appPercent >= 100 ? 'bg-red-500' : ($appPercent >= 80 ? 'bg-yellow-500' : 'bg-green-500');
                    @endphp
                    <div class="{{ $appColor }} h-full transition-all duration-500" 
                         style="width: {{ min($appPercent, 100) }}%"></div>
                </div>
                @if($appPercent >= 100)
                    <p class="text-red-400 text-sm mt-2">
                        ⚠️ {{ __('Application limit reached. Upgrade to deploy more apps.') }}
                    </p>
                @elseif($appPercent >= 80)
                    <p class="text-yellow-400 text-sm mt-2">
                        ⚠️ {{ __('You are approaching your application limit.') }}
                    </p>
                @endif
            </div>

            <!-- Servers Usage -->
            <div>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-slate-300 font-semibold">{{ __('Personal Servers') }}</span>
                    <span class="text-slate-100 font-bold">
                        {{ $quotas['usage']['servers']['current'] ?? 0 }} / {{ $quotas['usage']['servers']['limit'] ?? 0 }}
                    </span>
                </div>
                <div class="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                    @php
                        $serverPercent = isset($quotas['usage']['servers']) ? $quotas['usage']['servers']['percentage'] : 0;
                        $serverColor = $serverPercent >= 100 ? 'bg-red-500' : ($serverPercent >= 80 ? 'bg-yellow-500' : 'bg-green-500');
                    @endphp
                    <div class="{{ $serverColor }} h-full transition-all duration-500" 
                         style="width: {{ min($serverPercent, 100) }}%"></div>
                </div>
                @if($quotas['usage']['servers']['limit'] == 0)
                    <p class="text-slate-400 text-sm mt-2">
                        ℹ️ {{ __('Your plan does not include personal servers.') }}
                    </p>
                @elseif($serverPercent >= 100)
                    <p class="text-red-400 text-sm mt-2">
                        ⚠️ {{ __('Server limit reached. Upgrade to add more servers.') }}
                    </p>
                @elseif($serverPercent >= 80)
                    <p class="text-yellow-400 text-sm mt-2">
                        ⚠️ {{ __('You are approaching your server limit.') }}
                    </p>
                @endif
            </div>
        </div>
    @endif

    <!-- Available Plans -->
    @if($availablePlans && count($availablePlans) > 0)
        <div class="bg-slate-800 rounded-lg shadow-xl p-6 border border-slate-700">
            <h2 class="text-2xl font-bold text-slate-100 mb-6">{{ __('Available Plans') }}</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                @foreach($availablePlans as $plan)
                    <div class="bg-slate-700 rounded-lg p-4 border-2 {{ $subscription && $subscription['plan']['name'] == $plan['name'] ? 'border-blue-500' : 'border-slate-600' }}">
                        <h3 class="text-lg font-bold text-white mb-2">{{ $plan['display_name'] }}</h3>
                        <p class="text-2xl font-bold text-blue-400 mb-3">
                            ${{ number_format($plan['price'], 0) }}<span class="text-sm text-slate-400">/mo</span>
                        </p>
                        <ul class="text-sm text-slate-300 space-y-1 mb-4">
                            <li>{{ $plan['app_limit'] == 999999 ? '∞' : $plan['app_limit'] }} Apps</li>
                            <li>{{ $plan['server_limit'] == 999999 ? '∞' : $plan['server_limit'] }} Servers</li>
                        </ul>
                        
                        @if($subscription && $subscription['plan']['name'] == $plan['name'])
                            <button disabled class="w-full bg-slate-600 text-slate-400 py-2 rounded cursor-not-allowed">
                                {{ __('Current Plan') }}
                            </button>
                        @else
                            <button wire:click="selectPlan('{{ $plan['name'] }}')" 
                                    wire:loading.attr="disabled"
                                    class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors">
                                <span wire:loading.remove wire:target="selectPlan">{{ __('Upgrade') }}</span>
                                <span wire:loading wire:target="selectPlan">{{ __('Loading...') }}</span>
                            </button>
                        @endif
                    </div>
                @endforeach
            </div>
        </div>
    @endif

    <!-- Loading State -->
    <div wire:loading class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-lg p-6">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p class="text-white mt-4">{{ __('Processing...') }}</p>
        </div>
    </div>
</div>

@script
<script>
    $wire.on('redirect-to-stripe', (event) => {
        window.location.href = event.url;
    });
</script>
@endscript
