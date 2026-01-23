<x-layout>
    <x-slot:title>
        {{ __('Subscription Plans') }} | {{ config('app.name') }}
    </x-slot>
    
    <x-slot:content>
        <div class="flex h-full flex-col bg-[#0f1419] min-h-screen">
            <!-- Hero Section -->
            <div class="relative overflow-hidden bg-gradient-to-br from-[#0a0e1a] via-[#151b2e] to-[#0a0e1a] px-6 py-20 border-b border-gray-800/50">
                <!-- Decorative elements -->
                <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMzI4MzYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCA0IDEuNzkgNCA0IDQtMS43OSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
                
                <div class="max-w-7xl mx-auto text-center relative z-10">
                    <div class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
                        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                        </svg>
                        <span class="text-sm font-medium text-blue-400">Pricing Plans</span>
                    </div>
                    
                    <h1 class="text-5xl md:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        {{ __('Choose Your Plan') }}
                    </h1>
                    <p class="text-xl text-gray-400 max-w-2xl mx-auto">
                        {{ __('Scale your infrastructure as you grow. All plans include unlimited IDEM managed servers.') }}
                    </p>
                </div>
            </div>
            
            <!-- Plans Grid -->
            <div class="flex-1 px-6 py-12">
                <div class="max-w-7xl mx-auto">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                        @foreach($plans as $plan)
                            <div class="relative bg-gradient-to-br from-[#151b2e] to-[#0f1419] rounded-xl shadow-2xl p-8 border @if($plan->name === 'pro') border-blue-500/50 ring-2 ring-blue-500/20 @else border-gray-800/50 @endif hover:border-blue-500/50 hover:shadow-blue-500/10 transition-all duration-300 group">
                                @if($plan->name === 'pro')
                                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                                        {{ __('POPULAR') }}
                                    </div>
                                @endif
                                
                                <!-- Plan Name -->
                                <h3 class="text-2xl font-bold text-slate-100 mb-2 text-center">
                                    {{ $plan->display_name }}
                                </h3>
                                
                                <!-- Price -->
                                <div class="text-center mb-8">
                                    <span class="text-5xl font-bold text-blue-400">
                                        ${{ number_format($plan->price, 0) }}
                                    </span>
                                    <span class="text-slate-400 text-lg">/month</span>
                                </div>
                                
                                <!-- Features -->
                                <ul class="space-y-3 mb-8 text-slate-300">
                                    <li class="flex items-start">
                                        <svg class="w-5 h-5 mr-3 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
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
                                    
                                    <li class="flex items-start">
                                        <svg class="w-5 h-5 mr-3 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>
                                            @if($plan->server_limit === 999999)
                                                <strong class="text-white">Unlimited</strong> Personal Servers
                                            @elseif($plan->server_limit === 0)
                                                <span class="text-slate-400">No Personal Servers</span>
                                            @else
                                                <strong class="text-white">{{ $plan->server_limit }}</strong> Personal Servers
                                            @endif
                                        </span>
                                    </li>
                                    
                                    <li class="flex items-start">
                                        <svg class="w-5 h-5 mr-3 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                        <span><strong class="text-white">Unlimited</strong> IDEM Managed Servers</span>
                                    </li>
                                    
                                    <li class="flex items-start">
                                        <svg class="w-5 h-5 mr-3 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>Community Support</span>
                                    </li>
                                    
                                    @if($plan->name === 'enterprise')
                                        <li class="flex items-start">
                                            <svg class="w-5 h-5 mr-3 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                            </svg>
                                            <span><strong class="text-white">Priority Support</strong></span>
                                        </li>
                                        <li class="flex items-start">
                                            <svg class="w-5 h-5 mr-3 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                            </svg>
                                            <span><strong class="text-white">SLA Guarantee</strong></span>
                                        </li>
                                    @endif
                                </ul>
                                
                                <!-- CTA Button -->
                                <a href="{{ route('idem.subscription') }}" 
                                   class="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg">
                                    @if($plan->price == 0)
                                        {{ __('Current Plan') }}
                                    @else
                                        {{ __('Choose ') }}{{ $plan->display_name }}
                                    @endif
                                </a>
                            </div>
                        @endforeach
                    </div>
                    
                    <!-- FAQ Section -->
                    <div class="mt-16 max-w-3xl mx-auto">
                        <h2 class="text-3xl font-bold text-slate-100 text-center mb-8">
                            {{ __('Frequently Asked Questions') }}
                        </h2>
                        
                        <div class="space-y-4">
                            <details class="bg-slate-800 rounded-lg p-6 border border-slate-700">
                                <summary class="font-semibold text-slate-100 cursor-pointer text-lg">
                                    {{ __('Can I change my plan at any time?') }}
                                </summary>
                                <p class="mt-3 text-slate-300 leading-relaxed">
                                    {{ __('Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately. Downgrades are validated to ensure you\'re within the new plan limits.') }}
                                </p>
                            </details>
                            
                            <details class="bg-slate-800 rounded-lg p-6 border border-slate-700">
                                <summary class="font-semibold text-slate-100 cursor-pointer text-lg">
                                    {{ __('What happens if I exceed my quotas?') }}
                                </summary>
                                <p class="mt-3 text-slate-300 leading-relaxed">
                                    {{ __('You\'ll receive an email notification when you reach 80% of your limits. At 100%, new deployments will be blocked until you upgrade your plan or remove resources.') }}
                                </p>
                            </details>
                            
                            <details class="bg-slate-800 rounded-lg p-6 border border-slate-700">
                                <summary class="font-semibold text-slate-100 cursor-pointer text-lg">
                                    {{ __('What are IDEM Managed Servers?') }}
                                </summary>
                                <p class="mt-3 text-slate-300 leading-relaxed">
                                    {{ __('IDEM Managed Servers are infrastructure provided and maintained by us. You can deploy unlimited applications to these servers with any plan. Personal servers are your own infrastructure that you can connect to IDEM SaaS.') }}
                                </p>
                            </details>
                            
                            <details class="bg-slate-800 rounded-lg p-6 border border-slate-700">
                                <summary class="font-semibold text-slate-100 cursor-pointer text-lg">
                                    {{ __('Do you offer refunds?') }}
                                </summary>
                                <p class="mt-3 text-slate-300 leading-relaxed">
                                    {{ __('We offer a 14-day money-back guarantee on all paid plans. Contact our support team for refund requests.') }}
                                </p>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </x-slot>
</x-layout>
