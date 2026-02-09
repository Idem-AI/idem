<?php

namespace App\Jobs\Security;

use App\Models\FirewallRule;
use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Process;

class RemoveIpBanDecisionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120;
    public $tries = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public FirewallRule $rule,
        public Server $server
    ) {
    }

    /**
     * Execute the job.
     * 
     * Removes CrowdSec decisions for IPs specified in the deleted rule
     */
    public function handle(): void
    {
        ray("🗑️ RemoveIpBanDecisionsJob: Removing decisions for rule {$this->rule->name}");
        
        // Only process ip_ban rules
        if ($this->rule->protection_mode !== 'ip_ban') {
            ray("Rule is not ip_ban, skipping decision removal");
            return;
        }
        
        // Extract IPs from conditions
        $ips = $this->extractIpsFromConditions($this->rule->conditions);
        
        if (empty($ips)) {
            ray("No IPs found in rule conditions");
            return;
        }
        
        ray("Found IPs to remove: " . implode(', ', $ips));
        
        // Remove decisions for each IP
        foreach ($ips as $ip) {
            $this->removeDecisionForIp($ip);
        }
        
        ray("✅ Decisions removed for " . count($ips) . " IPs");
    }
    
    /**
     * Extract IP addresses from rule conditions
     */
    private function extractIpsFromConditions($conditions): array
    {
        $ips = [];
        
        // Ensure conditions are array
        if (is_string($conditions)) {
            $conditions = json_decode($conditions, true) ?? [];
        }
        
        // Handle single condition object vs array of conditions
        if (isset($conditions['field']) && isset($conditions['operator'])) {
            $conditions = [$conditions];
        }
        
        // Extract IPs from conditions
        foreach ($conditions as $condition) {
            if (empty($condition) || !is_array($condition)) {
                continue;
            }
            
            $field = $condition['field'] ?? '';
            $value = $condition['value'] ?? '';
            
            // Check if this is an IP field
            if (in_array($field, ['ip', 'ip_address', 'source_ip']) && !empty($value)) {
                // Validate IP address
                if (filter_var($value, FILTER_VALIDATE_IP)) {
                    $ips[] = $value;
                }
            }
        }
        
        return array_unique($ips);
    }
    
    /**
     * Remove CrowdSec decision for a specific IP
     */
    private function removeDecisionForIp(string $ip): void
    {
        try {
            ray("Removing decision for IP: {$ip}");
            
            // Build SSH command to remove decision
            $command = "docker exec crowdsec-live cscli decisions delete --ip {$ip}";
            
            $result = Process::timeout(30)->run(
                "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@{$this->server->ip} \"{$command}\""
            );
            
            if ($result->successful()) {
                ray("✅ Decision removed for IP {$ip}");
                ray("Output: " . $result->output());
            } else {
                ray("⚠️ Failed to remove decision for IP {$ip}");
                ray("Error: " . $result->errorOutput());
            }
            
        } catch (\Exception $e) {
            ray("❌ Exception removing decision for IP {$ip}: " . $e->getMessage());
            // Don't throw - continue with other IPs
        }
    }
    
    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        ray("❌ RemoveIpBanDecisionsJob failed: " . $exception->getMessage());
    }
}
