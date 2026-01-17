<?php

namespace App\Services\Security;

use App\Models\FirewallConfig;
use App\Models\Server;
use Illuminate\Support\Facades\Http;

/**
 * Service to fetch metrics from CrowdSec LAPI
 * Provides real-time statistics for dashboard
 */
class CrowdSecMetricsService
{
    /**
     * Get metrics for a firewall config from CrowdSec LAPI
     */
    public function getMetrics(FirewallConfig $config): array
    {
        $application = $config->application;
        $server = $application->destination->server;
        
        if (!$server->crowdsec_available) {
            return $this->getEmptyMetrics();
        }
        
        try {
            // Get decisions (blocked IPs)
            $decisions = $this->getDecisions($server, $application->uuid);
            
            // Get alerts (detection events)
            $alerts = $this->getAlerts($server, $application->uuid);
            
            // Calculate metrics
            $totalBlocked = count($decisions);
            $totalAlerts = count($alerts);
            
            // Estimate total traffic (alerts represent detected malicious traffic)
            // In reality, we'd need traffic logger for accurate numbers
            // For now, we use alerts as proxy for total requests
            $totalTraffic = max($totalAlerts, $totalBlocked);
            
            return [
                'total_requests' => $totalTraffic,
                'total_allowed' => max(0, $totalTraffic - $totalBlocked),
                'total_blocked' => $totalBlocked,
                'total_challenged' => 0, // TODO: implement captcha tracking
                'active_decisions' => $decisions,
                'recent_alerts' => array_slice($alerts, 0, 10),
            ];
            
        } catch (\Exception $e) {
            ray('❌ Failed to fetch CrowdSec metrics: ' . $e->getMessage());
            return $this->getEmptyMetrics();
        }
    }
    
    /**
     * Get active decisions from CrowdSec LAPI
     */
    private function getDecisions(Server $server, string $appUuid): array
    {
        try {
            // Get alerts which contain decisions
            $command = "docker exec crowdsec-live cscli alerts list -o json --limit 100";
            $output = instant_remote_process([$command], $server, false);
            
            if (empty($output)) {
                return [];
            }
            
            $allAlerts = json_decode($output, true);
            
            if (!is_array($allAlerts)) {
                return [];
            }
            
            $appDecisions = [];
            
            // Extract decisions from alerts for this application
            foreach ($allAlerts as $alert) {
                $scenario = $alert['decisions'][0]['scenario'] ?? '';
                
                // Check if this alert is for our application
                if (str_contains($scenario, $appUuid)) {
                    // Add all decisions from this alert
                    foreach ($alert['decisions'] ?? [] as $decision) {
                        $appDecisions[] = $decision;
                    }
                }
            }
            
            return $appDecisions;
            
        } catch (\Exception $e) {
            ray('❌ Failed to get decisions: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get alerts from CrowdSec LAPI
     */
    private function getAlerts(Server $server, string $appUuid): array
    {
        try {
            $command = "docker exec crowdsec-live cscli alerts list -o json --limit 100";
            $output = instant_remote_process([$command], $server, false);
            
            if (empty($output)) {
                return [];
            }
            
            $allAlerts = json_decode($output, true);
            
            if (!is_array($allAlerts)) {
                return [];
            }
            
            // Filter alerts for this application
            $appAlerts = array_filter($allAlerts, function($alert) use ($appUuid) {
                // Check scenario in decisions
                $scenario = $alert['decisions'][0]['scenario'] ?? '';
                return str_contains($scenario, $appUuid);
            });
            
            return array_values($appAlerts);
            
        } catch (\Exception $e) {
            ray('❌ Failed to get alerts: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get hourly traffic data for chart
     */
    public function getHourlyData(FirewallConfig $config, int $hours = 24): array
    {
        $application = $config->application;
        $server = $application->destination->server;
        
        if (!$server->crowdsec_available) {
            return [];
        }
        
        try {
            // Get all alerts for this app
            $alerts = $this->getAlerts($server, $application->uuid);
            
            // Initialize hourly buckets
            $hourlyData = [];
            for ($i = $hours - 1; $i >= 0; $i--) {
                $hour = now()->subHours($i)->format('H:00');
                $hourlyData[$hour] = ['allowed' => 0, 'denied' => 0, 'challenged' => 0];
            }
            
            // Group alerts by hour
            foreach ($alerts as $alert) {
                $alertTime = $alert['created_at'] ?? null;
                if (!$alertTime) {
                    continue;
                }
                
                $hour = date('H:00', strtotime($alertTime));
                
                if (isset($hourlyData[$hour])) {
                    // Count as denied (blocked)
                    $hourlyData[$hour]['denied']++;
                }
            }
            
            return $hourlyData;
            
        } catch (\Exception $e) {
            ray('❌ Failed to get hourly data: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get empty metrics structure
     */
    private function getEmptyMetrics(): array
    {
        return [
            'total_requests' => 0,
            'total_allowed' => 0,
            'total_blocked' => 0,
            'total_challenged' => 0,
            'active_decisions' => [],
            'recent_alerts' => [],
        ];
    }
}
