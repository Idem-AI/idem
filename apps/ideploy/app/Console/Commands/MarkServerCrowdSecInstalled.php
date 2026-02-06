<?php

namespace App\Console\Commands;

use App\Models\Server;
use Illuminate\Console\Command;

class MarkServerCrowdSecInstalled extends Command
{
    protected $signature = 'crowdsec:mark-installed {server_id?}';
    protected $description = 'Mark a server as having CrowdSec installed (for testing/dev)';

    public function handle()
    {
        $serverId = $this->argument('server_id');
        
        if ($serverId) {
            $server = Server::find($serverId);
        } else {
            $server = Server::first();
        }
        
        if (!$server) {
            $this->error('Server not found');
            return 1;
        }
        
        $this->info("Simulating CrowdSec installation for '{$server->name}' (ID: {$server->id})...");
        $this->line('');
        
        // Generate a fake API key
        $fakeApiKey = bin2hex(random_bytes(32));
        
        // Mark server as having CrowdSec (using direct columns)
        $server->update([
            'crowdsec_installed' => true,
            'crowdsec_available' => true,
            'crowdsec_lapi_url' => 'http://crowdsec-live:8080',
            'crowdsec_bouncer_key' => $fakeApiKey,
        ]);
        
        $this->info('✅ Server marked as CrowdSec ready');
        $this->line('');
        $this->line('Status:');
        $this->line("  Server: {$server->name}");
        $this->line("  crowdsec_installed: TRUE");
        $this->line("  crowdsec_available: TRUE");
        $this->line("  crowdsec_lapi_url: http://crowdsec:8080");
        $this->line('');
        $this->info('✅ You can now enable the firewall in the UI!');
        $this->info('   The system will work in test mode (fake bouncer keys).');
        
        return 0;
    }
    
    private function getCrowdSecCompose(): string
    {
        return <<<'YAML'
version: '3.8'
services:
  crowdsec:
    image: crowdsecurity/crowdsec:latest
    container_name: crowdsec
    restart: always
    environment:
      COLLECTIONS: "crowdsecurity/nginx crowdsecurity/traefik crowdsecurity/http-cve"
      GID: "1000"
      TZ: "UTC"
    volumes:
      - ./config:/etc/crowdsec
      - ./data:/var/lib/crowdsec/data
      - /var/log:/var/log:ro
    ports:
      - "127.0.0.1:8080:8080"
YAML;
    }
}
