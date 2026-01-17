<?php

namespace App\Console\Commands;

use App\Jobs\Server\ConfigureTraefikCrowdSecJob;
use App\Models\Server;
use Illuminate\Console\Command;

class ConfigureTraefikCrowdSec extends Command
{
    protected $signature = 'crowdsec:configure-traefik {server_id}';
    protected $description = 'Configure Traefik with CrowdSec plugin on a server';

    public function handle()
    {
        $serverId = $this->argument('server_id');
        $server = Server::find($serverId);
        
        if (!$server) {
            $this->error("Server #{$serverId} not found");
            return 1;
        }
        
        $this->info("Configuring Traefik with CrowdSec plugin on: {$server->name} (ID: {$server->id})");
        $this->line('');
        
        // Check if CrowdSec is installed
        if (!$server->crowdsec_installed) {
            $this->warn('⚠️  CrowdSec is not installed on this server');
            $this->line('');
            $this->info('Please run first: php artisan crowdsec:install-server ' . $server->id);
            return 1;
        }
        
        $this->info('✅ CrowdSec is installed');
        $this->line('');
        
        // Check proxy type
        $proxyType = $server->proxyType();
        if ($proxyType !== 'TRAEFIK') {
            $this->error("Server is not using Traefik (current: {$proxyType})");
            return 1;
        }
        
        $this->info('✅ Server is using Traefik');
        $this->line('');
        
        // Dispatch configuration job
        $this->info('Dispatching Traefik configuration job...');
        ConfigureTraefikCrowdSecJob::dispatch($server);
        
        $this->line('');
        $this->info('✅ Configuration job dispatched!');
        $this->line('');
        $this->line('Traefik will be restarted with CrowdSec plugin (2-3 minutes).');
        $this->line('You can check the progress with:');
        $this->line('  docker exec idem-ideploy-dev tail -f storage/logs/laravel.log');
        $this->line('');
        $this->line('Or check Traefik logs on the server:');
        $this->line('  ssh root@' . $server->ip . ' "docker logs coolify-proxy --tail 50"');
        $this->line('');
        $this->line('Once configured, you can activate firewall for apps!');
        
        return 0;
    }
}
