<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuthCheckController extends Controller
{
    /**
     * Vérifier si l'utilisateur est authentifié
     * Endpoint utilisé par la page welcome pour vérifier la session
     */
    public function check(Request $request)
    {
        Log::info('[Auth Check] Checking authentication status');
        
        // Si on arrive ici, c'est que le middleware express.auth a réussi
        $user = auth()->user();
        
        if ($user) {
            Log::info('[Auth Check] User authenticated', [
                'user_id' => $user->id,
                'email' => $user->email
            ]);
            
            return response()->json([
                'authenticated' => true,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ]
            ]);
        }
        
        // Ne devrait jamais arriver ici si le middleware fonctionne
        Log::warning('[Auth Check] No authenticated user found');
        
        return response()->json([
            'authenticated' => false
        ], 401);
    }
}
