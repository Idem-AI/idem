<?php

namespace App\Jobs\Pipeline;

use App\Models\PipelineExecution;
use App\Models\PipelineLog;
use Illuminate\Support\Facades\Log;

/**
 * Job pour exécuter les outils de sécurité natifs (Bandit, ESLint, Psalm, etc.)
 */
class NativeSecurityStageJob
{
    protected PipelineExecution $execution;
    protected string $language;
    protected string $workspacePath;

    public function __construct(PipelineExecution $execution, string $language, string $workspacePath)
    {
        $this->execution = $execution;
        $this->language = $language;
        $this->workspacePath = $workspacePath;
    }

    public function handle(): array
    {
        try {
            $config = $this->execution->pipelineConfig;
            
            if (!$config) {
                return ['success' => true, 'skipped' => true, 'message' => 'No pipeline config found'];
            }

            $securityTools = $config->config['security_tools'] ?? [];
            $server = $this->execution->application->destination->server;
            
            // Déterminer quel outil utiliser selon le langage
            $toolToRun = $this->getToolForLanguage($this->language, $securityTools);
            
            if (!$toolToRun) {
                $this->log('info', "No native security tool configured for {$this->language}");
                return ['success' => true, 'skipped' => true, 'message' => 'No tool configured'];
            }

            $this->log('info', "Running {$toolToRun['name']} for {$this->language}...");
            
            // Exécuter l'outil
            $result = $this->runSecurityTool($toolToRun, $server);
            
            return $result;

        } catch (\Exception $e) {
            Log::error("Native security scan failed: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    protected function getToolForLanguage(string $language, array $securityTools): ?array
    {
        $mapping = [
            'Python' => [
                'name' => 'Bandit',
                'enabled_key' => 'bandit_enabled',
                'command' => 'bandit',
                'install_check' => 'bandit --version',
                'install_command' => 'pip3 install bandit',
                'scan_command' => 'bandit -r . -f json -o bandit-report.json || true',
            ],
            'JavaScript' => [
                'name' => 'ESLint Security',
                'enabled_key' => 'eslint_security_enabled',
                'command' => 'eslint',
                'install_check' => 'npx eslint --version',
                'install_command' => 'npm install -g eslint eslint-plugin-security',
                'scan_command' => 'npx eslint . --ext .js,.jsx,.ts,.tsx -f json -o eslint-report.json || true',
            ],
            'PHP' => [
                'name' => 'Psalm Security',
                'enabled_key' => 'psalm_security_enabled',
                'command' => 'psalm',
                'install_check' => 'export PATH="$PATH:$HOME/.composer/vendor/bin:$HOME/.config/composer/vendor/bin" && psalm --version',
                'install_command' => 'composer global require vimeo/psalm --quiet 2>&1',
                'scan_command' => 'export PATH="$PATH:$HOME/.composer/vendor/bin:$HOME/.config/composer/vendor/bin" && psalm --output-format=json --report=psalm-report.json || true',
            ],
            'Ruby' => [
                'name' => 'Brakeman',
                'enabled_key' => 'brakeman_enabled',
                'command' => 'brakeman',
                'install_check' => 'brakeman --version',
                'install_command' => 'gem install brakeman',
                'scan_command' => 'brakeman -o brakeman-report.json -f json || true',
            ],
            'Go' => [
                'name' => 'Gosec',
                'enabled_key' => 'gosec_enabled',
                'command' => 'gosec',
                'install_check' => 'export PATH="$PATH:$HOME/go/bin:$(go env GOPATH)/bin" && gosec -version',
                'install_command' => 'go install github.com/securego/gosec/v2/cmd/gosec@latest 2>&1',
                'scan_command' => 'export PATH="$PATH:$HOME/go/bin:$(go env GOPATH)/bin" && gosec -fmt json -out gosec-report.json ./... || true',
            ],
        ];

        $tool = $mapping[$language] ?? null;
        
        if (!$tool) {
            return null;
        }

        // Vérifier si l'outil est activé dans la config
        $isEnabled = $securityTools[$tool['enabled_key']] ?? false;
        
        if (!$isEnabled) {
            return null;
        }

        return $tool;
    }

    protected function runSecurityTool(array $tool, $server): array
    {
        try {
            $this->log('info', "Checking if {$tool['name']} is installed...");
            
            // Vérifier si l'outil est installé
            $checkOutput = instant_remote_process([
                "cd {$this->workspacePath}",
                $tool['install_check'] . " 2>&1",
            ], $server, false);

            if (empty($checkOutput) || str_contains($checkOutput, 'not found') || str_contains($checkOutput, 'command not found')) {
                $this->log('warning', "{$tool['name']} not found. Installing...");
                
                // Installer l'outil
                try {
                    $installOutput = instant_remote_process([
                        "cd {$this->workspacePath}",
                        $tool['install_command'] . " 2>&1",
                    ], $server, false);
                    
                    if (str_contains($installOutput, 'error') || str_contains($installOutput, 'failed')) {
                        $this->log('error', "Installation failed: " . substr($installOutput, 0, 300));
                        throw new \Exception("Failed to install {$tool['name']}");
                    }
                    
                    $this->log('info', "Installation completed successfully");
                    
                    // Vérifier que l'installation a réussi
                    $verifyOutput = instant_remote_process([
                        "cd {$this->workspacePath}",
                        $tool['install_check'] . " 2>&1",
                    ], $server, false);
                    
                    if (empty($verifyOutput) || str_contains($verifyOutput, 'not found')) {
                        throw new \Exception("{$tool['name']} installation verification failed");
                    }
                    
                } catch (\Exception $e) {
                    $this->log('error', "Installation error: " . $e->getMessage());
                    throw $e;
                }
            } else {
                $this->log('info', "{$tool['name']} is already installed: " . trim(substr($checkOutput, 0, 100)));
            }

            // Exécuter le scan
            $this->log('info', "Running {$tool['name']} scan on {$this->workspacePath}...");
            
            $scanOutput = instant_remote_process([
                "cd {$this->workspacePath}",
                $tool['scan_command'] . " 2>&1",
            ], $server, false);

            // Lire le rapport généré
            $reportFile = $this->getReportFileName($tool['scan_command']);
            $this->log('info', "Reading report from {$reportFile}...");
            
            $reportContent = instant_remote_process([
                "cd {$this->workspacePath}",
                "cat {$reportFile} 2>/dev/null || echo '{}'",
            ], $server, false);

            if (empty($reportContent) || $reportContent === '{}') {
                $this->log('warning', "Report file is empty or not found. Scan may have failed.");
                $this->log('info', "Scan output: " . substr($scanOutput, 0, 500));
            }

            // Parser le rapport
            $issues = $this->parseReport($tool['name'], $reportContent);
            
            $this->log('info', "Scan completed. Found {$issues['total']} issue(s) - Critical: {$issues['critical']}, High: {$issues['high']}, Medium: {$issues['medium']}, Low: {$issues['low']}");
            
            if ($issues['critical'] > 0) {
                $this->log('error', "CRITICAL: Found {$issues['critical']} critical security issue(s)!");
            }
            
            if ($issues['high'] > 0) {
                $this->log('warning', "WARNING: Found {$issues['high']} high severity issue(s)");
            }

            return [
                'success' => true,
                'data' => [
                    'tool' => $tool['name'],
                    'issues' => $issues,
                    'report_file' => $reportFile,
                ],
            ];
            
        } catch (\Exception $e) {
            $this->log('error', "Security scan failed: " . $e->getMessage());
            throw $e;
        }
    }

    protected function getReportFileName(string $scanCommand): string
    {
        // Extraire le nom du fichier de rapport de la commande
        if (preg_match('/-o\s+(\S+)/', $scanCommand, $matches)) {
            return $matches[1];
        }
        if (preg_match('/--report=(\S+)/', $scanCommand, $matches)) {
            return $matches[1];
        }
        if (preg_match('/-out\s+(\S+)/', $scanCommand, $matches)) {
            return $matches[1];
        }
        
        return 'security-report.json';
    }

    protected function parseReport(string $toolName, string $reportContent): array
    {
        $issues = [
            'total' => 0,
            'critical' => 0,
            'high' => 0,
            'medium' => 0,
            'low' => 0,
        ];

        try {
            $report = json_decode($reportContent, true);
            
            if (!$report) {
                return $issues;
            }

            // Parser selon l'outil
            switch ($toolName) {
                case 'Bandit':
                    $issues['total'] = count($report['results'] ?? []);
                    foreach ($report['results'] ?? [] as $result) {
                        $severity = strtolower($result['issue_severity'] ?? 'low');
                        if (isset($issues[$severity])) {
                            $issues[$severity]++;
                        }
                    }
                    break;

                case 'ESLint Security':
                    foreach ($report as $file) {
                        $issues['total'] += count($file['messages'] ?? []);
                        foreach ($file['messages'] ?? [] as $message) {
                            $severity = $message['severity'] === 2 ? 'high' : 'medium';
                            $issues[$severity]++;
                        }
                    }
                    break;

                case 'Psalm Security':
                    $issues['total'] = count($report ?? []);
                    foreach ($report ?? [] as $issue) {
                        $severity = strtolower($issue['severity'] ?? 'low');
                        if (isset($issues[$severity])) {
                            $issues[$severity]++;
                        }
                    }
                    break;

                case 'Brakeman':
                    $warnings = $report['warnings'] ?? [];
                    $issues['total'] = count($warnings);
                    foreach ($warnings as $warning) {
                        $confidence = strtolower($warning['confidence'] ?? 'low');
                        if ($confidence === 'high') {
                            $issues['critical']++;
                        } elseif ($confidence === 'medium') {
                            $issues['high']++;
                        } else {
                            $issues['medium']++;
                        }
                    }
                    break;

                case 'Gosec':
                    $issuesList = $report['Issues'] ?? [];
                    $issues['total'] = count($issuesList);
                    foreach ($issuesList as $issue) {
                        $severity = strtolower($issue['severity'] ?? 'low');
                        if (isset($issues[$severity])) {
                            $issues[$severity]++;
                        }
                    }
                    break;
            }

        } catch (\Exception $e) {
            Log::warning("Failed to parse {$toolName} report: " . $e->getMessage());
        }

        return $issues;
    }

    protected function log(string $level, string $message): void
    {
        PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => 'native_security',
            'stage_name' => 'Native Security',
            'level' => $level,
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
}
