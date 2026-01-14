<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Login et génération de JWT token
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Trouver l'utilisateur
        $user = User::where('email', $request->email)->first();

        // Vérifier le mot de passe
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email ou mot de passe incorrect.',
            ], 401);
        }

        // Générer le JWT token
        $token = $this->generateToken($user);

        return response()->json([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->idem_role,
            ],
        ]);
    }

    /**
     * Générer un JWT token pour un utilisateur
     */
    private function generateToken(User $user): string
    {
        $jwtSecret = config('idem.jwt_secret');
        $expiration = config('idem.jwt_expiration', 1440); // minutes

        if (!$jwtSecret) {
            throw new \Exception('JWT_SECRET non configuré dans .env');
        }

        $payload = [
            'iss' => config('app.url'),           // Issuer
            'sub' => $user->id,                   // Subject (user ID)
            'email' => $user->email,
            'name' => $user->name,
            'role' => $user->idem_role,
            'iat' => time(),                      // Issued at
            'exp' => time() + ($expiration * 60), // Expiration
        ];

        return JWT::encode($payload, $jwtSecret, 'HS256');
    }

    /**
     * Refresh token
     */
    public function refresh(Request $request)
    {
        $user = auth()->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Non authentifié.',
            ], 401);
        }

        $token = $this->generateToken($user);

        return response()->json([
            'success' => true,
            'token' => $token,
        ]);
    }

    /**
     * Logout (JWT est stateless, le logout est géré côté client)
     */
    public function logout()
    {
        return response()->json([
            'success' => true,
            'message' => 'Déconnexion réussie. Supprimez le token côté client.',
        ]);
    }

    /**
     * Get current authenticated user info
     */
    public function me(Request $request)
    {
        $user = auth()->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Non authentifié.',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->idem_role,
                'created_at' => $user->created_at,
            ],
        ]);
    }
}
