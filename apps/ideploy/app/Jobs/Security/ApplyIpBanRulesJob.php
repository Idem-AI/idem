<?php

namespace App\Jobs\Security;

use App\Models\FirewallRule;
use App\Models\FirewallConfig;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ApplyIpBanRulesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public FirewallRule $rule
    ) {}

    public function handle(): void
    {
        ray("🚫 ApplyIpBanRulesJob: Processing IP ban rule: {$this->rule->name}");
        
        // Vérifier que c'est bien une règle ip_ban
        if ($this->rule->protection_mode !== 'ip_ban') {
            ray("Not an ip_ban rule, skipping");
            return;
        }
        
        // Vérifier que la règle est activée
        if (!$this->rule->enabled) {
            ray("Rule is disabled, removing decisions if any");
            $this->removeDecisions();
            return;
        }
        
        // Vérifier que le firewall est activé
        if (!$this->rule->config->enabled) {
            ray("Firewall is disabled, skipping");
            return;
        }
        
        // Extraire les IPs des conditions
        $ips = $this->extractIpsFromConditions();
        
        if (empty($ips)) {
            ray("No IPs found in rule conditions");
            return;
        }
        
        ray("Found IPs to ban: " . implode(', ', $ips));
        
        // Créer les décisions CrowdSec
        $this->createDecisions($ips);
    }
    
    /**
     * Extraire les IPs des conditions de la règle
     */
    private function extractIpsFromConditions(): array
    {
        $conditions = is_string($this->rule->conditions) 
            ? json_decode($this->rule->conditions, true) 
            : $this->rule->conditions;
        
        if (!$conditions) {
            return [];
        }
        
        $ips = [];
        
        // Si c'est un tableau de conditions
        if (isset($conditions['rules'])) {
            foreach ($conditions['rules'] as $condition) {
                if (isset($condition['field']) && in_array($condition['field'], ['ip', 'ip_address', 'source_ip']) && isset($condition['value'])) {
                    $ips[] = $condition['value'];
                }
            }
        }
        // Si c'est une condition simple
        elseif (isset($conditions['field']) && in_array($conditions['field'], ['ip', 'ip_address', 'source_ip']) && isset($conditions['value'])) {
            $ips[] = $conditions['value'];
        }
        // Si c'est un tableau simple de conditions
        else {
            foreach ($conditions as $condition) {
                if (is_array($condition) && isset($condition['field']) && in_array($condition['field'], ['ip', 'ip_address', 'source_ip']) && isset($condition['value'])) {
                    $ips[] = $condition['value'];
                }
            }
        }
        
        return array_unique($ips);
    }
    
    /**
     * Créer les décisions CrowdSec pour les IPs
     */
    private function createDecisions(array $ips): void
    {
        $server = $this->rule->config->application->destination->server;
        
        if (!$server->crowdsec_installed || !$server->crowdsec_available) {
            ray("CrowdSec not available on server");
            return;
        }
        
        $duration = $this->rule->remediation_duration ?? 3600; // Default 1h
        $durationStr = $this->formatDuration($duration);
        $reason = "Firewall rule: {$this->rule->name}";
        
        foreach ($ips as $ip) {
            try {
                // Vérifier si une décision existe déjà
                $checkCmd = "docker exec crowdsec-live cscli decisions list --ip {$ip} 2>/dev/null | grep -q '{$ip}'";
                $exists = false;
                
                try {
                    instant_remote_process([$checkCmd], $server);
                    $exists = true;
                } catch (\Exception $e) {
                    $exists = false;
                }
                
                if ($exists) {
                    ray("Decision already exists for IP: {$ip}, updating...");
                    // Supprimer l'ancienne décision
                    instant_remote_process([
                        "docker exec crowdsec-live cscli decisions delete --ip {$ip}"
                    ], $server);
                }
                
                // Créer la nouvelle décision
                $cmd = "docker exec crowdsec-live cscli decisions add --ip {$ip} --duration {$durationStr} --type ban --reason '{$reason}'";
                
                instant_remote_process([$cmd], $server);
                
                ray("✅ Decision created for IP: {$ip} (duration: {$durationStr})");
                
            } catch (\Exception $e) {
                ray("❌ Failed to create decision for IP {$ip}: " . $e->getMessage());
            }
        }
    }
    
    /**
     * Supprimer les décisions CrowdSec pour cette règle
     */
    private function removeDecisions(): void
    {
        $ips = $this->extractIpsFromConditions();
        
        if (empty($ips)) {
            return;
        }
        
        $server = $this->rule->config->application->destination->server;
        
        foreach ($ips as $ip) {
            try {
                instant_remote_process([
                    "docker exec crowdsec-live cscli decisions delete --ip {$ip}"
                ], $server);
                
                ray("✅ Decision removed for IP: {$ip}");
                
            } catch (\Exception $e) {
                ray("Failed to remove decision for IP {$ip}: " . $e->getMessage());
            }
        }
    }
    
    /**
     * Formater la durée en format CrowdSec (ex: 1h, 30m, 1d)
     */
    private function formatDuration(int $seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds}s";
        }
        
        if ($seconds < 3600) {
            $minutes = floor($seconds / 60);
            return "{$minutes}m";
        }
        
        if ($seconds < 86400) {
            $hours = floor($seconds / 3600);
            return "{$hours}h";
        }
        
        $days = floor($seconds / 86400);
        return "{$days}d";
    }
}
