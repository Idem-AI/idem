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
        
        // Déployer les règles YAML sur CrowdSec
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
     * Ensure CrowdSec middlewares are applied to the application's Traefik routes
     * This handles the case where the app was deployed before firewall activation
     * 
     * SOLUTION: Trigger automatic redeployment to regenerate labels with firewall middlewares
     */
    private function ensureMiddlewaresApplied(FirewallRule $rule): void
    {
        $application = $rule->config->application;
        
        // Check if firewall middlewares are already in labels
        if ($this->hasFirewallMiddlewares($application)) {
            ray("Firewall middlewares already present, skipping");
            return;
        }
        
        ray("⚠️ Firewall middlewares missing, triggering automatic redeployment");
        
        // Trigger automatic redeployment to apply firewall labels
        // This will call generateLabelsApplication() which includes CrowdSec labels
        $deploymentUuid = new \Visus\Cuid2\Cuid2();
        
        queue_application_deployment(
            application: $application,
            deployment_uuid: $deploymentUuid->toString(),
            force_rebuild: false
        );
        
        ray("✅ Automatic redeployment dispatched: {$deploymentUuid}");
    }
    
    /**
     * Check if application labels contain firewall middlewares
     */
    private function hasFirewallMiddlewares(\App\Models\Application $application): bool
    {
        $labels = $application->custom_labels ?? '';
        
        // Decode base64 if needed (single or double encoding)
        $decodedLabels = $labels;
        if (base64_decode($labels, true) !== false && 
            base64_encode(base64_decode($labels)) === $labels) {
            $decodedLabels = base64_decode($labels);
            
            // Check for double encoding
            if (base64_decode($decodedLabels, true) !== false && 
                base64_encode(base64_decode($decodedLabels)) === $decodedLabels) {
                $decodedLabels = base64_decode($decodedLabels);
            }
        }
        
        // Check if crowdsec middleware is present
        return str_contains($decodedLabels, "crowdsec-{$application->uuid}") ||
               str_contains($decodedLabels, "middlewares.crowdsec-");
    }
}
