<?php

namespace App\Http\Middleware;

use App\Services\IdemAuthService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class IdemAuthMiddleware
{
    protected IdemAuthService $idemAuthService;

    public function __construct(IdemAuthService $idemAuthService)
    {
        $this->idemAuthService = $idemAuthService;
    }

    /**
     * Handle an incoming request.
     * This middleware checks if the user is authenticated via IDEM API session cookie
     * and synchronizes the user to the local database.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Skip authentication for public routes (login, register, etc.)
        $publicPaths = [
            'login',
            'register',
            'password/reset',
            'password/email',
            'auth/link',
        ];

        $currentPath = $request->path();
        foreach ($publicPaths as $publicPath) {
            if (str_starts_with($currentPath, $publicPath)) {
                Log::info('[IDEM Auth Middleware] Skipping public path', ['path' => $currentPath]);
                return $next($request);
            }
        }

        Log::info('[IDEM Auth Middleware] Processing request', [
            'url' => $request->url(),
            'method' => $request->method(),
            'path' => $currentPath,
            'has_session_cookie' => $request->hasCookie('session'),
            'all_cookies' => array_keys($request->cookies->all()),
        ]);

        // Check if user is already authenticated in Laravel
        if (auth()->check()) {
            Log::info('[IDEM Auth Middleware] User already authenticated in Laravel', [
                'user_id' => auth()->id(),
                'email' => auth()->user()->email,
            ]);
            return $next($request);
        }

        // Extract session cookie
        // This mimics the withCredentials: true behavior from JavaScript
        // Note: The 'session' cookie must be excluded from EncryptCookies middleware
        $sessionCookie = $request->cookie('session');

        Log::info('[IDEM Auth Middleware] Cookie extraction attempt', [
            'has_cookie' => !empty($sessionCookie),
            'cookie_value_length' => $sessionCookie ? strlen($sessionCookie) : 0,
            'cookie_starts_with' => $sessionCookie ? substr($sessionCookie, 0, 20) . '...' : 'null',
        ]);

        if (!$sessionCookie) {
            Log::warning('[IDEM Auth Middleware] No session cookie found, continuing without auth', [
                'all_cookies' => $request->cookies->all(),
            ]);
            return $next($request);
        }

        Log::info('[IDEM Auth Middleware] Session cookie found, verifying with API', [
            'cookie_length' => strlen($sessionCookie),
        ]);

        // Authenticate user via IDEM API
        try {
            $user = $this->idemAuthService->authenticateUser($sessionCookie);

            if ($user) {
                Log::info('[IDEM Auth Middleware] User authenticated successfully', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'idem_uid' => $user->idem_uid,
                ]);
            } else {
                Log::warning('[IDEM Auth Middleware] Authentication failed or session invalid');
            }
        } catch (\Exception $e) {
            Log::error('[IDEM Auth Middleware] Exception during authentication', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return $next($request);
    }
}
