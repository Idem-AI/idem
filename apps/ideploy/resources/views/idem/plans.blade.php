<x-layout>
    <x-slot:title>
        {{ __('Subscription Plans') }} | {{ config('app.name') }}
    </x-slot>
    
    <x-slot:content>
        <div class="flex h-full flex-col bg-[#0a0e1a] min-h-screen">
            <!-- Hero Section -->
            <div class="relative overflow-hidden px-6 py-16 border-b border-gray-800/30">
                <div class="max-w-6xl mx-auto text-center">
                    <div class="inline-flex items-center gap-2 px-3 py-1 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-full mb-6">
                        <div class="w-2 h-2 bg-[#4F46E5] rounded-full"></div>
                        <span class="text-xs font-medium text-[#4F46E5] uppercase tracking-wider">Pricing Plans</span>
                    </div>
                    
                    <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">
                        Choose Your <span class="text-[#4F46E5]">Plan</span>
                    </h1>
                    <p class="text-base text-gray-400 max-w-2xl mx-auto">
                        {{ __('Scale your infrastructure as you grow. All plans include unlimited IDEM managed servers.') }}
                    </p>
                </div>
            </div>
            
            <!-- Plans Grid -->
            <div class="flex-1 px-6 py-12">
                <div class="max-w-6xl mx-auto">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        @foreach($plans as $plan)
                            <div class="relative bg-[#0f1419] rounded-xl p-6 border @if($plan->name === 'pro') border-[#4F46E5] @else border-gray-800/50 @endif hover:border-[#4F46E5]/50 transition-all duration-200">
                                @if($plan->name === 'pro')
                                    <div class="absolute -top-2 right-4 bg-[#4F46E5] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                                        {{ __('POPULAR') }}
                                    </div>
                                @endif
                                
                                <!-- Plan Name -->
                                <h3 class="text-xl font-bold text-white mb-1">
                                    {{ $plan->display_name }}
                                </h3>
                                
                                <!-- Price -->
                                <div class="mb-6">
                                    <span class="text-4xl font-bold text-white">
                                        ${{ number_format($plan->price, 0) }}
                                    </span>
                                    <span class="text-gray-500 text-sm">/month</span>
                                </div>
                                
                                <!-- Features -->
                                <ul class="space-y-2.5 mb-6 text-sm text-gray-300">
                                    <li class="flex items-start gap-2">
                                        <svg class="w-4 h-4 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>
                                            @if($plan->app_limit === 999999)
                                                <strong class="text-white">Unlimited</strong> Applications
                                            @else
                                                <strong class="text-white">{{ $plan->app_limit }}</strong> Applications
                                            @endif
                                        </span>
                                    </li>
                                    
                                    <li class="flex items-start gap-2">
                                        <svg class="w-4 h-4 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>
                                            @if($plan->server_limit === 999999)
                                                <strong class="text-white">Unlimited</strong> Servers
                                            @elseif($plan->server_limit === 0)
                                                <span class="text-gray-500">No Personal Servers</span>
                                            @else
                                                <strong class="text-white">{{ $plan->server_limit }}</strong> Servers
                                            @endif
                                        </span>
                                    </li>
                                    
                                    <li class="flex items-start gap-2">
                                        <svg class="w-4 h-4 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>Unlimited IDEM Servers</span>
                                    </li>
                                    
                                    <li class="flex items-start gap-2">
                                        <svg class="w-4 h-4 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>Community Support</span>
                                    </li>
                                    
                                    @if($plan->name === 'enterprise')
                                        <li class="flex items-start gap-2">
                                            <svg class="w-4 h-4 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                            </svg>
                                            <span><strong class="text-white">Priority Support</strong></span>
                                        </li>
                                        <li class="flex items-start gap-2">
                                            <svg class="w-4 h-4 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                            </svg>
                                            <span><strong class="text-white">SLA Guarantee</strong></span>
                                        </li>
                                    @endif
                                </ul>
                                
                                <!-- CTA Button -->
                                <a href="{{ route('idem.subscription') }}" 
                                   class="block w-full text-center @if($plan->name === 'pro') bg-[#4F46E5] hover:bg-[#4338CA] @else bg-gray-800 hover:bg-gray-700 @endif text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm">
                                    @if($plan->price == 0)
                                        {{ __('Get Started') }}
                                    @else
                                        {{ __('Choose Plan') }}
                                    @endif
                                </a>
                            </div>
                        @endforeach
                    </div>
                    
                    <!-- FAQ Section -->
                    <div class="mt-16 max-w-4xl mx-auto">
                        <h2 class="text-2xl font-bold text-white text-center mb-8">
                            {{ __('Frequently Asked Questions') }}
                        </h2>
                        
                        <div class="space-y-4">
                            <div class="bg-[#0f1419] border border-gray-800/50 rounded-lg p-5">
                                <h3 class="text-base font-semibold text-white mb-2">
                                    {{ __('What are IDEM Managed Servers?') }}
                                </h3>
                                <p class="text-sm text-gray-400">
                                    {{ __('IDEM Managed Servers are high-performance servers managed by our infrastructure team. You can deploy unlimited applications on these servers without worrying about server management.') }}
                                </p>
                            </div>
                            
                            <div class="bg-[#0f1419] border border-gray-800/50 rounded-lg p-5">
                                <h3 class="text-base font-semibold text-white mb-2">
                                    {{ __('Can I upgrade or downgrade my plan?') }}
                                </h3>
                                <p class="text-sm text-gray-400">
                                    {{ __('Yes, you can change your plan at any time. Upgrades take effect immediately, while downgrades will be applied at the end of your current billing cycle.') }}
                                </p>
                            </div>
                            
                            <div class="bg-[#0f1419] border border-gray-800/50 rounded-lg p-5">
                                <h3 class="text-base font-semibold text-white mb-2">
                                    {{ __('What happens if I exceed my limits?') }}
                                </h3>
                                <p class="text-sm text-gray-400">
                                    {{ __('If you reach your application or server limit, you\'ll need to upgrade to a higher plan to add more resources. We\'ll notify you when you\'re approaching your limits.') }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </x-slot>
</x-layout>
