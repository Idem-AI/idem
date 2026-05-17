<div>
    @if($canProceed === false)
        {{-- === FULL UPGRADE PAGE === --}}
        <div class="min-h-[60vh] flex flex-col items-center justify-center py-12 px-4">

            {{-- Icon + Status --}}
            <div class="flex flex-col items-center mb-10 text-center">
                <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/30 flex items-center justify-center mb-5 shadow-lg shadow-red-500/10">
                    <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                </div>
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
                    <div class="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
                    <span class="text-xs font-semibold text-red-400 uppercase tracking-widest">Limit Reached</span>
                </div>
                <h2 class="text-3xl font-bold text-white mb-3">
                    @if($quotaType === 'app')
                        You've used all your apps
                    @else
                        You've used all your servers
                    @endif
                </h2>
                <p class="text-base text-gray-400 max-w-md">
                    @if($quotaType === 'app')
                        You've deployed <strong class="text-white">{{ $currentUsage }}</strong> of your <strong class="text-white">{{ $limit }}</strong> available applications. Upgrade to unlock more.
                    @else
                        You've added <strong class="text-white">{{ $currentUsage }}</strong> of your <strong class="text-white">{{ $limit }}</strong> available servers. Upgrade to unlock more.
                    @endif
                </p>
            </div>

            {{-- Plans Cards --}}
            <div class="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                @php
                    $upgradePlans = [
                        ['name' => 'Basic', 'price' => '19', 'apps' => '10', 'servers' => '2', 'highlight' => false, 'color' => 'blue'],
                        ['name' => 'Pro', 'price' => '49', 'apps' => '50', 'servers' => '10', 'highlight' => true, 'color' => 'purple'],
                        ['name' => 'Enterprise', 'price' => '199', 'apps' => '∞', 'servers' => '∞', 'highlight' => false, 'color' => 'amber'],
                    ];
                @endphp
                @foreach($upgradePlans as $upgradePlan)
                    <div class="relative rounded-xl p-5 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg
                        @if($upgradePlan['highlight'])
                            bg-gradient-to-b from-primary/10 to-transparent border-primary/50 shadow-primary/10 shadow-lg
                        @else
                            bg-[#0f1419] border-gray-800/60 hover:border-gray-700
                        @endif">

                        @if($upgradePlan['highlight'])
                            <div class="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                                Most Popular
                            </div>
                        @endif

                        <div class="mb-4">
                            <h3 class="text-base font-bold text-white mb-1">{{ $upgradePlan['name'] }}</h3>
                            <div class="flex items-baseline gap-1">
                                <span class="text-3xl font-bold text-white">${{ $upgradePlan['price'] }}</span>
                                <span class="text-xs text-gray-500">/month</span>
                            </div>
                        </div>

                        <ul class="space-y-2 mb-5 text-sm text-gray-400">
                            <li class="flex items-center gap-2">
                                <svg class="w-3.5 h-3.5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                <span><strong class="text-white">{{ $upgradePlan['apps'] }}</strong> Applications</span>
                            </li>
                            <li class="flex items-center gap-2">
                                <svg class="w-3.5 h-3.5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                <span><strong class="text-white">{{ $upgradePlan['servers'] }}</strong> Servers</span>
                            </li>
                            <li class="flex items-center gap-2">
                                <svg class="w-3.5 h-3.5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                <span>Unlimited IDEM Servers</span>
                            </li>
                        </ul>

                        <a href="{{ route('idem.plans') }}"
                           class="block w-full text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200
                            @if($upgradePlan['highlight'])
                                inner-button text-white
                            @else
                                bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700/50
                            @endif">
                            Choose {{ $upgradePlan['name'] }}
                        </a>
                    </div>
                @endforeach
            </div>

            {{-- Bottom links --}}
            <div class="flex flex-col sm:flex-row items-center gap-4 text-sm">
                <a href="{{ route('idem.subscription') }}"
                   class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                    View subscription details
                </a>
                <span class="text-gray-700 hidden sm:block">•</span>
                <a href="{{ route('idem.plans') }}"
                   class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                    Compare all plans
                </a>
            </div>
        </div>

        {{-- Disable form elements --}}
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                const submitButtons = document.querySelectorAll('button[type="submit"], button[wire\\:click*="save"], button[wire\\:click*="store"], button[wire\\:click*="create"]');
                submitButtons.forEach(btn => {
                    btn.disabled = true;
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                    btn.title = '{{ $message }}';
                });
                const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
                inputs.forEach(input => {
                    input.disabled = true;
                    input.classList.add('opacity-50');
                });
            });
        </script>

    @elseif($canProceed === true)
        {{-- Subtle available indicator --}}
        <div class="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg mb-4">
            <div class="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0"></div>
            <p class="text-emerald-300 text-xs font-medium">
                @if($quotaType === 'app')
                    {{ $currentUsage }}/{{ $limit }} applications used — ready to deploy
                @else
                    {{ $currentUsage }}/{{ $limit }} servers used — ready to add
                @endif
            </p>
        </div>
    @endif
</div>
