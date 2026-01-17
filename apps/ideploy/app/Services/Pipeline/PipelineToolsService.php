<?php

namespace App\Services\Pipeline;

class PipelineToolsService
{
    /**
     * Get all available pipeline tools categorized
     */
    public function getAvailableTools(): array
    {
        return [
            'code_quality' => [
                'category' => 'Code Quality',
                'icon' => '📊',
                'tools' => [
                    [
                        'id' => 'sonarqube',
                        'name' => 'SonarQube',
                        'description' => 'Continuous code quality inspection',
                        'logo' => 'sonarqube.svg',
                        'icon_bg' => 'bg-orange-500',
                        'auto_detect' => true,
                        'languages' => ['java', 'javascript', 'typescript', 'python', 'php', 'c#', 'go'],
                        'config_template' => [
                            'quality_gate' => 'default',
                            'coverage_threshold' => 80,
                            'duplications_threshold' => 3,
                        ],
                    ],
                    [
                        'id' => 'eslint',
                        'name' => 'ESLint',
                        'description' => 'JavaScript/TypeScript linting',
                        'logo' => 'eslint.svg',
                        'auto_detect' => true,
                        'languages' => ['javascript', 'typescript'],
                        'config_template' => [
                            'config_file' => '.eslintrc.json',
                            'fix_auto' => false,
                        ],
                    ],
                    [
                        'id' => 'phpstan',
                        'name' => 'PHPStan',
                        'description' => 'PHP static analysis',
                        'logo' => 'phpstan.svg',
                        'auto_detect' => true,
                        'languages' => ['php'],
                        'config_template' => [
                            'level' => 5,
                            'paths' => ['app', 'src'],
                        ],
                    ],
                ],
            ],
            
            'security' => [
                'category' => 'Security',
                'icon' => '🔒',
                'tools' => [
                    [
                        'id' => 'trivy',
                        'name' => 'Trivy',
                        'description' => 'Vulnerability scanner for containers and code',
                        'logo' => 'trivy.svg',
                        'auto_detect' => false,
                        'scan_types' => ['vuln', 'secret', 'config', 'license'],
                        'config_template' => [
                            'severity' => ['CRITICAL', 'HIGH'],
                            'scan_type' => ['vuln', 'secret'],
                            'ignore_unfixed' => false,
                        ],
                    ],
                    [
                        'id' => 'snyk',
                        'name' => 'Snyk',
                        'description' => 'Find and fix vulnerabilities',
                        'logo' => 'snyk.svg',
                        'auto_detect' => true,
                        'scan_types' => ['code', 'deps', 'container', 'iac'],
                        'config_template' => [
                            'fail_on' => 'high',
                            'monitor' => true,
                        ],
                    ],
                    [
                        'id' => 'gitleaks',
                        'name' => 'Gitleaks',
                        'description' => 'Detect secrets in git repositories',
                        'logo' => 'gitleaks.svg',
                        'auto_detect' => false,
                        'config_template' => [
                            'config_file' => '.gitleaks.toml',
                            'scan_depth' => 50,
                        ],
                    ],
                ],
            ],
            
            'testing' => [
                'category' => 'Testing',
                'icon' => '🧪',
                'tools' => [
                    [
                        'id' => 'jest',
                        'name' => 'Jest',
                        'description' => 'JavaScript testing framework',
                        'logo' => 'jest.svg',
                        'auto_detect' => true,
                        'languages' => ['javascript', 'typescript'],
                        'config_template' => [
                            'coverage' => true,
                            'coverage_threshold' => 80,
                            'watch' => false,
                        ],
                    ],
                    [
                        'id' => 'pytest',
                        'name' => 'Pytest',
                        'description' => 'Python testing framework',
                        'logo' => 'pytest.svg',
                        'auto_detect' => true,
                        'languages' => ['python'],
                        'config_template' => [
                            'markers' => [],
                            'coverage' => true,
                            'verbose' => true,
                        ],
                    ],
                    [
                        'id' => 'phpunit',
                        'name' => 'PHPUnit',
                        'description' => 'PHP testing framework',
                        'logo' => 'phpunit.svg',
                        'auto_detect' => true,
                        'languages' => ['php'],
                        'config_template' => [
                            'config_file' => 'phpunit.xml',
                            'coverage' => false,
                        ],
                    ],
                    [
                        'id' => 'go-test',
                        'name' => 'Go Test',
                        'description' => 'Go testing framework',
                        'logo' => 'go.svg',
                        'auto_detect' => true,
                        'languages' => ['go'],
                        'config_template' => [
                            'coverage' => true,
                            'race' => true,
                            'verbose' => false,
                        ],
                    ],
                ],
            ],
            
            'build' => [
                'category' => 'Build',
                'icon' => '⚙️',
                'tools' => [
                    [
                        'id' => 'docker',
                        'name' => 'Docker Build',
                        'description' => 'Build Docker images',
                        'logo' => 'docker.svg',
                        'auto_detect' => false,
                        'config_template' => [
                            'dockerfile' => 'Dockerfile',
                            'context' => '.',
                            'buildargs' => [],
                            'cache' => true,
                        ],
                    ],
                    [
                        'id' => 'buildpacks',
                        'name' => 'Cloud Native Buildpacks',
                        'description' => 'Transform code into images',
                        'logo' => 'buildpacks.svg',
                        'auto_detect' => true,
                        'config_template' => [
                            'builder' => 'paketobuildpacks/builder:base',
                            'env' => [],
                        ],
                    ],
                    [
                        'id' => 'nixpacks',
                        'name' => 'Nixpacks',
                        'description' => 'App source to Docker image (used by Railway)',
                        'logo' => 'nixpacks.svg',
                        'auto_detect' => true,
                        'config_template' => [
                            'install_cmd' => null,
                            'build_cmd' => null,
                            'start_cmd' => null,
                        ],
                    ],
                ],
            ],
            
            'deploy' => [
                'category' => 'Deploy',
                'icon' => '🚀',
                'tools' => [
                    [
                        'id' => 'ideploy',
                        'name' => 'iDeploy',
                        'description' => 'Deploy to configured destination',
                        'logo' => 'ideploy.svg',
                        'auto_detect' => false,
                        'required' => true,
                        'config_template' => [
                            'zero_downtime' => true,
                            'health_check' => true,
                            'rollback_on_failure' => true,
                        ],
                    ],
                    [
                        'id' => 'kubernetes',
                        'name' => 'Kubernetes',
                        'description' => 'Deploy to Kubernetes cluster',
                        'logo' => 'kubernetes.svg',
                        'auto_detect' => false,
                        'config_template' => [
                            'namespace' => 'default',
                            'replicas' => 2,
                            'strategy' => 'RollingUpdate',
                        ],
                    ],
                ],
            ],
            
            'notifications' => [
                'category' => 'Notifications',
                'icon' => '📢',
                'tools' => [
                    [
                        'id' => 'slack',
                        'name' => 'Slack',
                        'description' => 'Send notifications to Slack',
                        'logo' => 'slack.svg',
                        'auto_detect' => false,
                        'config_template' => [
                            'webhook_url' => '',
                            'channel' => '#deployments',
                            'on_success' => true,
                            'on_failure' => true,
                        ],
                    ],
                    [
                        'id' => 'discord',
                        'name' => 'Discord',
                        'description' => 'Send notifications to Discord',
                        'logo' => 'discord.svg',
                        'auto_detect' => false,
                        'config_template' => [
                            'webhook_url' => '',
                            'on_success' => true,
                            'on_failure' => true,
                        ],
                    ],
                    [
                        'id' => 'email',
                        'name' => 'Email',
                        'description' => 'Send email notifications',
                        'logo' => 'email.svg',
                        'auto_detect' => false,
                        'config_template' => [
                            'recipients' => [],
                            'on_success' => false,
                            'on_failure' => true,
                        ],
                    ],
                ],
            ],
        ];
    }
    
    /**
     * Get tool by ID
     */
    public function getTool(string $toolId): ?array
    {
        $allTools = $this->getAvailableTools();
        
        foreach ($allTools as $category) {
            foreach ($category['tools'] as $tool) {
                if ($tool['id'] === $toolId) {
                    return $tool;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Get tools by category
     */
    public function getToolsByCategory(string $category): array
    {
        $allTools = $this->getAvailableTools();
        return $allTools[$category]['tools'] ?? [];
    }
    
    /**
     * Search tools
     */
    public function searchTools(string $query): array
    {
        $query = strtolower($query);
        $results = [];
        
        foreach ($this->getAvailableTools() as $categoryKey => $category) {
            foreach ($category['tools'] as $tool) {
                if (
                    str_contains(strtolower($tool['name']), $query) ||
                    str_contains(strtolower($tool['description']), $query)
                ) {
                    $results[] = array_merge($tool, ['category' => $categoryKey]);
                }
            }
        }
        
        return $results;
    }
    
    /**
     * Get auto-detectable tools for a language
     */
    public function getToolsForLanguage(string $language): array
    {
        $tools = [];
        
        foreach ($this->getAvailableTools() as $category) {
            foreach ($category['tools'] as $tool) {
                if (
                    isset($tool['auto_detect']) &&
                    $tool['auto_detect'] &&
                    isset($tool['languages']) &&
                    in_array($language, $tool['languages'])
                ) {
                    $tools[] = $tool;
                }
            }
        }
        
        return $tools;
    }
    
    /**
     * Get recommended pipeline for project type
     */
    public function getRecommendedPipeline(string $projectType): array
    {
        $pipelines = [
            'nodejs' => [
                ['tool' => 'eslint', 'category' => 'code_quality'],
                ['tool' => 'trivy', 'category' => 'security'],
                ['tool' => 'jest', 'category' => 'testing'],
                ['tool' => 'docker', 'category' => 'build'],
                ['tool' => 'trivy', 'category' => 'security'], // Container scan
                ['tool' => 'ideploy', 'category' => 'deploy'],
            ],
            'python' => [
                ['tool' => 'trivy', 'category' => 'security'],
                ['tool' => 'pytest', 'category' => 'testing'],
                ['tool' => 'docker', 'category' => 'build'],
                ['tool' => 'trivy', 'category' => 'security'],
                ['tool' => 'ideploy', 'category' => 'deploy'],
            ],
            'php' => [
                ['tool' => 'phpstan', 'category' => 'code_quality'],
                ['tool' => 'trivy', 'category' => 'security'],
                ['tool' => 'phpunit', 'category' => 'testing'],
                ['tool' => 'docker', 'category' => 'build'],
                ['tool' => 'ideploy', 'category' => 'deploy'],
            ],
            'go' => [
                ['tool' => 'trivy', 'category' => 'security'],
                ['tool' => 'go-test', 'category' => 'testing'],
                ['tool' => 'docker', 'category' => 'build'],
                ['tool' => 'ideploy', 'category' => 'deploy'],
            ],
            'generic' => [
                ['tool' => 'trivy', 'category' => 'security'],
                ['tool' => 'docker', 'category' => 'build'],
                ['tool' => 'trivy', 'category' => 'security'],
                ['tool' => 'ideploy', 'category' => 'deploy'],
            ],
        ];
        
        return $pipelines[$projectType] ?? $pipelines['generic'];
    }
}
