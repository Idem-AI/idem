<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\IdemSubscriptionService;
use App\Services\IdemQuotaService;
use App\Models\IdemSubscriptionPlan;

class IdemSubscriptionController extends Controller
{
    protected IdemSubscriptionService $subscriptionService;
    protected IdemQuotaService $quotaService;

    public function __construct(
        IdemSubscriptionService $subscriptionService,
        IdemQuotaService $quotaService
    ) {
        $this->subscriptionService = $subscriptionService;
        $this->quotaService = $quotaService;
    }

    /**
     * Get current team's subscription details
     */
    public function getSubscription(Request $request): JsonResponse
    {
        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        $details = $this->subscriptionService->getSubscriptionDetails($team);

        return response()->json([
            'success' => true,
            'data' => $details,
        ]);
    }

    /**
     * Get all available subscription plans
     */
    public function getPlans(): JsonResponse
    {
        $plans = $this->subscriptionService->getAvailablePlans();

        return response()->json([
            'success' => true,
            'data' => $plans,
        ]);
    }

    /**
     * Get team quota usage
     */
    public function getQuotas(Request $request): JsonResponse
    {
        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        $usage = $this->quotaService->getQuotaUsage($team);

        return response()->json([
            'success' => true,
            'data' => [
                'plan' => $team->idem_subscription_plan,
                'usage' => $usage,
            ],
        ]);
    }

    /**
     * Change subscription plan
     */
    public function changePlan(Request $request): JsonResponse
    {
        $request->validate([
            'plan' => 'required|string|in:free,basic,pro,enterprise',
        ]);

        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        // Check if user is admin or owner of the team
        $userRole = $team->members->where('id', $request->user()->id)->first()?->pivot->role;
        
        if (!in_array($userRole, ['owner', 'admin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Seuls les propriétaires et administrateurs peuvent changer le plan.',
            ], 403);
        }

        $result = $this->subscriptionService->changePlan($team, $request->plan);

        return response()->json($result, $result['success'] ? 200 : 400);
    }

    /**
     * Cancel subscription (revert to free)
     */
    public function cancelSubscription(Request $request): JsonResponse
    {
        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        // Check if user is owner of the team
        $userRole = $team->members->where('id', $request->user()->id)->first()?->pivot->role;
        
        if ($userRole !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => 'Seul le propriétaire peut annuler l\'abonnement.',
            ], 403);
        }

        $result = $this->subscriptionService->cancelSubscription($team);

        return response()->json($result, $result['success'] ? 200 : 400);
    }

    /**
     * Get upgrade suggestions
     */
    public function getUpgradeSuggestions(Request $request): JsonResponse
    {
        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        $availablePlans = $this->quotaService->getUpgradePlans($team);

        return response()->json([
            'success' => true,
            'data' => [
                'current_plan' => $team->idem_subscription_plan,
                'available_upgrades' => $availablePlans,
            ],
        ]);
    }

    /**
     * Check if can deploy (for pre-flight checks)
     */
    public function checkCanDeploy(Request $request): JsonResponse
    {
        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        $canDeploy = $this->quotaService->canDeployApp($team);
        $upgradeInfo = $this->quotaService->needsUpgrade($team, 'app');

        return response()->json([
            'success' => true,
            'data' => [
                'can_deploy' => $canDeploy,
                'needs_upgrade' => $upgradeInfo['needs_upgrade'],
                'message' => $upgradeInfo['message'],
                'suggested_plan' => $upgradeInfo['suggested_plan'] ?? null,
                'quota_usage' => $this->quotaService->getQuotaUsage($team),
            ],
        ]);
    }

    /**
     * Check if can add server (for pre-flight checks)
     */
    public function checkCanAddServer(Request $request): JsonResponse
    {
        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        $canAdd = $this->quotaService->canAddServer($team);
        $upgradeInfo = $this->quotaService->needsUpgrade($team, 'server');

        return response()->json([
            'success' => true,
            'data' => [
                'can_add_server' => $canAdd,
                'needs_upgrade' => $upgradeInfo['needs_upgrade'],
                'message' => $upgradeInfo['message'],
                'suggested_plan' => $upgradeInfo['suggested_plan'] ?? null,
                'quota_usage' => $this->quotaService->getQuotaUsage($team),
            ],
        ]);
    }
}
