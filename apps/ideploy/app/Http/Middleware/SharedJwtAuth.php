<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class SharedJwtAuth
{
    /**
     * Handle an incoming request.
     * Validate JWT token from external API and sync user
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->extractToken($request);

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Token JWT manquant.',
            ], 401);
        }

        try {
            $payload = $this->validateToken($token);
            
            // Sync or create user from JWT payload
            $user = $this->syncUser($payload);
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Impossible de synchroniser l\'utilisateur.',
                ], 401);
            }

            // Authenticate user for this request
            Auth::login($user);
            $request->setUserResolver(fn() => $user);

        } catch (\Firebase\JWT\ExpiredException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token JWT expiré.',
            ], 401);
        } catch (\Firebase\JWT\SignatureInvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Signature JWT invalide.',
            ], 401);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token JWT invalide: ' . $e->getMessage(),
            ], 401);
        }

        return $next($request);
    }

    /**
     * Extract JWT token from request
     */
    private function extractToken(Request $request): ?string
    {
        // Try Authorization header first
        $header = $request->header('Authorization');
        if ($header && preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
            return $matches[1];
        }

        // Try query parameter
        return $request->query('token');
    }

    /**
     * Validate JWT token and decode payload
     */
    private function validateToken(string $token): object
    {
        $jwtSecret = config('idem.jwt_secret') ?? env('JWT_SECRET');
        
        if (!$jwtSecret) {
            throw new \Exception('JWT_SECRET non configuré');
        }

        // Decode and validate JWT
        return JWT::decode($token, new Key($jwtSecret, 'HS256'));
    }

    /**
     * Sync user from JWT payload
     * Expected payload: { user_id, email, name, role }
     */
    private function syncUser(object $payload): ?User
    {
        if (!isset($payload->email)) {
            throw new \Exception('Email manquant dans le payload JWT');
        }

        // Find or create user
        $user = User::where('email', $payload->email)->first();

        $userData = [
            'email' => $payload->email,
            'name' => $payload->name ?? $payload->email,
            'idem_role' => $this->mapRole($payload->role ?? 'member'),
        ];

        if ($user) {
            // Update existing user
            $user->update($userData);
        } else {
            // Create new user with random password (won't be used with JWT)
            $userData['password'] = bcrypt(bin2hex(random_bytes(32)));
            $userData['email_verified_at'] = now();
            $user = User::create($userData);
        }

        return $user;
    }

    /**
     * Map external role to internal idem_role
     */
    private function mapRole(?string $externalRole): string
    {
        return match(strtolower($externalRole ?? 'member')) {
            'admin', 'administrator' => 'admin',
            default => 'member',
        };
    }
}
