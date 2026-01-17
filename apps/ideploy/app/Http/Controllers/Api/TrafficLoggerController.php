<?php

namespace App\Http\Controllers\Api;

use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallTrafficLog;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;

class TrafficLoggerController extends Controller
{
    /**
     * Store batch of traffic logs from PollTrafficLoggerJob
     */
    public function storeBatch(string $appUuid, array $logs): void
    {
        $application = Application::where('uuid', $appUuid)->first();
        
        if (\!$application) {
            Log::warning("Application not found for UUID: {$appUuid}");
            return;
        }

        $config = $application->firewallConfig;
        
        if (\!$config) {
            Log::warning("Firewall config not found for app: {$appUuid}");
            return;
        }

        $inserted = 0;
        
        foreach ($logs as $log) {
            try {
                FirewallTrafficLog::create([
                    'firewall_config_id' => $config->id,
                    'ip_address' => $log['ip_address'] ?? 'unknown',
                    'method' => $log['method'] ?? 'GET',
                    'uri' => $log['uri'] ?? '/',
                    'user_agent' => $log['user_agent'] ?? 'Unknown',
                    'decision' => $log['decision'] ?? 'allow',
                    'timestamp' => isset($log['timestamp']) ? \Carbon\Carbon::parse($log['timestamp']) : now(),
                ]);
                
                $inserted++;
                
                // Update stats
                $config->increment('total_requests');
                
                if ($log['decision'] === 'block') {
                    $config->increment('total_blocked');
                } else {
                    $config->increment('total_allowed');
                }
                
            } catch (\Exception $e) {
                Log::error("Failed to store traffic log: " . $e->getMessage(), [
                    'log' => $log,
                    'app_uuid' => $appUuid
                ]);
            }
        }
        
        ray("Inserted {$inserted} traffic logs for app {$appUuid}");
    }
}
