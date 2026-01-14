<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Services\IdemQuotaService;

class CheckIdemQuota
{
    protected IdemQuotaService $quotaService;

    public function __construct(IdemQuotaService $quotaService)
    {
        $this->quotaService = $quotaService;
    }

    /**
     * Handle an incoming request.
     * Check if team has quota available for the requested resource
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $resourceType = 'app'): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Non authentifié.',
            ], 401);
        }

        $team = $user->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        // Admins bypass quota checks
        if ($user->idem_role === 'admin') {
            return $next($request);
        }

        // Check quota based on resource type
        $canProceed = $resourceType === 'app' 
            ? $this->quotaService->canDeployApp($team)
            : $this->quotaService->canAddServer($team);

        if (!$canProceed) {
            $upgradeInfo = $this->quotaService->needsUpgrade($team, $resourceType);
            
            return response()->json([
                'success' => false,
                'message' => $upgradeInfo['message'],
                'needs_upgrade' => true,
                'suggested_plan' => $upgradeInfo['suggested_plan'],
                'quota_usage' => $this->quotaService->getQuotaUsage($team),
            ], 403);
        }

        return $next($request);
    }
}
