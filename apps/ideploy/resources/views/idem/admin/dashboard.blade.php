<x-layout>
    <x-slot:title>
        {{ __('IDEM Admin Dashboard') }} | {{ config('app.name') }}
    </x-slot>
    
    <x-slot:content>
        <div class="flex h-full flex-col bg-slate-900">
            <!-- Admin Header with Warning Banner -->
            <div class="bg-gradient-to-r from-red-900 to-red-700 px-6 py-4 border-b border-red-600">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <svg class="w-8 h-8 mr-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                        <div>
                            <h1 class="text-2xl font-bold text-white">
                                {{ __('IDEM Admin Dashboard') }}
                            </h1>
                            <p class="text-red-200 text-sm">
                                {{ __('Admin access - Full platform control') }}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <span class="bg-red-800 text-white text-xs font-bold px-3 py-1 rounded-full">
                            ADMIN MODE
                        </span>
                        <a href="{{ route('dashboard') }}" 
                           class="text-white hover:text-red-200 transition-colors text-sm">
                            {{ __('← Back to Dashboard') }}
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Content -->
            <div class="flex-1 p-6">
                <div class="max-w-7xl mx-auto">
                    @livewire('idem.admin-dashboard')
                </div>
            </div>
        </div>
    </x-slot>
</x-layout>
