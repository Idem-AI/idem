<?php

namespace App\Jobs\Security;

use App\Models\FirewallConfig;
use App\Services\Security\CrowdSecMetricsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

/**
 * Job to refresh firewall metrics from CrowdSec LAPI
 * Runs every 5 minutes to update dashboard metrics
 */
class RefreshFirewallMetricsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public FirewallConfig $config
    ) {}

    public function handle(): void
    {
        try {
            $metricsService = app(CrowdSecMetricsService::class);
            
            // Get fresh metrics from LAPI
            $metrics = $metricsService->getMetrics($this->config);
            
            // Cache metrics for 5 minutes
            $cacheKey = "firewall_metrics_{$this->config->id}";
            Cache::put($cacheKey, $metrics, now()->addMinutes(5));
            
            // Get hourly data
            $hourlyData = $metricsService->getHourlyData($this->config, 24);
            $hourlyCacheKey = "firewall_hourly_{$this->config->id}";
            Cache::put($hourlyCacheKey, $hourlyData, now()->addMinutes(5));
            
            ray("✅ Metrics refreshed for config {$this->config->id}");
            ray("   Total requests: {$metrics['total_requests']}");
            ray("   Total blocked: {$metrics['total_blocked']}");
            
        } catch (\Exception $e) {
            ray("❌ Failed to refresh metrics: {$e->getMessage()}");
            \Log::error("Failed to refresh firewall metrics", [
                'config_id' => $this->config->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
