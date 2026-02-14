<?php

namespace App\Jobs\Pipeline;

use App\Models\PipelineExecution;
use App\Models\PipelineLog;
use App\Models\PipelineScanResult;
use App\Models\PipelineToolConfig;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class TrivyStageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 900; // 15 minutes

    public function __construct(
        public PipelineExecution $execution
    ) {}

    public function handle(): array
    {
        $this->log('info', '🔒 Starting Trivy Security Scan...');
        
        try {
            $application = $this->execution->application;
            $server = $application->destination->server;
            $workspacePath = $this->execution->source_path;
            
            if (!$workspacePath) {
                throw new \Exception('Source code path not available');
            }
            
            // Get Trivy configuration from pipeline config
            $pipelineConfig = $this->execution->pipelineConfig;
            $trivyStageConfig = $pipelineConfig->stages['trivy'] ?? null;
            
            if (!$trivyStageConfig || !($trivyStageConfig['enabled'] ?? false)) {
                $this->log('info', '⏭️  Trivy is not enabled, skipping...');
                return ['success' => true, 'skipped' => true];
            }
            
            $scanTypes = $trivyStageConfig['config']['scan_types'] ?? ['vuln', 'secret'];
            $failOnCritical = $trivyStageConfig['config']['fail_on_critical'] ?? false;
            
            // Create scan result record
            $scanResult = PipelineScanResult::create([
                'pipeline_execution_id' => $this->execution->id,
                'tool' => 'trivy',
                'status' => 'running',
            ]);
            
            // Install Trivy if needed
            $this->log('info', '📦 Installing Trivy...');
            $this->installTrivy($server);
            
            // Run Trivy scan
            $this->log('info', '🔍 Scanning for vulnerabilities and secrets...');
            
            $outputPath = "/tmp/trivy-{$this->execution->uuid}.json";
            $scanCommand = $this->buildScanCommand($workspacePath, $outputPath);
            
            $output = instant_remote_process($scanCommand, $server, false);
            
            // Log scan progress
            if ($output) {
                foreach (explode("\n", $output) as $line) {
                    if (!empty(trim($line)) && !str_contains($line, 'Downloading')) {
                        $this->log('info', "  " . trim($line));
                    }
                }
            }
            
            // Fetch scan results
            $this->log('info', '📥 Retrieving scan results...');
            $resultsJson = instant_remote_process([
                "cat {$outputPath}",
                "rm -f {$outputPath}",
            ], $server);
            
            if (!$resultsJson) {
                throw new \Exception('Failed to retrieve Trivy scan results');
            }
            
            $trivyData = json_decode($resultsJson, true);
            
            if (!$trivyData) {
                throw new \Exception('Failed to parse Trivy output');
            }
            
            // Process results
            $vulnerabilities = $this->processVulnerabilities($trivyData);
            $secrets = $this->processSecrets($trivyData);
            
            // Count by severity
            $severityCounts = [
                'CRITICAL' => 0,
                'HIGH' => 0,
                'MEDIUM' => 0,
                'LOW' => 0,
            ];
            
            foreach ($vulnerabilities as $vuln) {
                $severity = $vuln['severity'] ?? 'UNKNOWN';
                if (isset($severityCounts[$severity])) {
                    $severityCounts[$severity]++;
                }
            }
            
            $totalVulns = array_sum($severityCounts);
            
            // Update scan result
            $scanResult->update([
                'status' => 'success',
                'total_vulnerabilities' => $totalVulns,
                'critical_count' => $severityCounts['CRITICAL'],
                'high_count' => $severityCounts['HIGH'],
                'medium_count' => $severityCounts['MEDIUM'],
                'low_count' => $severityCounts['LOW'],
                'vulnerabilities_detail' => array_slice($vulnerabilities, 0, 100),
                'secrets_found' => $secrets,
                'raw_data' => $trivyData,
                'summary' => $this->generateSummary($severityCounts, count($secrets)),
            ]);
            
            // Log summary
            $this->log('info', '');
            $this->log('info', '🔒 Security Scan Results:');
            $this->log('info', "  Total Vulnerabilities: {$totalVulns}");
            $this->log('info', "    🔴 Critical: {$severityCounts['CRITICAL']}");
            $this->log('info', "    🟠 High: {$severityCounts['HIGH']}");
            $this->log('info', "    🟡 Medium: {$severityCounts['MEDIUM']}");
            $this->log('info', "    🟢 Low: {$severityCounts['LOW']}");
            
            if (count($secrets) > 0) {
                $this->log('warning', "  ⚠️  Secrets Found: " . count($secrets));
                $this->log('warning', '  🔑 Please review and remove hardcoded secrets!');
            }
            
            // Determine if scan passed
            $criticalThreshold = $trivyConfig->config['critical_threshold'] ?? 0;
            $highThreshold = $trivyConfig->config['high_threshold'] ?? 5;
            
            $passed = $severityCounts['CRITICAL'] <= $criticalThreshold 
                   && $severityCounts['HIGH'] <= $highThreshold
                   && count($secrets) === 0;
            
            if ($passed) {
                $this->log('success', '✅ Security scan PASSED!');
            } else {
                $this->log('warning', '⚠️  Security scan found issues!');
            }
            
            return [
                'success' => true,
                'scan_passed' => $passed,
                'scan_result_id' => $scanResult->id,
                'critical_count' => $severityCounts['CRITICAL'],
                'secrets_count' => count($secrets),
            ];
            
        } catch (\Exception $e) {
            $this->log('error', '❌ Trivy scan failed: ' . $e->getMessage());
            Log::error('Trivy scan failed', [
                'execution_uuid' => $this->execution->uuid,
                'error' => $e->getMessage(),
            ]);
            
            if (isset($scanResult)) {
                $scanResult->update([
                    'status' => 'failed',
                    'summary' => 'Scan failed: ' . $e->getMessage(),
                ]);
            }
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
    
    private function installTrivy($server): void
    {
        $checkCommand = "which trivy";
        $installed = instant_remote_process([$checkCommand], $server, false);
        
        if (!$installed) {
            $this->log('info', '  Installing Trivy CLI...');
            
            $installCommands = [
                "wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add -",
                "echo 'deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main' | tee -a /etc/apt/sources.list.d/trivy.list",
                "apt-get update -qq",
                "apt-get install -y -qq trivy",
            ];
            
            instant_remote_process($installCommands, $server);
            $this->log('info', '  ✅ Trivy installed');
        } else {
            $this->log('info', '  ✅ Trivy already installed');
        }
    }
    
    private function buildScanCommand(string $workspacePath, string $outputPath): array
    {
        return [
            "cd {$workspacePath}",
            "trivy fs --format json --output {$outputPath} --scanners vuln,secret,config --severity CRITICAL,HIGH,MEDIUM,LOW . 2>&1 || true",
        ];
    }
    
    private function processVulnerabilities(array $trivyData): array
    {
        $vulnerabilities = [];
        
        foreach ($trivyData['Results'] ?? [] as $result) {
            foreach ($result['Vulnerabilities'] ?? [] as $vuln) {
                $vulnerabilities[] = [
                    'id' => $vuln['VulnerabilityID'] ?? 'N/A',
                    'package' => $vuln['PkgName'] ?? 'N/A',
                    'installed_version' => $vuln['InstalledVersion'] ?? 'N/A',
                    'fixed_version' => $vuln['FixedVersion'] ?? 'Not Fixed',
                    'severity' => $vuln['Severity'] ?? 'UNKNOWN',
                    'title' => $vuln['Title'] ?? 'N/A',
                    'description' => substr($vuln['Description'] ?? '', 0, 200),
                ];
            }
        }
        
        // Sort by severity
        $severityOrder = ['CRITICAL' => 0, 'HIGH' => 1, 'MEDIUM' => 2, 'LOW' => 3];
        usort($vulnerabilities, function($a, $b) use ($severityOrder) {
            return ($severityOrder[$a['severity']] ?? 999) <=> ($severityOrder[$b['severity']] ?? 999);
        });
        
        return $vulnerabilities;
    }
    
    private function processSecrets(array $trivyData): array
    {
        $secrets = [];
        
        foreach ($trivyData['Results'] ?? [] as $result) {
            foreach ($result['Secrets'] ?? [] as $secret) {
                $secrets[] = [
                    'rule_id' => $secret['RuleID'] ?? 'N/A',
                    'category' => $secret['Category'] ?? 'N/A',
                    'title' => $secret['Title'] ?? 'N/A',
                    'severity' => $secret['Severity'] ?? 'UNKNOWN',
                    'file' => $secret['Target'] ?? 'N/A',
                    'line' => $secret['StartLine'] ?? 0,
                ];
            }
        }
        
        return $secrets;
    }
    
    private function generateSummary(array $severityCounts, int $secretsCount): string
    {
        $lines = [];
        
        $total = array_sum($severityCounts);
        $lines[] = "Total Vulnerabilities: {$total}";
        $lines[] = "  - Critical: {$severityCounts['CRITICAL']}";
        $lines[] = "  - High: {$severityCounts['HIGH']}";
        $lines[] = "  - Medium: {$severityCounts['MEDIUM']}";
        $lines[] = "  - Low: {$severityCounts['LOW']}";
        
        if ($secretsCount > 0) {
            $lines[] = "Secrets Found: {$secretsCount}";
        }
        
        return implode("\n", $lines);
    }
    
    private function log(string $level, string $message): void
    {
        PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => 'trivy',
            'stage_name' => 'Trivy Security Scan',
            'level' => $level,
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
}
