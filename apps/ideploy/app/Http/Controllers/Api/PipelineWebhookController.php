<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\Pipeline\PipelineOrchestratorJob;
use App\Models\Application;
use App\Models\PipelineConfig;
use App\Models\PipelineExecution;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PipelineWebhookController extends Controller
{
    /**
     * Handle Git webhook for automatic pipeline trigger
     * 
     * Supports: GitHub, GitLab, Bitbucket
     */
    public function handle(Request $request, string $applicationUuid)
    {
        try {
            // Find application
            $application = Application::where('uuid', $applicationUuid)->firstOrFail();
            
            // Get pipeline config
            $pipelineConfig = $application->pipelineConfig;
            
            if (!$pipelineConfig || !$pipelineConfig->enabled) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pipeline is not enabled for this application',
                ], 400);
            }

            // Check trigger mode
            if ($pipelineConfig->trigger_mode !== 'auto') {
                return response()->json([
                    'success' => false,
                    'message' => 'Pipeline is set to manual trigger mode',
                ], 400);
            }

            // Detect Git provider
            $provider = $this->detectProvider($request);
            
            // Parse webhook payload
            $data = $this->parseWebhookPayload($request, $provider);
            
            if (!$data) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unable to parse webhook payload',
                ], 400);
            }

            // Check if branch matches trigger branches
            if (!$this->shouldTrigger($pipelineConfig, $data['branch'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Branch not configured for pipeline trigger',
                    'branch' => $data['branch'],
                ], 200);
            }

            // Create pipeline execution
            $execution = PipelineExecution::create([
                'pipeline_config_id' => $pipelineConfig->id,
                'application_id' => $application->id,
                'trigger_type' => 'webhook',
                'trigger_user' => $data['author'] ?? 'Webhook',
                'commit_sha' => $data['commit_sha'] ?? null,
                'commit_message' => $data['commit_message'] ?? 'Webhook trigger',
                'branch' => $data['branch'],
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

            Log::info("Pipeline triggered via webhook", [
                'application_id' => $application->id,
                'execution_id' => $execution->id,
                'branch' => $data['branch'],
                'provider' => $provider,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pipeline triggered successfully',
                'execution_id' => $execution->id,
                'execution_uuid' => $execution->uuid,
            ], 200);

        } catch (\Exception $e) {
            Log::error("Pipeline webhook error: " . $e->getMessage(), [
                'application_uuid' => $applicationUuid,
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Internal server error',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Detect Git provider from request
     */
    protected function detectProvider(Request $request): string
    {
        if ($request->header('X-GitHub-Event')) {
            return 'github';
        }
        
        if ($request->header('X-GitLab-Event')) {
            return 'gitlab';
        }
        
        if ($request->header('X-Event-Key')) {
            return 'bitbucket';
        }

        return 'unknown';
    }

    /**
     * Parse webhook payload based on provider
     */
    protected function parseWebhookPayload(Request $request, string $provider): ?array
    {
        $payload = $request->all();

        try {
            switch ($provider) {
                case 'github':
                    return $this->parseGitHubPayload($payload);
                
                case 'gitlab':
                    return $this->parseGitLabPayload($payload);
                
                case 'bitbucket':
                    return $this->parseBitbucketPayload($payload);
                
                default:
                    // Try to guess format
                    return $this->parseGenericPayload($payload);
            }
        } catch (\Exception $e) {
            Log::warning("Failed to parse webhook payload: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Parse GitHub webhook payload
     */
    protected function parseGitHubPayload(array $payload): array
    {
        return [
            'branch' => $payload['ref'] ? str_replace('refs/heads/', '', $payload['ref']) : null,
            'commit_sha' => $payload['after'] ?? $payload['head_commit']['id'] ?? null,
            'commit_message' => $payload['head_commit']['message'] ?? null,
            'author' => $payload['head_commit']['author']['name'] ?? $payload['pusher']['name'] ?? null,
        ];
    }

    /**
     * Parse GitLab webhook payload
     */
    protected function parseGitLabPayload(array $payload): array
    {
        return [
            'branch' => $payload['ref'] ? str_replace('refs/heads/', '', $payload['ref']) : null,
            'commit_sha' => $payload['checkout_sha'] ?? $payload['commits'][0]['id'] ?? null,
            'commit_message' => $payload['commits'][0]['message'] ?? null,
            'author' => $payload['user_name'] ?? $payload['commits'][0]['author']['name'] ?? null,
        ];
    }

    /**
     * Parse Bitbucket webhook payload
     */
    protected function parseBitbucketPayload(array $payload): array
    {
        $change = $payload['push']['changes'][0] ?? null;
        
        return [
            'branch' => $change['new']['name'] ?? null,
            'commit_sha' => $change['new']['target']['hash'] ?? null,
            'commit_message' => $change['new']['target']['message'] ?? null,
            'author' => $payload['actor']['display_name'] ?? null,
        ];
    }

    /**
     * Parse generic webhook payload (best effort)
     */
    protected function parseGenericPayload(array $payload): array
    {
        return [
            'branch' => $payload['branch'] ?? $payload['ref'] ?? 'main',
            'commit_sha' => $payload['commit'] ?? $payload['sha'] ?? null,
            'commit_message' => $payload['message'] ?? $payload['commit_message'] ?? null,
            'author' => $payload['author'] ?? $payload['user'] ?? 'unknown',
        ];
    }

    /**
     * Check if pipeline should be triggered for this branch
     */
    protected function shouldTrigger(PipelineConfig $config, ?string $branch): bool
    {
        if (!$branch) {
            return false;
        }

        $triggerBranches = $config->trigger_branches ?? ['main', 'master'];

        // If empty, trigger on all branches
        if (empty($triggerBranches)) {
            return true;
        }

        // Check if branch matches (exact match or wildcard)
        foreach ($triggerBranches as $pattern) {
            if ($branch === $pattern) {
                return true;
            }

            // Support wildcard patterns (e.g., "feature/*")
            if (Str::is($pattern, $branch)) {
                return true;
            }
        }

        return false;
    }
}
