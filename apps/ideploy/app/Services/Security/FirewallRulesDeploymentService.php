<?php

namespace App\Services\Security;

use App\Jobs\Security\DeployFirewallRulesJob;
use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallRule;

class FirewallRulesDeploymentService
{
    public function __construct(
        private YAMLGeneratorService $yamlGenerator
    ) {}
    
    /**
     * Déployer toutes les règles d'une application
     */
    public function deployRules(FirewallConfig $config): void
    {
        ray("Deploying rules for app: {$config->application->name}");
        
        // Vérifier que le firewall est activé
        if (!$config->enabled) {
            ray("Firewall not enabled, skipping deployment");
            return;
        }
        
        // Vérifier que CrowdSec est disponible
        $server = $config->application->destination->server;
        if (!$server->crowdsec_installed || !$server->crowdsec_available) {
            ray("CrowdSec not available on server, skipping deployment");
            return;
        }
        
        // Dispatcher le job de déploiement
        DeployFirewallRulesJob::dispatch($config)
            ->delay(now()->addSeconds(3)); // Petit delay pour batching
        
        ray("Deployment job dispatched");
    }
    
    /**
     * Déployer une règle spécifique (après création/modification)
     */
    public function deployRule(FirewallRule $rule): void
    {
        // Générer le YAML pour cette règle
        $this->yamlGenerator->generateAndStore($rule);
        
        // Déployer toutes les règles de l'app
        $this->deployRules($rule->config);
    }
    
    /**
     * Supprimer les règles d'une application du serveur
     */
    public function removeRules(Application $application): void
    {
        ray("Removing rules for app: {$application->name}");
        
        $server = $application->destination->server;
        $appDir = "/var/lib/coolify/crowdsec/config/appsec-configs/{$application->uuid}";
        
        try {
            // Supprimer le répertoire des règles
            instant_remote_process([
                "rm -rf {$appDir}"
            ], $server);
            
            // Reload CrowdSec
            instant_remote_process([
                'docker exec crowdsec kill -SIGHUP 1'
            ], $server);
            
            ray("Rules removed successfully");
            
        } catch (\Exception $e) {
            ray("Failed to remove rules: " . $e->getMessage());
        }
    }
    
    /**
     * Vérifier si les règles sont synchronisées sur le serveur
     */
    public function areRulesSynced(FirewallConfig $config): bool
    {
        $server = $config->application->destination->server;
        $appDir = "/var/lib/coolify/crowdsec/config/appsec-configs/{$config->application->uuid}";
        
        try {
            $result = instant_remote_process([
                "test -d {$appDir} && echo 'exists' || echo 'not_found'"
            ], $server);
            
            return str_contains($result, 'exists');
            
        } catch (\Exception $e) {
            return false;
        }
    }
    
    /**
     * Obtenir les statistiques de règles déployées
     */
    public function getDeploymentStats(FirewallConfig $config): array
    {
        $rules = $config->rules()->enabled()->get();
        
        return [
            'total_rules' => $rules->count(),
            'inband_rules' => $rules->where('mode', 'inband')->count(),
            'outofband_rules' => $rules->where('mode', 'outofband')->count(),
            'by_action' => [
                'block' => $rules->where('action', 'block')->count(),
                'log' => $rules->where('action', 'log')->count(),
                'allow' => $rules->where('action', 'allow')->count(),
                'captcha' => $rules->where('action', 'captcha')->count(),
            ],
            'last_deployed' => $config->updated_at,
            'synced' => $this->areRulesSynced($config),
        ];
    }
}
