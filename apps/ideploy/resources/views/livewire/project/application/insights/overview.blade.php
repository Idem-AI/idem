<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Insights | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-white">Insights</h1>
            <p class="text-sm text-gray-400 mt-1">Performance metrics and intelligent recommendations</p>
        </div>
    </div>
    
    {{-- Performance Metrics --}}
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-[#151b2e] border border-gray-700 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-gray-400">Response Time</span>
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
            </div>
            <p class="text-3xl font-bold text-white">124ms</p>
            <p class="text-xs text-green-400 mt-1">-15ms from yesterday</p>
        </div>
        
        <div class="bg-[#151b2e] border border-gray-700 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-gray-400">Error Rate</span>
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            </div>
            <p class="text-3xl font-bold text-white">0.2%</p>
            <p class="text-xs text-green-400 mt-1">All good</p>
        </div>
        
        <div class="bg-[#151b2e] border border-gray-700 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-gray-400">CPU Usage</span>
                <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
                </svg>
            </div>
            <p class="text-3xl font-bold text-white">34%</p>
            <p class="text-xs text-gray-400 mt-1">Normal</p>
        </div>
        
        <div class="bg-[#151b2e] border border-gray-700 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-gray-400">Memory</span>
                <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
            </div>
            <p class="text-3xl font-bold text-white">512MB</p>
            <p class="text-xs text-gray-400 mt-1">of 1GB</p>
        </div>
    </div>
    
    {{-- AI Recommendations --}}
    <div class="bg-[#151b2e] border border-gray-700 rounded-xl p-6 mb-6">
        <h3 class="text-lg font-semibold text-white mb-4">💡 AI Recommendations</h3>
        
        <div class="space-y-3">
            <div class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-sm font-semibold text-white mb-1">Optimize Response Time</h4>
                        <p class="text-xs text-gray-400">
                            Your /api/users endpoint has increased response time. Consider adding database indexes or implementing caching.
                        </p>
                        <button class="mt-2 text-xs text-blue-400 hover:text-blue-300">Learn more →</button>
                    </div>
                </div>
            </div>
            
            <div class="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-sm font-semibold text-white mb-1">Performance Excellent</h4>
                        <p class="text-xs text-gray-400">
                            Your application is performing well. No immediate action required.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    {{-- Charts Grid --}}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-[#151b2e] border border-gray-700 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Response Time Trend</h3>
            <div class="flex items-center justify-center h-48 bg-[#0f1724] rounded-lg">
                <p class="text-gray-500 text-sm">Chart coming soon</p>
            </div>
        </div>
        
        <div class="bg-[#151b2e] border border-gray-700 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Resource Usage</h3>
            <div class="flex items-center justify-center h-48 bg-[#0f1724] rounded-lg">
                <p class="text-gray-500 text-sm">Chart coming soon</p>
            </div>
        </div>
    </div>
</div>
