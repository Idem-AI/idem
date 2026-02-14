<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\PipelineExecution;
use App\Jobs\Pipeline\PipelineOrchestratorJob;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DeployWebhookController extends Controller
{
    /**
     * Handle webhook from Git providers (GitHub, GitLab, Gitea)
     */
    public function handle(Request $request, string $uuid)
    {
        try {
            // Find application
            $application = Application::where('uuid', $uuid)->firstOrFail();
            
            // Check if pipeline is enabled
            $config = $application->pipelineConfig;
            
            if (!$config || !$config->enabled) {
                Log::info("Webhook received but pipeline not enabled", [
                    'application' => $application->name,
                    'uuid' => $uuid,
                ]);
                
                return response()->json([
                    'message' => 'Pipeline not enabled for this application',
                ], 400);
            }
            
            // Parse webhook payload
            $payload = $this->parseWebhookPayload($request);
            
            if (!$payload) {
                Log::warning("Webhook received but payload could not be parsed", [
                    'application' => $application->name,
                    'headers' => $request->headers->all(),
                ]);
                
                return response()->json([
                    'message' => 'Invalid webhook payload',
                ], 400);
            }
            
            // Check if trigger mode is auto
            if ($config->trigger_mode === 'manual') {
                Log::info("Webhook received but trigger mode is manual", [
                    'application' => $application->name,
                    'branch' => $payload['branch'],
                ]);
                
                return response()->json([
                    'message' => 'Pipeline is set to manual trigger mode',
                ], 200);
            }
            
            // Check if branch matches trigger branches
            $triggerBranches = $config->trigger_branches ?? ['main', 'master'];
            
            if (!in_array($payload['branch'], $triggerBranches)) {
                Log::info("Webhook received but branch not configured for auto-trigger", [
                    'application' => $application->name,
                    'branch' => $payload['branch'],
                    'trigger_branches' => $triggerBranches,
                ]);
                
                return response()->json([
                    'message' => 'Branch not configured for auto-trigger',
                    'branch' => $payload['branch'],
                    'trigger_branches' => $triggerBranches,
                ], 200);
            }
            
            // Create pipeline execution
            $execution = PipelineExecution::create([
                'pipeline_config_id' => $config->id,
                'application_id' => $application->id,
                'trigger_type' => 'webhook',
                'trigger_user' => $payload['author'] ?? 'Webhook',
                'branch' => $payload['branch'],
                'commit_sha' => $payload['commit'],
                'commit_message' => $payload['message'] ?? 'Webhook trigger',
                'status' => 'pending',
                'started_at' => now(),
                'stages_status' => [
                    'git_clone' => 'pending',
                    'language_detection' => 'pending',
                    'sonarqube' => 'pending',
                    'trivy' => 'pending',
                    'deployment' => 'pending',
                ],
            ]);
            
            // Dispatch pipeline orchestrator job
            dispatch(new PipelineOrchestratorJob($execution));
            
            Log::info("Pipeline triggered successfully via webhook", [
                'application' => $application->name,
                'execution_id' => $execution->id,
                'branch' => $payload['branch'],
                'commit' => $payload['commit'],
            ]);
            
            return response()->json([
                'message' => 'Pipeline triggered successfully',
                'execution_id' => $execution->id,
                'execution_uuid' => $execution->uuid ?? $execution->id,
                'application' => $application->name,
                'branch' => $payload['branch'],
                'commit' => $payload['commit'],
            ], 201);
            
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            Log::warning("Webhook received for non-existent application", [
                'uuid' => $uuid,
            ]);
            
            return response()->json([
                'message' => 'Application not found',
            ], 404);
            
        } catch (\Exception $e) {
            Log::error("Webhook processing failed", [
                'uuid' => $uuid,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'message' => 'Internal server error',
                'error' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }
    
    /**
     * Parse webhook payload from different Git providers
     */
    private function parseWebhookPayload(Request $request): ?array
    {
        $payload = $request->all();
        $headers = $request->headers->all();
        
        // GitHub webhook
        if ($request->header('X-GitHub-Event') === 'push') {
            return $this->parseGitHubPayload($payload);
        }
        
        // GitLab webhook
        if ($request->header('X-Gitlab-Event') === 'Push Hook') {
            return $this->parseGitLabPayload($payload);
        }
        
        // Gitea webhook
        if ($request->header('X-Gitea-Event') === 'push') {
            return $this->parseGiteaPayload($payload);
        }
        
        // Generic webhook (fallback)
        return $this->parseGenericPayload($payload);
    }
    
    /**
     * Parse GitHub webhook payload
     */
    private function parseGitHubPayload(array $payload): ?array
    {
        if (!isset($payload['ref'])) {
            return null;
        }
        
        $branch = str_replace('refs/heads/', '', $payload['ref']);
        $commits = $payload['commits'] ?? [];
        $headCommit = $payload['head_commit'] ?? ($commits[0] ?? null);
        
        return [
            'provider' => 'github',
            'branch' => $branch,
            'commit' => $payload['after'] ?? $headCommit['id'] ?? null,
            'message' => $headCommit['message'] ?? 'No commit message',
            'author' => $headCommit['author']['name'] ?? $payload['pusher']['name'] ?? 'Unknown',
            'timestamp' => $headCommit['timestamp'] ?? now()->toIso8601String(),
        ];
    }
    
    /**
     * Parse GitLab webhook payload
     */
    private function parseGitLabPayload(array $payload): ?array
    {
        if (!isset($payload['object_kind']) || $payload['object_kind'] !== 'push') {
            return null;
        }
        
        $branch = str_replace('refs/heads/', '', $payload['ref'] ?? '');
        $commits = $payload['commits'] ?? [];
        $headCommit = $commits[0] ?? null;
        
        return [
            'provider' => 'gitlab',
            'branch' => $branch,
            'commit' => $payload['checkout_sha'] ?? $headCommit['id'] ?? null,
            'message' => $headCommit['message'] ?? 'No commit message',
            'author' => $payload['user_name'] ?? $headCommit['author']['name'] ?? 'Unknown',
            'timestamp' => $headCommit['timestamp'] ?? now()->toIso8601String(),
        ];
    }
    
    /**
     * Parse Gitea webhook payload
     */
    private function parseGiteaPayload(array $payload): ?array
    {
        if (!isset($payload['ref'])) {
            return null;
        }
        
        $branch = str_replace('refs/heads/', '', $payload['ref']);
        $commits = $payload['commits'] ?? [];
        $headCommit = $commits[0] ?? null;
        
        return [
            'provider' => 'gitea',
            'branch' => $branch,
            'commit' => $payload['after'] ?? $headCommit['id'] ?? null,
            'message' => $headCommit['message'] ?? 'No commit message',
            'author' => $payload['pusher']['login'] ?? $headCommit['author']['name'] ?? 'Unknown',
            'timestamp' => $headCommit['timestamp'] ?? now()->toIso8601String(),
        ];
    }
    
    /**
     * Parse generic webhook payload (fallback)
     */
    private function parseGenericPayload(array $payload): ?array
    {
        // Try to extract common fields
        $branch = $payload['branch'] 
            ?? ($payload['ref'] ? str_replace('refs/heads/', '', $payload['ref']) : null)
            ?? 'main';
        
        $commit = $payload['commit'] 
            ?? $payload['after'] 
            ?? $payload['sha'] 
            ?? $payload['commit_sha']
            ?? null;
        
        $message = $payload['message'] 
            ?? $payload['commit_message']
            ?? 'Webhook trigger';
        
        $author = $payload['author'] 
            ?? $payload['pusher']
            ?? $payload['user']
            ?? 'Webhook';
        
        return [
            'provider' => 'generic',
            'branch' => $branch,
            'commit' => $commit,
            'message' => $message,
            'author' => $author,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
