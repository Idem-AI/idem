<?php

namespace App\Services\Pipeline\Tools;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class TrivyService
{
    protected string $serverUrl;

    public function __construct(?string $serverUrl = null)
    {
        $this->serverUrl = $serverUrl ?? config('pipeline.trivy.server_url', 'http://ideploy-trivy-server:4954');
    }

    /**
     * Scan filesystem for vulnerabilities
     */
    public function scanFilesystem(string $path, array $options = []): array
    {
        try {
            $severity = $options['severity'] ?? ['CRITICAL', 'HIGH'];
            $scanTypes = $options['scan_types'] ?? ['vuln', 'secret'];

            $command = [
                'trivy',
                'fs',
                '--server', $this->serverUrl,
                '--severity', implode(',', $severity),
                '--scanners', implode(',', $scanTypes),
                '--format', 'json',
                '--quiet',
            ];

            if ($options['ignore_unfixed'] ?? false) {
                $command[] = '--ignore-unfixed';
            }

            $command[] = $path;

            $result = Process::run(implode(' ', $command));

            if ($result->successful()) {
                $output = json_decode($result->output(), true);
                
                return [
                    'success' => true,
                    'vulnerabilities' => $this->parseVulnerabilities($output),
                    'secrets' => $this->parseSecrets($output),
                    'summary' => $this->generateSummary($output),
                ];
            }

            return [
                'success' => false,
                'error' => $result->errorOutput(),
            ];
        } catch (\Exception $e) {
            Log::error('Trivy filesystem scan failed', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Scan Docker image for vulnerabilities
     */
    public function scanImage(string $imageName, array $options = []): array
    {
        try {
            $severity = $options['severity'] ?? ['CRITICAL', 'HIGH'];
            
            $command = [
                'trivy',
                'image',
                '--server', $this->serverUrl,
                '--severity', implode(',', $severity),
                '--format', 'json',
                '--quiet',
            ];

            if ($options['ignore_unfixed'] ?? false) {
                $command[] = '--ignore-unfixed';
            }

            $command[] = $imageName;

            $result = Process::run(implode(' ', $command));

            if ($result->successful()) {
                $output = json_decode($result->output(), true);
                
                return [
                    'success' => true,
                    'vulnerabilities' => $this->parseVulnerabilities($output),
                    'summary' => $this->generateSummary($output),
                    'passed' => $this->checkIfPassed($output, $severity),
                ];
            }

            return [
                'success' => false,
                'error' => $result->errorOutput(),
            ];
        } catch (\Exception $e) {
            Log::error('Trivy image scan failed', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Parse vulnerabilities from Trivy output
     */
    protected function parseVulnerabilities(array $output): array
    {
        $vulnerabilities = [];

        foreach ($output['Results'] ?? [] as $result) {
            foreach ($result['Vulnerabilities'] ?? [] as $vuln) {
                $vulnerabilities[] = [
                    'id' => $vuln['VulnerabilityID'] ?? 'UNKNOWN',
                    'package' => $vuln['PkgName'] ?? 'UNKNOWN',
                    'installed_version' => $vuln['InstalledVersion'] ?? '',
                    'fixed_version' => $vuln['FixedVersion'] ?? 'Not Available',
                    'severity' => $vuln['Severity'] ?? 'UNKNOWN',
                    'title' => $vuln['Title'] ?? '',
                    'description' => $vuln['Description'] ?? '',
                ];
            }
        }

        return $vulnerabilities;
    }

    /**
     * Parse secrets from Trivy output
     */
    protected function parseSecrets(array $output): array
    {
        $secrets = [];

        foreach ($output['Results'] ?? [] as $result) {
            foreach ($result['Secrets'] ?? [] as $secret) {
                $secrets[] = [
                    'category' => $secret['Category'] ?? 'UNKNOWN',
                    'title' => $secret['Title'] ?? '',
                    'severity' => $secret['Severity'] ?? 'UNKNOWN',
                    'match' => $secret['Match'] ?? '',
                ];
            }
        }

        return $secrets;
    }

    /**
     * Generate summary from scan results
     */
    protected function generateSummary(array $output): array
    {
        $summary = [
            'CRITICAL' => 0,
            'HIGH' => 0,
            'MEDIUM' => 0,
            'LOW' => 0,
            'UNKNOWN' => 0,
        ];

        foreach ($output['Results'] ?? [] as $result) {
            foreach ($result['Vulnerabilities'] ?? [] as $vuln) {
                $severity = $vuln['Severity'] ?? 'UNKNOWN';
                if (isset($summary[$severity])) {
                    $summary[$severity]++;
                }
            }
        }

        return $summary;
    }

    /**
     * Check if scan passed based on severity thresholds
     */
    protected function checkIfPassed(array $output, array $failOnSeverity): bool
    {
        $summary = $this->generateSummary($output);
        
        foreach ($failOnSeverity as $severity) {
            if (($summary[$severity] ?? 0) > 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if Trivy server is available
     */
    public function ping(): bool
    {
        try {
            $result = Process::timeout(5)->run("trivy --version");
            return $result->successful();
        } catch (\Exception $e) {
            return false;
        }
    }
}
