<?php

namespace App\Services\Analytics;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PlausibleService
{
    protected string $baseUrl;
    protected string $apiKey;

    public function __construct(?string $baseUrl = null, ?string $apiKey = null)
    {
        $this->baseUrl = $baseUrl ?? config('analytics.plausible.url', 'http://localhost:8001');
        $this->apiKey = $apiKey ?? config('analytics.plausible.api_key', '');
    }

    /**
     * Get real-time visitors
     */
    public function getRealtimeVisitors(string $siteId): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$this->apiKey}",
            ])->get("{$this->baseUrl}/api/v1/stats/realtime/visitors", [
                'site_id' => $siteId,
            ]);

            return [
                'success' => $response->successful(),
                'visitors' => $response->json()['value'] ?? 0,
            ];
        } catch (\Exception $e) {
            Log::error("Plausible realtime visitors error: " . $e->getMessage());
            return ['success' => false, 'visitors' => 0];
        }
    }

    /**
     * Get aggregate stats
     */
    public function getAggregate(string $siteId, array $metrics, string $period = '30d'): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$this->apiKey}",
            ])->get("{$this->baseUrl}/api/v1/stats/aggregate", [
                'site_id' => $siteId,
                'period' => $period,
                'metrics' => implode(',', $metrics),
            ]);

            return [
                'success' => $response->successful(),
                'data' => $response->json()['results'] ?? [],
            ];
        } catch (\Exception $e) {
            Log::error("Plausible aggregate error: " . $e->getMessage());
            return ['success' => false, 'data' => []];
        }
    }

    /**
     * Get timeseries data
     */
    public function getTimeseries(string $siteId, string $period = '30d', string $interval = 'date'): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$this->apiKey}",
            ])->get("{$this->baseUrl}/api/v1/stats/timeseries", [
                'site_id' => $siteId,
                'period' => $period,
                'interval' => $interval,
                'metrics' => 'visitors,pageviews,bounce_rate,visit_duration',
            ]);

            return [
                'success' => $response->successful(),
                'data' => $response->json()['results'] ?? [],
            ];
        } catch (\Exception $e) {
            Log::error("Plausible timeseries error: " . $e->getMessage());
            return ['success' => false, 'data' => []];
        }
    }
}
