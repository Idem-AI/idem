<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * HTTP Client for Express API
 * Centralizes all communication with the Express authentication and data service
 */
class ExpressApiClient
{
    private string $baseUrl;
    private string $apiKey;
    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = config('idem.api_url', env('IDEM_API_URL', 'http://localhost:3001'));
        $this->apiKey = env('EXPRESS_API_KEY', '');
        $this->timeout = 30;

        if (empty($this->apiKey)) {
            Log::warning('EXPRESS_API_KEY not configured. Inter-service communication may fail.');
        }
    }

    /**
     * Verify a Firebase session cookie and get user data
     *
     * @param string $sessionCookie
     * @return array|null User data or null if verification fails
     */
    public function verifySession(string $sessionCookie): ?array
    {
        try {
            Log::info('[Express API] Verifying session cookie');

            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'X-API-Key' => $this->apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->withCookies(['session' => $sessionCookie], parse_url($this->baseUrl, PHP_URL_HOST))
                ->post("{$this->baseUrl}/auth/verify-session");

            if ($response->successful()) {
                $data = $response->json();
                
                if ($data['success'] ?? false) {
                    Log::info('[Express API] Session verified successfully', [
                        'user_id' => $data['user']['uid'] ?? 'unknown'
                    ]);
                    return $data['user'];
                }
            }

            Log::warning('[Express API] Session verification failed', [
                'status' => $response->status(),
                'response' => $response->body()
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('[Express API] Error verifying session', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return null;
        }
    }

    /**
     * Get user profile by UID
     *
     * @param string $uid
     * @return array|null
     */
    public function getUserProfile(string $uid): ?array
    {
        $cacheKey = "express_user_{$uid}";

        return Cache::remember($cacheKey, 300, function () use ($uid) {
            try {
                Log::info('[Express API] Fetching user profile', ['uid' => $uid]);

                $response = Http::timeout($this->timeout)
                    ->withHeaders([
                        'X-API-Key' => $this->apiKey,
                    ])
                    ->get("{$this->baseUrl}/auth/profile");

                if ($response->successful()) {
                    return $response->json();
                }

                return null;
            } catch (\Exception $e) {
                Log::error('[Express API] Error fetching user profile', [
                    'uid' => $uid,
                    'error' => $e->getMessage()
                ]);
                return null;
            }
        });
    }

    /**
     * Get all teams for a user
     *
     * @param string $userId
     * @param string $sessionCookie
     * @return array
     */
    public function getUserTeams(string $userId, string $sessionCookie): array
    {
        try {
            Log::info('[Express API] Fetching user teams', ['user_id' => $userId]);

            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'X-API-Key' => $this->apiKey,
                ])
                ->withCookies(['session' => $sessionCookie], parse_url($this->baseUrl, PHP_URL_HOST))
                ->get("{$this->baseUrl}/api/teams/user/{$userId}");

            if ($response->successful()) {
                $data = $response->json();
                return $data['teams'] ?? [];
            }

            return [];
        } catch (\Exception $e) {
            Log::error('[Express API] Error fetching user teams', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }

    /**
     * Get team by ID
     *
     * @param string $teamId
     * @param string $sessionCookie
     * @return array|null
     */
    public function getTeam(string $teamId, string $sessionCookie): ?array
    {
        try {
            Log::info('[Express API] Fetching team', ['team_id' => $teamId]);

            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'X-API-Key' => $this->apiKey,
                ])
                ->withCookies(['session' => $sessionCookie], parse_url($this->baseUrl, PHP_URL_HOST))
                ->get("{$this->baseUrl}/api/teams/{$teamId}");

            if ($response->successful()) {
                $data = $response->json();
                return $data['team'] ?? null;
            }

            return null;
        } catch (\Exception $e) {
            Log::error('[Express API] Error fetching team', [
                'team_id' => $teamId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Create a new team
     *
     * @param array $teamData
     * @param string $sessionCookie
     * @return array|null
     */
    public function createTeam(array $teamData, string $sessionCookie): ?array
    {
        try {
            Log::info('[Express API] Creating team', ['name' => $teamData['name'] ?? 'unknown']);

            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'X-API-Key' => $this->apiKey,
                ])
                ->withCookies(['session' => $sessionCookie], parse_url($this->baseUrl, PHP_URL_HOST))
                ->post("{$this->baseUrl}/api/teams", $teamData);

            if ($response->successful()) {
                $data = $response->json();
                return $data['team'] ?? null;
            }

            return null;
        } catch (\Exception $e) {
            Log::error('[Express API] Error creating team', [
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Add member to team
     *
     * @param string $teamId
     * @param array $memberData
     * @param string $sessionCookie
     * @return array|null
     */
    public function addTeamMember(string $teamId, array $memberData, string $sessionCookie): ?array
    {
        try {
            Log::info('[Express API] Adding team member', [
                'team_id' => $teamId,
                'email' => $memberData['email'] ?? 'unknown'
            ]);

            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'X-API-Key' => $this->apiKey,
                ])
                ->withCookies(['session' => $sessionCookie], parse_url($this->baseUrl, PHP_URL_HOST))
                ->post("{$this->baseUrl}/api/teams/{$teamId}/members", $memberData);

            if ($response->successful()) {
                $data = $response->json();
                return $data['team'] ?? null;
            }

            return null;
        } catch (\Exception $e) {
            Log::error('[Express API] Error adding team member', [
                'team_id' => $teamId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Clear user cache
     *
     * @param string $uid
     * @return void
     */
    public function clearUserCache(string $uid): void
    {
        Cache::forget("express_user_{$uid}");
    }
}
