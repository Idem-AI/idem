<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Server;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class IdemSummaryController extends Controller
{
    public function summary(): JsonResponse
    {
        $user = Auth::user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->loadMissing('teams');
        $team = $user->teams->where('personal_team', true)->first()
            ?? $user->teams->first();

        if (! $team) {
            return response()->json($this->emptyResponse());
        }

        $teamId = $team->id;

        $projects = Project::where('team_id', $teamId)
            ->with(['applications', 'environments.services'])
            ->get();

        $applications = $projects
            ->pluck('applications')
            ->flatten()
            ->map(fn ($app) => [
                'uuid'           => $app->uuid,
                'name'           => $app->name,
                'status'         => $app->status,
                'fqdn'           => $app->fqdn,
                'build_pack'     => $app->build_pack,
                'git_repository' => $app->git_repository,
                'git_branch'     => $app->git_branch,
                'updated_at'     => $app->updated_at,
                'created_at'     => $app->created_at,
            ])->values();

        $databases = collect();
        foreach ($projects as $project) {
            $databases = $databases->merge($project->databases());
        }
        $databases = $databases->map(fn ($db) => [
            'uuid'       => $db->uuid,
            'name'       => $db->name,
            'status'     => $db->status,
            'type'       => class_basename($db),
            'updated_at' => $db->updated_at,
            'created_at' => $db->created_at,
        ])->values();

        $services = $projects
            ->pluck('environments')->flatten()
            ->pluck('services')->flatten()
            ->map(fn ($svc) => [
                'uuid'       => $svc->uuid,
                'name'       => $svc->name,
                'status'     => $svc->status ?? 'unknown',
                'updated_at' => $svc->updated_at,
                'created_at' => $svc->created_at,
            ])->values();

        $servers = Server::whereTeamId($teamId)
            ->select('id', 'uuid', 'name', 'ip', 'description', 'created_at', 'updated_at')
            ->get()
            ->load(['settings'])
            ->map(fn ($server) => [
                'uuid'         => $server->uuid,
                'name'         => $server->name,
                'ip'           => $server->ip,
                'description'  => $server->description,
                'is_reachable' => $server->settings->is_reachable ?? false,
                'is_usable'    => $server->settings->is_usable ?? false,
                'updated_at'   => $server->updated_at,
                'created_at'   => $server->created_at,
            ])->values();

        return response()->json([
            'applications' => $applications,
            'databases'    => $databases,
            'services'     => $services,
            'servers'      => $servers,
            'projects'     => $projects->map(fn ($p) => [
                'uuid'        => $p->uuid,
                'name'        => $p->name,
                'description' => $p->description,
                'updated_at'  => $p->updated_at,
                'created_at'  => $p->created_at,
            ])->values(),
            'stats' => [
                'totalApplications'  => $applications->count(),
                'totalDatabases'     => $databases->count(),
                'totalServices'      => $services->count(),
                'totalServers'       => $servers->count(),
                'totalProjects'      => $projects->count(),
                'runningApplications' => $applications->filter(
                    fn ($a) => str_starts_with(strtolower($a['status'] ?? ''), 'running')
                )->count(),
            ],
        ]);
    }

    private function emptyResponse(): array
    {
        return [
            'applications' => [],
            'databases'    => [],
            'services'     => [],
            'servers'      => [],
            'projects'     => [],
            'stats'        => [
                'totalApplications'   => 0,
                'totalDatabases'      => 0,
                'totalServices'       => 0,
                'totalServers'        => 0,
                'totalProjects'       => 0,
                'runningApplications' => 0,
            ],
        ];
    }
}
