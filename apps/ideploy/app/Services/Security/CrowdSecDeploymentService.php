<?php

namespace App\Services\Security;

use App\Models\Server;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Yaml\Yaml;

class CrowdSecDeploymentService
{
    /**
     * Deploy CrowdSec to a server with full DevOps approach
     */
    public function deployToServer(Server $server): array
    {
        $config = config('crowdsec');
        $installConfig = $config['installation'];

        ray("🚀 Starting CrowdSec deployment to {$server->name}");

        try {
            // 1. Pre-validation
            $this->validateServerRequirements($server);

            // 2. Create directory structure
            $this->createDirectoryStructure($server);

            // 3. Generate and deploy Docker Compose
            $this->deployDockerCompose($server);

            // 4. Start CrowdSec container
            $this->startCrowdSecContainer($server);

            // 5. Wait for startup
            sleep($installConfig['startup_wait']);

            // 6. Generate bouncer API key
            $apiKey = $this->generateBouncerKey($server);

            // 7. Configure Traefik bouncer
            $this->configureTraefikBouncer($server, $apiKey);

            // 7.5. Configure AppSec
            $this->configureAppSec($server);

            // 8. Post-installation validation
            if ($installConfig['validate_installation']) {
                $this->validateInstallation($server);
            }

            // 9. Update server metadata
            $server->update([
                'crowdsec_installed' => true,
                'crowdsec_available' => true,
                'crowdsec_lapi_url' => $config['lapi_url'],
                'crowdsec_api_key' => encrypt($apiKey),
            ]);

            ray("✅ CrowdSec deployment completed successfully on {$server->name}");

            return [
                'success' => true,
                'api_key' => $apiKey,
                'message' => 'CrowdSec deployed successfully'
            ];

        } catch (\Exception $e) {
            ray("❌ CrowdSec deployment failed: {$e->getMessage()}");

            // Mark as failed
            $server->update([
                'crowdsec_installed' => false,
                'crowdsec_available' => false,
            ]);

            throw $e;
        }
    }

    /**
     * Validate server requirements before installation
     */
    private function validateServerRequirements(Server $server): void
    {
        ray("🔍 Validating server requirements for {$server->name}");

        // Check Docker is available
        $dockerCheck = instant_remote_process(['docker --version'], $server);
        if (!str_contains(strtolower($dockerCheck), 'docker version')) {
            throw new \Exception('Docker is not available on this server');
        }

        // Check ideploy network exists
        $networkCheck = instant_remote_process(['docker network ls | grep ideploy'], $server);
        if (!str_contains($networkCheck, 'ideploy')) {
            throw new \Exception('Ideploy Docker network not found');
        }

        // Check port availability
        $portConfig = config('crowdsec.docker.lapi_port');
        $portCheck = instant_remote_process(["netstat -tuln | grep :$portConfig || echo 'PORT_FREE'"], $server);
        if (!str_contains($portCheck, 'PORT_FREE')) {
            throw new \Exception("Port $portConfig is already in use");
        }

        ray("✅ Server requirements validated");
    }

    /**
     * Create directory structure
     */
    private function createDirectoryStructure(Server $server): void
    {
        $basePath = config('crowdsec.docker.config_path');

        ray("📁 Creating directory structure at {$basePath}");

        instant_remote_process([
            "mkdir -p {$basePath}/{config,data}",
            "mkdir -p {$basePath}/config/{appsec-configs,appsec-rules,scenarios,parsers}",
            "chown -R 1000:1000 {$basePath}",
            "chmod -R 755 {$basePath}",
        ], $server);

        ray("✅ Directory structure created");
    }

    /**
     * Generate and deploy Docker Compose file
     */
    private function deployDockerCompose(Server $server): void
    {
        $config = config('crowdsec.docker');

        // Generate Docker Compose with configuration
        $compose = [
            'version' => '3.8',
            'services' => [
                $config['container_name'] => [
                    'image' => $config['image'],
                    'container_name' => $config['container_name'],
                    'restart' => 'always',
                    'environment' => [
                        'COLLECTIONS' => implode(' ', $config['collections']),
                        'APPSEC_ENABLED' => 'true', // Enable AppSec
                        ...$config['environment'],
                    ],
                    'volumes' => [
                        './config:/etc/crowdsec',
                        './data:/var/lib/crowdsec/data',
                        '/var/log:/var/log:ro',
                    ],
                    'ports' => [
                        "0.0.0.0:{$config['lapi_port']}:8080", // LAPI
                        "0.0.0.0:7422:7422", // AppSec port
                    ],
                    'networks' => [$config['network']],
                    'command' => ['crowdsec', '-no-api'],
                    'labels' => [
                        'ideploy.managed' => 'true',
                    ],
                ],
            ],
            'networks' => [
                $config['network'] => [
                    'external' => true,
                ],
            ],
        ];

        $yaml = Yaml::dump($compose, 6, 2);

        // Save and deploy
        $tempFile = storage_path("app/crowdsec-compose-{$server->id}.yml");
        file_put_contents($tempFile, $yaml);

        instant_scp(
            $tempFile,
            config('crowdsec.docker.config_path') . '/docker-compose.yml',
            $server
        );

        @unlink($tempFile);

        ray("✅ Docker Compose deployed");
    }

    /**
     * Start CrowdSec container
     */
    private function startCrowdSecContainer(Server $server): void
    {
        $basePath = config('crowdsec.docker.config_path');

        ray("🐳 Starting CrowdSec container");

        instant_remote_process([
            "cd {$basePath}",
            'docker compose down || true', // Clean any existing
            'docker compose up -d',
        ], $server);

        ray("✅ Container started");
    }

    /**
     * Generate bouncer API key
     */
    private function generateBouncerKey(Server $server): string
    {
        $containerName = config('crowdsec.docker.container_name');
        $bouncerName = "ideploy-traefik-{$server->id}";

        ray("🔑 Generating bouncer key for {$bouncerName}");

        // Remove existing bouncer if any
        instant_remote_process([
            "docker exec {$containerName} cscli bouncers delete {$bouncerName} || true",
        ], $server);

        // Create new bouncer
        $output = instant_remote_process([
            "docker exec {$containerName} cscli bouncers add {$bouncerName} -o raw",
        ], $server);

        $apiKey = trim($output);

        if (empty($apiKey) || strlen($apiKey) < 20) {
            throw new \Exception('Failed to generate bouncer API key: ' . $output);
        }

        ray("✅ Bouncer key generated: " . substr($apiKey, 0, 10) . "...");

        return $apiKey;
    }

    /**
     * Configure Traefik bouncer
     */
    private function configureTraefikBouncer(Server $server, string $apiKey): void
    {
        $config = [
            'http' => [
                'middlewares' => [
                    'crowdsec-bouncer' => [
                        'plugin' => [
                            'crowdsec-bouncer-traefik-plugin' => [
                                'enabled' => true,
                                'logLevel' => 'INFO',
                                'crowdsecLapiHost' => config('crowdsec.docker.container_name') . ':8080',
                                'crowdsecLapiScheme' => 'http',
                                'crowdsecLapiKey' => $apiKey,
                                'crowdsecAppsecEnabled' => true,
                                'crowdsecAppsecHost' => config('crowdsec.docker.container_name') . ':7422',
                                'crowdsecAppsecFailureBlock' => true,
                                'crowdsecMode' => 'live',
                                'updateIntervalSeconds' => 10,
                                'defaultDecisionSeconds' => 3600,
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $yaml = Yaml::dump($config, 6, 2);

        // Save and deploy
        $tempFile = storage_path("app/crowdsec-traefik-{$server->id}.yml");
        file_put_contents($tempFile, $yaml);

        instant_scp(
            $tempFile,
            '/data/ideploy/proxy/dynamic/crowdsec.yaml',
            $server
        );

        @unlink($tempFile);

        // Reload Traefik
        instant_remote_process([
            'docker exec ideploy-proxy kill -SIGHUP 1',
        ], $server);

        ray("✅ Traefik bouncer configured");
    }

    /**
     * Configure AppSec (Application Security)
     */
    private function configureAppSec(Server $server): void
    {
        $containerName = config('crowdsec.docker.container_name');

        ray("🔒 Configuring CrowdSec AppSec");

        try {
            // Install AppSec collections
            instant_remote_process([
                "docker exec {$containerName} cscli collections install crowdsecurity/appsec-virtual-patching",
                "docker exec {$containerName} cscli collections install crowdsecurity/appsec-generic-rules",
            ], $server);

            // Install AppSec configs
            instant_remote_process([
                "docker exec {$containerName} cscli appsec-configs install crowdsecurity/virtual-patching",
                "docker exec {$containerName} cscli appsec-configs install crowdsecurity/generic-rules",
            ], $server);

            // Install AppSec rules
            instant_remote_process([
                "docker exec {$containerName} cscli appsec-rules install crowdsecurity/rule-lfi",
                "docker exec {$containerName} cscli appsec-rules install crowdsecurity/rule-sqli",
                "docker exec {$containerName} cscli appsec-rules install crowdsecurity/rule-xss",
                "docker exec {$containerName} cscli appsec-rules install crowdsecurity/rule-rce",
            ], $server);

            // Create AppSec configuration file
            $appSecConfig = [
                'appsec_configs' => [
                    [
                        'name' => 'default_appsec_config',
                        'default_remediation' => 'ban',
                        'default_pass_action' => 'allow',
                        'blocked_http_code' => 403,
                        'passthrough_http_code' => 200,
                        'rules' => [
                            'crowdsecurity/rule-lfi',
                            'crowdsecurity/rule-sqli',
                            'crowdsecurity/rule-xss',
                            'crowdsecurity/rule-rce',
                        ],
                    ],
                ],
            ];

            $appSecYaml = Yaml::dump($appSecConfig, 6, 2);

            // Save and deploy AppSec config
            $tempFile = storage_path("app/appsec-config-{$server->id}.yaml");
            file_put_contents($tempFile, $appSecYaml);

            instant_scp(
                $tempFile,
                config('crowdsec.docker.config_path') . '/config/appsec-configs/ideploy-appsec.yaml',
                $server
            );

            @unlink($tempFile);

            // Reload CrowdSec to apply AppSec configuration
            instant_remote_process([
                "docker exec {$containerName} kill -SIGHUP 1",
            ], $server);

            ray("✅ AppSec configured with virtual patching and security rules");

        } catch (\Exception $e) {
            ray("⚠️ AppSec configuration failed (non-critical): " . $e->getMessage());
            // AppSec is not critical for basic firewall functionality
        }
    }

    /**
     * Validate installation post-deployment
     */
    public function validateInstallation(Server $server): bool
    {
        $containerName = config('crowdsec.docker.container_name');

        ray("🔍 Validating CrowdSec installation");

        try {
            // Check container is running
            $containerCheck = instant_remote_process([
                "docker ps | grep {$containerName} | grep 'Up'"
            ], $server);

            if (empty($containerCheck)) {
                throw new \Exception('CrowdSec container is not running');
            }

            // Check LAPI is responding
            $lapiCheck = instant_remote_process([
                "docker exec {$containerName} cscli version"
            ], $server);

            if (!str_contains(strtolower($lapiCheck), 'version')) {
                throw new \Exception('CrowdSec LAPI is not responding');
            }

            // Check bouncer exists
            $bouncerCheck = instant_remote_process([
                "docker exec {$containerName} cscli bouncers list -o json"
            ], $server);

            if (empty($bouncerCheck) || $bouncerCheck === '[]') {
                throw new \Exception('No bouncer configured');
            }

            ray("✅ Installation validation passed");
            return true;

        } catch (\Exception $e) {
            ray("❌ Installation validation failed: {$e->getMessage()}");
            return false;
        }
    }

    /**
     * Get health status of CrowdSec installation
     */
    public function getHealthStatus(Server $server): array
    {
        $containerName = config('crowdsec.docker.container_name');
        $status = [
            'healthy' => false,
            'container_running' => false,
            'lapi_responding' => false,
            'bouncer_configured' => false,
            'version' => null,
            'error' => null,
        ];

        try {
            // Check container
            $containerCheck = instant_remote_process([
                "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep {$containerName}"
            ], $server);

            $status['container_running'] = !empty($containerCheck) && str_contains($containerCheck, 'Up');

            if ($status['container_running']) {
                // Check LAPI
                try {
                    $versionOutput = instant_remote_process([
                        "docker exec {$containerName} cscli version --output json"
                    ], $server);

                    $versionData = json_decode($versionOutput, true);
                    $status['version'] = $versionData['version'] ?? 'unknown';
                    $status['lapi_responding'] = true;

                } catch (\Exception $e) {
                    $status['lapi_responding'] = false;
                    $status['error'] = 'LAPI not responding: ' . $e->getMessage();
                }

                // Check bouncers
                try {
                    $bouncerOutput = instant_remote_process([
                        "docker exec {$containerName} cscli bouncers list -o json"
                    ], $server);

                    $bouncers = json_decode($bouncerOutput, true);
                    $status['bouncer_configured'] = !empty($bouncers);

                } catch (\Exception $e) {
                    $status['bouncer_configured'] = false;
                }
            }

            $status['healthy'] = $status['container_running'] &&
                               $status['lapi_responding'] &&
                               $status['bouncer_configured'];

        } catch (\Exception $e) {
            $status['error'] = $e->getMessage();
        }

        return $status;
    }

    /**
     * Remove CrowdSec from server
     */
    public function removeFromServer(Server $server): void
    {
        $basePath = config('crowdsec.docker.config_path');
        $containerName = config('crowdsec.docker.container_name');

        ray("🗑️ Removing CrowdSec from {$server->name}");

        try {
            // Stop and remove container
            instant_remote_process([
                "cd {$basePath}",
                'docker compose down || true',
                "docker rm -f {$containerName} || true",
            ], $server);

            // Remove Traefik config
            instant_remote_process([
                'rm -f /data/ideploy/proxy/dynamic/crowdsec.yaml',
                'docker exec ideploy-proxy kill -SIGHUP 1 || true',
            ], $server);

            // Update server status
            $server->update([
                'crowdsec_installed' => false,
                'crowdsec_available' => false,
                'crowdsec_lapi_url' => null,
                'crowdsec_api_key' => null,
            ]);

            ray("✅ CrowdSec removed successfully");

        } catch (\Exception $e) {
            ray("❌ Failed to remove CrowdSec: {$e->getMessage()}");
            throw $e;
        }
    }
}
