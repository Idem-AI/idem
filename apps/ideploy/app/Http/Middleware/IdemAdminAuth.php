<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IdemAdminAuth
{
    /**
     * Handle an incoming request.
     * Verify that the authenticated user has admin role
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Non authentifié.',
            ], 401);
        }

        // Check if user has admin role
        if ($user->idem_role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé. Droits administrateur requis.',
            ], 403);
        }

        return $next($request);
    }
}
