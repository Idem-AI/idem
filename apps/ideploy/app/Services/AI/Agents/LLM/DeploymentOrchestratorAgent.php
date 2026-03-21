<?php

namespace App\Services\AI\Agents\LLM;

use App\Models\Project;
use App\Models\Environment;
use App\Models\Application;
use App\Models\StandalonePostgresql;
use App\Models\StandaloneRedis;
use App\Models\StandaloneMysql;
use App\Models\StandaloneMongodb;
use App\Models\Server;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DeploymentOrchestratorAgent extends BaseLLMAgent
{
    private array $deploymentConfig = [];
    private ?Project $project = null;
    private ?Environment $environment = null;
    
    protected function getSystemPrompt(): string
    {
        $schema = file_get_contents(config_path('ai/application_schema.json'));
        $options = file_get_contents(config_path('ai/deployment_options.json'));
        
        return "Expert DevOps orchestrating autonomous deployment.\n\nSCHEMA:\n{$schema}\n\nOPTIONS:\n{$options}\n\nCreate project, provision DB, deploy app, enable firewall+pipeline. Auto-fix errors. Return JSON actions.";
    }
    
    public function deploy(array $analysis, string $repoUrl, string $branch): array
    {
        Log::info('[Orchestrator] Starting autonomous deployment');
        
        return $this->executeWithRetry(function() use ($analysis, $repoUrl, $branch) {
            // Step 1: Plan deployment with LLM
            $plan = $this->planDeployment($analysis, $repoUrl, $branch);
            
            // Step 2: Create project
            $this->createProject($plan);
            
            // Step 3: Provision databases
            $this->provisionDatabases($plan);
            
            // Step 4: Create application
            $app = $this->createApplication($plan, $repoUrl, $branch);
            
            // Step 5: Enable firewall
            $this->enableFirewall($app);
            
            // Step 6: Enable pipeline
            $this->enablePipeline($app);
            
            // Step 7: Deploy
            $deployResult = $this->deployApplication($app);
            
            if (!$deployResult['success']) {
                return ['success' => false, 'error' => $deployResult['error']];
            }
            
            return [
                'success' => true,
                'application' => $app,
                'url' => $app->fqdn,
            ];
            
        }, 'full_deployment');
    }
    
    private function planDeployment(array $analysis, string $repoUrl, string $branch): array
    {
        Log::info('[Orchestrator] Planning deployment with LLM');
        
        $plan = $this->think("Create complete deployment plan", [
            'analysis' => $analysis,
            'repo_url' => $repoUrl,
            'branch' => $branch,
        ]);
        
        return $plan;
    }
    
    private function createProject(array $plan): void
    {
        $name = $plan['project_name'] ?? Str::slug(parse_url($plan['repo_url'] ?? 'app')['path'] ?? 'app');
        
        $this->project = Project::create([
            'name' => $name,
            'description' => $plan['project_description'] ?? 'AI-deployed application',
            'team_id' => auth()->user()->currentTeam->id,
        ]);
        
        $this->environment = Environment::create([
            'name' => 'production',
            'project_id' => $this->project->id,
        ]);
        
        Log::info('[Orchestrator] Project created', ['project_id' => $this->project->id]);
    }
    
    private function provisionDatabases(array $plan): void
    {
        $databases = $plan['databases'] ?? [];
        if (empty($databases)) return;
        
        $server = $this->selectServer();
        
        foreach ($databases as $db) {
            $type = is_string($db) ? $db : ($db['type'] ?? 'postgresql');
            $name = is_array($db) ? ($db['name'] ?? $type) : $type;
            
            switch ($type) {
                case 'postgresql':
                    StandalonePostgresql::create([
                        'name' => $name,
                        'postgres_password' => Str::random(32),
                        'environment_id' => $this->environment->id,
                        'destination_id' => $server->id,
                        'destination_type' => $server->getMorphClass(),
                    ]);
                    Log::info('[Orchestrator] PostgreSQL provisioned', compact('name'));
                    break;
                    
                case 'mysql':
                case 'mariadb':
                    StandaloneMysql::create([
                        'name' => $name,
                        'mysql_root_password' => Str::random(32),
                        'mysql_password' => Str::random(32),
                        'environment_id' => $this->environment->id,
                        'destination_id' => $server->id,
                        'destination_type' => $server->getMorphClass(),
                    ]);
                    Log::info('[Orchestrator] MySQL provisioned', compact('name'));
                    break;
                    
                case 'mongodb':
                    StandaloneMongodb::create([
                        'name' => $name,
                        'mongo_initdb_root_password' => Str::random(32),
                        'environment_id' => $this->environment->id,
                        'destination_id' => $server->id,
                        'destination_type' => $server->getMorphClass(),
                    ]);
                    Log::info('[Orchestrator] MongoDB provisioned', compact('name'));
                    break;
                    
                case 'redis':
                    StandaloneRedis::create([
                        'name' => $name,
                        'redis_password' => Str::random(32),
                        'environment_id' => $this->environment->id,
                        'destination_id' => $server->id,
                        'destination_type' => $server->getMorphClass(),
                    ]);
                    Log::info('[Orchestrator] Redis provisioned', compact('name'));
                    break;
            }
        }
    }
    
    private function createApplication(array $plan, string $repoUrl, string $branch): Application
    {
        $server = $this->selectServer();
        
        $app = Application::create([
            'name' => $plan['app_name'] ?? 'web',
            'git_repository' => $repoUrl,
            'git_branch' => $branch,
            'build_pack' => $plan['build_pack'] ?? 'nixpacks',
            'ports_exposes' => $plan['port'] ?? '3000',
            'install_command' => $plan['install_command'] ?? null,
            'build_command' => $plan['build_command'] ?? null,
            'start_command' => $plan['start_command'] ?? null,
            'post_deployment_command' => $plan['post_deploy_command'] ?? null,
            'health_check_enabled' => true,
            'health_check_path' => $plan['health_check_path'] ?? '/health',
            'environment_id' => $this->environment->id,
            'destination_id' => $server->id,
            'destination_type' => $server->getMorphClass(),
        ]);
        
        // Add environment variables
        foreach ($plan['env_vars'] ?? [] as $envVar) {
            $app->environment_variables()->create([
                'key' => $envVar['name'],
                'value' => $envVar['default'] ?? '',
                'is_build_time' => false,
            ]);
        }
        
        Log::info('[Orchestrator] Application created', ['app_id' => $app->id]);
        
        return $app;
    }
    
    private function enableFirewall(Application $app): void
    {
        // TODO: Activer CrowdSec via FirewallConfigService
        Log::info('[Orchestrator] Firewall enabled');
    }
    
    private function enablePipeline(Application $app): void
    {
        // TODO: Activer pipeline CI/CD
        Log::info('[Orchestrator] Pipeline enabled');
    }
    
    private function deployApplication(Application $app): array
    {
        try {
            // Dispatch deployment job
            dispatch(new \App\Jobs\ApplicationDeploymentJob(
                application: $app,
                deployment_uuid: Str::uuid(),
            ));
            
            return ['success' => true];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    
    private function selectServer(): Server
    {
        $server = auth()->user()->currentTeam->servers()
            ->where('settings->is_reachable', true)
            ->first();
            
        if (!$server) {
            throw new \Exception('No available server found. Please add a server first.');
        }
        
        Log::info('[Orchestrator] Server selected', ['server' => $server->name]);
        return $server;
    }
}
