<?php

use App\Models\Server;
use App\Models\User;

/**
 * Retourne les serveurs accessibles par l'utilisateur actuel
 * - Admin: tous les serveurs
 * - User: serveurs managés + serveurs de sa team
 * 
 * @return \Illuminate\Database\Eloquent\Builder
 */
function accessibleServers()
{
    $user = auth()->user();
    
    if (!$user) {
        return Server::query()->whereRaw('1 = 0'); // Aucun serveur si pas connecté
    }

    return Server::accessibleBy($user);
}

/**
 * Retourne uniquement les serveurs managés par la plateforme
 * (disponibles pour tous les users)
 * 
 * @return \Illuminate\Database\Eloquent\Builder
 */
function managedServers()
{
    return Server::managed();
}

/**
 * Vérifie si l'utilisateur actuel est un admin IDEM
 * 
 * @return bool
 */
function isIdemAdmin(): bool
{
    $user = auth()->user();
    return $user ? $user->isIdemAdmin() : false;
}

/**
 * Vérifie si l'utilisateur peut accéder à un serveur spécifique
 * 
 * @param Server $server
 * @param User|null $user
 * @return bool
 */
function canAccessServer(Server $server, ?User $user = null): bool
{
    $user = $user ?? auth()->user();
    
    if (!$user) {
        return false;
    }

    // Admin: accès à tous les serveurs
    if ($user->isIdemAdmin()) {
        return true;
    }

    // User normal: serveur managé OU serveur de sa team
    return $server->idem_managed || $server->team_id === ($user->currentTeam()->id ?? 0);
}

/**
 * Retourne les statistiques globales pour le dashboard admin
 * 
 * @return array
 */
function getAdminStats(): array
{
    if (!isIdemAdmin()) {
        abort(403, 'Accès refusé');
    }

    return [
        'users' => [
            'total' => \App\Models\User::count(),
            'admins' => \App\Models\User::where('idem_role', 'admin')->count(),
            'members' => \App\Models\User::where('idem_role', 'member')->count(),
            'recent' => \App\Models\User::where('created_at', '>=', now()->subDays(30))->count(),
        ],
        'teams' => [
            'total' => \App\Models\Team::count(),
        ],
        'servers' => [
            'total' => Server::count(),
            'managed' => Server::where('idem_managed', true)->count(),
            'personal' => Server::where('idem_managed', false)->count(),
        ],
        'applications' => [
            'total' => \App\Models\Application::count(),
            'running' => \App\Models\Application::where('status', 'running')->count(),
        ],
    ];
}
