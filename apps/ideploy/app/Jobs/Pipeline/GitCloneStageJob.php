<?php

namespace App\Jobs\Pipeline;

use App\Models\Application;
use App\Models\PipelineExecution;
use App\Models\PipelineLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GitCloneStageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes

    public function __construct(
        public PipelineExecution $execution
    ) {}

    public function handle(): array
    {
        $this->log('info', '🔄 Starting Git Clone stage...');
        
        try {
            $application = $this->execution->application;
            $server = $application->destination->server;
            
            // Generate unique workspace path
            $workspacePath = "/var/lib/ideploy/pipelines/{$this->execution->uuid}";
            $this->execution->update(['source_path' => $workspacePath]);
            
            $this->log('info', "📁 Workspace: {$workspacePath}");
            
            // Create workspace directory
            $this->log('info', '📂 Creating workspace directory...');
            instant_remote_process([
                "mkdir -p {$workspacePath}",
            ], $server);
            
            // Get Git repository URL
            $gitUrl = $this->getGitRepositoryUrl($application);
            $branch = $this->execution->branch ?? $application->git_branch ?? 'main';
            
            $this->log('info', "📦 Repository: {$gitUrl}");
            $this->log('info', "🌿 Branch: {$branch}");
            
            // Clone repository with progress
            $this->log('info', '⬇️  Cloning repository...');
            
            $cloneCommand = $this->buildGitCloneCommand($gitUrl, $branch, $workspacePath, $application);
            
            // Execute clone command with real-time output
            $output = instant_remote_process($cloneCommand, $server);
            
            if ($output) {
                foreach (explode("\n", $output) as $line) {
                    if (!empty(trim($line))) {
                        $this->log('info', "  " . trim($line));
                    }
                }
            }
            
            // Verify clone success
            $this->log('info', '✅ Verifying clone...');
            $verifyOutput = instant_remote_process([
                "ls -la {$workspacePath}",
                "cd {$workspacePath} && git log -1 --oneline",
            ], $server);
            
            if ($verifyOutput) {
                $lines = explode("\n", $verifyOutput);
                $commitInfo = end($lines);
                
                // Extract commit SHA
                if (preg_match('/^([a-f0-9]+)\s/', $commitInfo, $matches)) {
                    $commitSha = $matches[1];
                    $this->execution->update(['commit_sha' => $commitSha]);
                    $this->log('info', "📝 Commit: {$commitInfo}");
                }
            }
            
            $this->log('success', '✅ Git clone completed successfully!');
            
            return [
                'success' => true,
                'workspace_path' => $workspacePath,
                'branch' => $branch,
            ];
            
        } catch (\Exception $e) {
            $this->log('error', '❌ Git clone failed: ' . $e->getMessage());
            Log::error('Git clone failed', [
                'execution_uuid' => $this->execution->uuid,
                'error' => $e->getMessage(),
            ]);
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
    
    /**
     * Determine the deployment type based on application source
     */
    private function getDeploymentType(Application $application): string
    {
        // Check if source is set (GitHub App or GitLab App)
        if ($application->source) {
            $sourceClass = $application->source->getMorphClass();
            
            if ($sourceClass === 'App\Models\GithubApp') {
                return 'github_app';
            }
            
            if ($sourceClass === 'App\Models\GitlabApp') {
                return 'gitlab_app';
            }
        }
        
        // Check if deploy key is configured
        if ($application->private_key_id) {
            return 'deploy_key';
        }
        
        // Default: public repository
        return 'public';
    }
    
    /**
     * Get repository info for logging
     */
    private function getGitRepositoryUrl(Application $application): string
    {
        $deploymentType = $this->getDeploymentType($application);
        
        switch ($deploymentType) {
            case 'github_app':
            case 'gitlab_app':
                return $application->git_repository;
                
            case 'deploy_key':
            case 'public':
            default:
                return $application->git_repository;
        }
    }
    
    private function buildGitCloneCommand(string $gitUrl, string $branch, string $workspacePath, Application $application): array
    {
        $deploymentType = $this->getDeploymentType($application);
        
        switch ($deploymentType) {
            case 'github_app':
                return $this->buildGitHubAppClone($application, $branch, $workspacePath);
                
            case 'gitlab_app':
                return $this->buildGitLabAppClone($application, $branch, $workspacePath);
                
            case 'deploy_key':
                return $this->buildDeployKeyClone($application, $branch, $workspacePath);
                
            case 'public':
            default:
                return $this->buildPublicClone($application, $branch, $workspacePath);
        }
    }
    
    /**
     * Build clone command for GitHub App (private or public)
     */
    private function buildGitHubAppClone(Application $app, string $branch, string $path): array
    {
        $source = $app->source; // GithubApp
        $repo = $app->git_repository;
        
        if ($source->is_public) {
            // Public GitHub repository
            $url = "https://github.com/{$repo}";
            return ["git clone --depth 1 --branch {$branch} {$url} {$path}"];
        }
        
        // Private GitHub - Generate installation token
        $token = generateGithubInstallationToken($source);
        $url = "https://x-access-token:{$token}@github.com/{$repo}.git";
        
        return [
            "git clone --depth 1 --branch {$branch} {$url} {$path}",
        ];
    }
    
    /**
     * Build clone command for GitLab App
     */
    private function buildGitLabAppClone(Application $app, string $branch, string $path): array
    {
        $source = $app->source; // GitlabApp
        $repo = $app->git_repository;
        $token = $source->app_secret;
        
        $url = "https://oauth2:{$token}@gitlab.com/{$repo}.git";
        
        return [
            "git clone --depth 1 --branch {$branch} {$url} {$path}",
        ];
    }
    
    /**
     * Build clone command with SSH deploy key
     */
    private function buildDeployKeyClone(Application $app, string $branch, string $path): array
    {
        $privateKey = $app->private_key;
        $keyPath = "/tmp/pipeline_key_{$this->execution->uuid}";
        $repo = $app->git_repository;
        
        // Encode the private key
        $encodedKey = base64_encode($privateKey->private_key);
        
        return [
            // Write SSH key
            "echo '{$encodedKey}' | base64 -d > {$keyPath}",
            "chmod 600 {$keyPath}",
            
            // Clone with SSH
            "GIT_SSH_COMMAND='ssh -i {$keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null' " .
            "git clone --depth 1 --branch {$branch} {$repo} {$path}",
            
            // Cleanup key
            "rm -f {$keyPath}",
        ];
    }
    
    /**
     * Build clone command for public repository
     */
    private function buildPublicClone(Application $app, string $branch, string $path): array
    {
        $repo = $app->git_repository;
        
        return [
            "git clone --depth 1 --branch {$branch} {$repo} {$path}",
        ];
    }
    
    private function log(string $level, string $message): void
    {
        PipelineLog::create([
            'pipeline_execution_id' => $this->execution->id,
            'stage_id' => 'git_clone',
            'stage_name' => 'Git Clone',
            'level' => $level,
            'message' => $message,
            'logged_at' => now(),
        ]);
    }
}
