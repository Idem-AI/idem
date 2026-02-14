<?php

namespace App\Jobs\Pipeline;

use App\Models\PipelineExecution;
use App\Models\PipelineLog;
use App\Models\PipelineScanResult;
use App\Models\PipelineToolConfig;
use App\Services\Pipeline\SonarQubeApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class SonarQubeStageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 900; // 15 minutes

    public function __construct(
        public PipelineExecution $execution,
        public string $detectedLanguage
    ) {}

    public function handle(): array
    {
        $this->log('info', '🔍 Starting SonarQube Analysis...');
        
        try {
            $application = $this->execution->application;
            $server = $application->destination->server;
            $workspacePath = $this->execution->source_path;
            
            if (!$workspacePath) {
                throw new \Exception('Source code path not available');
            }
            
            // Get global SonarQube configuration
            $sonarConfig = PipelineToolConfig::where('tool_name', 'sonarqube')
                ->whereNull('application_id')
                ->first();
            
            if (!$sonarConfig || !$sonarConfig->enabled) {
                $this->log('info', '⏭️  SonarQube is not configured globally, skipping...');
                return ['success' => true, 'skipped' => true];
            }
            
            $sonarUrl = $sonarConfig->config['url'] ?? config('services.sonarqube.url', 'https://sonar.idem.africa');
            $sonarToken = $sonarConfig->config['token'] ?? config('services.sonarqube.token');
            $projectKey = "ideploy-{$application->uuid}";
            $projectName = $application->name;
            
            if (!$sonarToken) {
                throw new \Exception('SonarQube token not configured');
            }
            
            $this->log('info', "📊 Project Key: {$projectKey}");
            $this->log('info', "🌐 SonarQube URL: {$sonarUrl}");
            
            // Create scan result record
            $scanResult = PipelineScanResult::create([
                'pipeline_execution_id' => $this->execution->id,
                'tool' => 'sonarqube',
                'status' => 'running',
                'sonar_project_key' => $projectKey,
            ]);
            
            // Install sonar-scanner in builder container if needed
            $this->log('info', '📦 Installing SonarQube Scanner...');
            $this->installSonarScanner($server);
            
            // Create project on SonarQube if it doesn't exist
            $this->log('info', '🔧 Checking/Creating project on SonarQube...');
            $projectCreated = $this->ensureProjectExists($projectKey, $projectName, $sonarUrl, $sonarToken);
            if ($projectCreated) {
                $this->log('success', '  ✅ Project ready on SonarQube');
            }
            
            // Run SonarQube analysis
            $this->log('info', '🔬 Running code analysis...');
            
            // Use output file to capture all scanner output
            $outputFile = "/tmp/sonar-scan-{$this->execution->uuid}.log";
            
            $scanScript = <<<BASH
cd {$workspacePath}
sonar-scanner \
  -X \
  -Dsonar.projectKey={$projectKey} \
  -Dsonar.sources=. \
  -Dsonar.host.url={$sonarUrl} \
  -Dsonar.login={$sonarToken} \
  -Dsonar.scm.disabled=true \
  > {$outputFile} 2>&1
echo "SCAN_EXIT_CODE=\$?" >> {$outputFile}
cat {$outputFile}
BASH;
            
            $this->log('info', '  Starting scan...');
            $this->log('info', '  Project: ' . $projectKey);
            $this->log('info', '  URL: ' . $sonarUrl);
            
            // Execute scan with longer timeout (10 minutes)
            // Run in background and wait for completion
            $scanCommand = "bash -c " . escapeshellarg($scanScript);
            
            $this->log('info', '  ⏳ Scan may take several minutes...');
            
            $output = \App\Helpers\SshRetryHandler::retry(
                function () use ($server, $scanCommand) {
                    $sshCommand = \App\Helpers\SshMultiplexingHelper::generateSshCommand($server, $scanCommand);
                    // Timeout de 10 minutes pour le scan
                    $process = Process::timeout(600)->run($sshCommand);
                    
                    $output = trim($process->output());
                    $exitCode = $process->exitCode();
                    
                    if ($exitCode !== 0 && !str_contains($output, 'SCAN_EXIT_CODE')) {
                        throw new \Exception('Scan command failed with exit code: ' . $exitCode);
                    }
                    
                    return $output === 'null' ? null : $output;
                },
                [
                    'server' => $server->ip,
                    'command_preview' => 'sonar-scanner',
                    'function' => 'SonarQubeStageJob::scan',
                ],
                false
            );
            
            // Log scanner output
            if ($output) {
                $this->log('info', '  ✅ Scanner produced output (' . strlen($output) . ' chars)');
                
                // Log important lines only
                $lines = explode("\n", $output);
                $importantLines = [];
                foreach ($lines as $line) {
                    $trimmed = trim($line);
                    if (empty($trimmed)) continue;
                    
                    // Log lines that contain important info
                    if (str_contains($trimmed, 'INFO:') ||
                        str_contains($trimmed, 'WARN:') ||
                        str_contains($trimmed, 'ERROR:') ||
                        str_contains($trimmed, 'ceTaskId') ||
                        str_contains($trimmed, 'EXECUTION SUCCESS') ||
                        str_contains($trimmed, 'EXECUTION FAILURE') ||
                        str_contains($trimmed, 'Analysis report') ||
                        str_contains($trimmed, 'dashboard') ||
                        str_contains($trimmed, 'api/ce/task') ||
                        str_contains($trimmed, 'More about') ||
                        str_contains($trimmed, 'SCAN_EXIT_CODE')) {
                        $this->log('info', '  ' . $trimmed);
                        $importantLines[] = $trimmed;
                    }
                }
                
                // Check exit code
                if (preg_match('/SCAN_EXIT_CODE=(\d+)/', $output, $exitMatch)) {
                    $exitCode = (int) $exitMatch[1];
                    if ($exitCode !== 0) {
                        $this->log('warning', "  ⚠️  Scanner exited with code: {$exitCode}");
                    } else {
                        $this->log('success', '  ✅ Scanner completed successfully');
                    }
                }
            } else {
                $this->log('warning', '  ⚠️  Scanner produced no output');
                throw new \Exception('SonarQube scanner produced no output');
            }
            
            // Extract task ID from output
            $taskId = $this->extractTaskId($output);
            
            if ($taskId) {
                $this->log('info', "⏳ Analysis Task ID: {$taskId}");
                $scanResult->update(['sonar_task_id' => $taskId]);
                
                // Wait for analysis to complete
                $this->log('info', '⏳ Waiting for analysis to complete...');
                $this->waitForAnalysis($taskId, $sonarUrl, $sonarToken);
                
                // Fetch metrics using API service
                $this->log('info', '📈 Fetching analysis results...');
                $sonarApi = new SonarQubeApiService($sonarUrl, $sonarToken);
                
                $analysisResult = $sonarApi->getProjectAnalysis($projectKey);
                if (!$analysisResult['success']) {
                    throw new \Exception('Failed to fetch analysis results');
                }
                
                $results = $analysisResult['results'];
                
                // Fetch detailed issues
                $this->log('info', '🔍 Fetching detailed issues...');
                $issuesResult = $sonarApi->getProjectIssues($projectKey);
                $issues = $issuesResult['success'] ? $issuesResult['issues'] : [];
                
                // Update scan result with complete data
                $scanResult->update([
                    'status' => 'success',
                    'quality_gate_status' => $results['quality_gate_status'] ?? 'UNKNOWN',
                    'bugs' => (int) ($results['bugs'] ?? 0),
                    'vulnerabilities' => (int) ($results['vulnerabilities'] ?? 0),
                    'code_smells' => (int) ($results['code_smells'] ?? 0),
                    'security_hotspots' => (int) ($results['security_hotspots'] ?? 0),
                    'coverage' => (float) ($results['coverage'] ?? 0),
                    'duplications' => (float) ($results['duplicated_lines_density'] ?? 0),
                    'sonar_dashboard_url' => "{$sonarUrl}/dashboard?id={$projectKey}",
                    'raw_data' => [
                        'measures' => $results,
                        'issues' => $issues,
                        'quality_gate_conditions' => $results['quality_gate_conditions'] ?? [],
                    ],
                    'summary' => $this->generateSummaryFromResults($results, $issues),
                ]);
                
                $metrics = [
                    'qualityGateStatus' => $results['quality_gate_status'] ?? 'UNKNOWN',
                    'bugs' => (int) ($results['bugs'] ?? 0),
                    'vulnerabilities' => (int) ($results['vulnerabilities'] ?? 0),
                    'codeSmells' => (int) ($results['code_smells'] ?? 0),
                    'securityHotspots' => (int) ($results['security_hotspots'] ?? 0),
                    'coverage' => (float) ($results['coverage'] ?? 0),
                    'duplications' => (float) ($results['duplicated_lines_density'] ?? 0),
                ];
                
                // Log summary
                $this->log('info', '');
                $this->log('info', '📊 Analysis Results:');
                $this->log('info', "  Quality Gate: {$metrics['qualityGateStatus']}");
                $this->log('info', "  Bugs: {$metrics['bugs']}");
                $this->log('info', "  Vulnerabilities: {$metrics['vulnerabilities']}");
                $this->log('info', "  Code Smells: {$metrics['codeSmells']}");
                $this->log('info', "  Coverage: {$metrics['coverage']}%");
                $this->log('info', "");
                $this->log('info', "🔗 Dashboard: {$sonarUrl}/dashboard?id={$projectKey}");
                
                if ($metrics['qualityGateStatus'] === 'ERROR') {
                    $this->log('warning', '⚠️  Quality Gate FAILED!');
                } else {
                    $this->log('success', '✅ Quality Gate PASSED!');
                }
                
                return [
                    'success' => true,
                    'quality_gate_passed' => $metrics['qualityGateStatus'] !== 'ERROR',
                    'scan_result_id' => $scanResult->id,
                ];
            } else {
                throw new \Exception('Failed to extract task ID from SonarQube scanner output');
            }
            
        } catch (\Exception $e) {
            $this->log('error', '❌ SonarQube analysis failed: ' . $e->getMessage());
            Log::error('SonarQube analysis failed', [
                'execution_uuid' => $this->execution->uuid,
                'error' => $e->getMessage(),
            ]);
            
            if (isset($scanResult)) {
                $scanResult->update([
                    'status' => 'failed',
                    'summary' => 'Analysis failed: ' . $e->getMessage(),
                ]);
            }
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
    
    private function installSonarScanner($server): void
    {
        // Check if already installed
        $checkCommand = "which sonar-scanner 2>/dev/null || echo NOT_FOUND";
        $checkResult = instant_remote_process([$checkCommand], $server, false);
        
        if ($checkResult && !str_contains($checkResult, 'NOT_FOUND')) {
            $this->log('info', '  ✅ SonarQube Scanner already installed at: ' . trim($checkResult));
            return;
        }
        
        $this->log('info', '  📥 Installing SonarQube Scanner...');
        
        // Step 1: Check prerequisites
        $this->log('info', '  Checking prerequisites...');
        $prereqCheck = instant_remote_process([
            'echo "wget: $(which wget 2>/dev/null || echo NOT_FOUND)"',
            'echo "unzip: $(which unzip 2>/dev/null || echo NOT_FOUND)"',
        ], $server, false);
        
        if ($prereqCheck) {
            $this->log('info', '  ' . str_replace("\n", "\n  ", trim($prereqCheck)));
        }
        
        // Step 2: Install prerequisites if needed
        if ($prereqCheck && (str_contains($prereqCheck, 'wget: NOT_FOUND') || str_contains($prereqCheck, 'unzip: NOT_FOUND'))) {
            $this->log('info', '  Installing prerequisites...');
            instant_remote_process([
                'apt-get update -qq 2>&1 | tail -1',
                'apt-get install -y wget unzip 2>&1 | tail -1',
            ], $server, false);
        }
        
        // Step 3: Download and install sonar-scanner with verbose output
        $installScript = <<<'BASH'
set -e
echo "Step 1: Cleaning old files..."
cd /tmp
rm -rf sonar-scanner* 2>/dev/null || true

echo "Step 2: Downloading sonar-scanner..."
wget --progress=dot:mega https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-6.2.1.4610-linux-x64.zip 2>&1 | tail -3

echo "Step 3: Extracting..."
unzip -q sonar-scanner-cli-6.2.1.4610-linux-x64.zip

echo "Step 4: Moving to /opt..."
rm -rf /opt/sonar-scanner 2>/dev/null || true
mv sonar-scanner-6.2.1.4610-linux-x64 /opt/sonar-scanner

echo "Step 5: Creating symlink..."
ln -sf /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner

echo "Step 6: Cleaning up..."
rm -f sonar-scanner-cli-6.2.1.4610-linux-x64.zip

echo "Step 7: Verifying installation..."
which sonar-scanner

echo "INSTALLATION_SUCCESS"
BASH;
        
        $result = instant_remote_process([
            "bash -c " . escapeshellarg($installScript)
        ], $server, false);
        
        // Log the full output for debugging
        if ($result) {
            foreach (explode("\n", $result) as $line) {
                if (!empty(trim($line))) {
                    $this->log('info', '  ' . trim($line));
                }
            }
        }
        
        if ($result && str_contains($result, 'INSTALLATION_SUCCESS')) {
            $this->log('success', '  ✅ SonarQube Scanner installed successfully');
            
            // Verify installation
            $version = instant_remote_process(['sonar-scanner --version 2>&1 | head -1'], $server, false);
            if ($version) {
                $this->log('info', '  Version: ' . trim($version));
            }
        } else {
            $error = $result ?: 'No output from installation script';
            $this->log('error', '  ❌ Installation failed');
            $this->log('error', '  Output: ' . $error);
            throw new \Exception('Failed to install SonarQube Scanner: ' . $error);
        }
    }
    
    private function extractTaskId(?string $output): ?string
    {
        if (!$output) {
            $this->log('warning', '⚠️  Scanner output is empty');
            return null;
        }
        
        // Pattern 1: api/ce/task?id=xxx (nouveau format scanner 6.x)
        if (preg_match('/api\/ce\/task\?id=([a-zA-Z0-9_-]+)/', $output, $matches)) {
            $this->log('info', "  ✅ Task ID extracted (api/ce/task): {$matches[1]}");
            return $matches[1];
        }
        
        // Pattern 2: ceTaskId=xxx
        if (preg_match('/ceTaskId=([a-zA-Z0-9_-]+)/', $output, $matches)) {
            $this->log('info', "  ✅ Task ID extracted (ceTaskId): {$matches[1]}");
            return $matches[1];
        }
        
        // Pattern 3: More about the report processing at...
        if (preg_match('/More about.*?id=([a-zA-Z0-9_-]+)/', $output, $matches)) {
            $this->log('info', "  ✅ Task ID extracted (More about): {$matches[1]}");
            return $matches[1];
        }
        
        // Pattern 4: task id: xxx
        if (preg_match('/task\s+id:\s*([a-zA-Z0-9_-]+)/i', $output, $matches)) {
            $this->log('info', "  ✅ Task ID extracted (task id): {$matches[1]}");
            return $matches[1];
        }
        
        // Pattern 5: ceTaskUrl with task ID in URL
        if (preg_match('/ceTaskUrl=.*?id=([a-zA-Z0-9_-]+)/', $output, $matches)) {
            $this->log('info', "  ✅ Task ID extracted (ceTaskUrl): {$matches[1]}");
            return $matches[1];
        }
        
        $this->log('warning', '⚠️  Could not extract task ID from scanner output');
        $this->log('info', '  Searching for task ID in output...');
        
        // Try to find any line with task-like ID
        if (preg_match('/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/', $output, $matches)) {
            $this->log('info', '  Found potential task ID (UUID format): ' . $matches[1]);
            return $matches[1];
        }
        
        return null;
    }
    
    private function waitForAnalysis(string $taskId, string $sonarUrl, string $sonarToken, int $maxWaitSeconds = 300): void
    {
        $startTime = time();
        
        while (time() - $startTime < $maxWaitSeconds) {
            $response = Http::withBasicAuth($sonarToken, '')
                ->timeout(10)
                ->get("{$sonarUrl}/api/ce/task", ['id' => $taskId]);
            
            if ($response->successful()) {
                $task = $response->json('task');
                $status = $task['status'] ?? 'PENDING';
                
                if ($status === 'SUCCESS') {
                    $this->log('info', '  ✅ Analysis completed');
                    return;
                }
                
                if ($status === 'FAILED' || $status === 'CANCELED') {
                    throw new \Exception("SonarQube analysis task failed with status: {$status}");
                }
                
                $this->log('info', "  ⏳ Status: {$status}...");
            }
            
            sleep(5);
        }
        
        throw new \Exception("SonarQube analysis timeout after {$maxWaitSeconds} seconds");
    }
    
    private function fetchMetrics(string $projectKey, string $sonarUrl, string $sonarToken): array
    {
        $metricKeys = [
            'bugs',
            'vulnerabilities',
            'code_smells',
            'security_hotspots',
            'coverage',
            'duplicated_lines_density',
        ];
        
        $response = Http::withBasicAuth($sonarToken, '')
            ->timeout(10)
            ->get("{$sonarUrl}/api/measures/component", [
                'component' => $projectKey,
                'metricKeys' => implode(',', $metricKeys),
            ]);
        
        if (!$response->successful()) {
            throw new \Exception("Failed to fetch SonarQube metrics");
        }
        
        $measures = $response->json('component.measures', []);
        $metrics = [];
        
        foreach ($measures as $measure) {
            $metrics[$measure['metric']] = $measure['value'] ?? 0;
        }
        
        // Fetch quality gate status
        $qgResponse = Http::withBasicAuth($sonarToken, '')
            ->timeout(10)
            ->get("{$sonarUrl}/api/qualitygates/project_status", [
                'projectKey' => $projectKey,
            ]);
        
        $qualityGateStatus = $qgResponse->json('projectStatus.status', 'NONE');
        
        return [
            'qualityGateStatus' => $qualityGateStatus,
            'bugs' => (int) ($metrics['bugs'] ?? 0),
            'vulnerabilities' => (int) ($metrics['vulnerabilities'] ?? 0),
            'codeSmells' => (int) ($metrics['code_smells'] ?? 0),
            'securityHotspots' => (int) ($metrics['security_hotspots'] ?? 0),
            'coverage' => (float) ($metrics['coverage'] ?? 0),
            'duplications' => (float) ($metrics['duplicated_lines_density'] ?? 0),
        ];
    }
    
    private function generateSummary(array $metrics): string
    {
        $lines = [];
        $lines[] = "Quality Gate: {$metrics['qualityGateStatus']}";
        $lines[] = "Bugs: {$metrics['bugs']}";
        $lines[] = "Vulnerabilities: {$metrics['vulnerabilities']}";
        $lines[] = "Code Smells: {$metrics['codeSmells']}";
        $lines[] = "Security Hotspots: {$metrics['securityHotspots']}";
        $lines[] = "Coverage: {$metrics['coverage']}%";
        $lines[] = "Duplications: {$metrics['duplications']}%";
        
        return implode("\n", $lines);
    }
    
    private function generateSummaryFromResults(array $results, array $issues): string
    {
        $lines = [];
        $lines[] = "Quality Gate: " . ($results['quality_gate_status'] ?? 'UNKNOWN');
        $lines[] = "Bugs: " . ($results['bugs'] ?? 0);
        $lines[] = "Vulnerabilities: " . ($results['vulnerabilities'] ?? 0);
        $lines[] = "Code Smells: " . ($results['code_smells'] ?? 0);
        $lines[] = "Security Hotspots: " . ($results['security_hotspots'] ?? 0);
        $lines[] = "Coverage: " . ($results['coverage'] ?? 0) . "%";
        $lines[] = "Duplications: " . ($results['duplicated_lines_density'] ?? 0) . "%";
        $lines[] = "";
        $lines[] = "Detailed Issues:";
        $lines[] = "  Bugs found: " . count($issues['bugs'] ?? []);
        $lines[] = "  Vulnerabilities found: " . count($issues['vulnerabilities'] ?? []);
        $lines[] = "  Code Smells found: " . count($issues['code_smells'] ?? []);
        
        return implode("\n", $lines);
    }
    
    private function ensureProjectExists(string $projectKey, string $projectName, string $sonarUrl, string $sonarToken): bool
    {
        try {
            // Check if project exists
            $checkResponse = Http::withBasicAuth($sonarToken, '')
                ->timeout(10)
                ->get("{$sonarUrl}/api/projects/search", [
                    'projects' => $projectKey,
                ]);
            
            if ($checkResponse->successful()) {
                $projects = $checkResponse->json('components', []);
                
                // Project already exists
                if (count($projects) > 0) {
                    $this->log('info', '  Project already exists');
                    return true;
                }
            }
            
            // Create project
            $this->log('info', '  Creating new project...');
            $createResponse = Http::withBasicAuth($sonarToken, '')
                ->asForm()
                ->timeout(10)
                ->post("{$sonarUrl}/api/projects/create", [
                    'project' => $projectKey,
                    'name' => $projectName,
                ]);
            
            if ($createResponse->successful()) {
                $this->log('success', '  ✅ Project created successfully');
                return true;
            } else {
                $error = $createResponse->json('errors.0.msg', $createResponse->body());
                $this->log('warning', '  ⚠️  Could not create project: ' . $error);
                // Continue anyway - the scanner might create it
                return true;
            }
        } catch (\Exception $e) {
            $this->log('warning', '  ⚠️  Project check/create failed: ' . $e->getMessage());
            // Continue anyway - not critical
            return true;
        }
    }
    
    private function log(string $level, string $message): void
    {
        PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => 'sonarqube',
            'stage_name' => 'SonarQube Analysis',
            'level' => $level,
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
}
