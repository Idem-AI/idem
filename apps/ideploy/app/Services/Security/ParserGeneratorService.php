<?php

namespace App\Services\Security;

use Symfony\Component\Yaml\Yaml;

/**
 * Generate CrowdSec parser and scenarios for Traefik JSON logs
 * 
 * This service creates:
 * 1. Parser that reads Traefik JSON access logs
 * 2. Scenarios that filter events by app_uuid (isolation)
 * 3. Custom rules per application
 */
class ParserGeneratorService
{
    /**
     * Generate Traefik JSON parser YAML
     * 
     * This parser reads Traefik access.log (JSON format) and creates
     * events with evt.Parsed fields that scenarios can filter on
     */
    public function generateTraefikParser(): string
    {
        $parser = [
            'onsuccess' => 'next_stage',
            'name' => 'ideploy/traefik-json',
            'description' => 'Parse Traefik JSON access logs for custom firewall rules',
            'filter' => 'evt.Line.Labels.type == "traefik-json"',
            'nodes' => [
                // Parse JSON log line
                [
                    'grok' => [
                        'pattern' => '%{GREEDYDATA:json_data}',
                        'apply_on' => 'message',
                    ],
                ],
                
                // Decode JSON
                [
                    'grok' => [
                        'pattern' => '^%{DATA:json}$',
                        'apply_on' => 'json_data',
                    ],
                ],
            ],
            'statics' => [
                // Extract source IP (remove port)
                [
                    'meta' => 'source_ip',
                    'expression' => 'JsonExtract(evt.Parsed.json_data, "ClientAddr") != "" ? JsonExtract(evt.Parsed.json_data, "ClientAddr").Split(":")[0] : ""',
                ],
                
                // HTTP Method
                [
                    'parsed' => 'method',
                    'expression' => 'JsonExtract(evt.Parsed.json_data, "RequestMethod")',
                ],
                
                // Request Path
                [
                    'parsed' => 'request_path',
                    'expression' => 'JsonExtract(evt.Parsed.json_data, "RequestPath")',
                ],
                
                // User-Agent
                [
                    'parsed' => 'http_user_agent',
                    'expression' => 'JsonExtractSlice(evt.Parsed.json_data, "RequestHeader.User-Agent")[0] ?? ""',
                ],
                
                // Host
                [
                    'parsed' => 'http_host',
                    'expression' => 'JsonExtract(evt.Parsed.json_data, "RequestHost")',
                ],
                
                // HTTP Status
                [
                    'parsed' => 'http_status',
                    'expression' => 'JsonExtract(evt.Parsed.json_data, "DownstreamStatus")',
                ],
                
                // Referer
                [
                    'parsed' => 'http_referer',
                    'expression' => 'JsonExtractSlice(evt.Parsed.json_data, "RequestHeader.Referer")[0] ?? ""',
                ],
                
                // Protocol
                [
                    'parsed' => 'http_version',
                    'expression' => 'JsonExtract(evt.Parsed.json_data, "RequestProtocol")',
                ],
                
                // Set program name
                [
                    'target' => 'evt.Parsed.program',
                    'value' => 'traefik',
                ],
                
                // Timestamp
                [
                    'target' => 'evt.StrTime',
                    'expression' => 'JsonExtract(evt.Parsed.json_data, "StartUTC")',
                ],
            ],
        ];
        
        return Yaml::dump($parser, 10, 2, Yaml::DUMP_MULTI_LINE_LITERAL_BLOCK);
    }
    
    /**
     * Generate acquis.yaml configuration with Traefik log source
     */
    public function generateAcquisConfig(array $appSecConfigs = []): string
    {
        $sources = [];
        
        // Traefik logs source (uses official CrowdSec parser)
        $sources[] = [
            'source' => 'file',
            'filenames' => ['/traefik/access.log'],  // Correct path in CrowdSec container
            'labels' => [
                'type' => 'traefik',  // Official parser expects this label
            ],
        ];
        
        // AppSec sources (one per application)
        foreach ($appSecConfigs as $config) {
            $sources[] = [
                'source' => 'appsec',
                'listen_addr' => '0.0.0.0:7422',
                'appsec_config' => $config['name'],
                'labels' => [
                    'type' => 'appsec',
                    'application_uuid' => $config['uuid'],
                ],
            ];
        }
        
        // Generate YAML with separator between sources
        $yaml = '';
        foreach ($sources as $source) {
            $yaml .= "---\n";
            $yaml .= Yaml::dump($source, 6, 2);
            $yaml .= "\n";
        }
        
        return $yaml;
    }
    
    /**
     * Install official CrowdSec Traefik parser
     * 
     * Instead of creating a custom parser, we use the official one
     * from CrowdSec hub which is battle-tested and maintained
     */
    public function installOfficialTraefikParser(\App\Models\Server $server): void
    {
        ray("Installing official CrowdSec Traefik parser...");
        
        try {
            // Install Traefik collection (includes parser + scenarios)
            $output = instant_remote_process([
                'docker exec crowdsec-live cscli collections install crowdsecurity/traefik -o raw 2>&1 || echo "INSTALL_FAILED"',
            ], $server);
            
            if (str_contains($output, 'INSTALL_FAILED')) {
                ray("⚠️ Collection might already be installed or install failed, continuing...");
            } else {
                ray("✅ Traefik collection installed");
            }
            
            // Reload CrowdSec to apply
            instant_remote_process([
                'docker exec crowdsec-live kill -SIGHUP 1',
            ], $server);
            
            sleep(3);
            
            ray("✅ Official Traefik parser ready");
            
        } catch (\Exception $e) {
            ray("⚠️ Parser installation issue (might already exist): " . $e->getMessage());
            // Continue anyway, parser might already be installed
        }
    }
    
    /**
     * Upload acquis.yaml to server
     */
    public function uploadAcquisConfig(\App\Models\Server $server, string $yaml): void
    {
        ray("Uploading acquis.yaml to server: {$server->name}");
        
        // Write locally
        $tempFile = storage_path("app/acquis-{$server->id}.yaml");
        file_put_contents($tempFile, $yaml);
        
        // Upload to server
        instant_scp(
            $tempFile,
            '/var/lib/coolify/crowdsec/config/acquis.yaml',
            $server
        );
        
        // Cleanup
        @unlink($tempFile);
        
        ray("✅ Acquis config uploaded successfully");
    }
    
    /**
     * Deploy raw parser for Traefik logs
     * This parser sets program=traefik based on the label type=traefik from acquis.yaml
     */
    public function deployTraefikRawParser(\App\Models\Server $server): void
    {
        ray("Deploying Traefik raw parser...");
        
        $parserYaml = <<<'YAML'
name: ideploy/traefik-raw
description: Prepare raw JSON for traefik-logs parser
filter: "evt.Line.Labels.type == 'traefik'"
onsuccess: next_stage
nodes:
  - grok:
      pattern: "%{GREEDYDATA:message}"
      apply_on: Line.Raw
statics:
  - parsed: program
    value: traefik
YAML;
        
        // Write locally
        $tempFile = storage_path("app/ideploy-traefik-raw-{$server->id}.yaml");
        file_put_contents($tempFile, $parserYaml);
        
        // Upload to server
        instant_scp(
            $tempFile,
            '/var/lib/coolify/crowdsec/config/parsers/s00-raw/ideploy-traefik-raw.yaml',
            $server
        );
        
        ray("✅ Traefik raw parser deployed");
    }
    
    /**
     * Deploy IP enrichment parser for Traefik logs
     * This parser copies remote_addr to source_ip meta for scenarios to work
     */
    public function deployIPEnrichmentParser(\App\Models\Server $server): void
    {
        ray("Deploying IP enrichment parser...");
        
        $parserYaml = <<<'YAML'
name: ideploy/ip-enrich
description: "Enrich Traefik logs with source_ip meta for scenarios"
filter: "evt.Parsed.program == 'traefik'"
onsuccess: next_stage
statics:
  - meta: source_ip
    expression: "evt.Parsed.remote_addr"
  - meta: http_host
    expression: "evt.Parsed.request_addr"
  - meta: traefik_router_name
    expression: "evt.Parsed.traefik_router_name"
YAML;
        
        // Write locally
        $tempFile = storage_path("app/ideploy-ip-enrich-{$server->id}.yaml");
        file_put_contents($tempFile, $parserYaml);
        
        // Upload to server
        instant_scp(
            $tempFile,
            '/var/lib/coolify/crowdsec/config/parsers/s02-enrich/ideploy-ip-enrich.yaml',
            $server
        );
        
        ray("✅ IP enrichment parser deployed");
    }
    
    /**
     * Test parser with sample log
     */
    public function testParser(\App\Models\Server $server): array
    {
        ray("Testing parser with sample log...");
        
        // Sample Traefik JSON log
        $sampleLog = json_encode([
            'ClientAddr' => '203.0.113.42:52345',
            'RequestMethod' => 'GET',
            'RequestPath' => '/api/test',
            'RequestProtocol' => 'HTTP/1.1',
            'RequestHost' => 'app.example.com',
            'RequestHeader' => [
                'User-Agent' => ['Mozilla/5.0'],
                'Referer' => ['https://google.com'],
            ],
            'DownstreamStatus' => 200,
            'StartUTC' => date('c'),
        ]);
        
        // Test parser
        $output = instant_remote_process([
            "echo '{$sampleLog}' | docker exec -i crowdsec-live cscli parsers test ideploy/traefik-json --type traefik-json || echo 'PARSER_TEST_FAILED'",
        ], $server);
        
        $success = !str_contains($output, 'PARSER_TEST_FAILED');
        
        return [
            'success' => $success,
            'output' => $output,
        ];
    }
    
    /**
     * Génère un scenario CrowdSec pour une règle firewall
     * ISOLATION PAR APP: Le scenario filtre par app_uuid
     */
    public function generateScenario(
        string $appUuid,
        string $ruleName,
        array $conditions,
        string $action,
        ?int $ruleId = null
    ): string {
        $filters = $this->buildFilters($appUuid, $conditions);
        $remediation = $this->mapActionToRemediation($action);
        
        // Include rule ID in scenario name to guarantee uniqueness
        $sanitizedName = str_replace(' ', '-', strtolower($ruleName));
        $scenarioName = $ruleId 
            ? "ideploy/{$appUuid}/{$sanitizedName}-{$ruleId}"
            : "ideploy/{$appUuid}/{$sanitizedName}";
        
        $scenario = [
            'type' => 'leaky',
            'name' => $scenarioName,
            'description' => "Firewall rule: {$ruleName} for app {$appUuid}",
            'filter' => $filters,
            'groupby' => 'evt.Meta.source_ip',
            'capacity' => 1,  // 1 = ban on first match
            'leakspeed' => '10s',
            'blackhole' => '4h',
            'labels' => [
                'service' => 'http',
                'type' => 'firewall_rule',
                'app_uuid' => $appUuid,
                'remediation' => true,  // Required for profile to create decision
            ],
        ];
        
        return Yaml::dump($scenario, 10, 2);
    }
    
    /**
     * Construit les filtres pour le scenario
     * CRITIQUE: Filtre par app_uuid pour isolation
     */
    private function buildFilters(string $appUuid, array $conditions): string
    {
        // FILTRE PRINCIPAL: app_uuid (ISOLATION)
        // On utilise le RouterName OU RequestHost qui contient l'app UUID
        $filters = ["evt.Parsed.program == 'traefik'"];
        $filters[] = "(evt.Meta.traefik_router_name contains '{$appUuid}' || evt.Meta.http_host contains '{$appUuid}')";
        
        foreach ($conditions as $condition) {
            $field = $condition['field'];
            $operator = $condition['operator'];
            $value = $condition['value'];
            
            $filter = match($field) {
                'uri', 'request_path' => $this->buildUriFilter($operator, $value),
                'method' => "evt.Parsed.verb == '{$value}'",
                'user_agent' => $this->buildUserAgentFilter($operator, $value),
                'ip', 'ip_address' => "evt.Meta.source_ip == '{$value}'",
                'country', 'country_code' => "evt.Enriched.IsoCode == '{$value}'",
                'host' => "evt.Meta.target_fqdn == '{$value}'",
                default => null
            };
            
            if ($filter) {
                $filters[] = $filter;
            }
        }
        
        return implode(' && ', $filters);
    }
    
    /**
     * Construit filtre URI
     */
    private function buildUriFilter(string $operator, string $value): string
    {
        return match($operator) {
            'equals' => "evt.Parsed.request == '{$value}'",
            'starts_with' => "evt.Parsed.request startsWith '{$value}'",
            'contains' => "evt.Parsed.request contains '{$value}'",
            'regex' => "evt.Parsed.request matches '{$value}'",
            default => "evt.Parsed.request == '{$value}'"
        };
    }
    
    /**
     * Construit filtre User-Agent
     */
    private function buildUserAgentFilter(string $operator, string $value): string
    {
        return match($operator) {
            'equals' => "evt.Parsed.http_user_agent == '{$value}'",
            'contains' => "evt.Parsed.http_user_agent contains '{$value}'",
            'regex' => "evt.Parsed.http_user_agent matches '{$value}'",
            default => "evt.Parsed.http_user_agent contains '{$value}'"
        };
    }
    
    /**
     * Map action vers remediation CrowdSec
     */
    private function mapActionToRemediation(string $action): string
    {
        return match($action) {
            'block' => 'ban',
            'captcha' => 'captcha',
            'log' => 'log',
            default => 'ban'
        };
    }
}
