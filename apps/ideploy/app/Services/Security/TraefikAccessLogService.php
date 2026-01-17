<?php

namespace App\Services\Security;

use App\Models\Application;
use App\Models\Server;
use Carbon\Carbon;

/**
 * Service to collect and analyze Traefik access logs
 * Provides REAL traffic metrics (allowed + denied)
 */
class TraefikAccessLogService
{
    /**
     * Get real traffic metrics from Traefik access logs
     */
    public function getMetrics(Application $application, int $hours = 24): array
    {
        $server = $application->destination->server;
        
        if (!$server) {
            return $this->getEmptyMetrics();
        }
        
        try {
            // Get recent access logs from Traefik
            $logs = $this->getAccessLogs($server, 2000); // Last 2000 lines
            
            // Filter logs for this application
            $appLogs = $this->filterByApplication($logs, $application->uuid);
            
            // Filter by time range
            $recentLogs = $this->filterByTimeRange($appLogs, $hours);
            
            // Calculate metrics
            $totalRequests = count($recentLogs);
            $denied = $this->countByStatus($recentLogs, 403);
            $allowed = $totalRequests - $denied;
            
            // Get hourly data
            $hourlyData = $this->getHourlyData($recentLogs, $hours);
            
            // Get recent events
            $recentEvents = $this->getRecentEvents($recentLogs, 10);
            
            return [
                'total_requests' => $totalRequests,
                'total_allowed' => $allowed,
                'total_denied' => $denied,
                'hourly_data' => $hourlyData,
                'recent_events' => $recentEvents,
            ];
            
        } catch (\Exception $e) {
            ray('❌ Failed to get Traefik metrics: ' . $e->getMessage());
            return $this->getEmptyMetrics();
        }
    }
    
    /**
     * Get access logs from Traefik container
     */
    private function getAccessLogs(Server $server, int $lines = 1000): array
    {
        try {
            // Read access.log file from Traefik container
            $command = "docker exec coolify-proxy tail -{$lines} /traefik/access.log 2>/dev/null || echo ''";
            $output = instant_remote_process([$command], $server, false);
            
            if (empty($output)) {
                ray('⚠️ No Traefik access logs found');
                return [];
            }
            
            // Parse JSON lines
            $logs = [];
            $logLines = explode("\n", $output);
            
            foreach ($logLines as $line) {
                $line = trim($line);
                if (empty($line)) {
                    continue;
                }
                
                // Try to parse as JSON
                $log = json_decode($line, true);
                
                // Check if it's a valid access log (has RequestMethod)
                if (is_array($log) && isset($log['RequestMethod'])) {
                    $logs[] = $log;
                }
            }
            
            ray("✅ Collected " . count($logs) . " Traefik access logs");
            
            return $logs;
            
        } catch (\Exception $e) {
            ray('❌ Failed to get access logs: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Filter logs by application UUID
     */
    private function filterByApplication(array $logs, string $appUuid): array
    {
        return array_filter($logs, function($log) use ($appUuid) {
            $routerName = $log['RouterName'] ?? '';
            $requestHost = $log['RequestHost'] ?? '';
            
            // Check if router name or request host contains app UUID
            return str_contains($routerName, $appUuid) || str_contains($requestHost, $appUuid);
        });
    }
    
    /**
     * Filter logs by time range
     */
    private function filterByTimeRange(array $logs, int $hours): array
    {
        $cutoff = now()->subHours($hours);
        
        return array_filter($logs, function($log) use ($cutoff) {
            $timestamp = $log['time'] ?? $log['StartUTC'] ?? null;
            
            if (!$timestamp) {
                return false;
            }
            
            try {
                $logTime = Carbon::parse($timestamp);
                return $logTime->isAfter($cutoff);
            } catch (\Exception $e) {
                return false;
            }
        });
    }
    
    /**
     * Count logs by HTTP status
     */
    private function countByStatus(array $logs, int $status): int
    {
        return count(array_filter($logs, function($log) use ($status) {
            return ($log['DownstreamStatus'] ?? 0) === $status;
        }));
    }
    
    /**
     * Get hourly traffic data
     */
    private function getHourlyData(array $logs, int $hours): array
    {
        // Initialize hourly buckets
        $hourlyData = [];
        for ($i = $hours - 1; $i >= 0; $i--) {
            $hour = now()->subHours($i)->format('H:00');
            $hourlyData[$hour] = ['allowed' => 0, 'denied' => 0];
        }
        
        // Group logs by hour
        foreach ($logs as $log) {
            $timestamp = $log['time'] ?? $log['StartUTC'] ?? null;
            
            if (!$timestamp) {
                continue;
            }
            
            try {
                $hour = Carbon::parse($timestamp)->format('H:00');
                
                if (isset($hourlyData[$hour])) {
                    $status = $log['DownstreamStatus'] ?? 0;
                    
                    if ($status === 403) {
                        $hourlyData[$hour]['denied']++;
                    } else {
                        $hourlyData[$hour]['allowed']++;
                    }
                }
            } catch (\Exception $e) {
                continue;
            }
        }
        
        return $hourlyData;
    }
    
    /**
     * Get recent events
     */
    private function getRecentEvents(array $logs, int $limit): array
    {
        // Sort by time (most recent first)
        usort($logs, function($a, $b) {
            $timeA = $a['time'] ?? $a['StartUTC'] ?? '1970-01-01';
            $timeB = $b['time'] ?? $b['StartUTC'] ?? '1970-01-01';
            return strcmp($timeB, $timeA);
        });
        
        // Take first N logs
        $recentLogs = array_slice($logs, 0, $limit);
        
        // Format for display
        return array_map(function($log) {
            $status = $log['DownstreamStatus'] ?? 0;
            
            return [
                'ip' => $log['ClientHost'] ?? 'Unknown',
                'method' => $log['RequestMethod'] ?? 'GET',
                'path' => $log['RequestPath'] ?? '/',
                'status' => $status,
                'action' => $status === 403 ? 'denied' : 'allowed',
                'timestamp' => Carbon::parse($log['time'] ?? $log['StartUTC'] ?? now()),
                'duration' => ($log['Duration'] ?? 0) / 1000000, // Convert to ms
            ];
        }, $recentLogs);
    }
    
    /**
     * Get empty metrics structure
     */
    private function getEmptyMetrics(): array
    {
        return [
            'total_requests' => 0,
            'total_allowed' => 0,
            'total_denied' => 0,
            'hourly_data' => [],
            'recent_events' => [],
        ];
    }
}
