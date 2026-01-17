<?php

namespace App\Services\Security;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Response;
use Exception;

class CrowdSecApiClient
{
    private string $baseUrl;
    private string $apiKey;
    private int $timeout = 10;
    
    public function __construct(string $baseUrl, string $apiKey)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
    }
    
    /**
     * Get all active decisions (bans)
     */
    public function getDecisions(array $filters = []): array
    {
        try {
            $response = $this->makeRequest('GET', '/v1/decisions', [
                'query' => $filters,
            ]);
            
            return $response->successful() ? $response->json() : [];
        } catch (Exception $e) {
            ray('CrowdSec API Error: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get decisions for specific IP
     */
    public function getDecisionsForIp(string $ip): array
    {
        return $this->getDecisions(['ip' => $ip]);
    }
    
    /**
     * Create a new decision (ban IP)
     */
    public function createDecision(
        string $ip,
        string $type = 'ban',
        int $duration = 3600,
        string $reason = 'Manual ban from iDeploy'
    ): bool {
        try {
            $response = $this->makeRequest('POST', '/v1/decisions', [
                'json' => [
                    'decisions' => [
                        [
                            'duration' => "{$duration}s",
                            'origin' => 'ideploy',
                            'scenario' => 'manual:ban',
                            'scope' => 'ip',
                            'type' => $type,
                            'value' => $ip,
                            'reason' => $reason,
                        ],
                    ],
                ],
            ]);
            
            return $response->successful();
        } catch (Exception $e) {
            ray('Failed to create decision: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Delete a decision (unban IP)
     */
    public function deleteDecision(string $ip): bool
    {
        try {
            $response = $this->makeRequest('DELETE', '/v1/decisions', [
                'query' => ['ip' => $ip],
            ]);
            
            return $response->successful();
        } catch (Exception $e) {
            ray('Failed to delete decision: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get all alerts
     */
    public function getAlerts(int $limit = 100, int $offset = 0): array
    {
        try {
            $response = $this->makeRequest('GET', '/v1/alerts', [
                'query' => [
                    'limit' => $limit,
                    'offset' => $offset,
                ],
            ]);
            
            return $response->successful() ? $response->json() : [];
        } catch (Exception $e) {
            ray('Failed to get alerts: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get alert by ID
     */
    public function getAlert(int $alertId): ?array
    {
        try {
            $response = $this->makeRequest('GET', "/v1/alerts/{$alertId}");
            
            return $response->successful() ? $response->json() : null;
        } catch (Exception $e) {
            ray('Failed to get alert: ' . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Delete alert
     */
    public function deleteAlert(int $alertId): bool
    {
        try {
            $response = $this->makeRequest('DELETE', "/v1/alerts/{$alertId}");
            
            return $response->successful();
        } catch (Exception $e) {
            ray('Failed to delete alert: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get metrics
     */
    public function getMetrics(): array
    {
        try {
            $response = $this->makeRequest('GET', '/v1/metrics');
            
            return $response->successful() ? $response->json() : [];
        } catch (Exception $e) {
            ray('Failed to get metrics: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Create a bouncer (generate API key)
     */
    public function createBouncer(string $name): ?string
    {
        try {
            $response = $this->makeRequest('POST', '/v1/bouncers', [
                'json' => [
                    'name' => $name,
                ],
            ]);
            
            if ($response->successful()) {
                $data = $response->json();
                return $data['api_key'] ?? null;
            }
            
            return null;
        } catch (Exception $e) {
            ray('Failed to create bouncer: ' . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Delete a bouncer
     */
    public function deleteBouncer(string $name): bool
    {
        try {
            $response = $this->makeRequest('DELETE', "/v1/bouncers/{$name}");
            
            return $response->successful();
        } catch (Exception $e) {
            ray('Failed to delete bouncer: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Reload CrowdSec configuration
     */
    public function reloadConfig(): bool
    {
        try {
            // CrowdSec doesn't have a direct reload endpoint
            // We need to send SIGHUP to the container
            // This will be handled in the deployment service
            return true;
        } catch (Exception $e) {
            ray('Failed to reload config: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Test connection to CrowdSec LAPI
     */
    public function testConnection(): bool
    {
        try {
            $response = $this->makeRequest('GET', '/v1/heartbeat');
            
            return $response->successful();
        } catch (Exception $e) {
            ray('Connection test failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get CrowdSec version
     */
    public function getVersion(): ?string
    {
        try {
            $response = $this->makeRequest('GET', '/v1/version');
            
            if ($response->successful()) {
                $data = $response->json();
                return $data['version'] ?? null;
            }
            
            return null;
        } catch (Exception $e) {
            ray('Failed to get version: ' . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Make HTTP request to CrowdSec LAPI
     */
    private function makeRequest(string $method, string $endpoint, array $options = []): Response
    {
        $url = $this->baseUrl . $endpoint;
        
        $request = Http::timeout($this->timeout)
            ->withHeaders([
                'X-Api-Key' => $this->apiKey,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ]);
        
        return match(strtoupper($method)) {
            'GET' => $request->get($url, $options['query'] ?? []),
            'POST' => $request->post($url, $options['json'] ?? []),
            'PUT' => $request->put($url, $options['json'] ?? []),
            'DELETE' => $request->delete($url, $options['query'] ?? []),
            default => throw new Exception("Unsupported HTTP method: {$method}"),
        };
    }
    
    /**
     * Set custom timeout
     */
    public function setTimeout(int $seconds): self
    {
        $this->timeout = $seconds;
        return $this;
    }
}
