<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Services\ExpressApiClient;
use App\Models\User;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to verify Firebase session via Express API
 * Replaces local Laravel authentication with centralized Express authentication
 */
class VerifyExpressSession
{
    private ExpressApiClient $expressClient;

    public function __construct(ExpressApiClient $expressClient)
    {
        $this->expressClient = $expressClient;
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Get session cookie from request
        $sessionCookie = $request->cookie('session');

        if (!$sessionCookie) {
            Log::warning('[Express Auth] No session cookie found');
            
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated'
                ], 401);
            }

            return redirect()->route('login');
        }

        try {
            // Verify session with Express API
            $userData = $this->expressClient->verifySession($sessionCookie);

            if (!$userData) {
                Log::warning('[Express Auth] Session verification failed');
                
                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid or expired session'
                    ], 401);
                }

                return redirect()->route('login');
            }

            // Sync user with local database
            $user = $this->syncUser($userData);

            if (!$user) {
                Log::error('[Express Auth] Failed to sync user', ['uid' => $userData['uid'] ?? 'unknown']);
                
                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'User synchronization failed'
                    ], 500);
                }

                return redirect()->route('login');
            }

            // Log the user in
            Auth::login($user);

            // Store session cookie in request for later use
            $request->attributes->set('express_session', $sessionCookie);
            $request->attributes->set('express_user_data', $userData);

            Log::info('[Express Auth] User authenticated successfully', [
                'user_id' => $user->id,
                'email' => $user->email
            ]);

            return $next($request);

        } catch (\Exception $e) {
            Log::error('[Express Auth] Authentication error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Authentication error'
                ], 500);
            }

            return redirect()->route('login');
        }
    }

    /**
     * Sync user data from Express to local database
     *
     * @param array $userData
     * @return User|null
     */
    private function syncUser(array $userData): ?User
    {
        try {
            $uid = $userData['uid'] ?? null;
            $email = $userData['email'] ?? null;

            if (!$uid || !$email) {
                Log::error('[Express Auth] Missing required user data', ['data' => $userData]);
                return null;
            }

            // Find or create user
            $user = User::where('email', $email)->first();

            if (!$user) {
                Log::info('[Express Auth] Creating new user', ['email' => $email]);

                $user = User::create([
                    'name' => $userData['displayName'] ?? $email,
                    'email' => $email,
                    'password' => bcrypt(str()->random(32)), // Random password, not used
                    'email_verified_at' => now(),
                ]);
            } else {
                // Update user data
                $user->update([
                    'name' => $userData['displayName'] ?? $user->name,
                ]);
            }

            // Store Firebase UID for reference
            if (!$user->firebase_uid) {
                $user->update(['firebase_uid' => $uid]);
            }

            Log::info('[Express Auth] User synced successfully', [
                'user_id' => $user->id,
                'firebase_uid' => $uid
            ]);

            return $user;

        } catch (\Exception $e) {
            Log::error('[Express Auth] Error syncing user', [
                'error' => $e->getMessage(),
                'data' => $userData
            ]);
            return null;
        }
    }
}
