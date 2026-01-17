<?php

namespace App\Services\Security;

use App\Models\FirewallAlert;
use App\Models\Server;

class AlertMonitorService
{
    public function syncAlerts(Server $server): int
    {
        $command = "docker exec crowdsec-live cscli alerts list -o json --limit 50";
        $output = instant_remote_process([$command], $server, false);
        
        $alerts = json_decode($output, true) ?: [];
        $synced = 0;
        
        foreach ($alerts as $alert) {
            if ($this->storeAlert($alert)) {
                $synced++;
            }
        }
        
        return $synced;
    }
    
    private function storeAlert(array $alert): bool
    {
        $scenario = $alert['scenario'] ?? '';
        if (!str_starts_with($scenario, 'ideploy/')) return false;
        
        $appUuid = explode('/', $scenario)[1] ?? null;
        if (!$appUuid) return false;
        
        FirewallAlert::updateOrCreate(
            ['alert_id' => $alert['id']],
            [
                'app_uuid' => $appUuid,
                'ip_address' => $alert['source']['ip'] ?? 'unknown',
                'scenario' => $scenario,
                'severity' => $this->getSeverity($alert),
                'decisions_count' => count($alert['decisions'] ?? []),
                'created_at' => $alert['created_at'] ?? now(),
            ]
        );
        
        return true;
    }
    
    private function getSeverity(array $alert): string
    {
        $decisions = $alert['decisions'] ?? [];
        foreach ($decisions as $decision) {
            if (($decision['type'] ?? '') === 'ban') return 'high';
        }
        return 'medium';
    }
}
