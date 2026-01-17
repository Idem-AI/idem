<?php

namespace App\Services\Pipeline\Tools;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SonarQubeService
{
    protected string $baseUrl;
    protected string $token;

    public function __construct(?string $baseUrl = null, ?string $token = null)
    {
        $this->baseUrl = $baseUrl ?? config('pipeline.sonarqube.url', 'http://ideploy-sonarqube:9000');
        $this->token = $token ?? config('pipeline.sonarqube.token', 'admin:admin');
    }

    /**
     * Create a new project in SonarQube
     */
    public function createProject(string $projectKey, string $projectName): array
    {
        try {
            $response = Http::withBasicAuth(...explode(':', $this->token))
                ->post("{$this->baseUrl}/api/projects/create", [
                    'project' => $projectKey,
                    'name' => $projectName,
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json(),
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('errors.0.msg') ?? 'Failed to create project',
            ];
        } catch (\Exception $e) {
            Log::error('SonarQube create project failed', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Generate authentication token for a project
     */
    public function generateToken(string $projectKey): array
    {
        try {
            $response = Http::withBasicAuth(...explode(':', $this->token))
                ->post("{$this->baseUrl}/api/user_tokens/generate", [
                    'name' => "ideploy-{$projectKey}-" . time(),
                    'type' => 'PROJECT_ANALYSIS_TOKEN',
                    'projectKey' => $projectKey,
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'token' => $response->json('token'),
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('errors.0.msg') ?? 'Failed to generate token',
            ];
        } catch (\Exception $e) {
            Log::error('SonarQube generate token failed', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Run analysis on a project
     */
    public function runAnalysis(string $projectPath, string $projectKey, string $token, array $options = []): array
    {
        try {
            // Build sonar-scanner command
            $command = [
                'sonar-scanner',
                "-Dsonar.projectKey={$projectKey}",
                "-Dsonar.sources={$projectPath}",
                "-Dsonar.host.url={$this->baseUrl}",
                "-Dsonar.login={$token}",
            ];

            // Add optional parameters
            if (isset($options['exclusions'])) {
                $command[] = "-Dsonar.exclusions={$options['exclusions']}";
            }
            if (isset($options['language'])) {
                $command[] = "-Dsonar.language={$options['language']}";
            }

            $commandString = implode(' ', $command);

            return [
                'success' => true,
                'command' => $commandString,
            ];
        } catch (\Exception $e) {
            Log::error('SonarQube run analysis failed', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get quality gate status
     */
    public function getQualityGateStatus(string $projectKey): array
    {
        try {
            $response = Http::withBasicAuth(...explode(':', $this->token))
                ->get("{$this->baseUrl}/api/qualitygates/project_status", [
                    'projectKey' => $projectKey,
                ]);

            if ($response->successful()) {
                $data = $response->json('projectStatus');
                return [
                    'success' => true,
                    'status' => $data['status'] ?? 'NONE',
                    'conditions' => $data['conditions'] ?? [],
                ];
            }

            return [
                'success' => false,
                'error' => 'Failed to get quality gate status',
            ];
        } catch (\Exception $e) {
            Log::error('SonarQube get quality gate failed', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get project measures (metrics)
     */
    public function getProjectMeasures(string $projectKey, array $metricKeys = []): array
    {
        try {
            $metrics = empty($metricKeys) 
                ? ['bugs', 'vulnerabilities', 'code_smells', 'coverage', 'duplicated_lines_density']
                : $metricKeys;

            $response = Http::withBasicAuth(...explode(':', $this->token))
                ->get("{$this->baseUrl}/api/measures/component", [
                    'component' => $projectKey,
                    'metricKeys' => implode(',', $metrics),
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'measures' => $response->json('component.measures', []),
                ];
            }

            return [
                'success' => false,
                'error' => 'Failed to get project measures',
            ];
        } catch (\Exception $e) {
            Log::error('SonarQube get measures failed', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check if SonarQube server is available
     */
    public function ping(): bool
    {
        try {
            $response = Http::timeout(5)
                ->get("{$this->baseUrl}/api/system/ping");

            return $response->successful() && $response->body() === 'pong';
        } catch (\Exception $e) {
            return false;
        }
    }
}
