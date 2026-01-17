<?php

namespace App\Jobs;

use App\Models\Server;
use App\Models\FirewallTrafficLog;
use App\Http\Controllers\Api\TrafficLoggerController;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PollTrafficLoggerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120;
    public $tries = 1;

    public function __construct(
        public Server $server
    ) {}

    public function handle()
    {
        ray("🔍 Polling traffic logger on server: {$this->server->name}");
        
        try {
            // Vérifier que le serveur a le Traffic Logger installé
            if (!$this->server->traffic_logger_installed) {
                Log::debug("Traffic Logger not installed on server {$this->server->name}");
                return;
            }

            // Collecter les logs via SSH
            $logs = $this->collectTrafficLogs();
            
            if (empty($logs)) {
                ray("No new traffic logs found");
                return;
            }

            // Parser et insérer en batch
            $this->processLogs($logs);
            
            ray("✅ Processed " . count($logs) . " traffic logs");
            
        } catch (\Exception $e) {
            ray("❌ Error polling traffic logger: " . $e->getMessage());
            Log::error("PollTrafficLoggerJob failed", [
                'server' => $this->server->name,
                'error' => $e->getMessage()
            ]);
        }
    }
    
    private function collectTrafficLogs(): array
    {
        // Collecter les logs des 2 dernières minutes
        $since = now()->subMinutes(2)->format('Y-m-d H:i:s');
        
        $command = "docker logs traffic-logger --since '{$since}' 2>/dev/null | grep 'TRAFFIC_LOG:' | tail -100";
        
        $result = instant_remote_process([$command], $this->server);
        
        if (empty($result)) {
            return [];
        }
        
        $logs = [];
        $lines = explode("\n", trim($result));
        
        foreach ($lines as $line) {
            if (str_contains($line, 'TRAFFIC_LOG:')) {
                // Extract JSON from line like: "2025-12-03 19:23:39 [INFO] traffic-logger: TRAFFIC_LOG: {...}"
                $jsonStart = strpos($line, 'TRAFFIC_LOG:') + 12;
                $jsonData = trim(substr($line, $jsonStart));
                
                try {
                    $logData = json_decode($jsonData, true);
                    if ($logData) {
                        $logs[] = $logData;
                    }
                } catch (\Exception $e) {
                    ray("Failed to parse log line: " . $line);
                }
            }
        }
        
        return $logs;
    }
    
    private function processLogs(array $logs): void
    {
        $controller = new TrafficLoggerController();
        
        // Grouper par app_uuid pour batch insert
        $logsByApp = [];
        foreach ($logs as $log) {
            $appUuid = $log['app_uuid'] ?? 'unknown';
            if (!isset($logsByApp[$appUuid])) {
                $logsByApp[$appUuid] = [];
            }
            $logsByApp[$appUuid][] = $log;
        }
        
        // Traiter chaque app séparément
        foreach ($logsByApp as $appUuid => $appLogs) {
            try {
                $controller->storeBatch($appUuid, $appLogs);
                ray("Stored " . count($appLogs) . " logs for app {$appUuid}");
            } catch (\Exception $e) {
                ray("Failed to store logs for app {$appUuid}: " . $e->getMessage());
            }
        }
    }
}