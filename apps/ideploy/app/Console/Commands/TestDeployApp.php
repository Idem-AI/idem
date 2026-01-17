<?php

namespace App\Console\Commands;

use App\Models\Application;
use Illuminate\Console\Command;
use Visus\Cuid2\Cuid2;

class TestDeployApp extends Command
{
    protected $signature = 'test:deploy-app {app_id}';
    protected $description = 'Deploy an application for testing';

    public function handle()
    {
        $appId = $this->argument('app_id');
        $app = Application::find($appId);
        
        if (!$app) {
            $this->error("Application #{$appId} not found");
            return 1;
        }
        
        $this->info("Deploying app: {$app->name}");
        $this->line("UUID: {$app->uuid}");
        $this->line("FQDN: {$app->fqdn}");
        $this->line('');
        
        try {
            // Create deployment queue
            $deployment_uuid = new Cuid2;
            $destination = $app->destination;
            $server = $destination->server;
            
            $queue = \App\Models\ApplicationDeploymentQueue::create([
                'application_id' => $app->id,
                'deployment_uuid' => $deployment_uuid,
                'pull_request_id' => 0,
                'force_rebuild' => false,
                'is_webhook' => false,
                'restart_only' => false,
                'commit' => $app->git_commit_sha ?? 'HEAD',
                'rollback' => false,
                'server_id' => $server->id,
                'destination_id' => $destination->id,
                'only_this_server' => false,
                'git_type' => $app->git_type ?? 'github',
                'status' => 'queued',
            ]);
            
            $this->info("✅ Deployment queue created (ID: {$queue->id})");
            
            // Dispatch job
            \App\Jobs\ApplicationDeploymentJob::dispatch($queue->id);
            
            $this->info("✅ Deployment job dispatched!");
            $this->line('');
            $this->line("Deployment UUID: {$deployment_uuid}");
            $this->line("Wait 2-3 minutes for deployment to complete...");
            $this->line('');
            $this->line("URL: {$app->fqdn}");
            
            return 0;
            
        } catch (\Exception $e) {
            $this->error("Failed: " . $e->getMessage());
            return 1;
        }
    }
}
