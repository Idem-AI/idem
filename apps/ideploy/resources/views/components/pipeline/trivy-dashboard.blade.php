@props(['scanResult'])

@if($scanResult)
<div class="space-y-6">
    {{-- Summary Cards --}}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {{-- Critical --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Critical</span>
                <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
            <div class="text-3xl font-bold {{ $scanResult->critical_count > 0 ? 'text-red-500' : 'text-green-400' }}">
                {{ $scanResult->critical_count }}
            </div>
            @if($scanResult->critical_count > 0)
                <div class="mt-2 text-xs text-red-400">Requires immediate action</div>
            @endif
        </div>

        {{-- High --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">High</span>
                <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
            <div class="text-3xl font-bold {{ $scanResult->high_count > 0 ? 'text-orange-500' : 'text-green-400' }}">
                {{ $scanResult->high_count }}
            </div>
            @if($scanResult->high_count > 0)
                <div class="mt-2 text-xs text-orange-400">Should be fixed soon</div>
            @endif
        </div>

        {{-- Medium --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Medium</span>
                <svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <div class="text-3xl font-bold text-yellow-500">
                {{ $scanResult->medium_count }}
            </div>
        </div>

        {{-- Low --}}
        <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Low</span>
                <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <div class="text-3xl font-bold text-blue-500">
                {{ $scanResult->low_count }}
            </div>
        </div>
    </div>

    {{-- Overall Status --}}
    <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
        <div class="flex items-center justify-between">
            <div>
                <h3 class="text-lg font-semibold mb-2">Security Status</h3>
                @if($scanResult->critical_count === 0 && $scanResult->high_count === 0)
                    <div class="flex items-center gap-2 text-green-400">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="font-semibold">PASSED</span>
                    </div>
                    <p class="text-sm text-gray-400 mt-1">No critical or high vulnerabilities found</p>
                @else
                    <div class="flex items-center gap-2 text-red-400">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="font-semibold">FAILED</span>
                    </div>
                    <p class="text-sm text-gray-400 mt-1">
                        Found {{ $scanResult->critical_count }} critical and {{ $scanResult->high_count }} high severity vulnerabilities
                    </p>
                @endif
            </div>
            <div class="text-right">
                <div class="text-3xl font-bold text-gray-300">{{ $scanResult->total_vulnerabilities }}</div>
                <div class="text-sm text-gray-400">Total Issues</div>
            </div>
        </div>
    </div>

    {{-- Severity Chart --}}
    <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
        <h4 class="text-sm font-semibold text-gray-400 mb-4">Vulnerabilities by Severity</h4>
        <div class="flex items-center justify-center" style="height: 300px;">
            <canvas id="trivySeverityChart"></canvas>
        </div>
    </div>

    {{-- Secrets Found --}}
    @if($scanResult->secrets_found && count($scanResult->secrets_found) > 0)
    <div class="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
        <div class="flex items-start gap-3">
            <svg class="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <div class="flex-1">
                <h4 class="text-lg font-semibold text-red-400 mb-2">⚠️ Secrets Detected!</h4>
                <p class="text-sm text-gray-300 mb-4">
                    Trivy found {{ count($scanResult->secrets_found) }} potential secret(s) in your code. 
                    These should be removed immediately and rotated.
                </p>
                <div class="space-y-2">
                    @foreach(array_slice($scanResult->secrets_found, 0, 5) as $secret)
                    <div class="bg-[#0f0f0f] border border-red-500/30 rounded p-3">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm font-medium text-red-300">{{ $secret['title'] ?? $secret['rule_id'] }}</span>
                            <span class="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded">{{ $secret['severity'] }}</span>
                        </div>
                        <div class="text-xs text-gray-400">
                            {{ $secret['file'] }}:{{ $secret['line'] }}
                        </div>
                    </div>
                    @endforeach
                    @if(count($scanResult->secrets_found) > 5)
                    <div class="text-sm text-gray-400 text-center pt-2">
                        + {{ count($scanResult->secrets_found) - 5 }} more secret(s)
                    </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
    @endif

    {{-- Vulnerabilities Table --}}
    @if($scanResult->vulnerabilities_detail && count($scanResult->vulnerabilities_detail) > 0)
    <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-800">
            <h4 class="font-semibold">Vulnerability Details</h4>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-800/30">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">CVE ID</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Package</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Severity</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Installed</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fixed In</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Title</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-800">
                    @foreach(array_slice($scanResult->vulnerabilities_detail, 0, 20) as $vuln)
                    <tr class="hover:bg-gray-800/20">
                        <td class="px-6 py-4 text-sm font-mono text-blue-400">
                            {{ $vuln['id'] }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-300">
                            {{ $vuln['package'] }}
                        </td>
                        <td class="px-6 py-4 text-sm">
                            @php
                                $severityColors = [
                                    'CRITICAL' => 'bg-red-500/20 text-red-400 border-red-500/50',
                                    'HIGH' => 'bg-orange-500/20 text-orange-400 border-orange-500/50',
                                    'MEDIUM' => 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
                                    'LOW' => 'bg-blue-500/20 text-blue-400 border-blue-500/50',
                                ];
                                $color = $severityColors[$vuln['severity']] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/50';
                            @endphp
                            <span class="px-2 py-1 text-xs font-medium border rounded {{ $color }}">
                                {{ $vuln['severity'] }}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-sm font-mono text-gray-400">
                            {{ $vuln['installed_version'] }}
                        </td>
                        <td class="px-6 py-4 text-sm font-mono">
                            @if($vuln['fixed_version'] !== 'Not Fixed')
                                <span class="text-green-400">{{ $vuln['fixed_version'] }}</span>
                            @else
                                <span class="text-gray-500">{{ $vuln['fixed_version'] }}</span>
                            @endif
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-300 max-w-md truncate">
                            {{ $vuln['title'] }}
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        @if(count($scanResult->vulnerabilities_detail) > 20)
        <div class="px-6 py-4 border-t border-gray-800 text-center text-sm text-gray-400">
            Showing 20 of {{ count($scanResult->vulnerabilities_detail) }} vulnerabilities
        </div>
        @endif
    </div>
    @endif
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('trivySeverityChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    data: [
                        {{ $scanResult->critical_count }},
                        {{ $scanResult->high_count }},
                        {{ $scanResult->medium_count }},
                        {{ $scanResult->low_count }}
                    ],
                    backgroundColor: [
                        '#ef4444',  // Red
                        '#f97316',  // Orange
                        '#eab308',  // Yellow
                        '#3b82f6'   // Blue
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
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += context.parsed + ' vulnerabilities';
                                return label;
                            }
                        }
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
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
    </svg>
    <p class="text-gray-400">No Trivy scan results available</p>
    <p class="text-sm text-gray-500 mt-2">Run the pipeline to see security vulnerabilities</p>
</div>
@endif
