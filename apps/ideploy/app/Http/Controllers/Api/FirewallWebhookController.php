<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallTrafficLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class FirewallWebhookController extends Controller
{
    /**
     * Receive traffic logs from Traefik or CrowdSec
     * 
     * POST /api/firewall/webhook/{app_uuid}
     * 
     * Body:
     * {
     *   "ip": "1.2.3.4",
     *   "method": "GET",
     *   "uri": "/api/users",
     *   "user_agent": "curl/7.68.0",
     *   "status_code": 200,
     *   "decision": "allow|ban|captcha",
     *   "rule_name": "block_known_bots",
     *   "timestamp": "2024-01-01T12:00:00Z"
     * }
     */
    public function receiveTrafficLog(Request $request, string $appUuid)
    {
        try {
            // Find application
            $application = Application::where('uuid', $appUuid)->first();
            
            if (!$application) {
                return response()->json(['error' => 'Application not found'], 404);
            }
            
            // Get firewall config
            $config = $application->firewallConfig;
            
            if (!$config || !$config->enabled) {
                return response()->json(['error' => 'Firewall not enabled'], 403);
            }
            
            // Validate request
            $validated = $request->validate([
                'ip' => 'required|ip',
                'method' => 'required|string',
                'uri' => 'required|string',
                'user_agent' => 'nullable|string',
                'status_code' => 'nullable|integer',
                'decision' => 'required|in:allow,ban,captcha',
                'rule_name' => 'nullable|string',
                'timestamp' => 'nullable|date',
                'country_code' => 'nullable|string|size:2',
                'asn' => 'nullable|integer',
            ]);
            
            // Create log entry
            $log = FirewallTrafficLog::create([
                'firewall_config_id' => $config->id,
                'application_id' => $application->id,
                'ip_address' => $validated['ip'],
                'method' => $validated['method'],
                'uri' => $validated['uri'],
                'user_agent' => $validated['user_agent'] ?? 'Unknown',
                'status_code' => $validated['status_code'] ?? null,
                'decision' => $validated['decision'],
                'rule_name' => $validated['rule_name'] ?? null,
                'timestamp' => $validated['timestamp'] ?? now(),
                'country_code' => $validated['country_code'] ?? null,
                'asn' => $validated['asn'] ?? null,
            ]);
            
            // Update config stats (cache for performance)
            $this->updateConfigStats($config);
            
            Log::info("Firewall log received", [
                'app' => $appUuid,
                'ip' => $validated['ip'],
                'decision' => $validated['decision'],
            ]);
            
            return response()->json([
                'success' => true,
                'log_id' => $log->id,
            ], 201);
            
        } catch (\Exception $e) {
            Log::error("Firewall webhook error: " . $e->getMessage());
            
            return response()->json([
                'error' => 'Internal server error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    
    /**
     * Receive batch logs (more efficient)
     * 
     * POST /api/firewall/webhook/{app_uuid}/batch
     * 
     * Body:
     * {
     *   "logs": [
     *     {...log1},
     *     {...log2}
     *   ]
     * }
     */
    public function receiveBatchLogs(Request $request, string $appUuid)
    {
        try {
            $application = Application::where('uuid', $appUuid)->first();
            
            if (!$application) {
                return response()->json(['error' => 'Application not found'], 404);
            }
            
            $config = $application->firewallConfig;
            
            if (!$config || !$config->enabled) {
                return response()->json(['error' => 'Firewall not enabled'], 403);
            }
            
            $validated = $request->validate([
                'logs' => 'required|array',
                'logs.*.ip' => 'required|ip',
                'logs.*.method' => 'required|string',
                'logs.*.uri' => 'required|string',
                'logs.*.user_agent' => 'nullable|string',
                'logs.*.decision' => 'required|in:allow,ban,captcha',
                'logs.*.rule_name' => 'nullable|string',
                'logs.*.timestamp' => 'nullable|date',
            ]);
            
            $inserted = 0;
            
            foreach ($validated['logs'] as $logData) {
                FirewallTrafficLog::create([
                    'firewall_config_id' => $config->id,
                    'application_id' => $application->id,
                    'ip_address' => $logData['ip'],
                    'method' => $logData['method'],
                    'uri' => $logData['uri'],
                    'user_agent' => $logData['user_agent'] ?? 'Unknown',
                    'decision' => $logData['decision'],
                    'rule_name' => $logData['rule_name'] ?? null,
                    'timestamp' => $logData['timestamp'] ?? now(),
                ]);
                
                $inserted++;
            }
            
            $this->updateConfigStats($config);
            
            return response()->json([
                'success' => true,
                'inserted' => $inserted,
            ], 201);
            
        } catch (\Exception $e) {
            Log::error("Firewall batch webhook error: " . $e->getMessage());
            
            return response()->json([
                'error' => 'Internal server error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
    
    /**
     * Update config stats cache
     */
    private function updateConfigStats(FirewallConfig $config): void
    {
        // Update stats columns (optional, for performance)
        $stats = $config->getTrafficStats();
        
        $config->update([
            'total_requests' => $stats['all_traffic'],
            'total_allowed' => $stats['allowed_requests'],
            'total_blocked' => $stats['denied_requests'],
            'last_request_at' => now(),
        ]);
    }
}
