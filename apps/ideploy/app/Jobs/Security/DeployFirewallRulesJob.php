<?php

namespace App\Jobs\Security;

use App\Models\FirewallConfig;
use App\Services\Security\YAMLGeneratorService;
use App\Services\Security\ScenarioGeneratorService;
use App\Services\Security\ParserGeneratorService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class DeployFirewallRulesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes
    public $tries = 1;

    public function __construct(
        public FirewallConfig $config
    ) {}

    public function handle()
    {
        ray("🚀 Deploying firewall rules for app: {$this->config->application->name}");
        
        try {
            $server = $this->config->application->destination->server;
            $application = $this->config->application;
            
            // 0. Configure Traefik logging if not already done (for custom rules via parser)
            if (!$server->traefik_logging_enabled) {
                ray("📝 Configuring Traefik logging...");
                dispatch_sync(new ConfigureTraefikLoggingJob($server));
            }
            
            // 0.1. Deploy raw parser (sets program=traefik from label)
            $this->deployRawParser($server);
            
            // 0.2. Deploy Traefik log parser (for custom rules to work)
            $this->deployParser($server);
            
            // 0.3. Deploy IP enrichment parser (for IP-based scenarios)
            $this->deployIPEnrichmentParser($server);
            
            // 1. Générer les fichiers YAML (AppSec rules)
            $yamlFiles = $this->generateYAMLFiles();
            ray("Generated " . count($yamlFiles) . " YAML files");
            
            // 2. Générer les scenarios (pour geo-blocking, etc.)
            $scenarioFiles = $this->generateScenarioFiles();
            ray("Generated " . count($scenarioFiles) . " scenario files");
            
            // 3. Créer les répertoires sur le serveur
            $appDir = "/var/lib/coolify/crowdsec/config/appsec-configs";
            $scenarioDir = "/var/lib/coolify/crowdsec/config/scenarios";
            $this->createDirectoryOnServer($server, $scenarioDir);
            
            // 4. Upload les fichiers YAML AppSec
            // 4.1 Créer sous-dossiers pour appsec-configs et appsec-rules
            $appSubDir = "{$appDir}/ideploy";
            $appSecRulesDir = "/var/lib/coolify/crowdsec/config/appsec-rules/ideploy";
            $this->createDirectoryOnServer($server, $appSubDir);
            $this->createDirectoryOnServer($server, $appSecRulesDir);
            
            // 4.2 Upload all AppSec files  
            foreach ($yamlFiles as $fn => $content) {
                if ($fn === 'appsec-config.yaml') {
                    $this->uploadYAMLFile($server, $appSubDir, "app-{$application->uuid}.yaml", $content);
                } elseif (str_starts_with($fn, 'custom-appsec-')) {
                    $this->uploadYAMLFile($server, $appSecRulesDir, $fn, $content);
                }
            }
            
            // 5. Nettoyer les anciens scenarios de cette app
            $this->cleanOldScenarios($server, $scenarioDir, $application->uuid);
            
            // 6. Upload les nouveaux scenarios
            foreach ($scenarioFiles as $filename => $content) {
                $this->uploadYAMLFile($server, $scenarioDir, "ideploy-{$application->uuid}-{$filename}", $content);
            }
            
            // 6. Mettre à jour acquis.yaml pour inclure AppSec config
            $this->updateAcquisYaml($server, $application);
            
            // 7. Reload CrowdSec pour appliquer les nouvelles règles
            $this->reloadCrowdSec($server);
            
            // 8. Apply CrowdSec bouncer middleware to Traefik
            dispatch_sync(new ApplyCrowdSecBouncerJob($application));
            
            ray("🎉 Firewall rules deployed successfully!");
            
        } catch (\Exception $e) {
            ray("❌ Failed to deploy firewall rules: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Générer tous les fichiers YAML nécessaires
     */
    private function generateYAMLFiles(): array
    {
        $yamlGenerator = app(YAMLGeneratorService::class);
        $appSecGenerator = app(\App\Services\Security\AppSecRuleGeneratorService::class);
        $files = [];
        
        // 1. Generate AppSec config and rules with new advanced service
        $appSecConfigs = $appSecGenerator->generateAppSecConfig($this->config);
        foreach ($appSecConfigs as $config) {
            $files[$config['filename']] = $config['content'];
        }
        
        // 2. Generate custom AppSec rules 
        $appSecRules = $appSecGenerator->generateAppSecRules($this->config);
        foreach ($appSecRules as $rule) {
            $files[$rule['filename']] = $rule['content'];
        }
        
        // 3. Fallback to legacy generator if no AppSec rules generated
        if (empty($files)) {
            // 3.1. Fichier de config AppSec principal (legacy)
            $files['appsec-config.yaml'] = $yamlGenerator->generateAppSecConfig($this->config, $this->config->application);
            
            // 3.2. Fichier des règles AppSec custom pour path_only et hybrid modes (legacy)
            $rules = $this->config->rules()->enabled()->ordered()->get();
            $appSecRules = $rules->filter(function($rule) {
                return in_array($rule->protection_mode, ['path_only', 'hybrid']);
            });
            
            if ($appSecRules->isNotEmpty()) {
                $files['custom-appsec-rules.yaml'] = $yamlGenerator->generateCustomAppSecRules($appSecRules);
            }
        }
        
        return $files;
    }
    
    /**
     * Générer les fichiers de scenarios
     */
    private function generateScenarioFiles(): array
    {
        $scenarioGenerator = app(ScenarioGeneratorService::class);
        return $scenarioGenerator->generateScenarioFiles($this->config);
    }
    
    /**
     * Créer le répertoire sur le serveur
     */
    private function createDirectoryOnServer($server, string $directory): void
    {
        instant_remote_process([
            "mkdir -p {$directory}",
            "chown -R 1000:1000 {$directory}",
        ], $server);
        
        ray("Directory created: {$directory}");
    }
    
    /**
     * Upload un fichier YAML sur le serveur
     */
    private function uploadYAMLFile($server, string $directory, string $filename, string $content): void
    {
        // Sauvegarder localement temporairement
        $localPath = "crowdsec-rules/{$this->config->application->uuid}/{$filename}";
        Storage::disk('local')->put($localPath, $content);
        
        // Upload via SCP
        instant_scp(
            Storage::disk('local')->path($localPath),
            "{$directory}/{$filename}",
            $server
        );
        
        // Cleanup local
        Storage::disk('local')->delete($localPath);
        
        ray("Uploaded: {$filename}");
    }
    
    /**
     * Reload CrowdSec pour appliquer les nouvelles règles
     */
    private function reloadCrowdSec($server): void
    {
        ray("Reloading CrowdSec...");
        
        // Option 1: SIGHUP (reload config sans restart)
        // Try crowdsec-live first (new naming), fallback to crowdsec (old naming)
        instant_remote_process([
            'docker exec crowdsec-live kill -SIGHUP 1 2>/dev/null || docker exec crowdsec kill -SIGHUP 1'
        ], $server);
        
        // Attendre que CrowdSec recharge
        sleep(2);
        
        // Vérifier que CrowdSec fonctionne toujours
        $status = instant_remote_process([
            'docker ps --filter name=crowdsec-live --format "{{.Status}}" 2>/dev/null || docker ps --filter name=crowdsec --format "{{.Status}}"'
        ], $server);
        
        if (str_contains($status, 'Up')) {
            ray("✅ CrowdSec reloaded successfully");
        } else {
            ray("⚠️ CrowdSec might have issues after reload");
        }
    }
    
    /**
     * Deploy raw parser for Traefik logs
     */
    private function deployRawParser($server): void
    {
        ray("📝 Deploying Traefik raw parser...");
        
        $parserService = app(ParserGeneratorService::class);
        $parserService->deployTraefikRawParser($server);
        
        ray("✅ Raw parser ready");
    }
    
    /**
     * Deploy Traefik log parser for custom rules
     * 
     * Uses official CrowdSec Traefik parser from hub
     */
    private function deployParser($server): void
    {
        ray("📝 Installing official CrowdSec Traefik parser...");
        
        $parserService = app(ParserGeneratorService::class);
        
        // Install official parser collection (battle-tested)
        $parserService->installOfficialTraefikParser($server);
        
        ray("✅ Parser ready");
    }
    
    /**
     * Deploy IP enrichment parser for IP-based scenarios
     */
    private function deployIPEnrichmentParser($server): void
    {
        ray("📝 Deploying IP enrichment parser...");
        
        $parserService = app(ParserGeneratorService::class);
        $parserService->deployIPEnrichmentParser($server);
        
        ray("✅ IP enrichment parser ready");
    }
    
    /**
     * Mettre à jour acquis.yaml pour inclure la config AppSec + Traefik logs
     */
    private function updateAcquisYaml($server, $application): void
    {
        ray("Updating acquis.yaml...");
        
        $parserService = app(ParserGeneratorService::class);
        
        // Get all AppSec configs for this server
        $appSecConfigs = [[
            'name' => "ideploy/app-{$application->uuid}",
            'uuid' => $application->uuid,
        ]];
        
        // TODO: Add other apps on same server if needed
        
        // Generate complete acquis.yaml with Traefik logs + AppSec
        $acquisYaml = $parserService->generateAcquisConfig($appSecConfigs);
        
        ray("Generated acquis.yaml:");
        ray($acquisYaml);
        
        // Upload to server
        $parserService->uploadAcquisConfig($server, $acquisYaml);
        
        ray("✅ acquis.yaml updated with Traefik logs + AppSec config");
    }
    
    /**
     * Nettoyer les anciens scenarios de cette application
     */
    private function cleanOldScenarios($server, string $scenarioDir, string $appUuid): void
    {
        ray("Cleaning old scenarios for app: {$appUuid}");
        
        // Supprimer tous les fichiers ideploy-{uuid}-*.yaml
        $command = "rm -f {$scenarioDir}/ideploy-{$appUuid}-*.yaml";
        
        instant_remote_process([$command], $server, false);
        
        ray("✅ Old scenarios cleaned");
    }
}
