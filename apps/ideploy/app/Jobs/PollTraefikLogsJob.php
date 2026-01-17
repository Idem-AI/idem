<?php

namespace App\Jobs;

use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallTrafficLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PollTraefikLogsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60;
    
    public function __construct(
        public Application $application
    ) {}

    public function handle(): void
    {
        try {
            $server = $this->application->destination->server;
            $logFile = "/var/log/traefik/access.log";
            
            // Récupérer la dernière position lue
            $cacheKey = "traefik_log_position_{$this->application->uuid}";
            $lastPosition = Cache::get($cacheKey, 0);
            
            // Lire les nouvelles lignes
            $command = "tail -n +{$lastPosition} {$logFile} 2>/dev/null || echo ''";
            $result = instant_remote_process([$command], $server);
            
            if (empty($result)) {
                return;
            }
            
            $lines = explode("\n", trim($result));
            $logs = [];
            $lineCount = 0;
            
            foreach ($lines as $line) {
                if (empty(trim($line))) {
                    continue;
                }
                
                $lineCount++;
                
                try {
                    $logData = json_decode($line, true);
                    
                    if (!$logData) {
                        continue;
                    }
                    
                    // Vérifier si c'est pour cette application (via RouterName)
                    $routerName = $logData['RouterName'] ?? '';
                    if (!str_contains($routerName, $this->application->uuid)) {
                        continue;
                    }
                    
                    $logs[] = $this->transformLog($logData);
                    
                    // Envoyer par batch de 50
                    if (count($logs) >= 50) {
                        $this->saveLogs($logs);
                        $logs = [];
                    }
                    
                } catch (\Exception $e) {
                    Log::warning("Failed to parse Traefik log line: {$e->getMessage()}");
                    continue;
                }
            }
            
            // Envoyer les logs restants
            if (!empty($logs)) {
                $this->saveLogs($logs);
            }
            
            // Mettre à jour la position
            Cache::put($cacheKey, $lastPosition + $lineCount, now()->addHours(24));
            
        } catch (\Exception $e) {
            Log::error("PollTraefikLogsJob failed: " . $e->getMessage());
        }
    }
    
    private function transformLog(array $logData): array
    {
        // Extraire l'IP (format "IP:PORT")
        $clientAddr = $logData['ClientAddr'] ?? '0.0.0.0:0';
        $ip = explode(':', $clientAddr)[0];
        
        // Déterminer la décision basée sur le status code
        $statusCode = $logData['DownstreamStatus'] ?? 200;
        $decision = $statusCode >= 400 ? 'ban' : 'allow';
        
        // User-Agent
        $userAgentArray = $logData['request_User-Agent'] ?? ['Unknown'];
        $userAgent = is_array($userAgentArray) ? ($userAgentArray[0] ?? 'Unknown') : 'Unknown';
        
        return [
            'ip_address' => $ip,
            'method' => $logData['RequestMethod'] ?? 'GET',
            'uri' => $logData['RequestPath'] ?? '/',
            'user_agent' => $userAgent,
            'status_code' => $statusCode,
            'decision' => $decision,
            'rule_name' => $statusCode === 403 ? 'traefik_blocked' : null,
            'response_time' => $logData['Duration'] ?? null,
            'bytes_sent' => $logData['DownstreamContentSize'] ?? 0,
            'timestamp' => $this->parseTimestamp($logData['time'] ?? null),
        ];
    }
    
    private function parseTimestamp(?string $time): \Carbon\Carbon
    {
        if (!$time) {
            return now();
        }
        
        try {
            return \Carbon\Carbon::parse($time);
        } catch (\Exception $e) {
            return now();
        }
    }
    
    private function saveLogs(array $logs): void
    {
        $config = $this->application->firewallConfig;
        
        if (!$config) {
            return;
        }
        
        foreach ($logs as $logData) {
            try {
                FirewallTrafficLog::create([
                    'firewall_config_id' => $config->id,
                    'application_id' => $this->application->id,
                    ...$logData
                ]);
            } catch (\Exception $e) {
                Log::warning("Failed to save traffic log: {$e->getMessage()}");
            }
        }
        
        // Mettre à jour les stats
        $config->refresh();
        $stats = $config->getTrafficStats();
        $config->update([
            'total_requests' => $stats['all_traffic'],
            'total_allowed' => $stats['allowed_requests'],
            'total_blocked' => $stats['denied_requests'],
            'last_request_at' => now(),
        ]);
    }
}
