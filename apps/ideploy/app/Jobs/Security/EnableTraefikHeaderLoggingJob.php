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
            
            // 3. Initialize newLines array and ensure access log file creation directive exists
            $newLines = [];
            
            if (!str_contains($composeContent, '--accesslog.filepath=')) {
                ray("Adding accesslog.filepath directive");
                // Add access log file creation before header configs
                $accesslogLines = [
                    "      - '--accesslog.filepath=/traefik/access.log'",
                    "      - '--accesslog.format=json'",
                    "      - '--accesslog.bufferingsize=100'",
                ];
                
                // Insert access log config first
                foreach ($accesslogLines as $line) {
                    if (!str_contains($composeContent, trim(str_replace("      - '", "", str_replace("'", "", $line))))) {
                        $newLines[] = $line;
                    }
                }
            }
            
            // 4. Add header logging arguments
            $headersToLog = [
                'User-Agent',
                'Referer',
                'X-Forwarded-For',
                'X-Real-Ip',
            ];
            
            foreach ($headersToLog as $header) {
                $newLines[] = "      - '--accesslog.fields.headers.names.{$header}=keep'";
            }
            
            // 4. Insert after existing accesslog configurations or command section
            $lines = explode("\n", $composeContent);
            $newContent = [];
            $inserted = false;
            
            foreach ($lines as $line) {
                $newContent[] = $line;
                // Insert after the last accesslog line, or after command section starts
                if (!$inserted && (
                    str_contains($line, '--accesslog.fields.names.ServiceName=keep') ||
                    str_contains($line, '--accesslog.bufferingsize=') ||
                    str_contains($line, '--providers.docker=true')
                )) {
                    // Insert new lines after this one
                    foreach ($newLines as $newLine) {
                        $newContent[] = $newLine;
                    }
                    $inserted = true;
                }
            }
            
            // If not inserted yet, add at the end of command section
            if (!$inserted && !empty($newLines)) {
                // Find the end of command section and insert before
                $tempContent = [];
                $inCommand = false;
                foreach ($newContent as $line) {
                    if (str_contains($line, 'command:')) {
                        $inCommand = true;
                    }
                    
                    if ($inCommand && (str_contains($line, 'labels:') || str_contains($line, 'volumes:'))) {
                        // End of command section, insert here
                        foreach ($newLines as $newLine) {
                            $tempContent[] = $newLine;
                        }
                        $inCommand = false;
                    }
                    $tempContent[] = $line;
                }
                $newContent = $tempContent;
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
                'docker compose up -d --force-recreate'
            ], $this->server);
            
            // 7. Wait for Traefik to be healthy
            sleep(10);
            
            // 8. Ensure access.log file exists and generate initial traffic
            ray("Creating access.log file and generating initial traffic...");
            instant_remote_process([
                'touch /data/coolify/proxy/access.log',
                'chmod 666 /data/coolify/proxy/access.log',
                'curl -s http://localhost >/dev/null || true',
                'curl -s http://localhost/health >/dev/null || true',
                'sleep 2'
            ], $this->server);
            
            // 9. Verify
            $this->verifyHeaderLogging();
            
            // 10. Update metadata
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
        
        // Try multiple possible log paths
        $possiblePaths = [
            '/data/coolify/proxy/access.log',
            '/var/lib/docker/volumes/coolify_coolify_data/_data/proxy/access.log',
            '/var/lib/docker/volumes/coolify_dev_coolify_data/_data/proxy/access.log',
        ];
        
        // Make test request with custom User-Agent
        instant_remote_process([
            'curl -s -A "iDeploy-Test-Bot" http://localhost > /dev/null',
            'sleep 3',
        ], $this->server);
        
        $found = false;
        foreach ($possiblePaths as $logPath) {
            try {
                $result = instant_remote_process([
                    "test -f {$logPath} && tail -10 {$logPath} | grep -i 'user-agent' || echo 'NOT_FOUND'"
                ], $this->server);
                
                if (!str_contains($result, 'NOT_FOUND')) {
                    ray("✅ Header logging verified at: {$logPath}");
                    $found = true;
                    break;
                }
            } catch (\Exception $e) {
                ray("Path {$logPath} not accessible: {$e->getMessage()}");
                continue;
            }
        }
        
        if (!$found) {
            ray("⚠️ Could not verify header logging, but configuration was applied");
            // Ne pas throw une exception, juste un warning
        }
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
