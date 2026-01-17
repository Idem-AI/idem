<?php

namespace App\Services\Analytics;

use App\Models\Application;
use App\Models\FirewallTrafficLog;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    /**
     * Get analytics overview for an application
     */
    public function getOverview(Application $application, string $period = '24h'): array
    {
        $dateRange = $this->getDateRange($period);
        
        return [
            'visitors' => $this->getUniqueVisitors($application, $dateRange),
            'page_views' => $this->getPageViews($application, $dateRange),
            'bounce_rate' => $this->getBounceRate($application, $dateRange),
            'avg_session_duration' => $this->getAvgSessionDuration($application, $dateRange),
            'top_pages' => $this->getTopPages($application, $dateRange),
            'top_countries' => $this->getTopCountries($application, $dateRange),
            'traffic_sources' => $this->getTrafficSources($application, $dateRange),
            'hourly_traffic' => $this->getHourlyTraffic($application, $dateRange),
        ];
    }
    
    /**
     * Get unique visitors count
     */
    public function getUniqueVisitors(Application $application, array $dateRange): int
    {
        return FirewallTrafficLog::where('application_id', $application->id)
            ->whereBetween('timestamp', $dateRange)
            ->distinct('ip_address')
            ->count('ip_address');
    }
    
    /**
     * Get total page views
     */
    public function getPageViews(Application $application, array $dateRange): int
    {
        return FirewallTrafficLog::where('application_id', $application->id)
            ->whereBetween('timestamp', $dateRange)
            ->count();
    }
    
    /**
     * Get bounce rate (estimated)
     */
    public function getBounceRate(Application $application, array $dateRange): float
    {
        $singlePageSessions = FirewallTrafficLog::where('application_id', $application->id)
            ->whereBetween('timestamp', $dateRange)
            ->select('ip_address')
            ->groupBy('ip_address')
            ->having(DB::raw('COUNT(*)'), '=', 1)
            ->count();
        
        $totalSessions = FirewallTrafficLog::where('application_id', $application->id)
            ->whereBetween('timestamp', $dateRange)
            ->distinct('ip_address')
            ->count('ip_address');
        
        return $totalSessions > 0 ? round(($singlePageSessions / $totalSessions) * 100, 1) : 0;
    }
    
    /**
     * Get average session duration (estimated in minutes)
     */
    public function getAvgSessionDuration(Application $application, array $dateRange): string
    {
        // Simplified: average 3-5 minutes per session based on page views per IP
        // Use subquery to calculate average of page counts per IP
        $avgPagesPerSession = DB::table(DB::raw('(
            SELECT ip_address, COUNT(*) as page_count 
            FROM firewall_traffic_logs 
            WHERE application_id = ? 
            AND timestamp BETWEEN ? AND ? 
            GROUP BY ip_address
        ) as subquery'))
            ->selectRaw('AVG(page_count) as avg_pages')
            ->setBindings([$application->id, $dateRange[0], $dateRange[1]])
            ->value('avg_pages');
        
        $minutes = round(($avgPagesPerSession ?? 1) * 1.5); // ~1.5min per page
        
        return $minutes . 'm';
    }
    
    /**
     * Get top pages
     */
    public function getTopPages(Application $application, array $dateRange, int $limit = 10): array
    {
        return FirewallTrafficLog::where('application_id', $application->id)
            ->whereBetween('timestamp', $dateRange)
            ->select('uri', DB::raw('COUNT(*) as views'))
            ->groupBy('uri')
            ->orderByDesc('views')
            ->limit($limit)
            ->get()
            ->map(fn($log) => [
                'path' => $log->uri,
                'views' => $log->views,
                'percentage' => 0, // Will be calculated in component
            ])
            ->toArray();
    }
    
    /**
     * Get top countries
     */
    public function getTopCountries(Application $application, array $dateRange, int $limit = 10): array
    {
        $countries = FirewallTrafficLog::where('application_id', $application->id)
            ->whereBetween('timestamp', $dateRange)
            ->whereNotNull('country_code')
            ->select('country_code', DB::raw('COUNT(*) as visits'))
            ->groupBy('country_code')
            ->orderByDesc('visits')
            ->limit($limit)
            ->get()
            ->toArray();
        
        // Get country names and flags
        $countryData = $this->getCountryData();
        
        return array_map(function($country) use ($countryData) {
            $code = $country['country_code'];
            return [
                'code' => $code,
                'name' => $countryData[$code]['name'] ?? $code,
                'flag' => $countryData[$code]['flag'] ?? '🏴',
                'visits' => $country['visits'],
            ];
        }, $countries);
    }
    
    /**
     * Get traffic sources
     */
    public function getTrafficSources(Application $application, array $dateRange): array
    {
        $sources = FirewallTrafficLog::where('application_id', $application->id)
            ->whereBetween('timestamp', $dateRange)
            ->select('user_agent', DB::raw('COUNT(*) as count'))
            ->groupBy('user_agent')
            ->get();
        
        $categorized = [
            'browser' => 0,
            'mobile' => 0,
            'bot' => 0,
            'other' => 0,
        ];
        
        foreach ($sources as $source) {
            $ua = strtolower($source->user_agent ?? '');
            
            if (str_contains($ua, 'bot') || str_contains($ua, 'crawler') || str_contains($ua, 'spider')) {
                $categorized['bot'] += $source->count;
            } elseif (str_contains($ua, 'mobile') || str_contains($ua, 'android') || str_contains($ua, 'iphone')) {
                $categorized['mobile'] += $source->count;
            } elseif (str_contains($ua, 'mozilla') || str_contains($ua, 'chrome') || str_contains($ua, 'safari')) {
                $categorized['browser'] += $source->count;
            } else {
                $categorized['other'] += $source->count;
            }
        }
        
        return $categorized;
    }
    
    /**
     * Get hourly traffic for the last 24h
     */
    public function getHourlyTraffic(Application $application, array $dateRange): array
    {
        $logs = FirewallTrafficLog::where('application_id', $application->id)
            ->whereBetween('timestamp', $dateRange)
            ->get();
        
        $hourlyData = [];
        for ($i = 23; $i >= 0; $i--) {
            $hour = now()->subHours($i)->format('H:00');
            $hourlyData[$hour] = 0;
        }
        
        foreach ($logs as $log) {
            $hour = $log->timestamp->format('H:00');
            if (isset($hourlyData[$hour])) {
                $hourlyData[$hour]++;
            }
        }
        
        return $hourlyData;
    }
    
    /**
     * Get date range based on period
     */
    private function getDateRange(string $period): array
    {
        return match($period) {
            '1h' => [now()->subHour(), now()],
            '24h' => [now()->subHours(24), now()],
            '7d' => [now()->subDays(7), now()],
            '30d' => [now()->subDays(30), now()],
            default => [now()->subHours(24), now()],
        };
    }
    
    /**
     * Get country data with flags
     */
    private function getCountryData(): array
    {
        return [
            'US' => ['name' => 'United States', 'flag' => '🇺🇸'],
            'GB' => ['name' => 'United Kingdom', 'flag' => '🇬🇧'],
            'FR' => ['name' => 'France', 'flag' => '🇫🇷'],
            'DE' => ['name' => 'Germany', 'flag' => '🇩🇪'],
            'CA' => ['name' => 'Canada', 'flag' => '🇨🇦'],
            'AU' => ['name' => 'Australia', 'flag' => '🇦🇺'],
            'CN' => ['name' => 'China', 'flag' => '🇨🇳'],
            'IN' => ['name' => 'India', 'flag' => '🇮🇳'],
            'JP' => ['name' => 'Japan', 'flag' => '🇯🇵'],
            'BR' => ['name' => 'Brazil', 'flag' => '🇧🇷'],
        ];
    }
}
