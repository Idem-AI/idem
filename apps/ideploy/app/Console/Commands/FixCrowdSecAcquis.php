<?php

namespace App\Console\Commands;

use App\Models\Server;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class FixCrowdSecAcquis extends Command
{
    protected $signature = 'crowdsec:fix-acquis {server_id}';
    protected $description = 'Fix acquis.yaml format on a server';

    public function handle()
    {
        $serverId = $this->argument('server_id');
        $server = Server::find($serverId);
        
        if (!$server) {
            $this->error("Server #{$serverId} not found");
            return 1;
        }
        
        $this->info("Fixing acquis.yaml on server: {$server->name} (ID: {$server->id})");
        $this->line('');
        
        // Generate correct acquis.yaml
        $yaml = <<<YAML
filenames:
  - /var/log/traefik/*.log
labels:
  type: traefik
---
filenames:
  - /var/log/nginx/*.log
labels:
  type: nginx
YAML;
        
        // Save locally
        $localPath = "crowdsec-server-{$server->id}/acquis-fixed.yaml";
        Storage::disk('local')->put($localPath, $yaml);
        
        $this->info('✅ Generated correct acquis.yaml');
        $this->line('');
        
        // Upload to server
        try {
            instant_scp(
                Storage::disk('local')->path($localPath),
                "/var/lib/coolify/crowdsec/config/acquis.yaml",
                $server
            );
            
            $this->info('✅ Uploaded to server');
            $this->line('');
            
            // Restart CrowdSec
            $this->info('Restarting CrowdSec...');
            instant_remote_process([
                'cd /var/lib/coolify/crowdsec',
                'docker compose restart crowdsec',
            ], $server);
            
            $this->line('');
            $this->info('✅ CrowdSec restarted');
            $this->line('');
            
            // Cleanup
            Storage::disk('local')->delete($localPath);
            
            // Check logs
            $this->line('Checking CrowdSec logs (last 20 lines):');
            $this->line('');
            
            $logs = instant_remote_process([
                'docker logs crowdsec --tail 20'
            ], $server);
            
            $this->line($logs);
            $this->line('');
            
            if (str_contains($logs, 'fatal') || str_contains($logs, 'error')) {
                $this->warn('⚠️  There are still errors in the logs');
            } else {
                $this->info('✅ CrowdSec is running correctly!');
            }
            
        } catch (\Exception $e) {
            $this->error('Failed to fix acquis: ' . $e->getMessage());
            return 1;
        }
        
        return 0;
    }
}
