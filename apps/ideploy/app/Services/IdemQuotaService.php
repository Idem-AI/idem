<?php

namespace App\Services;

use App\Models\Team;
use App\Models\Application;
use App\Models\Server;
use App\Models\IdemSubscriptionPlan;

class IdemQuotaService
{
    /**
     * Check if team can deploy a new application
     */
    public function canDeployApp(Team $team): bool
    {
        // Admins have unlimited quotas
        if ($this->isTeamAdmin($team)) {
            return true;
        }

        $planName = $team->idem_subscription_plan ?? 'free';
        $plan = IdemSubscriptionPlan::findByName($planName);
        
        if (!$plan) {
            return false;
        }

        // Unlimited apps
        if ($plan->hasUnlimitedApps()) {
            return true;
        }

        // Check current usage against limit
        $currentApps = $this->getTeamAppsCount($team);
        return $currentApps < $plan->app_limit;
    }

    /**
     * Check if team can add a new personal server
     */
    public function canAddServer(Team $team): bool
    {
        // Admins have unlimited quotas
        if ($this->isTeamAdmin($team)) {
            return true;
        }

        $planName = $team->idem_subscription_plan ?? 'free';
        $plan = IdemSubscriptionPlan::findByName($planName);
        
        if (!$plan) {
            return false;
        }

        // Unlimited servers
        if ($plan->hasUnlimitedServers()) {
            return true;
        }

        // Check current usage against limit
        $currentServers = $this->getTeamServersCount($team);
        return $currentServers < $plan->server_limit;
    }

    /**
     * Get team's current applications count
     */
    public function getTeamAppsCount(Team $team): int
    {
        return Application::whereHas('environment.project', function ($query) use ($team) {
            $query->where('team_id', $team->id);
        })->count();
    }

    /**
     * Get team's current personal servers count (excluding IDEM managed servers)
     */
    public function getTeamServersCount(Team $team): int
    {
        return Server::where('team_id', $team->id)
            ->where('idem_managed', false)
            ->count();
    }

    /**
     * Sync team quota counters
     */
    public function syncQuotas(Team $team): void
    {
        $team->update([
            'idem_apps_count' => $this->getTeamAppsCount($team),
            'idem_servers_count' => $this->getTeamServersCount($team),
        ]);
    }

    /**
     * Get quota usage information
     */
    public function getQuotaUsage(Team $team): array
    {
        $planName = $team->idem_subscription_plan ?? 'free';
        $plan = IdemSubscriptionPlan::findByName($planName);
        
        if (!$plan) {
            return [
                'apps' => ['used' => 0, 'limit' => 0, 'unlimited' => false],
                'servers' => ['used' => 0, 'limit' => 0, 'unlimited' => false],
            ];
        }

        return [
            'apps' => [
                'used' => $this->getTeamAppsCount($team),
                'limit' => $plan->app_limit,
                'unlimited' => $plan->hasUnlimitedApps(),
                'percentage' => $plan->hasUnlimitedApps() ? 0 : 
                    ($plan->app_limit > 0 ? ($this->getTeamAppsCount($team) / $plan->app_limit) * 100 : 0),
            ],
            'servers' => [
                'used' => $this->getTeamServersCount($team),
                'limit' => $plan->server_limit,
                'unlimited' => $plan->hasUnlimitedServers(),
                'percentage' => $plan->hasUnlimitedServers() ? 0 : 
                    ($plan->server_limit > 0 ? ($this->getTeamServersCount($team) / $plan->server_limit) * 100 : 0),
            ],
        ];
    }

    /**
     * Check if team needs to upgrade
     */
    public function needsUpgrade(Team $team, string $resourceType = 'app'): array
    {
        $planName = $team->idem_subscription_plan ?? 'free';
        $plan = IdemSubscriptionPlan::findByName($planName);
        
        if (!$plan) {
            return ['needs_upgrade' => true, 'message' => 'Plan invalide', 'suggested_plan' => 'basic'];
        }

        if ($resourceType === 'app' && !$this->canDeployApp($team)) {
            return [
                'needs_upgrade' => true,
                'message' => "Vous avez atteint la limite de {$plan->app_limit} applications. Passez à un plan supérieur pour en déployer davantage.",
                'suggested_plan' => $this->suggestNextPlan($team->idem_subscription_plan),
            ];
        }

        if ($resourceType === 'server' && !$this->canAddServer($team)) {
            return [
                'needs_upgrade' => true,
                'message' => "Vous avez atteint la limite de {$plan->server_limit} serveurs personnels. Passez à un plan supérieur pour en ajouter.",
                'suggested_plan' => $this->suggestNextPlan($team->idem_subscription_plan),
            ];
        }

        return ['needs_upgrade' => false, 'message' => '', 'suggested_plan' => null];
    }

    /**
     * Suggest next plan based on current plan
     */
    private function suggestNextPlan(string $currentPlan): string
    {
        $planHierarchy = ['free', 'basic', 'pro', 'enterprise'];
        $currentIndex = array_search($currentPlan, $planHierarchy);
        
        if ($currentIndex === false || $currentIndex >= count($planHierarchy) - 1) {
            return 'enterprise';
        }

        return $planHierarchy[$currentIndex + 1];
    }

    /**
     * Get available plans for upgrade
     */
    public function getUpgradePlans(Team $team): array
    {
        $currentPlan = $team->idem_subscription_plan;
        $planHierarchy = ['free', 'basic', 'pro', 'enterprise'];
        $currentIndex = array_search($currentPlan, $planHierarchy);
        
        if ($currentIndex === false) {
            return IdemSubscriptionPlan::getActivePlans()->toArray();
        }

        return IdemSubscriptionPlan::where('is_active', true)
            ->where('sort_order', '>', $currentIndex + 1)
            ->orderBy('sort_order')
            ->get()
            ->toArray();
    }

    /**
     * Check if team owner is an admin
     * Admins are exempt from quota limitations
     */
    private function isTeamAdmin(Team $team): bool
    {
        // Get team owner
        $owner = $team->members()->wherePivot('role', 'owner')->first();
        
        if (!$owner) {
            return false;
        }

        return $owner->idem_role === 'admin';
    }
}
