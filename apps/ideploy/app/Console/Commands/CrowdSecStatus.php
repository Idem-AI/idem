<?php

namespace App\Console\Commands;

use App\Models\Server;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Process;

class CrowdSecStatus extends Command
{
    protected $signature = 'crowdsec:status {server_ip=206.81.23.6}';
    protected $description = 'Check CrowdSec installation status on server';

    public function handle()
    {
        $serverIp = $this->argument('server_ip');
        $server = Server::where('ip', $serverIp)->first();
        
        if (!$server) {
            $this->error("Server not found: {$serverIp}");
            return 1;
        }
        
        $this->info("=== CROWDSEC STATUS FOR {$server->name} ===");
        $this->newLine();
        
        // Server info
        $this->line("Server: {$server->name}");
        $this->line("IP: {$server->ip}");
        $this->line("UUID: {$server->uuid}");
        $this->newLine();
        
        // Metadata
        $this->info("=== METADATA ===");
        $metadata = $server->extra_attributes ?? [];
        
        $fields = [
            'crowdsec_installed' => fn($v) => $v ? '✅ true' : '❌ false',
            'crowdsec_version' => fn($v) => "✅ {$v}",
            'crowdsec_bouncer_key' => fn($v) => '✅ SET (hidden)',
            'crowdsec_container_name' => fn($v) => "✅ {$v}",
            'crowdsec_installed_at' => fn($v) => "✅ {$v}",
        ];
        
        foreach ($fields as $field => $formatter) {
            if (isset($metadata[$field])) {
                $this->line("  {$formatter($metadata[$field])}");
            } else {
                $this->line("  ❌ {$field}: NOT SET");
            }
        }
        
        $this->newLine();
        
        // Check container on server
        $this->info("=== CONTAINER STATUS ===");
        try {
            $containerName = $metadata['crowdsec_container_name'] ?? 'crowdsec';
            $command = "docker ps -a --filter name={$containerName} --format '{{.Names}}\t{{.Status}}'";
            
            $result = Process::timeout(30)->run(
                "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i {$server->privateKeyLocation()} root@{$server->ip} \"{$command}\""
            );
            
            if ($result->successful() && !empty(trim($result->output()))) {
                $this->info("✅ Container found:");
                $this->line("   " . trim($result->output()));
            } else {
                $this->warn("❌ Container NOT found on server");
            }
        } catch (\Exception $e) {
            $this->error("Error checking container: " . $e->getMessage());
        }
        
        $this->newLine();
        
        // Recommendation
        $this->info("=== RECOMMENDATION ===");
        if (!isset($metadata['crowdsec_installed']) || !$metadata['crowdsec_installed']) {
            $this->warn("⚠️  CrowdSec NOT installed");
            $this->line("Run: php artisan crowdsec:install {$server->id}");
        } else {
            $this->info("✅ Metadata shows installed");
            $this->line("If container is missing, re-run installation");
        }
        
        return 0;
    }
}
