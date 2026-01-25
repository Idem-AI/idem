<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware pour vérifier que l'utilisateur est un administrateur IDEM
 * Utilisé pour les routes web (admin dashboard, gestion serveurs, etc.)
 */
class IdemAdminMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = auth()->user();

        if (!$user) {
            abort(401, 'Authentification requise');
        }

        // Vérifier si l'utilisateur a le rôle admin
        if (!$user->isIdemAdmin()) {
            abort(403, 'Accès refusé. Droits administrateur requis.');
        }

        return $next($request);
    }
}
