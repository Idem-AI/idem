<?php

namespace Idem\SharedAuth\Laravel\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Idem\SharedAuth\AuthClient;
use Idem\SharedAuth\Models\UserModel;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * Middleware Laravel pour authentifier via l'API centrale
 * Équivalent du package TypeScript - contacte uniquement l'API centrale
 * 
 * L'API centrale gère Firebase en interne
 */
class ApiAuthMiddleware
{
    private AuthClient $authClient;

    public function __construct()
    {
        $apiUrl = config('idem.api_url', 'http://localhost:3001');
        $this->authClient = new AuthClient($apiUrl);
    }

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Récupérer le token d'authentification
        $token = $this->extractToken($request);

        if (!$token) {
            Log::warning('Authentication failed: No token provided', [
                'ip' => $request->ip(),
                'path' => $request->path(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: No authentication credentials provided'
            ], 401);
        }

        try {
            // Configurer le token pour l'AuthClient
            $this->authClient->setAuthToken($token);

            // Récupérer le profil utilisateur depuis l'API centrale
            // L'API centrale vérifie le token Firebase en interne
            $userProfile = $this->getUserProfileFromApi();

            if (!$userProfile) {
                Log::warning('Authentication failed: Invalid token or user not found', [
                    'ip' => $request->ip(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized: Invalid authentication credentials'
                ], 401);
            }

            // Synchroniser l'utilisateur localement
            $user = $this->syncUser($userProfile);

            if ($user) {
                Auth::login($user);
                $request->setUserResolver(fn() => $user);

                Log::info('User authenticated via API', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                ]);

                return $next($request);
            }

        } catch (\Exception $e) {
            Log::error('Authentication error: ' . $e->getMessage(), [
                'stack' => $e->getTraceAsString(),
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Unauthorized: Authentication failed'
        ], 401);
    }

    /**
     * Extraire le token d'authentification de la requête
     */
    private function extractToken(Request $request): ?string
    {
        // 1. Essayer le cookie de session
        $sessionCookie = $request->cookie('session');
        if ($sessionCookie) {
            return $sessionCookie;
        }

        // 2. Essayer le header Authorization
        $authHeader = $request->header('Authorization');
        if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
            return substr($authHeader, 7);
        }

        return null;
    }

    /**
     * Récupérer le profil utilisateur depuis l'API centrale (avec cache)
     */
    private function getUserProfileFromApi(): ?UserModel
    {
        try {
            // L'API centrale vérifie le token Firebase et retourne le profil
            $profile = $this->authClient->getUserProfile();
            
            if ($profile) {
                // Mettre en cache pour 5 minutes
                Cache::put(
                    "user_profile_{$profile->uid}",
                    $profile,
                    now()->addMinutes(5)
                );
            }

            return $profile;
        } catch (\Exception $e) {
            Log::warning('Failed to fetch user profile from API: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Synchroniser l'utilisateur localement
     */
    private function syncUser(UserModel $userProfile): ?\Illuminate\Foundation\Auth\User
    {
        try {
            $userModel = config('auth.providers.users.model');
            
            // Trouver l'utilisateur par UID ou email
            $user = $userModel::where('firebase_uid', $userProfile->uid)
                ->orWhere('email', $userProfile->email)
                ->first();

            $userData = [
                'email' => $userProfile->email,
                'name' => $userProfile->displayName ?? $userProfile->email,
                'firebase_uid' => $userProfile->uid,
                'email_verified_at' => $userProfile->isEmailVerified ? now() : null,
            ];

            if ($user) {
                // Mettre à jour l'utilisateur existant
                $user->update($userData);
                
                Log::info('User synchronized from API', [
                    'user_id' => $user->id,
                    'firebase_uid' => $userProfile->uid,
                ]);
            } else {
                // Créer un nouvel utilisateur
                $userData['password'] = bcrypt(bin2hex(random_bytes(32)));
                $userData['idem_role'] = $userProfile->isOwner ? 'owner' : 'member';
                
                $user = $userModel::create($userData);
                
                Log::info('New user created from API', [
                    'user_id' => $user->id,
                    'firebase_uid' => $userProfile->uid,
                ]);
            }

            return $user;
        } catch (\Exception $e) {
            Log::error('Error syncing user: ' . $e->getMessage());
            return null;
        }
    }
}
