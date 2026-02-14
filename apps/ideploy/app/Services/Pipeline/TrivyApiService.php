<?php

namespace App\Services\Pipeline;

use Illuminate\Support\Facades\Log;

class TrivyApiService
{
    protected string $baseUrl;

    public function __construct(string $baseUrl)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    /**
     * Scanner une image Docker
     */
    public function scanImage(string $imageName, array $options = []): array
    {
        try {
            $severity = $options['severity'] ?? ['HIGH', 'CRITICAL'];
            $format = $options['format'] ?? 'json';

            $command = sprintf(
                'trivy image --format %s --severity %s %s',
                escapeshellarg($format),
                escapeshellarg(implode(',', $severity)),
                escapeshellarg($imageName)
            );

            // Exécuter via Docker exec
            $output = [];
            $returnCode = 0;
            exec("docker exec idem-trivy {$command} 2>&1", $output, $returnCode);

            $outputStr = implode("\n", $output);

            if ($returnCode === 0 || $returnCode === 1) { // 1 = vulnerabilities found
                $results = json_decode($outputStr, true);

                if (json_last_error() === JSON_ERROR_NONE && isset($results['Results'])) {
                    return [
                        'success' => true,
                        'results' => $this->parseImageResults($results),
                        'raw' => $results,
                    ];
                }
            }

            throw new \Exception("Trivy scan failed: " . $outputStr);

        } catch (\Exception $e) {
            Log::error("Trivy image scan failed", [
                'image' => $imageName,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Scanner un filesystem (code source)
     */
    public function scanFilesystem(string $path, array $options = []): array
    {
        try {
            $severity = $options['severity'] ?? ['HIGH', 'CRITICAL'];
            $scanners = $options['scanners'] ?? ['vuln', 'secret', 'misconfig'];
            $format = $options['format'] ?? 'json';

            $command = sprintf(
                'trivy fs --format %s --severity %s --scanners %s %s',
                escapeshellarg($format),
                escapeshellarg(implode(',', $severity)),
                escapeshellarg(implode(',', $scanners)),
                escapeshellarg($path)
            );

            $output = [];
            $returnCode = 0;
            exec("docker exec idem-trivy {$command} 2>&1", $output, $returnCode);

            $outputStr = implode("\n", $output);

            if ($returnCode === 0 || $returnCode === 1) {
                $results = json_decode($outputStr, true);

                if (json_last_error() === JSON_ERROR_NONE && isset($results['Results'])) {
                    return [
                        'success' => true,
                        'results' => $this->parseFilesystemResults($results),
                        'raw' => $results,
                    ];
                }
            }

            throw new \Exception("Trivy filesystem scan failed: " . $outputStr);

        } catch (\Exception $e) {
            Log::error("Trivy filesystem scan failed", [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Scanner un repository Git
     */
    public function scanRepository(string $repoPath, array $options = []): array
    {
        try {
            $severity = $options['severity'] ?? ['HIGH', 'CRITICAL'];
            $format = $options['format'] ?? 'json';

            $command = sprintf(
                'trivy repo --format %s --severity %s %s',
                escapeshellarg($format),
                escapeshellarg(implode(',', $severity)),
                escapeshellarg($repoPath)
            );

            $output = [];
            $returnCode = 0;
            exec("docker exec idem-trivy {$command} 2>&1", $output, $returnCode);

            $outputStr = implode("\n", $output);

            if ($returnCode === 0 || $returnCode === 1) {
                $results = json_decode($outputStr, true);

                if (json_last_error() === JSON_ERROR_NONE) {
                    return [
                        'success' => true,
                        'results' => $this->parseRepositoryResults($results),
                        'raw' => $results,
                    ];
                }
            }

            throw new \Exception("Trivy repository scan failed: " . $outputStr);

        } catch (\Exception $e) {
            Log::error("Trivy repository scan failed", [
                'repo' => $repoPath,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Vérifier la connexion à Trivy
     */
    public function checkConnection(): bool
    {
        try {
            $output = [];
            $returnCode = 0;
            exec("docker exec idem-trivy trivy --version 2>&1", $output, $returnCode);

            return $returnCode === 0;

        } catch (\Exception $e) {
            Log::error("Trivy connection check failed", [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Parser les résultats d'un scan d'image
     */
    protected function parseImageResults(array $rawResults): array
    {
        $parsed = [
            'vulnerabilities' => [],
            'summary' => [
                'total' => 0,
                'critical' => 0,
                'high' => 0,
                'medium' => 0,
                'low' => 0,
            ],
        ];

        foreach ($rawResults['Results'] ?? [] as $result) {
            foreach ($result['Vulnerabilities'] ?? [] as $vuln) {
                $severity = strtolower($vuln['Severity'] ?? 'unknown');
                
                $parsed['vulnerabilities'][] = [
                    'id' => $vuln['VulnerabilityID'] ?? 'N/A',
                    'package' => $vuln['PkgName'] ?? 'N/A',
                    'installed_version' => $vuln['InstalledVersion'] ?? 'N/A',
                    'fixed_version' => $vuln['FixedVersion'] ?? 'Not fixed',
                    'severity' => $severity,
                    'title' => $vuln['Title'] ?? '',
                    'description' => $vuln['Description'] ?? '',
                ];

                $parsed['summary']['total']++;
                if (isset($parsed['summary'][$severity])) {
                    $parsed['summary'][$severity]++;
                }
            }
        }

        return $parsed;
    }

    /**
     * Parser les résultats d'un scan filesystem
     */
    protected function parseFilesystemResults(array $rawResults): array
    {
        $parsed = [
            'vulnerabilities' => [],
            'secrets' => [],
            'misconfigurations' => [],
            'summary' => [
                'vulnerabilities' => 0,
                'secrets' => 0,
                'misconfigurations' => 0,
            ],
        ];

        foreach ($rawResults['Results'] ?? [] as $result) {
            // Vulnerabilities
            foreach ($result['Vulnerabilities'] ?? [] as $vuln) {
                $parsed['vulnerabilities'][] = [
                    'id' => $vuln['VulnerabilityID'] ?? 'N/A',
                    'package' => $vuln['PkgName'] ?? 'N/A',
                    'severity' => strtolower($vuln['Severity'] ?? 'unknown'),
                    'title' => $vuln['Title'] ?? '',
                ];
                $parsed['summary']['vulnerabilities']++;
            }

            // Secrets
            foreach ($result['Secrets'] ?? [] as $secret) {
                $parsed['secrets'][] = [
                    'rule_id' => $secret['RuleID'] ?? 'N/A',
                    'category' => $secret['Category'] ?? 'N/A',
                    'severity' => strtolower($secret['Severity'] ?? 'unknown'),
                    'title' => $secret['Title'] ?? '',
                    'match' => $secret['Match'] ?? '',
                ];
                $parsed['summary']['secrets']++;
            }

            // Misconfigurations
            foreach ($result['Misconfigurations'] ?? [] as $misconfig) {
                $parsed['misconfigurations'][] = [
                    'id' => $misconfig['ID'] ?? 'N/A',
                    'type' => $misconfig['Type'] ?? 'N/A',
                    'severity' => strtolower($misconfig['Severity'] ?? 'unknown'),
                    'title' => $misconfig['Title'] ?? '',
                    'description' => $misconfig['Description'] ?? '',
                ];
                $parsed['summary']['misconfigurations']++;
            }
        }

        return $parsed;
    }

    /**
     * Parser les résultats d'un scan repository
     */
    protected function parseRepositoryResults(array $rawResults): array
    {
        return $this->parseFilesystemResults($rawResults);
    }
}
