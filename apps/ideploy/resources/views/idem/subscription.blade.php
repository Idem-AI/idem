<x-layout>
    <x-slot:title>
        {{ __('My Subscription') }} | {{ config('app.name') }}
    </x-slot>
    
    <x-slot:content>
        <div class="flex h-full flex-col bg-slate-900">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-900 to-blue-700 border-b border-blue-600 px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <svg class="w-8 h-8 mr-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                        </svg>
                        <h1 class="text-2xl font-bold text-white">
                            {{ __('Subscription & Quotas') }}
                        </h1>
                    </div>
                    <a href="{{ route('idem.plans') }}" 
                       class="inline-flex items-center px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold rounded-lg transition-colors">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                        </svg>
                        {{ __('View All Plans') }}
                    </a>
                </div>
            </div>
            
            <!-- Content -->
            <div class="flex-1 p-6">
                <div class="max-w-7xl mx-auto">
                    @livewire('idem.subscription-dashboard')
                </div>
            </div>
        </div>
    </x-slot>
</x-layout>
