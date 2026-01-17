<?php

namespace App\Jobs\Security;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Enable header logging in Traefik for User-Agent, Referer, etc.
 * Required for bot protection and advanced firewall rules
 */
class EnableTraefikHeaderLoggingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 1;
    public $timeout = 120;

    public function __construct(
        public Server $server
    ) {}

    public function handle(): void
    {
        ray("Enabling Traefik header logging on server: {$this->server->name}");
        
        try {
            // 1. Read current docker-compose
            $composePath = '/data/coolify/proxy/docker-compose.yml';
            $composeContent = instant_remote_process([
                "cat {$composePath}"
            ], $this->server);
            
            // 2. Check if already configured
            if (str_contains($composeContent, '--accesslog.fields.headers.names.User-Agent=keep')) {
                ray("✅ Header logging already enabled");
                $this->updateServerMetadata();
                return;
            }
            
            // 3. Add header logging arguments
            $headersToLog = [
                'User-Agent',
                'Referer',
                'X-Forwarded-For',
                'X-Real-Ip',
            ];
            
            $newLines = [];
            foreach ($headersToLog as $header) {
                $newLines[] = "      - '--accesslog.fields.headers.names.{$header}=keep'";
            }
            
            // 4. Insert after defaultmode=keep line
            $lines = explode("\n", $composeContent);
            $newContent = [];
            
            foreach ($lines as $line) {
                $newContent[] = $line;
                if (str_contains($line, '--accesslog.fields.headers.defaultmode=keep')) {
                    // Insert new lines after this one
                    foreach ($newLines as $newLine) {
                        $newContent[] = $newLine;
                    }
                }
            }
            
            $finalContent = implode("\n", $newContent);
            
            // 5. Write to temp file and upload
            $tempFile = storage_path("app/traefik-compose-{$this->server->id}.yml");
            file_put_contents($tempFile, $finalContent);
            
            instant_scp(
                $tempFile,
                $composePath,
                $this->server
            );
            
            @unlink($tempFile);
            
            // 6. Recreate Traefik container
            ray("Recreating Traefik with new config...");
            instant_remote_process([
                'cd /data/coolify/proxy',
                'docker-compose up -d --force-recreate'
            ], $this->server);
            
            // 7. Wait for Traefik to be healthy
            sleep(10);
            
            // 8. Verify
            $this->verifyHeaderLogging();
            
            // 9. Update metadata
            $this->updateServerMetadata();
            
            ray("✅ Traefik header logging enabled successfully");
            
        } catch (\Exception $e) {
            ray("❌ Failed to enable header logging: {$e->getMessage()}");
            throw $e;
        }
    }
    
    private function verifyHeaderLogging(): void
    {
        ray("Verifying header logging...");
        
        // Make test request with custom User-Agent
        instant_remote_process([
            'curl -s -A "iDeploy-Test-Bot" http://localhost > /dev/null',
            'sleep 2',
        ], $this->server);
        
        // Check if User-Agent appears in log
        $logPath = '/var/lib/docker/volumes/coolify_dev_coolify_data/_data/proxy/access.log';
        $result = instant_remote_process([
            "tail -5 {$logPath} | grep -i 'user-agent' || echo 'NOT_FOUND'"
        ], $this->server);
        
        if (str_contains($result, 'NOT_FOUND')) {
            throw new \Exception('User-Agent not found in access logs after configuration');
        }
        
        ray("✅ Header logging verified");
    }
    
    private function updateServerMetadata(): void
    {
        $this->server->update([
            'traefik_header_logging_enabled' => true,
        ]);
    }
    
    public function failed(\Throwable $exception): void
    {
        ray("EnableTraefikHeaderLoggingJob failed: {$exception->getMessage()}");
    }
}
