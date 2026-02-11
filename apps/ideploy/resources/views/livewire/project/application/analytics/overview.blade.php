<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Analytics | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    {{-- Header --}}
    <div class="mb-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-semibold text-white">Analytics</h1>
                <p class="text-sm text-gray-500 mt-1">Monitor your application traffic and performance</p>
            </div>
            
            <div class="flex gap-2">
                <button wire:click="setPeriod('24h')" class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {{ $period === '24h' ? 'bg-white text-black' : 'bg-[#0a0a0a] border border-gray-800 text-gray-400 hover:text-white' }}">
                    24 Hours
                </button>
                <button wire:click="setPeriod('7d')" class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {{ $period === '7d' ? 'bg-white text-black' : 'bg-[#0a0a0a] border border-gray-800 text-gray-400 hover:text-white' }}">
                    7 Days
                </button>
                <button wire:click="setPeriod('30d')" class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {{ $period === '30d' ? 'bg-white text-black' : 'bg-[#0a0a0a] border border-gray-800 text-gray-400 hover:text-white' }}">
                    30 Days
                </button>
            </div>
        </div>
    </div>

    {{-- Stats Cards --}}
    <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="text-2xl font-bold text-white">{{ number_format($overview['page_views'] ?? 0) }}</p>
                    <p class="text-xs text-gray-500">Page Views</p>
                </div>
            </div>
        </div>

        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="text-2xl font-bold text-white">{{ number_format($overview['visitors'] ?? 0) }}</p>
                    <p class="text-xs text-gray-500">Unique Visitors</p>
                </div>
            </div>
        </div>

        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="text-2xl font-bold text-white">{{ $overview['avg_session'] ?? '0m' }}</p>
                    <p class="text-xs text-gray-500">Avg. Session</p>
                </div>
            </div>
        </div>

        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="text-2xl font-bold text-white">{{ $overview['bounce_rate'] ?? 0 }}%</p>
                    <p class="text-xs text-gray-500">Bounce Rate</p>
                </div>
            </div>
        </div>
    </div>

    {{-- Traffic Chart --}}
    <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6 mb-6">
        <h2 class="text-lg font-semibold text-white mb-4">Traffic Over Time</h2>
        <div class="h-64" wire:ignore>
            <canvas id="trafficChart" data-hourly="{{ json_encode($hourlyTraffic) }}"></canvas>
        </div>
    </div>

    <div class="grid grid-cols-2 gap-6">
        {{-- Top Pages --}}
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
            <h3 class="text-sm font-semibold text-white mb-4">Top Pages</h3>
            
            @if(count($topPages) === 0)
                <div class="text-center py-8">
                    <p class="text-sm text-gray-500">No data available</p>
                </div>
            @else
                <div class="space-y-3">
                    @foreach($topPages as $page)
                        <div class="flex items-center justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm text-white font-medium truncate">{{ $page['path'] }}</p>
                            </div>
                            <div class="flex items-center gap-3 ml-4">
                                <span class="text-sm text-gray-400">{{ number_format($page['views']) }} views</span>
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif
        </div>

        {{-- Top Countries --}}
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
            <h3 class="text-sm font-semibold text-white mb-4">Top Countries</h3>
            
            @if(count($topCountries) === 0)
                <div class="text-center py-8">
                    <p class="text-sm text-gray-500">No data available</p>
                </div>
            @else
                <div class="space-y-3">
                    @foreach($topCountries as $country)
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2 flex-1">
                                <span class="text-2xl">{{ $country['flag'] }}</span>
                                <p class="text-sm text-white font-medium">{{ $country['name'] }}</p>
                            </div>
                            <span class="text-sm text-gray-400">{{ number_format($country['visits']) }} visits</span>
                        </div>
                    @endforeach
                </div>
            @endif
        </div>
    </div>

    @push('scripts')
    <script>
        document.addEventListener('livewire:init', function() {
            const canvas = document.getElementById('trafficChart');
            if (!canvas) return;
            
            const hourlyData = JSON.parse(canvas.dataset.hourly || '{}');
            const labels = [];
            const data = [];
            
            for (let key in hourlyData) {
                labels.push(key);
                data.push(hourlyData[key]);
            }
            
            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Visitors',
                        data: data,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.5)'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.5)'
                            }
                        }
                    }
                }
            });
        });
    </script>
    @endpush
</div>
