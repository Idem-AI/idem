<?php

namespace App\Policies;

use App\Models\Server;
use App\Models\User;

class ServerPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Server $server): bool
    {
        return $user->teams->contains('id', $server->team_id);
    }

    /**
     * Determine whether the user can create models.
     * Only IDEM platform admins and team owners can create servers.
     */
    public function create(User $user): bool
    {
        return $user->isIdemAdmin() || $user->isOwner();
    }

    /**
     * Determine whether the user can update the model.
     * Only admins and team owners can update servers.
     */
    public function update(User $user, Server $server): bool
    {
        // User must be part of the server's team
        if (!$user->teams->contains('id', $server->team_id)) {
            return false;
        }

        // Only IDEM admins or team owners can update
        return $user->isIdemAdmin() || $user->isOwner();
    }

    /**
     * Determine whether the user can delete the model.
     * Only admins and team owners can delete servers.
     */
    public function delete(User $user, Server $server): bool
    {
        // User must be part of the server's team
        if (!$user->teams->contains('id', $server->team_id)) {
            return false;
        }

        // Only IDEM admins or team owners can delete
        return $user->isIdemAdmin() || $user->isOwner();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Server $server): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Server $server): bool
    {
        return false;
    }

    /**
     * Determine whether the user can manage proxy (start/stop/restart).
     */
    public function manageProxy(User $user, Server $server): bool
    {
        // return $user->isAdmin() && $user->teams->contains('id', $server->team_id);
        return true;
    }

    /**
     * Determine whether the user can manage sentinel (start/stop).
     */
    public function manageSentinel(User $user, Server $server): bool
    {
        // return $user->isAdmin() && $user->teams->contains('id', $server->team_id);
        return true;
    }

    /**
     * Determine whether the user can manage CA certificates.
     */
    public function manageCaCertificate(User $user, Server $server): bool
    {
        // return $user->isAdmin() && $user->teams->contains('id', $server->team_id);
        return true;
    }

    /**
     * Determine whether the user can view security views.
     */
    public function viewSecurity(User $user, Server $server): bool
    {
        // return $user->isAdmin() && $user->teams->contains('id', $server->team_id);
        return true;
    }
}
