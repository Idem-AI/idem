<?php

namespace App\Services;

use App\Models\Team;
use App\Models\IdemSubscriptionPlan;
use Carbon\Carbon;

class IdemSubscriptionService
{
    /**
     * Change team's subscription plan
     */
    public function changePlan(Team $team, string $newPlanName): array
    {
        $newPlan = IdemSubscriptionPlan::findByName($newPlanName);
        
        if (!$newPlan) {
            return [
                'success' => false,
                'message' => "Plan '{$newPlanName}' introuvable.",
            ];
        }

        if (!$newPlan->is_active) {
            return [
                'success' => false,
                'message' => "Le plan '{$newPlan->display_name}' n'est plus disponible.",
            ];
        }

        // Check if downgrading and if current usage exceeds new limits
        if ($this->isDowngrade($team->idem_subscription_plan, $newPlanName)) {
            $validationResult = $this->validateDowngrade($team, $newPlan);
            if (!$validationResult['valid']) {
                return [
                    'success' => false,
                    'message' => $validationResult['message'],
                ];
            }
        }

        $oldPlan = $team->idem_subscription_plan;

        // Update team subscription
        $team->update([
            'idem_subscription_plan' => $newPlanName,
            'idem_app_limit' => $newPlan->app_limit,
            'idem_server_limit' => $newPlan->server_limit,
            'idem_subscription_started_at' => now(),
            'idem_subscription_expires_at' => $this->calculateExpiryDate($newPlan),
        ]);

        return [
            'success' => true,
            'message' => "Plan changé de '{$oldPlan}' à '{$newPlan->display_name}' avec succès.",
            'old_plan' => $oldPlan,
            'new_plan' => $newPlanName,
        ];
    }

    /**
     * Cancel team's subscription (revert to free)
     */
    public function cancelSubscription(Team $team): array
    {
        if ($team->idem_subscription_plan === 'free') {
            return [
                'success' => false,
                'message' => 'Vous êtes déjà sur le plan gratuit.',
            ];
        }

        $freePlan = IdemSubscriptionPlan::findByName('free');
        
        if (!$freePlan) {
            return [
                'success' => false,
                'message' => 'Impossible de trouver le plan gratuit.',
            ];
        }

        // Validate downgrade to free plan
        $validationResult = $this->validateDowngrade($team, $freePlan);
        if (!$validationResult['valid']) {
            return [
                'success' => false,
                'message' => $validationResult['message'],
            ];
        }

        $oldPlan = $team->idem_subscription_plan;

        $team->update([
            'idem_subscription_plan' => 'free',
            'idem_app_limit' => $freePlan->app_limit,
            'idem_server_limit' => $freePlan->server_limit,
            'idem_subscription_started_at' => now(),
            'idem_subscription_expires_at' => null,
        ]);

        return [
            'success' => true,
            'message' => "Abonnement annulé. Vous êtes maintenant sur le plan gratuit.",
            'old_plan' => $oldPlan,
        ];
    }

    /**
     * Check if changing from one plan to another is a downgrade
     */
    private function isDowngrade(string $currentPlan, string $newPlan): bool
    {
        $planHierarchy = ['free', 'basic', 'pro', 'enterprise'];
        $currentIndex = array_search($currentPlan, $planHierarchy);
        $newIndex = array_search($newPlan, $planHierarchy);

        return $newIndex < $currentIndex;
    }

    /**
     * Validate if team can downgrade to a plan
     */
    private function validateDowngrade(Team $team, IdemSubscriptionPlan $newPlan): array
    {
        $quotaService = app(IdemQuotaService::class);
        
        $currentApps = $quotaService->getTeamAppsCount($team);
        $currentServers = $quotaService->getTeamServersCount($team);

        $errors = [];

        // Check apps limit (0 = unlimited)
        if (!$newPlan->hasUnlimitedApps() && $currentApps > $newPlan->app_limit) {
            $errors[] = "Vous avez {$currentApps} applications déployées, mais le plan '{$newPlan->display_name}' permet seulement {$newPlan->app_limit}.";
        }

        // Check servers limit (0 = unlimited)
        if (!$newPlan->hasUnlimitedServers() && $currentServers > $newPlan->server_limit) {
            $errors[] = "Vous avez {$currentServers} serveurs personnels, mais le plan '{$newPlan->display_name}' permet seulement {$newPlan->server_limit}.";
        }

        if (!empty($errors)) {
            return [
                'valid' => false,
                'message' => "Impossible de changer de plan : " . implode(' ', $errors) . " Veuillez réduire votre utilisation avant de changer de plan.",
            ];
        }

        return ['valid' => true];
    }

    /**
     * Calculate subscription expiry date
     */
    private function calculateExpiryDate(IdemSubscriptionPlan $plan): ?Carbon
    {
        if ($plan->isFree()) {
            return null; // Free plan never expires
        }

        return $plan->billing_period === 'monthly' 
            ? now()->addMonth() 
            : now()->addYear();
    }

    /**
     * Check if subscription is expired
     */
    public function isExpired(Team $team): bool
    {
        if (!$team->idem_subscription_expires_at) {
            return false; // No expiry (free plan)
        }

        return now()->greaterThan($team->idem_subscription_expires_at);
    }

    /**
     * Get subscription details for a team
     */
    public function getSubscriptionDetails(Team $team): array
    {
        $planName = $team->idem_subscription_plan ?? 'free';
        $plan = IdemSubscriptionPlan::findByName($planName);
        
        if (!$plan) {
            return [
                'plan' => null,
                'is_expired' => false,
                'days_remaining' => null,
                'limits' => [],
            ];
        }

        $daysRemaining = null;
        if ($team->idem_subscription_expires_at) {
            $daysRemaining = now()->diffInDays($team->idem_subscription_expires_at, false);
            $daysRemaining = max(0, ceil($daysRemaining));
        }

        $quotaService = app(IdemQuotaService::class);
        $usage = $quotaService->getQuotaUsage($team);

        return [
            'plan' => [
                'name' => $plan->name,
                'display_name' => $plan->display_name,
                'price' => $plan->price,
                'formatted_price' => $plan->formatted_price,
                'app_limit' => $plan->app_limit,
                'server_limit' => $plan->server_limit,
                'features' => $plan->features,
            ],
            'is_expired' => $this->isExpired($team),
            'started_at' => $team->idem_subscription_started_at,
            'expires_at' => $team->idem_subscription_expires_at,
            'days_remaining' => $daysRemaining,
            'usage' => $usage,
        ];
    }

    /**
     * Get all available plans
     */
    public function getAvailablePlans(): array
    {
        return IdemSubscriptionPlan::getActivePlans()->map(function ($plan) {
            return [
                'name' => $plan->name,
                'display_name' => $plan->display_name,
                'price' => $plan->price,
                'formatted_price' => $plan->formatted_price,
                'currency' => $plan->currency,
                'billing_period' => $plan->billing_period,
                'app_limit' => $plan->app_limit,
                'server_limit' => $plan->server_limit,
                'features' => $plan->features,
                'is_unlimited_apps' => $plan->hasUnlimitedApps(),
                'is_unlimited_servers' => $plan->hasUnlimitedServers(),
            ];
        })->toArray();
    }
}
