<?php

namespace App\Jobs\Security;

use App\Models\FirewallConfig;
use App\Services\Security\YAMLGeneratorService;
use App\Services\Security\ScenarioGeneratorService;
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
            
            // 1. Générer les fichiers YAML (AppSec rules)
            $yamlFiles = $this->generateYAMLFiles();
            ray("Generated " . count($yamlFiles) . " YAML files");
            
            // 2. Générer les scenarios (pour geo-blocking, etc.)
            $scenarioFiles = $this->generateScenarioFiles();
            ray("Generated " . count($scenarioFiles) . " scenario files");
            
            // 3. Créer les répertoires sur le serveur
            $appSecConfigDir = "/var/lib/coolify/crowdsec/config/appsec-configs";
            $appSecRulesDir = "/var/lib/coolify/crowdsec/config/appsec-rules";
            $scenarioDir = "/var/lib/coolify/crowdsec/config/scenarios";
            $this->createDirectoryOnServer($server, $appSecConfigDir);
            $this->createDirectoryOnServer($server, $appSecRulesDir);
            $this->createDirectoryOnServer($server, $scenarioDir);
            
            // 4. Upload les fichiers YAML AppSec dans les bons répertoires
            // CrowdSec scanne seulement les fichiers .yaml à la racine, pas les sous-dossiers
            foreach ($yamlFiles as $filename => $content) {
                $prefixedFilename = "{$application->uuid}-{$filename}";
                
                // custom-rules.yaml va dans /appsec-rules/
                // appsec-config.yaml va dans /appsec-configs/
                if (str_contains($filename, 'custom-rules')) {
                    $this->uploadYAMLFile($server, $appSecRulesDir, $prefixedFilename, $content);
                    ray("Uploaded {$prefixedFilename} to appsec-rules/");
                } else {
                    $this->uploadYAMLFile($server, $appSecConfigDir, $prefixedFilename, $content);
                    ray("Uploaded {$prefixedFilename} to appsec-configs/");
                }
            }
            
            // 5. Upload les scenarios
            foreach ($scenarioFiles as $filename => $content) {
                $this->uploadYAMLFile($server, $scenarioDir, "ideploy-{$application->uuid}-{$filename}", $content);
            }
            
            // 6. Mettre à jour acquis.yaml pour inclure AppSec config
            $this->updateAcquisYaml($server, $application);
            
            // 7. Reload CrowdSec pour appliquer les nouvelles règles
            $this->reloadCrowdSec($server);
            
            ray("✅ Firewall rules deployed successfully");
            
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
        $files = [];
        
        // 1. Fichier de config AppSec principal
        $files['appsec-config.yaml'] = $yamlGenerator->generateAppSecConfig($this->config);
        
        // 2. Fichier des règles custom (filtrer les règles qui ne sont pas des scenarios)
        $rules = $this->config->rules()->enabled()->ordered()->get();
        $appSecRules = $rules->reject(function($rule) {
            // Rejeter les règles qui doivent être des scenarios
            foreach ($rule->conditions as $condition) {
                if ($condition['field'] === 'country_code') {
                    return true; // Exclude geo-blocking rules
                }
            }
            return false;
        });
        
        $files['custom-rules.yaml'] = $yamlGenerator->generateCustomRules($appSecRules);
        
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
        instant_remote_process([
            'docker exec crowdsec kill -SIGHUP 1'
        ], $server);
        
        // Attendre que CrowdSec recharge
        sleep(2);
        
        // Vérifier que CrowdSec fonctionne toujours
        $status = instant_remote_process([
            'docker ps --filter name=crowdsec --format "{{.Status}}"'
        ], $server);
        
        if (str_contains($status, 'Up')) {
            ray("✅ CrowdSec reloaded successfully");
        } else {
            ray("⚠️ CrowdSec might have issues after reload");
        }
    }
    
    /**
     * Mettre à jour acquis.yaml pour inclure la config AppSec
     */
    private function updateAcquisYaml($server, $application): void
    {
        ray("Updating acquis.yaml...");
        
        $acquisPath = "/var/lib/coolify/crowdsec/config/acquis.yaml";
        
        // Lire le fichier acquis.yaml existant
        $existingAcquis = instant_remote_process([
            "cat {$acquisPath} 2>/dev/null || echo ''"
        ], $server);
        
        // Parser le YAML multi-document existant
        $documents = [];
        try {
            // Split by --- to handle multi-document YAML
            $parts = preg_split('/^---$/m', $existingAcquis);
            foreach ($parts as $part) {
                $part = trim($part);
                if (!empty($part)) {
                    $parsed = \Symfony\Component\Yaml\Yaml::parse($part);
                    if ($parsed) {
                        $documents[] = $parsed;
                    }
                }
            }
        } catch (\Exception $e) {
            ray("Failed to parse existing acquis.yaml: " . $e->getMessage());
        }
        
        // Assurer qu'on a au moins l'entrée Traefik
        $hasTraefik = false;
        foreach ($documents as $doc) {
            if (isset($doc['labels']['type']) && $doc['labels']['type'] === 'traefik') {
                $hasTraefik = true;
                break;
            }
        }
        
        if (!$hasTraefik) {
            // Ajouter entrée Traefik par défaut
            array_unshift($documents, [
                'filenames' => ['/var/log/traefik/*.log'],
                'labels' => ['type' => 'traefik']
            ]);
        }
        
        // Créer/mettre à jour l'entrée AppSec pour cette app
        // IMPORTANT : Utiliser le NAME du fichier appsec-config (pas le nom de fichier)
        $appSecEntry = [
            'source' => 'appsec',
            'appsec_config' => "ideploy_app_{$application->uuid}",
            'listen_addr' => '0.0.0.0:7422',
            'labels' => [
                'type' => 'appsec',
                'application_id' => (string)$application->id,
                'application_uuid' => $application->uuid,
            ],
        ];
        
        // Chercher et remplacer l'entrée AppSec existante ou ajouter
        $found = false;
        foreach ($documents as $key => $doc) {
            if (isset($doc['labels']['application_uuid']) && 
                $doc['labels']['application_uuid'] === $application->uuid) {
                $documents[$key] = $appSecEntry;
                $found = true;
                ray("Updated existing AppSec entry for {$application->uuid}");
                break;
            }
        }
        
        if (!$found) {
            $documents[] = $appSecEntry;
            ray("Added new AppSec entry for {$application->uuid}");
        }
        
        // Générer le YAML multi-document avec séparateurs ---
        $yamlParts = [];
        foreach ($documents as $doc) {
            $yamlParts[] = \Symfony\Component\Yaml\Yaml::dump($doc, 6, 2);
        }
        $newAcquisYaml = "---\n" . implode("---\n", $yamlParts);
        
        // Sauvegarder localement
        $localPath = "crowdsec-acquis/{$application->uuid}/acquis.yaml";
        Storage::disk('local')->put($localPath, $newAcquisYaml);
        
        ray("Generated acquis.yaml with " . count($documents) . " documents");
        ray($newAcquisYaml);
        
        // Upload sur le serveur
        instant_scp(
            Storage::disk('local')->path($localPath),
            $acquisPath,
            $server
        );
        
        // Cleanup
        Storage::disk('local')->delete($localPath);
        
        ray("✅ acquis.yaml updated with absolute path");
    }
}
