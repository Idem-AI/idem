<?php

namespace App\Observers;

use App\Models\FirewallRule;
use App\Jobs\ReloadTraefikBouncerJob;
use App\Services\Security\FirewallRulesDeploymentService;

class FirewallRuleObserver
{
    /**
     * Handle the FirewallRule "saved" event.
     */
    public function saved(FirewallRule $rule): void
    {
        ray("🔥 FirewallRuleObserver::saved triggered for rule: {$rule->name}");
        
        // Only deploy if firewall is enabled
        if (!$rule->config->enabled) {
            ray("Rule saved but firewall disabled, skipping deployment");
            return;
        }
        
        ray("FirewallRule saved, deploying rules: {$rule->name}");
        
        // Handle IP ban rules differently - create CrowdSec decisions directly
        if ($rule->protection_mode === 'ip_ban') {
            ray("IP ban rule detected, creating CrowdSec decisions");
            \App\Jobs\Security\ApplyIpBanRulesJob::dispatch($rule)
                ->delay(now()->addSeconds(1));
            return;
        }
        
        // Déployer les règles YAML sur CrowdSec (for inband/outofband rules)
        app(FirewallRulesDeploymentService::class)->deployRule($rule);
        
        // CRITICAL: Ensure middlewares are applied to Traefik
        // This is needed if the app was deployed BEFORE firewall activation
        // or if this is the first rule being created
        $this->ensureMiddlewaresApplied($rule);
        
        // NOTE: Bouncer will auto-sync within 5s (UpdateIntervalSeconds=5)
        // For faster blocking, force refresh bouncer cache
        
        ray("Rule deployment dispatched - bouncer will sync automatically (5s)");
        
        // Force bouncer cache refresh for immediate blocking
        \App\Jobs\ReloadTraefikBouncerJob::dispatch($rule->config->application->destination->server, false)
            ->delay(now()->addSeconds(2));
    }
    
    /**
     * Handle the FirewallRule "deleted" event.
     */
    public function deleted(FirewallRule $rule): void
    {
        // Only deploy if firewall is enabled
        if (!$rule->config->enabled) {
            ray("Rule deleted but firewall disabled, skipping deployment");
            return;
        }
        
        ray("FirewallRule deleted, redeploying rules: {$rule->name}");
        
        // Redéployer toutes les règles (sans celle qui est supprimée)
        app(FirewallRulesDeploymentService::class)->deployRules($rule->config);
        
        ray("Rules redeployment dispatched");
    }
    
    /**
     * Ensure application is redeployed to:
     * 1. Apply CrowdSec middlewares to Traefik labels (if first rule)
     * 2. Upload updated YAML rules to CrowdSec (always)
     * 
     * CRITICAL: We must ALWAYS redeploy when rules change to upload new YAML
     */
    private function ensureMiddlewaresApplied(FirewallRule $rule): void
    {
        $application = $rule->config->application;
        
        ray("🔄 Triggering automatic redeployment to apply new firewall rule");
        
        // ALWAYS trigger redeployment to:
        // 1. Ensure Traefik middlewares are applied
        // 2. Upload new YAML rules to CrowdSec container
        $deploymentUuid = new \Visus\Cuid2\Cuid2();
        
        queue_application_deployment(
            application: $application,
            deployment_uuid: $deploymentUuid->toString(),
            force_rebuild: false
        );
        
        ray("✅ Automatic redeployment dispatched: {$deploymentUuid}");
    }
}
