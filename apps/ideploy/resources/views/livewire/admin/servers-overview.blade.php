<div class="p-6">
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-white">Administration Serveurs</h1>
        <p class="text-sm text-gray-400 mt-1">Monitoring et gestion des composants firewall</p>
    </div>

    {{-- Statistiques --}}
    <div class="grid grid-cols-4 gap-4 mb-8">
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
            <div class="text-2xl font-bold text-white">{{ $stats['total'] }}</div>
            <div class="text-sm text-gray-400">Serveurs Total</div>
        </div>
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
            <div class="text-2xl font-bold text-green-400">{{ $stats['validated'] }}</div>
            <div class="text-sm text-gray-400">Validés</div>
        </div>
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
            <div class="text-2xl font-bold text-blue-400">{{ $stats['with_crowdsec'] }}</div>
            <div class="text-sm text-gray-400">CrowdSec OK</div>
        </div>
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
            <div class="text-2xl font-bold text-purple-400">{{ $stats['with_firewall_apps'] }}</div>
            <div class="text-sm text-gray-400">Apps Firewall</div>
        </div>
    </div>

    {{-- Liste Serveurs --}}
    <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg overflow-hidden">
        <table class="w-full">
            <thead class="bg-[#0f1724]">
                <tr class="border-b border-gray-800">
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">SERVEUR</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">CROWDSEC</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">TRAEFIK</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">TRAFFIC LOGGER</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">VALIDATION</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">APPS</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">ACTIONS</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
                @foreach($servers as $server)
                <tr class="hover:bg-gray-900/50">
                    <td class="px-6 py-4">
                        <div class="text-white font-medium">{{ $server->name }}</div>
                        <div class="text-xs text-gray-500">{{ $server->ip }}</div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            @if($server->crowdsec_available)
                                <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                                <span class="text-green-400 text-sm">Opérationnel</span>
                            @else
                                <span class="w-2 h-2 bg-red-400 rounded-full"></span>
                                <span class="text-red-400 text-sm">Indisponible</span>
                            @endif
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            @if($server->traefik_logging_enabled)
                                <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                                <span class="text-green-400 text-sm">Activé</span>
                            @else
                                <span class="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                <span class="text-yellow-400 text-sm">Désactivé</span>
                            @endif
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            @if($server->traffic_logger_installed)
                                <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                                <span class="text-green-400 text-sm">Installé</span>
                            @else
                                <span class="w-2 h-2 bg-red-400 rounded-full"></span>
                                <span class="text-red-400 text-sm">Non installé</span>
                            @endif
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            @if($server->installation_validated)
                                <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                                <span class="text-green-400 text-sm">Validé</span>
                            @else
                                <span class="w-2 h-2 bg-gray-400 rounded-full"></span>
                                <span class="text-gray-400 text-sm">En attente</span>
                            @endif
                        </div>
                        @if($server->last_validation_at)
                            <div class="text-xs text-gray-500 mt-1">
                                {{ $server->last_validation_at->diffForHumans() }}
                            </div>
                        @endif
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-white text-sm">{{ $server->applications->count() }}</div>
                        @php
                            $firewallApps = $server->applications->filter(fn($app) => $app->firewallConfig?->enabled)->count();
                        @endphp
                        @if($firewallApps > 0)
                            <div class="text-xs text-blue-400">{{ $firewallApps }} avec firewall</div>
                        @endif
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex justify-end gap-2">
                            <button wire:click="validateServer({{ $server->id }})"
                                    class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors">
                                Valider
                            </button>
                            <button wire:click="reinstallComponents({{ $server->id }})"
                                    class="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors">
                                Réinstaller
                            </button>
                        </div>
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
</div>
