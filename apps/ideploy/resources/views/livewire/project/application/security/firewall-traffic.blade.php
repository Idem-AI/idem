<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Events | iDeploy
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

    {{-- Sub-Navigation Tabs --}}
    <div class="mb-6 border-b border-gray-800">
        <nav class="flex gap-1">
            <a href="{{ route('project.application.security.overview', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white">
                Overview
            </a>
            <a href="{{ route('project.application.security.traffic', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-white border-b-2 border-blue-500 -mb-px">
                Events
            </a>
            <a href="{{ route('project.application.security.rules', $parameters) }}"
               class="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white">
                Rules
            </a>
        </nav>
    </div>

    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-white">Firewall Events</h1>
            <p class="text-sm text-gray-400 mt-1">Real-time security events and blocked requests</p>
        </div>
    </div>
    
    {{-- Events Table --}}
    <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg overflow-hidden">
        <table class="w-full">
            <thead class="bg-[#0f1724] border-b border-gray-800">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Events</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Hostname</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP Address</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Start</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
                @forelse($logs as $log)
                    <tr class="hover:bg-[#151b2e] transition-colors">
                        <td class="px-4 py-3 text-sm text-white">{{ $log->event_type ?? $log->reason ?? 'GET /' }}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 rounded text-xs font-medium
                                @if($log->decision === 'block' || $log->action === 'denied') bg-red-900/30 text-red-400
                                @elseif($log->action === 'challenged') bg-yellow-900/30 text-yellow-400
                                @else bg-green-900/30 text-green-400 @endif">
                                {{ ucfirst($log->decision ?? $log->action ?? 'allowed') }}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-400">{{ $log->hostname ?? $application->name }}</td>
                        <td class="px-4 py-3 text-sm text-gray-400">{{ $log->ip_address ?? $log->ip }}</td>
                        <td class="px-4 py-3 text-sm text-gray-400">{{ $log->timestamp->diffForHumans() }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" class="px-4 py-12">
                            <div class="text-center">
                                <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <h3 class="text-lg font-semibold text-white mb-2">No events yet</h3>
                                <p class="text-gray-400 max-w-md mx-auto">
                                    Firewall events will appear here when requests are blocked or flagged
                                </p>
                            </div>
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>
