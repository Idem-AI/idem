<?php

namespace App\Livewire\Admin;

use App\Models\Server;
use Livewire\Component;

class ServersOverview extends Component
{
    public function render()
    {
        $servers = Server::with(['applications.firewallConfig'])
            ->orderBy('created_at', 'desc')
            ->get();
            
        $stats = [
            'total' => $servers->count(),
            'validated' => $servers->where('installation_validated', true)->count(),
            'with_crowdsec' => $servers->where('crowdsec_available', true)->count(),
            'with_firewall_apps' => $servers->filter(function($server) {
                return $server->applications->some(function($app) {
                    return $app->firewallConfig && $app->firewallConfig->enabled;
                });
            })->count(),
        ];
        
        return view('livewire.admin.servers-overview', compact('servers', 'stats'));
    }
    
    public function validateServer($serverId)
    {
        $server = Server::findOrFail($serverId);
        
        \App\Jobs\Security\ValidateServerInstallationJob::dispatch($server);
        
        $this->dispatch('notify', [
            'type' => 'info',
            'message' => "Validation lancée pour {$server->name}"
        ]);
    }
    
    public function reinstallComponents($serverId)
    {
        $server = Server::findOrFail($serverId);
        
        // Réinstaller tous les composants
        \App\Jobs\Server\InstallCrowdSecJob::dispatch($server)->delay(now()->addSeconds(10));
        \App\Jobs\ConfigureTraefikLoggingJob::dispatch($server)->delay(now()->addMinutes(2));
        \App\Jobs\Security\DeployTrafficLoggerJob::dispatch($server)->delay(now()->addMinutes(4));
        \App\Jobs\Security\ValidateServerInstallationJob::dispatch($server)->delay(now()->addMinutes(6));
        
        $this->dispatch('notify', [
            'type' => 'success',
            'message' => "Réinstallation lancée pour {$server->name}"
        ]);
    }
}
