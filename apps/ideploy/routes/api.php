<?php

use App\Http\Controllers\Api\ApplicationsController;
use App\Http\Controllers\Api\DatabasesController;
use App\Http\Controllers\Api\DeployController;
use App\Http\Controllers\Api\GithubController;
use App\Http\Controllers\Api\OtherController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ResourcesController;
use App\Http\Controllers\Api\SecurityController;
use App\Http\Controllers\Api\ServersController;
use App\Http\Controllers\Api\ServicesController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\IdemAdminController;
use App\Http\Controllers\Api\IdemSubscriptionController;
use App\Http\Controllers\Api\IdemStripeController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AuthCheckController;
use App\Http\Middleware\ApiAllowed;
use App\Http\Middleware\IdemAdminAuth;
use App\Http\Middleware\CheckIdemQuota;
use App\Jobs\PushServerUpdateJob;
use App\Models\Server;
use Illuminate\Support\Facades\Route;

Route::get('/health', [OtherController::class, 'healthcheck']);

// Express Auth Check - Endpoint pour vérifier l'authentification
Route::middleware(['express.auth'])->group(function () {
    Route::get('/auth/check', [AuthCheckController::class, 'check']);
});
Route::group([
    'prefix' => 'v1',
], function () {
    Route::get('/health', [OtherController::class, 'healthcheck']);
});

Route::post('/feedback', [OtherController::class, 'feedback']);

// IDEM Authentication routes (JWT)
Route::prefix('v1/auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

// IDEM SaaS Routes (JWT Authentication)
Route::group([
    'middleware' => [\App\Http\Middleware\SharedJwtAuth::class],
    'prefix' => 'v1',
], function () {
    // Client Subscription Routes
    Route::prefix('idem')->group(function () {
        Route::get('/subscription', [IdemSubscriptionController::class, 'getSubscription']);
        Route::get('/plans', [IdemSubscriptionController::class, 'getPlans']);
        Route::get('/quota', [IdemSubscriptionController::class, 'getQuotas']);
        Route::post('/subscription/change', [IdemSubscriptionController::class, 'changePlan']);
        Route::post('/subscription/cancel', [IdemSubscriptionController::class, 'cancelSubscription']);
        Route::get('/upgrade-suggestions', [IdemSubscriptionController::class, 'getUpgradeSuggestions']);
        Route::get('/preflight/app', [IdemSubscriptionController::class, 'checkCanDeploy']);
        Route::get('/preflight/server', [IdemSubscriptionController::class, 'checkCanAddServer']);
        
        // Stripe routes
        Route::post('/stripe/checkout', [IdemStripeController::class, 'createCheckoutSession']);
        Route::get('/stripe/success', [IdemStripeController::class, 'checkoutSuccess']);
        Route::post('/stripe/cancel-subscription', [IdemStripeController::class, 'cancelSubscription']);
        Route::post('/stripe/portal', [IdemStripeController::class, 'createPortalSession']);
    });

    // Admin Routes (requires admin role)
    Route::prefix('idem/admin')->middleware([IdemAdminAuth::class])->group(function () {
        Route::get('/dashboard', [IdemAdminController::class, 'dashboard']);
        Route::get('/servers/managed', [IdemAdminController::class, 'getManagedServers']);
        Route::get('/servers/managed/{uuid}', [IdemAdminController::class, 'getManagedServerDetails']);
        Route::get('/teams', [IdemAdminController::class, 'getTeams']);
        Route::get('/teams/{teamId}', [IdemAdminController::class, 'getTeamDetails']);
        Route::post('/teams/{teamId}/change-plan', [IdemAdminController::class, 'changeTeamSubscription']);
        Route::post('/users/promote', [IdemAdminController::class, 'promoteUser']);
        Route::post('/users/demote', [IdemAdminController::class, 'demoteUser']);
        Route::get('/export', [IdemAdminController::class, 'export']);
    });
});

Route::group([
    'middleware' => ['auth:sanctum', 'api.ability:write'],
    'prefix' => 'v1',
], function () {
    Route::get('/enable', [OtherController::class, 'enable_api']);
    Route::get('/disable', [OtherController::class, 'disable_api']);
});
Route::group([
    'middleware' => ['auth:sanctum', ApiAllowed::class, 'api.sensitive'],
    'prefix' => 'v1',
], function () {

    Route::get('/version', [OtherController::class, 'version'])->middleware(['api.ability:read']);

    Route::get('/teams', [TeamController::class, 'teams'])->middleware(['api.ability:read']);
    Route::get('/teams/current', [TeamController::class, 'current_team'])->middleware(['api.ability:read']);
    Route::get('/teams/current/members', [TeamController::class, 'current_team_members'])->middleware(['api.ability:read']);
    Route::get('/teams/{id}', [TeamController::class, 'team_by_id'])->middleware(['api.ability:read']);
    Route::get('/teams/{id}/members', [TeamController::class, 'members_by_id'])->middleware(['api.ability:read']);

    Route::get('/projects', [ProjectController::class, 'projects'])->middleware(['api.ability:read']);
    Route::get('/projects/{uuid}', [ProjectController::class, 'project_by_uuid'])->middleware(['api.ability:read']);
    Route::get('/projects/{uuid}/environments', [ProjectController::class, 'get_environments'])->middleware(['api.ability:read']);
    Route::get('/projects/{uuid}/{environment_name_or_uuid}', [ProjectController::class, 'environment_details'])->middleware(['api.ability:read']);
    Route::post('/projects/{uuid}/environments', [ProjectController::class, 'create_environment'])->middleware(['api.ability:write']);
    Route::delete('/projects/{uuid}/environments/{environment_name_or_uuid}', [ProjectController::class, 'delete_environment'])->middleware(['api.ability:write']);

    Route::post('/projects', [ProjectController::class, 'create_project'])->middleware(['api.ability:read']);
    Route::patch('/projects/{uuid}', [ProjectController::class, 'update_project'])->middleware(['api.ability:write']);
    Route::delete('/projects/{uuid}', [ProjectController::class, 'delete_project'])->middleware(['api.ability:write']);

    Route::get('/security/keys', [SecurityController::class, 'keys'])->middleware(['api.ability:read']);
    Route::post('/security/keys', [SecurityController::class, 'create_key'])->middleware(['api.ability:write']);

    Route::get('/security/keys/{uuid}', [SecurityController::class, 'key_by_uuid'])->middleware(['api.ability:read']);
    Route::patch('/security/keys/{uuid}', [SecurityController::class, 'update_key'])->middleware(['api.ability:write']);
    Route::delete('/security/keys/{uuid}', [SecurityController::class, 'delete_key'])->middleware(['api.ability:write']);

    Route::match(['get', 'post'], '/deploy', [DeployController::class, 'deploy'])->middleware(['api.ability:deploy']);
    Route::get('/deployments', [DeployController::class, 'deployments'])->middleware(['api.ability:read']);
    Route::get('/deployments/{uuid}', [DeployController::class, 'deployment_by_uuid'])->middleware(['api.ability:read']);
    Route::post('/deployments/{uuid}/cancel', [DeployController::class, 'cancel_deployment'])->middleware(['api.ability:deploy']);
    Route::get('/deployments/applications/{uuid}', [DeployController::class, 'get_application_deployments'])->middleware(['api.ability:read']);

    Route::get('/servers', [ServersController::class, 'servers'])->middleware(['api.ability:read']);
    Route::get('/servers/{uuid}', [ServersController::class, 'server_by_uuid'])->middleware(['api.ability:read']);
    Route::get('/servers/{uuid}/domains', [ServersController::class, 'domains_by_server'])->middleware(['api.ability:read']);
    Route::get('/servers/{uuid}/resources', [ServersController::class, 'resources_by_server'])->middleware(['api.ability:read']);

    Route::get('/servers/{uuid}/validate', [ServersController::class, 'validate_server'])->middleware(['api.ability:read']);

    Route::post('/servers', [ServersController::class, 'create_server'])->middleware(['api.ability:read']);
    Route::patch('/servers/{uuid}', [ServersController::class, 'update_server'])->middleware(['api.ability:write']);
    Route::delete('/servers/{uuid}', [ServersController::class, 'delete_server'])->middleware(['api.ability:write']);

    Route::get('/resources', [ResourcesController::class, 'resources'])->middleware(['api.ability:read']);

    Route::get('/applications', [ApplicationsController::class, 'applications'])->middleware(['api.ability:read']);
    Route::post('/applications/public', [ApplicationsController::class, 'create_public_application'])->middleware(['api.ability:write']);
    Route::post('/applications/private-github-app', [ApplicationsController::class, 'create_private_gh_app_application'])->middleware(['api.ability:write']);
    Route::post('/applications/private-deploy-key', [ApplicationsController::class, 'create_private_deploy_key_application'])->middleware(['api.ability:write']);
    Route::post('/applications/dockerfile', [ApplicationsController::class, 'create_dockerfile_application'])->middleware(['api.ability:write']);
    Route::post('/applications/dockerimage', [ApplicationsController::class, 'create_dockerimage_application'])->middleware(['api.ability:write']);
    Route::post('/applications/dockercompose', [ApplicationsController::class, 'create_dockercompose_application'])->middleware(['api.ability:write']);

    Route::get('/applications/{uuid}', [ApplicationsController::class, 'application_by_uuid'])->middleware(['api.ability:read']);
    Route::patch('/applications/{uuid}', [ApplicationsController::class, 'update_by_uuid'])->middleware(['api.ability:write']);
    Route::delete('/applications/{uuid}', [ApplicationsController::class, 'delete_by_uuid'])->middleware(['api.ability:write']);

    Route::get('/applications/{uuid}/envs', [ApplicationsController::class, 'envs'])->middleware(['api.ability:read']);
    Route::post('/applications/{uuid}/envs', [ApplicationsController::class, 'create_env'])->middleware(['api.ability:write']);
    Route::patch('/applications/{uuid}/envs/bulk', [ApplicationsController::class, 'create_bulk_envs'])->middleware(['api.ability:write']);
    Route::patch('/applications/{uuid}/envs', [ApplicationsController::class, 'update_env_by_uuid'])->middleware(['api.ability:write']);
    Route::delete('/applications/{uuid}/envs/{env_uuid}', [ApplicationsController::class, 'delete_env_by_uuid'])->middleware(['api.ability:write']);
    Route::get('/applications/{uuid}/logs', [ApplicationsController::class, 'logs_by_uuid'])->middleware(['api.ability:read']);

    Route::match(['get', 'post'], '/applications/{uuid}/start', [ApplicationsController::class, 'action_deploy'])->middleware(['api.ability:write']);
    Route::match(['get', 'post'], '/applications/{uuid}/restart', [ApplicationsController::class, 'action_restart'])->middleware(['api.ability:write']);
    Route::match(['get', 'post'], '/applications/{uuid}/stop', [ApplicationsController::class, 'action_stop'])->middleware(['api.ability:write']);

    Route::get('/github-apps', [GithubController::class, 'list_github_apps'])->middleware(['api.ability:read']);
    Route::post('/github-apps', [GithubController::class, 'create_github_app'])->middleware(['api.ability:write']);
    Route::patch('/github-apps/{github_app_id}', [GithubController::class, 'update_github_app'])->middleware(['api.ability:write']);
    Route::delete('/github-apps/{github_app_id}', [GithubController::class, 'delete_github_app'])->middleware(['api.ability:write']);
    Route::get('/github-apps/{github_app_id}/repositories', [GithubController::class, 'load_repositories'])->middleware(['api.ability:read']);
    Route::get('/github-apps/{github_app_id}/repositories/{owner}/{repo}/branches', [GithubController::class, 'load_branches'])->middleware(['api.ability:read']);

    Route::get('/databases', [DatabasesController::class, 'databases'])->middleware(['api.ability:read']);
    Route::post('/databases/postgresql', [DatabasesController::class, 'create_database_postgresql'])->middleware(['api.ability:write']);
    Route::post('/databases/mysql', [DatabasesController::class, 'create_database_mysql'])->middleware(['api.ability:write']);
    Route::post('/databases/mariadb', [DatabasesController::class, 'create_database_mariadb'])->middleware(['api.ability:write']);
    Route::post('/databases/mongodb', [DatabasesController::class, 'create_database_mongodb'])->middleware(['api.ability:write']);
    Route::post('/databases/redis', [DatabasesController::class, 'create_database_redis'])->middleware(['api.ability:write']);
    Route::post('/databases/clickhouse', [DatabasesController::class, 'create_database_clickhouse'])->middleware(['api.ability:write']);
    Route::post('/databases/dragonfly', [DatabasesController::class, 'create_database_dragonfly'])->middleware(['api.ability:write']);
    Route::post('/databases/keydb', [DatabasesController::class, 'create_database_keydb'])->middleware(['api.ability:write']);

    Route::get('/databases/{uuid}', [DatabasesController::class, 'database_by_uuid'])->middleware(['api.ability:read']);
    Route::get('/databases/{uuid}/backups', [DatabasesController::class, 'database_backup_details_uuid'])->middleware(['api.ability:read']);
    Route::get('/databases/{uuid}/backups/{scheduled_backup_uuid}/executions', [DatabasesController::class, 'list_backup_executions'])->middleware(['api.ability:read']);
    Route::patch('/databases/{uuid}', [DatabasesController::class, 'update_by_uuid'])->middleware(['api.ability:write']);
    Route::post('/databases/{uuid}/backups', [DatabasesController::class, 'create_backup'])->middleware(['api.ability:write']);
    Route::patch('/databases/{uuid}/backups/{scheduled_backup_uuid}', [DatabasesController::class, 'update_backup'])->middleware(['api.ability:write']);
    Route::delete('/databases/{uuid}', [DatabasesController::class, 'delete_by_uuid'])->middleware(['api.ability:write']);
    Route::delete('/databases/{uuid}/backups/{scheduled_backup_uuid}', [DatabasesController::class, 'delete_backup_by_uuid'])->middleware(['api.ability:write']);
    Route::delete('/databases/{uuid}/backups/{scheduled_backup_uuid}/executions/{execution_uuid}', [DatabasesController::class, 'delete_execution_by_uuid'])->middleware(['api.ability:write']);

    Route::match(['get', 'post'], '/databases/{uuid}/start', [DatabasesController::class, 'action_deploy'])->middleware(['api.ability:write']);
    Route::match(['get', 'post'], '/databases/{uuid}/restart', [DatabasesController::class, 'action_restart'])->middleware(['api.ability:write']);
    Route::match(['get', 'post'], '/databases/{uuid}/stop', [DatabasesController::class, 'action_stop'])->middleware(['api.ability:write']);

    Route::get('/services', [ServicesController::class, 'services'])->middleware(['api.ability:read']);
    Route::post('/services', [ServicesController::class, 'create_service'])->middleware(['api.ability:write']);

    Route::get('/services/{uuid}', [ServicesController::class, 'service_by_uuid'])->middleware(['api.ability:read']);
    Route::patch('/services/{uuid}', [ServicesController::class, 'update_by_uuid'])->middleware(['api.ability:write']);
    Route::delete('/services/{uuid}', [ServicesController::class, 'delete_by_uuid'])->middleware(['api.ability:write']);

    Route::get('/services/{uuid}/envs', [ServicesController::class, 'envs'])->middleware(['api.ability:read']);
    Route::post('/services/{uuid}/envs', [ServicesController::class, 'create_env'])->middleware(['api.ability:write']);
    Route::patch('/services/{uuid}/envs/bulk', [ServicesController::class, 'create_bulk_envs'])->middleware(['api.ability:write']);
    Route::patch('/services/{uuid}/envs', [ServicesController::class, 'update_env_by_uuid'])->middleware(['api.ability:write']);
    Route::delete('/services/{uuid}/envs/{env_uuid}', [ServicesController::class, 'delete_env_by_uuid'])->middleware(['api.ability:write']);

    Route::match(['get', 'post'], '/services/{uuid}/start', [ServicesController::class, 'action_deploy'])->middleware(['api.ability:write']);
    Route::match(['get', 'post'], '/services/{uuid}/restart', [ServicesController::class, 'action_restart'])->middleware(['api.ability:write']);
    Route::match(['get', 'post'], '/services/{uuid}/stop', [ServicesController::class, 'action_stop'])->middleware(['api.ability:write']);
});

Route::group([
    'prefix' => 'v1',
], function () {
    Route::post('/sentinel/push', function () {
        $token = request()->header('Authorization');
        if (! $token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        $naked_token = str_replace('Bearer ', '', $token);
        try {
            $decrypted = decrypt($naked_token);
            $decrypted_token = json_decode($decrypted, true);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Invalid token'], 401);
        }
        $server_uuid = data_get($decrypted_token, 'server_uuid');
        if (! $server_uuid) {
            return response()->json(['message' => 'Invalid token'], 401);
        }
        $server = Server::where('uuid', $server_uuid)->first();
        if (! $server) {
            return response()->json(['message' => 'Server not found'], 404);
        }

        if (isCloud() && data_get($server->team->subscription, 'stripe_invoice_paid', false) === false && $server->team->id !== 0) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($server->isFunctional() === false) {
            return response()->json(['message' => 'Server is not functional'], 401);
        }

        if ($server->settings->sentinel_token !== $naked_token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        $data = request()->all();

        // \App\Jobs\ServerCheckNewJob::dispatch($server, $data);
        PushServerUpdateJob::dispatch($server, $data);

        return response()->json(['message' => 'ok'], 200);
    });
});

Route::any('/{any}', function () {
    return response()->json(['message' => 'Not found.', 'docs' => 'https://coolify.io/docs'], 404);
})->where('any', '.*');
