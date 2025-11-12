<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

// Route de test pour vérifier la récupération du cookie
Route::get('/test-cookie', function (Request $request) {
    $sessionCookie = $request->cookie('session');
    $allCookies = $request->cookies->all();
    
    return response()->json([
        'has_session_cookie' => !empty($sessionCookie),
        'session_cookie_length' => $sessionCookie ? strlen($sessionCookie) : 0,
        'session_cookie_preview' => $sessionCookie ? substr($sessionCookie, 0, 50) . '...' : null,
        'all_cookies' => array_keys($allCookies),
        'cookie_count' => count($allCookies),
    ]);
});

// Route de test pour vérifier l'appel à l'API
Route::get('/test-api-call', function (Request $request) {
    $sessionCookie = $request->cookie('session');
    
    if (!$sessionCookie) {
        return response()->json([
            'error' => 'No session cookie found',
            'all_cookies' => array_keys($request->cookies->all()),
        ], 400);
    }
    
    $apiUrl = config('idem.api_url');
    
    try {
        $response = \Illuminate\Support\Facades\Http::timeout(10)
            ->withHeaders([
                'Cookie' => "session={$sessionCookie}",
                'Accept' => 'application/json',
            ])
            ->get("{$apiUrl}/auth/profile");
        
        return response()->json([
            'api_url' => $apiUrl,
            'status' => $response->status(),
            'success' => $response->successful(),
            'body' => $response->json(),
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'error' => $e->getMessage(),
            'api_url' => $apiUrl,
        ], 500);
    }
});
