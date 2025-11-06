<?php

namespace Idem\SharedAuth\Laravel\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Idem\SharedAuth\AuthClient;
use Idem\SharedAuth\Models\UserModel;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Middleware Laravel pour authentifier via l'API centrale
 * Équivalent du package TypeScript - contacte uniquement l'API centrale
 * 
 * L'API centrale gère Firebase en interne
 */
class ApiAuthMiddleware
{
    private Request $request;

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $this->request = $request;

        try {
            // Créer l'AuthClient
            $apiUrl = config('idem.api_url', 'http://localhost:3001');
            $authClient = new AuthClient($apiUrl);
            
            // Transférer les cookies via le header Cookie
            $cookieHeader = $this->getCookieHeaderFromRequest($request);
            if ($cookieHeader) {
                $authClient->setCookieHeader($cookieHeader);
            }
            
            // Vérifier l'authentification via l'API centrale
            // L'API centrale vérifie le cookie de session
            $userProfile = $authClient->getUserProfile();

            if (!$userProfile) {
                Log::warning('Authentication failed: No valid session', [
                    'ip' => $request->ip(),
                    'path' => $request->path(),
                ]);

                // Retourner une page HTML au lieu de JSON
                return $this->unauthenticatedResponse();
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

            return $this->unauthenticatedResponse();
        }

        return $this->unauthenticatedResponse();
    }

    /**
     * Retourner une réponse pour utilisateur non authentifié
     */
    private function unauthenticatedResponse(): Response
    {
        $dashboardUrl = config('idem.dashboard_url', 'http://localhost:4200');

        // Si c'est une requête API (JSON), retourner du JSON
        if ($this->request->expectsJson() || $this->request->is('api/*')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: No valid session',
                'redirect_url' => $dashboardUrl
            ], 401);
        }

        // Sinon, retourner une page HTML
        $html = view('idem-auth::unauthenticated', [
            'dashboardUrl' => $dashboardUrl
        ])->render();

        return response($html, 401);
    }

    /**
     * Obtenir le header Cookie depuis la requête
     */
    private function getCookieHeaderFromRequest(Request $request): ?string
    {
        // Récupérer tous les cookies de la requête
        $cookies = $request->cookies->all();
        
        if (empty($cookies)) {
            return null;
        }
        
        // Construire le header Cookie au format: "name1=value1; name2=value2"
        $cookiePairs = [];
        foreach ($cookies as $name => $value) {
            $cookiePairs[] = "{$name}={$value}";
        }
        
        return implode('; ', $cookiePairs);
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
