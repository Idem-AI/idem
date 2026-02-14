<?php

namespace App\Services\Pipeline;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SonarQubeApiService
{
    protected string $baseUrl;
    protected string $adminToken;

    public function __construct(string $baseUrl, string $adminToken)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->adminToken = $adminToken;
    }

    /**
     * Créer un projet SonarQube automatiquement
     */
    public function createProject(string $projectKey, string $projectName): array
    {
        try {
            $response = Http::withBasicAuth($this->adminToken, '')
                ->asForm()
                ->post("{$this->baseUrl}/api/projects/create", [
                    'project' => $projectKey,
                    'name' => $projectName,
                ]);

            if ($response->successful()) {
                Log::info("SonarQube project created", [
                    'project_key' => $projectKey,
                    'project_name' => $projectName,
                ]);

                return [
                    'success' => true,
                    'project' => $response->json()['project'] ?? [],
                ];
            }

            // Projet existe déjà (erreur 400)
            if ($response->status() === 400 && str_contains($response->body(), 'already exists')) {
                Log::info("SonarQube project already exists", ['project_key' => $projectKey]);
                
                return [
                    'success' => true,
                    'project' => ['key' => $projectKey, 'name' => $projectName],
                    'already_exists' => true,
                ];
            }

            throw new \Exception("Failed to create project: " . $response->body());

        } catch (\Exception $e) {
            Log::error("SonarQube project creation failed", [
                'project_key' => $projectKey,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Générer un token pour un projet spécifique
     */
    public function generateProjectToken(string $projectKey, string $tokenName = null): array
    {
        try {
            $tokenName = $tokenName ?? "ideploy-{$projectKey}-" . time();

            $response = Http::withBasicAuth($this->adminToken, '')
                ->asForm()
                ->post("{$this->baseUrl}/api/user_tokens/generate", [
                    'name' => $tokenName,
                    'type' => 'PROJECT_ANALYSIS_TOKEN',
                    'projectKey' => $projectKey,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                
                Log::info("SonarQube token generated", [
                    'project_key' => $projectKey,
                    'token_name' => $tokenName,
                ]);

                return [
                    'success' => true,
                    'token' => $data['token'] ?? null,
                    'name' => $data['name'] ?? $tokenName,
                ];
            }

            throw new \Exception("Failed to generate token: " . $response->body());

        } catch (\Exception $e) {
            Log::error("SonarQube token generation failed", [
                'project_key' => $projectKey,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Récupérer les résultats d'analyse d'un projet
     */
    public function getProjectAnalysis(string $projectKey): array
    {
        try {
            // Récupérer les mesures principales
            $response = Http::withBasicAuth($this->adminToken, '')
                ->get("{$this->baseUrl}/api/measures/component", [
                    'component' => $projectKey,
                    'metricKeys' => implode(',', [
                        'bugs',
                        'vulnerabilities',
                        'code_smells',
                        'coverage',
                        'duplicated_lines_density',
                        'ncloc',
                        'sqale_rating',
                        'reliability_rating',
                        'security_rating',
                        'alert_status',
                    ]),
                ]);

            if (!$response->successful()) {
                throw new \Exception("Failed to fetch measures: " . $response->body());
            }

            $measures = $response->json()['component']['measures'] ?? [];
            
            // Transformer en format plus utilisable
            $results = [];
            foreach ($measures as $measure) {
                $results[$measure['metric']] = $measure['value'] ?? null;
            }

            // Récupérer le statut du Quality Gate
            $qgResponse = Http::withBasicAuth($this->adminToken, '')
                ->get("{$this->baseUrl}/api/qualitygates/project_status", [
                    'projectKey' => $projectKey,
                ]);

            if ($qgResponse->successful()) {
                $qgData = $qgResponse->json()['projectStatus'] ?? [];
                $results['quality_gate_status'] = $qgData['status'] ?? 'UNKNOWN';
                $results['quality_gate_conditions'] = $qgData['conditions'] ?? [];
            }

            Log::info("SonarQube analysis results retrieved", [
                'project_key' => $projectKey,
                'quality_gate' => $results['quality_gate_status'] ?? 'UNKNOWN',
            ]);

            return [
                'success' => true,
                'results' => $results,
            ];

        } catch (\Exception $e) {
            Log::error("SonarQube analysis retrieval failed", [
                'project_key' => $projectKey,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Récupérer les issues (bugs, vulnerabilities, code smells)
     */
    public function getProjectIssues(string $projectKey, array $types = ['BUG', 'VULNERABILITY', 'CODE_SMELL']): array
    {
        try {
            $response = Http::withBasicAuth($this->adminToken, '')
                ->get("{$this->baseUrl}/api/issues/search", [
                    'componentKeys' => $projectKey,
                    'types' => implode(',', $types),
                    'resolved' => 'false',
                    'ps' => 500, // Page size
                ]);

            if (!$response->successful()) {
                throw new \Exception("Failed to fetch issues: " . $response->body());
            }

            $data = $response->json();
            $issues = $data['issues'] ?? [];

            // Grouper par type et sévérité
            $grouped = [
                'bugs' => [],
                'vulnerabilities' => [],
                'code_smells' => [],
                'total' => count($issues),
            ];

            foreach ($issues as $issue) {
                $type = strtolower($issue['type']);
                if ($type === 'bug') {
                    $grouped['bugs'][] = $issue;
                } elseif ($type === 'vulnerability') {
                    $grouped['vulnerabilities'][] = $issue;
                } elseif ($type === 'code_smell') {
                    $grouped['code_smells'][] = $issue;
                }
            }

            return [
                'success' => true,
                'issues' => $grouped,
            ];

        } catch (\Exception $e) {
            Log::error("SonarQube issues retrieval failed", [
                'project_key' => $projectKey,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Vérifier la connexion à SonarQube
     */
    public function checkConnection(): bool
    {
        try {
            $response = Http::withBasicAuth($this->adminToken, '')
                ->timeout(5)
                ->get("{$this->baseUrl}/api/system/status");

            return $response->successful() && 
                   ($response->json()['status'] ?? '') === 'UP';

        } catch (\Exception $e) {
            Log::error("SonarQube connection check failed", [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Supprimer un projet (utile pour les tests)
     */
    public function deleteProject(string $projectKey): array
    {
        try {
            $response = Http::withBasicAuth($this->adminToken, '')
                ->asForm()
                ->post("{$this->baseUrl}/api/projects/delete", [
                    'project' => $projectKey,
                ]);

            if ($response->successful()) {
                Log::info("SonarQube project deleted", ['project_key' => $projectKey]);

                return ['success' => true];
            }

            throw new \Exception("Failed to delete project: " . $response->body());

        } catch (\Exception $e) {
            Log::error("SonarQube project deletion failed", [
                'project_key' => $projectKey,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Créer un projet complet avec token (méthode tout-en-un)
     */
    public function setupProjectComplete(string $projectKey, string $projectName): array
    {
        // 1. Créer le projet
        $projectResult = $this->createProject($projectKey, $projectName);
        
        if (!$projectResult['success']) {
            return $projectResult;
        }

        // 2. Générer le token
        $tokenResult = $this->generateProjectToken($projectKey);
        
        if (!$tokenResult['success']) {
            return $tokenResult;
        }

        return [
            'success' => true,
            'project_key' => $projectKey,
            'project_name' => $projectName,
            'token' => $tokenResult['token'],
            'token_name' => $tokenResult['name'],
            'already_exists' => $projectResult['already_exists'] ?? false,
        ];
    }
}
