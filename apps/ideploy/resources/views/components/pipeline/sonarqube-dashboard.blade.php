@props(['scanResult'])

@if($scanResult)
<div class="space-y-6">
    {{-- Quality Gate Status --}}
    <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">Quality Gate</h3>
            <a href="{{ $scanResult->sonar_dashboard_url }}" target="_blank" 
               class="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <span>View in SonarQube</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
            </a>
        </div>
        
        <div class="flex items-center gap-3">
            @if($scanResult->quality_gate_status === 'OK')
                <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div>
                    <div class="text-2xl font-bold text-green-400">PASSED</div>
                    <div class="text-sm text-gray-400">Quality gate passed successfully</div>
                </div>
            @elseif($scanResult->quality_gate_status === 'ERROR')
                <div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div>
                    <div class="text-2xl font-bold text-red-400">FAILED</div>
                    <div class="text-sm text-gray-400">Quality gate failed</div>
                </div>
            @else
                <div class="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <svg class="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <div>
                    <div class="text-2xl font-bold text-yellow-400">WARNING</div>
                    <div class="text-sm text-gray-400">Quality gate has warnings</div>
                </div>
            @endif
        </div>
    </div>

    {{-- Metrics Grid --}}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {{-- Bugs --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Bugs</span>
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <div class="text-3xl font-bold {{ $scanResult->bugs > 0 ? 'text-red-400' : 'text-green-400' }}">
                {{ $scanResult->bugs }}
            </div>
        </div>

        {{-- Vulnerabilities --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Vulnerabilities</span>
                <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
            <div class="text-3xl font-bold {{ $scanResult->vulnerabilities > 0 ? 'text-orange-400' : 'text-green-400' }}">
                {{ $scanResult->vulnerabilities }}
            </div>
        </div>

        {{-- Code Smells --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Code Smells</span>
                <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                </svg>
            </div>
            <div class="text-3xl font-bold text-purple-400">
                {{ $scanResult->code_smells }}
            </div>
        </div>

        {{-- Security Hotspots --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Security Hotspots</span>
                <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
            </div>
            <div class="text-3xl font-bold text-yellow-400">
                {{ $scanResult->security_hotspots }}
            </div>
        </div>
    </div>

    {{-- Coverage & Duplications --}}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {{-- Coverage --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
            <h4 class="text-sm font-semibold text-gray-400 mb-4">Code Coverage</h4>
            <div class="flex items-end gap-4">
                <div class="text-5xl font-bold text-blue-400">{{ number_format($scanResult->coverage, 1) }}%</div>
                <div class="mb-2">
                    @if($scanResult->coverage >= 80)
                        <span class="text-green-400 text-sm">Excellent</span>
                    @elseif($scanResult->coverage >= 60)
                        <span class="text-yellow-400 text-sm">Good</span>
                    @else
                        <span class="text-red-400 text-sm">Needs Improvement</span>
                    @endif
                </div>
            </div>
            <div class="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full transition-all duration-500" 
                     style="width: {{ $scanResult->coverage }}%"></div>
            </div>
        </div>

        {{-- Duplications --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
            <h4 class="text-sm font-semibold text-gray-400 mb-4">Code Duplications</h4>
            <div class="flex items-end gap-4">
                <div class="text-5xl font-bold text-purple-400">{{ number_format($scanResult->duplications, 1) }}%</div>
                <div class="mb-2">
                    @if($scanResult->duplications <= 3)
                        <span class="text-green-400 text-sm">Excellent</span>
                    @elseif($scanResult->duplications <= 5)
                        <span class="text-yellow-400 text-sm">Acceptable</span>
                    @else
                        <span class="text-red-400 text-sm">Too High</span>
                    @endif
                </div>
            </div>
            <div class="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-purple-500 rounded-full transition-all duration-500" 
                     style="width: {{ min($scanResult->duplications, 100) }}%"></div>
            </div>
        </div>
    </div>

    {{-- Issues Chart --}}
    <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
        <h4 class="text-sm font-semibold text-gray-400 mb-4">Issues Distribution</h4>
        <div class="flex items-center justify-center" style="height: 300px;">
            <canvas id="sonarIssuesChart"></canvas>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('sonarIssuesChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Bugs', 'Vulnerabilities', 'Code Smells', 'Security Hotspots'],
                datasets: [{
                    data: [
                        {{ $scanResult->bugs }},
                        {{ $scanResult->vulnerabilities }},
                        {{ $scanResult->code_smells }},
                        {{ $scanResult->security_hotspots }}
                    ],
                    backgroundColor: [
                        '#ef4444',  // Red
                        '#f59e0b',  // Orange
                        '#a855f7',  // Purple
                        '#eab308'   // Yellow
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        titleColor: '#fff',
                        bodyColor: '#9ca3af',
                        borderColor: '#374151',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true
                    }
                }
            }
        });
    }
});
</script>

@else
<div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-12 text-center">
    <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
    </svg>
    <p class="text-gray-400">No SonarQube results available</p>
    <p class="text-sm text-gray-500 mt-2">Run the pipeline to see code quality metrics</p>
</div>
@endif
