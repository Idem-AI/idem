<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Determine whether the user can view any users.
     */
    public function viewAny(User $user): bool
    {
        // Only IDEM platform admins can view all users
        return $user->isIdemAdmin();
    }

    /**
     * Determine whether the user can view the user.
     */
    public function view(User $user, User $model): bool
    {
        // Users can view themselves, IDEM admins can view anyone
        return $user->id === $model->id || $user->isIdemAdmin();
    }

    /**
     * Determine whether the user can create users.
     */
    public function create(User $user): bool
    {
        // Only IDEM platform admins can create users
        return $user->isIdemAdmin();
    }

    /**
     * Determine whether the user can update the user.
     */
    public function update(User $user, User $model): bool
    {
        // Users can update themselves, admins can update anyone
        // Team owners can update users in their team
        if ($user->id === $model->id) {
            return true;
        }

        if ($user->isIdemAdmin()) {
            return true;
        }

        // Team owner can update their team members
        if ($user->isOwner()) {
            $teamIds = $user->teams->pluck('id');
            $modelTeamIds = $model->teams->pluck('id');
            return $teamIds->intersect($modelTeamIds)->isNotEmpty();
        }

        return false;
    }

    /**
     * Determine whether the user can delete the user.
     */
    public function delete(User $user, User $model): bool
    {
        // Only IDEM platform admins can delete users
        return $user->isIdemAdmin() && $user->id !== $model->id;
    }

    /**
     * Determine whether the user can activate/deactivate users.
     */
    public function toggleStatus(User $user, User $model): bool
    {
        // Only IDEM platform admins can activate/deactivate users
        return $user->isIdemAdmin() && $user->id !== $model->id;
    }

    /**
     * Determine whether the user can manage team members.
     */
    public function manageTeamMembers(User $user): bool
    {
        // IDEM admins and team owners can manage team members
        return $user->isIdemAdmin() || $user->isOwner();
    }
}
