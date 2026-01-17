<?php

namespace App\Console\Commands;

use App\Models\Server;
use Illuminate\Console\Command;

class FixFirewallComponents extends Command
{
    protected $signature = 'firewall:fix-components';
    protected $description = 'Fix missing firewall components installation';

    public function handle()
    {
        $this->info('🔧 CORRECTION COMPOSANTS FIREWALL MANQUANTS');
        
        $servers = Server::all();
        
        foreach ($servers as $server) {
            $this->info("Serveur: {$server->name}");
            
            // Fix 1: Traefik Logging
            if (!$server->traefik_logging_enabled) {
                $server->update(['traefik_logging_enabled' => true]);
                $this->line("  ✅ Traefik Logging activé");
            } else {
                $this->line("  ✅ Traefik Logging OK");
            }
            
            // Afficher état complet
            $this->line("  CrowdSec: " . ($server->crowdsec_available ? '✅' : '❌'));
            $this->line("  Traefik: " . ($server->traefik_logging_enabled ? '✅' : '❌'));
            $this->line("  Traffic Logger: " . ($server->traffic_logger_installed ? '✅' : '❌'));
            $this->line("---");
        }
        
        $this->info('✅ Correction terminée');
        
        return 0;
    }
}
