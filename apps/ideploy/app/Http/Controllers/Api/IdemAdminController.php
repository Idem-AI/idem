<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\User;
use App\Models\Team;
use App\Models\Server;
use App\Models\Application;
use App\Models\IdemSubscriptionPlan;
use App\Services\IdemServerService;
use App\Services\IdemQuotaService;
use App\Services\IdemSubscriptionService;

class IdemAdminController extends Controller
{
    protected IdemServerService $serverService;
    protected IdemQuotaService $quotaService;
    protected IdemSubscriptionService $subscriptionService;

    public function __construct(
        IdemServerService $serverService,
        IdemQuotaService $quotaService,
        IdemSubscriptionService $subscriptionService
    ) {
        $this->serverService = $serverService;
        $this->quotaService = $quotaService;
        $this->subscriptionService = $subscriptionService;
    }

    /**
     * Get global dashboard statistics
     */
    public function dashboard(): JsonResponse
    {
        $stats = [
            'users' => [
                'total' => User::count(),
                'admins' => User::where('idem_role', 'admin')->count(),
                'members' => User::where('idem_role', 'member')->count(),
                'recent' => User::where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'teams' => [
                'total' => Team::count(),
                'by_plan' => [
                    'free' => Team::where('idem_subscription_plan', 'free')->count(),
                    'basic' => Team::where('idem_subscription_plan', 'basic')->count(),
                    'pro' => Team::where('idem_subscription_plan', 'pro')->count(),
                    'enterprise' => Team::where('idem_subscription_plan', 'enterprise')->count(),
                ],
            ],
            'servers' => [
                'total' => Server::count(),
                'managed' => Server::where('idem_managed', true)->count(),
                'personal' => Server::where('idem_managed', false)->count(),
                'managed_stats' => $this->serverService->getManagedServerStats(),
            ],
            'applications' => [
                'total' => Application::count(),
                'running' => Application::where('status', 'running')->count(),
            ],
            'revenue' => [
                'monthly' => $this->calculateMonthlyRevenue(),
                'by_plan' => $this->calculateRevenueByPlan(),
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get all managed servers with full details
     */
    public function getManagedServers(): JsonResponse
    {
        $servers = $this->serverService->getManagedServers()->map(function ($server) {
            return [
                'id' => $server->id,
                'uuid' => $server->uuid,
                'name' => $server->name,
                'description' => $server->description,
                'ip' => $server->ip,
                'user' => $server->user,
                'port' => $server->port,
                'proxy_type' => $server->proxy_type,
                'idem_load_score' => $server->idem_load_score,
                'is_reachable' => $server->settings->is_reachable ?? false,
                'is_usable' => $server->settings->is_usable ?? false,
                'applications_count' => $server->applications()->count(),
                'databases_count' => $server->databases()->count(),
                'created_at' => $server->created_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $servers,
            'stats' => $this->serverService->getManagedServerStats(),
        ]);
    }

    /**
     * Get managed server details by UUID
     */
    public function getManagedServerDetails(string $uuid): JsonResponse
    {
        $server = Server::where('uuid', $uuid)
            ->where('idem_managed', true)
            ->with('settings', 'applications', 'databases')
            ->first();

        if (!$server) {
            return response()->json([
                'success' => false,
                'message' => 'Serveur introuvable.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $server->id,
                'uuid' => $server->uuid,
                'name' => $server->name,
                'description' => $server->description,
                'ip' => $server->ip,
                'user' => $server->user,
                'port' => $server->port,
                'proxy_type' => $server->proxy_type,
                'idem_load_score' => $server->idem_load_score,
                'settings' => $server->settings,
                'applications' => $server->applications->map(fn($app) => [
                    'id' => $app->id,
                    'name' => $app->name,
                    'status' => $app->status,
                    'created_at' => $app->created_at,
                ]),
                'databases' => $server->databases->map(fn($db) => [
                    'id' => $db->id,
                    'name' => $db->name,
                    'type' => $db->type ?? class_basename($db),
                    'created_at' => $db->created_at,
                ]),
            ],
        ]);
    }

    /**
     * Get all teams with subscription details
     */
    public function getTeams(Request $request): JsonResponse
    {
        $query = Team::query();

        // Filter by plan if provided
        if ($request->has('plan')) {
            $query->where('idem_subscription_plan', $request->plan);
        }

        $teams = $query->with('members', 'subscription')->paginate(20);

        $teams->getCollection()->transform(function ($team) {
            return [
                'id' => $team->id,
                'name' => $team->name,
                'description' => $team->description,
                'idem_subscription_plan' => $team->idem_subscription_plan,
                'idem_apps_count' => $team->idem_apps_count,
                'idem_servers_count' => $team->idem_servers_count,
                'idem_app_limit' => $team->idem_app_limit,
                'idem_server_limit' => $team->idem_server_limit,
                'idem_subscription_started_at' => $team->idem_subscription_started_at,
                'idem_subscription_expires_at' => $team->idem_subscription_expires_at,
                'members_count' => $team->members->count(),
                'created_at' => $team->created_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $teams,
        ]);
    }

    /**
     * Change team subscription plan
     */
    public function changeTeamSubscription(Request $request, int $teamId): JsonResponse
    {
        $request->validate([
            'plan' => 'required|string|in:free,basic,pro,enterprise',
        ]);

        $team = Team::find($teamId);

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        $result = $this->subscriptionService->changePlan($team, $request->plan);

        return response()->json($result, $result['success'] ? 200 : 400);
    }

    /**
     * Promote user to admin
     */
    public function promoteUser(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = User::find($request->user_id);

        if ($user->idem_role === 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'L\'utilisateur est déjà administrateur.',
            ], 400);
        }

        $user->update(['idem_role' => 'admin']);

        return response()->json([
            'success' => true,
            'message' => "Utilisateur {$user->name} promu administrateur.",
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'idem_role' => $user->idem_role,
            ],
        ]);
    }

    /**
     * Demote admin to member
     */
    public function demoteUser(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = User::find($request->user_id);

        if ($user->idem_role === 'member') {
            return response()->json([
                'success' => false,
                'message' => 'L\'utilisateur est déjà membre.',
            ], 400);
        }

        // Prevent demoting yourself
        if ($user->id === auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez pas vous rétrograder vous-même.',
            ], 400);
        }

        $user->update(['idem_role' => 'member']);

        return response()->json([
            'success' => true,
            'message' => "Utilisateur {$user->name} rétrogradé en membre.",
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'idem_role' => $user->idem_role,
            ],
        ]);
    }

    /**
     * Calculate monthly recurring revenue
     */
    private function calculateMonthlyRevenue(): float
    {
        $revenue = 0;

        foreach (['basic', 'pro', 'enterprise'] as $planName) {
            $plan = IdemSubscriptionPlan::findByName($planName);
            if ($plan) {
                $teamsCount = Team::where('idem_subscription_plan', $planName)->count();
                $planRevenue = $plan->billing_period === 'monthly' 
                    ? $plan->price 
                    : $plan->price / 12; // Convert yearly to monthly
                $revenue += $teamsCount * $planRevenue;
            }
        }

        return round($revenue, 2);
    }

    /**
     * Calculate revenue breakdown by plan
     */
    private function calculateRevenueByPlan(): array
    {
        $breakdown = [];

        foreach (['basic', 'pro', 'enterprise'] as $planName) {
            $plan = IdemSubscriptionPlan::findByName($planName);
            if ($plan) {
                $teamsCount = Team::where('idem_subscription_plan', $planName)->count();
                $planRevenue = $plan->billing_period === 'monthly' 
                    ? $plan->price 
                    : $plan->price / 12;
                $breakdown[$planName] = [
                    'teams_count' => $teamsCount,
                    'monthly_revenue' => round($teamsCount * $planRevenue, 2),
                ];
            }
        }

        return $breakdown;
    }

    /**
     * Export data for reporting
     */
    public function export(Request $request): JsonResponse
    {
        $type = $request->query('type', 'teams');

        $data = match($type) {
            'teams' => Team::with('members')->get(),
            'users' => User::all(),
            'servers' => Server::where('idem_managed', true)->with('settings')->get(),
            default => [],
        };

        return response()->json([
            'success' => true,
            'type' => $type,
            'data' => $data,
            'exported_at' => now(),
        ]);
    }
}
