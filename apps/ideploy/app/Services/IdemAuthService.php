<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class IdemAuthService
{
    private string $apiUrl;

    public function __construct()
    {
        $this->apiUrl = config('idem.api_url', 'http://localhost:3001');
    }

    /**
     * Verify user authentication by calling IDEM API with session cookie
     * This mimics the withCredentials: true behavior from JavaScript
     * 
     * @param string|null $sessionCookie The session cookie value
     * @return array|null User data from API or null if not authenticated
     */
    public function verifySession(?string $sessionCookie): ?array
    {
        if (!$sessionCookie) {
            Log::info('[IDEM Auth] No session cookie provided');
            return null;
        }

        try {
            Log::info('[IDEM Auth] Attempting to verify session with API', [
                'api_url' => $this->apiUrl,
                'has_cookie' => !empty($sessionCookie),
                'cookie_length' => strlen($sessionCookie),
                'endpoint' => "{$this->apiUrl}/auth/profile",
            ]);

            // Call IDEM API /auth/profile endpoint with session cookie
            // This is equivalent to withCredentials: true in JavaScript
            $response = Http::timeout(10)
                ->withHeaders([
                    'Cookie' => "session={$sessionCookie}",
                    'Accept' => 'application/json',
                ])
                ->get("{$this->apiUrl}/auth/profile");

            Log::info('[IDEM Auth] API response received', [
                'status' => $response->status(),
                'has_body' => !empty($response->body()),
                'body_length' => strlen($response->body()),
            ]);

            if ($response->successful()) {
                $userData = $response->json();
                
                Log::info('[IDEM Auth] Session verified successfully', [
                    'user_uid' => $userData['uid'] ?? 'unknown',
                    'user_email' => $userData['email'] ?? 'unknown',
                ]);

                return $userData;
            }

            if ($response->status() === 401 || $response->status() === 403) {
                Log::warning('[IDEM Auth] Session invalid or expired', [
                    'status' => $response->status(),
                    'response_body' => $response->body(),
                ]);
                return null;
            }

            Log::warning('[IDEM Auth] Unexpected response from API', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return null;

        } catch (\Exception $e) {
            Log::error('[IDEM Auth] Error verifying session with API', [
                'error' => $e->getMessage(),
                'error_class' => get_class($e),
                'api_url' => $this->apiUrl,
                'trace' => $e->getTraceAsString(),
            ]);
            return null;
        }
    }

    /**
     * Synchronize user from IDEM API to local database
     * Creates or updates user based on idem_uid
     * 
     * @param array $userData User data from IDEM API
     * @return User|null The synchronized user or null on failure
     */
    public function syncUser(array $userData): ?User
    {
        try {
            $uid = $userData['uid'] ?? null;
            $email = $userData['email'] ?? null;
            $displayName = $userData['displayName'] ?? null;
            $photoURL = $userData['photoURL'] ?? null;

            if (!$uid || !$email) {
                Log::error('[IDEM Auth] Missing required user data', [
                    'has_uid' => !empty($uid),
                    'has_email' => !empty($email),
                ]);
                return null;
            }

            Log::info('[IDEM Auth] Synchronizing user from API', [
                'uid' => $uid,
                'email' => $email,
                'has_photo' => !empty($photoURL),
            ]);

            // Try to find user by idem_uid first
            $user = User::where('idem_uid', $uid)->first();

            if ($user) {
                // User exists with idem_uid, just update
                $user->update([
                    'name' => $displayName ?? $user->name,
                    'email' => $email,
                    'photo_url' => $photoURL,
                    'email_verified_at' => $user->email_verified_at ?? now(),
                ]);

                Log::info('[IDEM Auth] User updated from API (by idem_uid)', [
                    'user_id' => $user->id,
                    'idem_uid' => $uid,
                ]);
            } else {
                // User not found by idem_uid, check if exists by email
                $user = User::where('email', $email)->first();

                if ($user) {
                    // User exists with this email but no idem_uid
                    // Update the existing user with idem_uid
                    $user->update([
                        'idem_uid' => $uid,
                        'name' => $displayName ?? $user->name,
                        'photo_url' => $photoURL,
                        'email_verified_at' => $user->email_verified_at ?? now(),
                    ]);

                    Log::info('[IDEM Auth] Existing user linked to IDEM', [
                        'user_id' => $user->id,
                        'idem_uid' => $uid,
                        'email' => $email,
                    ]);
                } else {
                    // User doesn't exist at all, create new
                    $user = User::create([
                        'idem_uid' => $uid,
                        'name' => $displayName ?? explode('@', $email)[0],
                        'email' => $email,
                        'photo_url' => $photoURL,
                        'email_verified_at' => now(),
                        'password' => null, // No password needed for IDEM auth
                    ]);

                    Log::info('[IDEM Auth] New user created from API', [
                        'user_id' => $user->id,
                        'idem_uid' => $uid,
                        'email' => $email,
                    ]);
                }
            }

            return $user;

        } catch (\Exception $e) {
            Log::error('[IDEM Auth] Error synchronizing user', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_data' => $userData,
            ]);
            return null;
        }
    }

    /**
     * Authenticate user by verifying session and syncing to local database
     * This is the main method used by middleware
     * 
     * @param string|null $sessionCookie The session cookie value
     * @return User|null The authenticated user or null
     */
    public function authenticateUser(?string $sessionCookie): ?User
    {
        Log::info('[IDEM Auth] Starting authentication process', [
            'has_session_cookie' => !empty($sessionCookie),
        ]);

        // Step 1: Verify session with IDEM API
        $userData = $this->verifySession($sessionCookie);

        if (!$userData) {
            Log::info('[IDEM Auth] Authentication failed: Invalid session');
            return null;
        }

        // Step 2: Sync user to local database
        $user = $this->syncUser($userData);

        if (!$user) {
            Log::error('[IDEM Auth] Authentication failed: Could not sync user');
            return null;
        }

        // Step 3: Log the user in to Laravel's auth system
        Auth::login($user);

        Log::info('[IDEM Auth] User authenticated successfully', [
            'user_id' => $user->id,
            'idem_uid' => $user->idem_uid,
            'email' => $user->email,
        ]);

        return $user;
    }

    /**
     * Check if user is authenticated via IDEM API
     * 
     * @param string|null $sessionCookie The session cookie value
     * @return bool
     */
    public function check(?string $sessionCookie): bool
    {
        return $this->verifySession($sessionCookie) !== null;
    }
}
