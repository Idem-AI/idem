<?php

namespace App\Services;

use App\Models\User;
use App\Models\Team;
use App\Models\TeamInvitation;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UserManagementService
{
    /**
     * Create a new user with an automatically associated team
     * The user becomes the team owner
     */
    public function createUserWithTeam(array $userData): array
    {
        try {
            DB::beginTransaction();

            // Create the user
            $user = User::create([
                'name' => $userData['name'],
                'email' => $userData['email'],
                'password' => Hash::make($userData['password'] ?? Str::random(16)),
                'is_idem_admin' => $userData['is_admin'] ?? false,
            ]);

            // Create a team for the user
            $teamName = $userData['team_name'] ?? "{$user->name}'s Team";
            $team = Team::create([
                'name' => $teamName,
                'personal_team' => true,
                'show_boarding' => true,
            ]);

            // Attach user to team as owner
            $user->teams()->attach($team->id, [
                'role' => 'owner',
            ]);

            // Set as current team
            $user->update(['current_team_id' => $team->id]);

            // If not admin, initialize IDEM subscription to free plan
            if (!$user->is_idem_admin) {
                $team->update([
                    'idem_subscription_plan' => 'free',
                    'idem_subscription_status' => 'active',
                ]);
            }

            DB::commit();

            return [
                'success' => true,
                'user' => $user,
                'team' => $team,
                'message' => 'User and team created successfully',
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            
            return [
                'success' => false,
                'message' => 'Error creating user: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Create a user within an existing team (for team owners)
     */
    public function createTeamMember(Team $team, array $userData, User $creator): array
    {
        try {
            // Verify creator is owner or admin
            if (!$creator->isAdmin() && !$creator->isOwner()) {
                return [
                    'success' => false,
                    'message' => 'Only team owners and admins can create team members',
                ];
            }

            DB::beginTransaction();

            // Create the user
            $user = User::create([
                'name' => $userData['name'],
                'email' => $userData['email'],
                'password' => Hash::make($userData['password'] ?? Str::random(16)),
                'is_idem_admin' => false, // Team members cannot be admins
            ]);

            // Attach user to the team as member
            $user->teams()->attach($team->id, [
                'role' => 'member',
            ]);

            // Set as current team
            $user->update(['current_team_id' => $team->id]);

            DB::commit();

            return [
                'success' => true,
                'user' => $user,
                'message' => 'Team member created successfully',
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            
            return [
                'success' => false,
                'message' => 'Error creating team member: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Toggle user active status (for admins only)
     */
    public function toggleUserStatus(User $user): array
    {
        try {
            $user->update([
                'is_active' => !($user->is_active ?? true),
            ]);

            return [
                'success' => true,
                'is_active' => $user->is_active,
                'message' => $user->is_active ? 'User activated' : 'User deactivated',
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Error toggling user status: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get all users with their teams (for admins)
     */
    public function getAllUsersWithTeams()
    {
        return User::with(['teams', 'currentTeam'])
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get team members (for team owners and admins)
     */
    public function getTeamMembers(Team $team)
    {
        return $team->members()
            ->with(['teams'])
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Remove user from team (for team owners and admins)
     */
    public function removeFromTeam(User $user, Team $team, User $remover): array
    {
        try {
            // Verify remover has permission
            if (!$remover->isAdmin() && !$remover->isOwner()) {
                return [
                    'success' => false,
                    'message' => 'You do not have permission to remove team members',
                ];
            }

            // Cannot remove team owner
            if ($user->isOwnerOfTeam($team)) {
                return [
                    'success' => false,
                    'message' => 'Cannot remove team owner',
                ];
            }

            $user->teams()->detach($team->id);

            // If this was their current team, switch to another team or create a new one
            if ($user->current_team_id === $team->id) {
                $otherTeam = $user->teams()->first();
                if ($otherTeam) {
                    $user->update(['current_team_id' => $otherTeam->id]);
                }
            }

            return [
                'success' => true,
                'message' => 'User removed from team',
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Error removing user from team: ' . $e->getMessage(),
            ];
        }
    }
}
