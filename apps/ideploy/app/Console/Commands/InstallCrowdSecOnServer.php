<?php

namespace App\Console\Commands;

use App\Jobs\Server\InstallCrowdSecJob;
use App\Models\Server;
use Illuminate\Console\Command;

class InstallCrowdSecOnServer extends Command
{
    protected $signature = 'crowdsec:install-server {server_id}';
    protected $description = 'Install CrowdSec on a server';

    public function handle()
    {
        $serverId = $this->argument('server_id');
        $server = Server::find($serverId);
        
        if (!$server) {
            $this->error("Server #{$serverId} not found");
            return 1;
        }
        
        $this->info("Installing CrowdSec on server: {$server->name} (ID: {$server->id})");
        $this->line('');
        
        // Check if already installed
        if ($server->crowdsec_installed) {
            $this->warn('⚠️  CrowdSec is already installed on this server');
            
            if (!$this->confirm('Do you want to reinstall?', false)) {
                $this->info('Installation cancelled');
                return 0;
            }
        }
        
        // Check server connectivity
        $this->info('Checking server connectivity...');
        
        if (!$server->ip || !$server->port) {
            $this->error('Server is not properly configured (missing IP or port)');
            return 1;
        }
        
        $this->info("  IP: {$server->ip}");
        $this->info("  Port: {$server->port}");
        $this->info("  User: {$server->user}");
        $this->line('');
        
        // Dispatch installation job
        $this->info('Dispatching installation job...');
        InstallCrowdSecJob::dispatch($server);
        
        $this->line('');
        $this->info('✅ Installation job dispatched!');
        $this->line('');
        $this->line('The installation will run in the background (5-10 minutes).');
        $this->line('You can check the progress with:');
        $this->line('  docker exec idem-ideploy-dev tail -f storage/logs/laravel.log');
        $this->line('');
        $this->line('Or check Ray for real-time updates.');
        $this->line('');
        $this->line('Once installed, the server will be marked as:');
        $this->line('  - crowdsec_installed: true');
        $this->line('  - crowdsec_available: true');
        $this->line('  - crowdsec_lapi_url: http://crowdsec:8081');
        
        return 0;
    }
}
