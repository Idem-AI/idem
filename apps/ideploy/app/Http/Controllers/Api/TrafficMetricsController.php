<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\FirewallTrafficLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TrafficMetricsController extends Controller
{
    /**
     * Reçoit metrics du Traffic Logger en temps réel
     * 
     * Le Traffic Logger envoie des batches de metrics toutes les 5 secondes
     * Format: { metrics: [{ app_uuid, allowed, denied, challenged, timestamp }] }
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'metrics' => 'required|array',
            'metrics.*.app_uuid' => 'required|string',
            'metrics.*.allowed' => 'required|integer|min:0',
            'metrics.*.denied' => 'required|integer|min:0',
            'metrics.*.challenged' => 'required|integer|min:0',
            'metrics.*.timestamp' => 'required|string',
        ]);

        $inserted = 0;

        DB::transaction(function () use ($validated, &$inserted) {
            foreach ($validated['metrics'] as $metric) {
                $application = Application::where('uuid', $metric['app_uuid'])->first();
                
                if (!$application || !$application->firewallConfig) {
                    Log::warning("Traffic metrics received for unknown app: {$metric['app_uuid']}");
                    continue;
                }

                $timestamp = \Carbon\Carbon::parse($metric['timestamp']);

                // Créer entrées de log pour traffic ALLOWED
                for ($i = 0; $i < $metric['allowed']; $i++) {
                    FirewallTrafficLog::create([
                        'firewall_config_id' => $application->firewallConfig->id,
                        'ip_address' => 'aggregated',
                        'method' => 'GET',
                        'uri' => '/aggregated',
                        'user_agent' => 'Traffic Logger',
                        'decision' => 'allow',
                        'timestamp' => $timestamp,
                    ]);
                    $inserted++;
                }

                // Créer entrées de log pour traffic DENIED (bloqué)
                for ($i = 0; $i < $metric['denied']; $i++) {
                    FirewallTrafficLog::create([
                        'firewall_config_id' => $application->firewallConfig->id,
                        'ip_address' => 'aggregated',
                        'method' => 'GET',
                        'uri' => '/aggregated',
                        'user_agent' => 'Traffic Logger',
                        'decision' => 'ban',
                        'timestamp' => $timestamp,
                    ]);
                    $inserted++;
                }

                // Créer entrées de log pour traffic CHALLENGED (captcha)
                for ($i = 0; $i < $metric['challenged']; $i++) {
                    FirewallTrafficLog::create([
                        'firewall_config_id' => $application->firewallConfig->id,
                        'ip_address' => 'aggregated',
                        'method' => 'GET',
                        'uri' => '/aggregated',
                        'user_agent' => 'Traffic Logger',
                        'decision' => 'captcha',
                        'timestamp' => $timestamp,
                    ]);
                    $inserted++;
                }
            }
        });

        Log::info("Traffic metrics stored: {$inserted} logs from " . count($validated['metrics']) . " apps");

        return response()->json([
            'success' => true,
            'inserted' => $inserted,
        ]);
    }
}
