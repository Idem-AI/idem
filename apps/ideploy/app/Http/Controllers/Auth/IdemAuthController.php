<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class IdemAuthController extends Controller
{
    /**
     * Synchroniser l'utilisateur depuis l'API Idem avec le backend Laravel
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function sync(Request $request)
    {
        try {
            $userData = $request->input('user');

            if (!$userData || !isset($userData['id'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Données utilisateur invalides'
                ], 400);
            }

            // Créer ou mettre à jour l'utilisateur
            $user = User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    'name' => $userData['displayName'] ?? $userData['email'],
                    'email' => $userData['email'],
                    'email_verified_at' => now(),
                    // Stocker l'ID Firebase pour référence
                    'firebase_uid' => $userData['id'] ?? null,
                ]
            );

            // Connecter l'utilisateur dans Laravel
            Auth::login($user, true);

            Log::info('[IDEM Auth] Utilisateur synchronisé', [
                'user_id' => $user->id,
                'email' => $user->email
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Utilisateur synchronisé avec succès',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('[IDEM Auth] Erreur de synchronisation', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la synchronisation: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Vérifier si l'utilisateur est authentifié
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function check()
    {
        if (Auth::check()) {
            return response()->json([
                'authenticated' => true,
                'user' => [
                    'id' => Auth::user()->id,
                    'name' => Auth::user()->name,
                    'email' => Auth::user()->email,
                ]
            ]);
        }

        return response()->json([
            'authenticated' => false
        ], 401);
    }

    /**
     * Déconnexion
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout()
    {
        Auth::logout();

        return response()->json([
            'success' => true,
            'message' => 'Déconnexion réussie'
        ]);
    }

    /**
     * Afficher la page de vérification d'authentification
     * 
     * @return \Illuminate\View\View
     */
    public function showVerifying()
    {
        return view('auth.verifying');
    }

    /**
     * Afficher la page d'erreur d'authentification
     * 
     * @return \Illuminate\View\View
     */
    public function showError()
    {
        return view('auth.error');
    }
}
