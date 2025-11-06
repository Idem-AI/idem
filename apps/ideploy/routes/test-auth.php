<?php

use Illuminate\Support\Facades\Route;
use Idem\SharedAuth\AuthClient;

/*
|--------------------------------------------------------------------------
| Test Routes pour le Package shared-auth-php
|--------------------------------------------------------------------------
|
| Routes de test pour vérifier que le package fonctionne correctement
|
*/

// Test sans authentification
Route::get('/test/health', function () {
    return response()->json([
        'success' => true,
        'message' => 'Ideploy is running',
        'timestamp' => now()->toIso8601String(),
    ]);
});

// Test de l'AuthClient (sans auth)
Route::get('/test/api-health', function (AuthClient $authClient) {
    try {
        $isHealthy = $authClient->healthCheck();
        
        return response()->json([
            'success' => true,
            'api_accessible' => $isHealthy,
            'api_url' => config('idem.api_url'),
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
        ], 500);
    }
});

// Test de la page HTML d'erreur (sans authentification)
Route::get('/test/auth/page', function () {
    return view('idem-auth::unauthenticated', [
        'dashboardUrl' => config('idem.dashboard_url', 'http://localhost:4200')
    ]);
});

// Test avec authentification
Route::middleware(['idem.auth'])->group(function () {
    
    // Test de base
    Route::get('/test/auth/me', function () {
        $user = auth()->user();
        
        return response()->json([
            'success' => true,
            'authenticated' => true,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'firebase_uid' => $user->firebase_uid ?? null,
            ],
        ]);
    });
    
    // Test récupération teams
    Route::get('/test/auth/teams', function (AuthClient $authClient) {
        try {
            $user = auth()->user();
            $teams = $authClient->getMyTeams();
            
            return response()->json([
                'success' => true,
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                ],
                'teams' => array_map(fn($team) => [
                    'id' => $team->id,
                    'name' => $team->name,
                    'description' => $team->description,
                    'members_count' => count($team->members),
                ], $teams),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    });
    
    // Test récupération d'une team spécifique
    Route::get('/test/auth/teams/{teamId}', function (AuthClient $authClient, string $teamId) {
        try {
            $team = $authClient->getTeam($teamId);
            
            if (!$team) {
                return response()->json([
                    'success' => false,
                    'message' => 'Team not found',
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'team' => $team->toArray(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    });
});
