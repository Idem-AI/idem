<?php

namespace App\Jobs\Security;

use App\Models\Application;
use App\Models\FirewallAlert;
use App\Models\Server;
use App\Services\Security\CrowdSecApiClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncCrowdSecAlertsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 120;

    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Get all servers with CrowdSec installed
            $servers = Server::where('crowdsec_installed', true)
                ->where('crowdsec_available', true)
                ->get();

            foreach ($servers as $server) {
                $this->syncServerAlerts($server);
            }

            ray('✅ CrowdSec alerts synced for ' . $servers->count() . ' servers');

        } catch (\Exception $e) {
            Log::error('SyncCrowdSecAlertsJob failed: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Sync alerts for a specific server
     */
    private function syncServerAlerts(Server $server): void
    {
        try {
            // Get CrowdSec API client
            $client = new CrowdSecApiClient($server);

            // Fetch recent alerts (last 24h)
            $alerts = $client->getAlerts();

            if (empty($alerts)) {
                ray("No alerts for server {$server->name}");
                return;
            }

            ray("Processing " . count($alerts) . " alerts for server {$server->name}");

            foreach ($alerts as $alert) {
                $this->processAlert($alert, $server);
            }

        } catch (\Exception $e) {
            ray("Failed to sync alerts for server {$server->name}: " . $e->getMessage());
            Log::warning("Failed to sync alerts for server {$server->name}", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Process a single alert
     */
    private function processAlert(array $alert, Server $server): void
    {
        // Extract alert data
        $sourceIp = $alert['source']['ip'] ?? null;
        $scenario = $alert['scenario'] ?? 'unknown';
        $decisions = $alert['decisions'] ?? [];

        if (!$sourceIp) {
            return;
        }

        // Try to find the application based on IP or other metadata
        $application = $this->findApplicationForAlert($alert, $server);

        if (!$application || !$application->firewallConfig) {
            ray("No application found for alert from IP {$sourceIp}");
            return;
        }

        // Check if alert already exists
        $exists = FirewallAlert::where('application_id', $application->id)
            ->where('ip_address', $sourceIp)
            ->where('scenario_name', $scenario)
            ->where('status', 'active')
            ->where('created_at', '>', now()->subHour())
            ->exists();

        if ($exists) {
            return; // Don't create duplicate
        }

        // Determine alert type and severity
        $alertType = $this->mapScenarioToType($scenario);
        $severity = $this->mapDecisionsToSeverity($decisions);

        // Create alert
        FirewallAlert::create([
            'application_id' => $application->id,
            'alert_type' => $alertType,
            'severity' => $severity,
            'ip_address' => $sourceIp,
            'message' => $this->generateAlertMessage($alert),
            'scenario_name' => $scenario,
            'metadata' => json_encode($alert),
            'status' => 'active',
        ]);

        ray("✅ Alert created for application {$application->name}: {$alertType} from {$sourceIp}");
    }

    /**
     * Find application for an alert
     */
    private function findApplicationForAlert(array $alert, Server $server): ?Application
    {
        // Try to find by application UUID in alert metadata
        $appId = $alert['meta']['ideploy.application_id'] ?? null;
        if ($appId) {
            $app = Application::find($appId);
            if ($app) {
                return $app;
            }
        }

        // Fallback: Get first application with firewall enabled on this server
        $application = Application::whereHas('destination', function ($query) use ($server) {
            $query->where('server_id', $server->id);
        })
            ->whereHas('firewallConfig', function ($query) {
                $query->where('enabled', true);
            })
            ->first();

        return $application;
    }

    /**
     * Map CrowdSec scenario to alert type
     */
    private function mapScenarioToType(string $scenario): string
    {
        if (str_contains($scenario, 'sql-injection') || str_contains($scenario, 'sqli')) {
            return 'sql_injection';
        }

        if (str_contains($scenario, 'xss') || str_contains($scenario, 'cross-site')) {
            return 'xss_attack';
        }

        if (str_contains($scenario, 'scan') || str_contains($scenario, 'probe')) {
            return 'port_scan';
        }

        if (str_contains($scenario, 'brute') || str_contains($scenario, 'password')) {
            return 'brute_force';
        }

        if (str_contains($scenario, 'path-traversal') || str_contains($scenario, 'directory')) {
            return 'path_traversal';
        }

        if (str_contains($scenario, 'rce') || str_contains($scenario, 'remote-code')) {
            return 'remote_code_execution';
        }

        if (str_contains($scenario, 'bot') || str_contains($scenario, 'crawler')) {
            return 'suspicious_bot';
        }

        if (str_contains($scenario, 'rate') || str_contains($scenario, 'flood')) {
            return 'rate_limit_exceeded';
        }

        return 'suspicious_activity';
    }

    /**
     * Map decisions to severity level
     */
    private function mapDecisionsToSeverity(array $decisions): string
    {
        if (empty($decisions)) {
            return 'low';
        }

        foreach ($decisions as $decision) {
            $type = $decision['type'] ?? '';
            $duration = $decision['duration'] ?? '';

            // Ban = high severity
            if ($type === 'ban') {
                // Long ban = critical
                if (str_contains($duration, 'h') && intval($duration) >= 24) {
                    return 'critical';
                }
                return 'high';
            }

            // Captcha = medium
            if ($type === 'captcha') {
                return 'medium';
            }
        }

        return 'low';
    }

    /**
     * Generate human-readable alert message
     */
    private function generateAlertMessage(array $alert): string
    {
        $sourceIp = $alert['source']['ip'] ?? 'unknown';
        $scenario = $alert['scenario'] ?? 'unknown';
        $decisionsCount = count($alert['decisions'] ?? []);

        $message = "Suspicious activity detected from IP {$sourceIp}";

        if ($scenario !== 'unknown') {
            $message .= " ({$scenario})";
        }

        if ($decisionsCount > 0) {
            $message .= ". {$decisionsCount} decision(s) applied.";
        }

        return $message;
    }

    /**
     * Handle failed job
     */
    public function failed(\Throwable $exception): void
    {
        ray("SyncCrowdSecAlertsJob failed: {$exception->getMessage()}");

        Log::error('SyncCrowdSecAlertsJob failed', [
            'exception' => get_class($exception),
            'message' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
