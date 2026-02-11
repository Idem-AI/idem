<?php

namespace App\Services\Pipeline;

use App\Models\PipelineScanResult;
use App\Models\PipelineJob;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class TrivyService
{
    /**
     * Run Trivy security scan on a project
     */
    public function scan(PipelineJob $job, string $projectPath): PipelineScanResult
    {
        Log::info("Starting Trivy security scan for project: {$projectPath}");

        $scanResult = PipelineScanResult::create([
            'pipeline_job_id' => $job->id,
            'pipeline_execution_id' => $job->pipeline_execution_id,
            'tool' => 'trivy',
            'status' => 'pending',
        ]);

        try {
            // Run Trivy filesystem scan with JSON output
            $outputFile = storage_path("app/trivy-{$job->uuid}.json");
            
            $command = sprintf(
                'trivy fs --format json --output %s --scanners vuln,secret,config %s',
                escapeshellarg($outputFile),
                escapeshellarg($projectPath)
            );

            $result = Process::timeout(600) // 10 minutes timeout
                ->run($command);

            if (!file_exists($outputFile)) {
                throw new \Exception("Trivy scan failed: output file not created");
            }

            // Parse Trivy JSON output
            $trivyData = json_decode(file_get_contents($outputFile), true);
            unlink($outputFile); // Clean up

            if (!$trivyData) {
                throw new \Exception("Failed to parse Trivy output");
            }

            // Process vulnerabilities
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

            // Update scan result
            $scanResult->update([
                'status' => 'success',
                'critical_count' => $severityCounts['CRITICAL'],
                'high_count' => $severityCounts['HIGH'],
                'medium_count' => $severityCounts['MEDIUM'],
                'low_count' => $severityCounts['LOW'],
                'vulnerabilities_detail' => array_slice($vulnerabilities, 0, 100), // Limit to 100 for storage
                'secrets_found' => $secrets,
                'raw_data' => $trivyData,
                'summary' => $this->generateSummary($severityCounts, count($secrets)),
            ]);

            Log::info("Trivy scan completed successfully");

        } catch (\Exception $e) {
            Log::error("Trivy scan failed: " . $e->getMessage());
            
            $scanResult->update([
                'status' => 'failed',
                'summary' => 'Scan failed: ' . $e->getMessage(),
            ]);
        }

        return $scanResult->fresh();
    }

    /**
     * Process vulnerabilities from Trivy output
     */
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
                    'description' => $vuln['Description'] ?? '',
                    'references' => $vuln['References'] ?? [],
                ];
            }
        }

        // Sort by severity (CRITICAL first)
        $severityOrder = ['CRITICAL' => 0, 'HIGH' => 1, 'MEDIUM' => 2, 'LOW' => 3, 'UNKNOWN' => 4];
        usort($vulnerabilities, function($a, $b) use ($severityOrder) {
            return ($severityOrder[$a['severity']] ?? 999) <=> ($severityOrder[$b['severity']] ?? 999);
        });

        return $vulnerabilities;
    }

    /**
     * Process secrets from Trivy output
     */
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
                    'match' => $secret['Match'] ?? '',
                ];
            }
        }

        return $secrets;
    }

    /**
     * Generate human-readable summary
     */
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

    /**
     * Test Trivy installation
     */
    public function testInstallation(): bool
    {
        try {
            $result = Process::timeout(5)
                ->run('trivy --version');

            return $result->successful();
        } catch (\Exception $e) {
            Log::error("Trivy installation test failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Scan Docker image
     */
    public function scanImage(PipelineJob $job, string $imageName): PipelineScanResult
    {
        Log::info("Starting Trivy image scan for: {$imageName}");

        $scanResult = PipelineScanResult::create([
            'pipeline_job_id' => $job->id,
            'pipeline_execution_id' => $job->pipeline_execution_id,
            'tool' => 'trivy',
            'status' => 'pending',
        ]);

        try {
            $outputFile = storage_path("app/trivy-image-{$job->uuid}.json");
            
            $command = sprintf(
                'trivy image --format json --output %s %s',
                escapeshellarg($outputFile),
                escapeshellarg($imageName)
            );

            $result = Process::timeout(600)->run($command);

            if (!file_exists($outputFile)) {
                throw new \Exception("Trivy image scan failed: output file not created");
            }

            $trivyData = json_decode(file_get_contents($outputFile), true);
            unlink($outputFile);

            if (!$trivyData) {
                throw new \Exception("Failed to parse Trivy output");
            }

            $vulnerabilities = $this->processVulnerabilities($trivyData);
            
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

            $scanResult->update([
                'status' => 'success',
                'critical_count' => $severityCounts['CRITICAL'],
                'high_count' => $severityCounts['HIGH'],
                'medium_count' => $severityCounts['MEDIUM'],
                'low_count' => $severityCounts['LOW'],
                'vulnerabilities_detail' => array_slice($vulnerabilities, 0, 100),
                'raw_data' => $trivyData,
                'summary' => $this->generateSummary($severityCounts, 0),
            ]);

            Log::info("Trivy image scan completed successfully");

        } catch (\Exception $e) {
            Log::error("Trivy image scan failed: " . $e->getMessage());
            
            $scanResult->update([
                'status' => 'failed',
                'summary' => 'Scan failed: ' . $e->getMessage(),
            ]);
        }

        return $scanResult->fresh();
    }
}
