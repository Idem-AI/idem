<?php

namespace App\Services\AI\Agents\LLM;

use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;

class CodeIntelligenceAgent extends BaseLLMAgent
{
    private string $repoPath;
    
    protected function getSystemPrompt(): string
    {
        $frameworks = file_get_contents(config_path('ai/frameworks.json'));
        return "Expert DevOps analyzing ANY app (Node, Python, PHP, Go, Ruby, etc.)\n\nFRAMEWORKS:\n{$frameworks}\n\nExtract: framework, port, env_vars, services, commands. Return JSON.";
    }
    
    public function analyze(string $repoUrl, string $branch = 'main'): array
    {
        try {
            $this->repoPath = storage_path('app/repos/' . md5($repoUrl . time()));
            @mkdir(dirname($this->repoPath), 0755, true);
            
            Log::info('[CodeIntelligence] Cloning', compact('repoUrl', 'branch'));
            $clone = Process::timeout(120)->run("git clone --depth 1 -b {$branch} {$repoUrl} {$this->repoPath} 2>&1");
            
            if (!$clone->successful()) {
                $error = $clone->errorOutput() ?: $clone->output();
                Log::error('[CodeIntelligence] Clone failed', ['error' => $error, 'url' => $repoUrl, 'branch' => $branch]);
                
                // Messages d'erreur plus clairs
                if (str_contains($error, 'not found') || str_contains($error, '404')) {
                    return ['success' => false, 'error' => "Repository not found. Vérifiez l'URL et que le repo est public."];
                }
                if (str_contains($error, 'branch') || str_contains($error, 'reference')) {
                    return ['success' => false, 'error' => "Branch '{$branch}' not found. Essayez 'main' ou 'master'."];
                }
                if (str_contains($error, 'Permission denied') || str_contains($error, 'authentication')) {
                    return ['success' => false, 'error' => "Repository privé. Utilisez un repository public."];
                }
                
                return ['success' => false, 'error' => 'Git clone failed: ' . substr($error, 0, 200)];
            }
            
            $files = $this->scanFiles();
            $keyContent = $this->readKeyFiles($files);
            
            if (empty($keyContent)) {
                return ['success' => false, 'error' => 'No key files found'];
            }
            
            $analysis = $this->think("Analyze repo and provide deployment config", [
                'repo' => $repoUrl,
                'files' => array_keys($keyContent),
                'content' => $keyContent,
            ]);
            
            if (isset($analysis['error'])) {
                return ['success' => false, 'error' => $analysis['error']];
            }
            
            Log::info('[CodeIntelligence] Done', ['framework' => $analysis['framework'] ?? 'unknown']);
            return ['success' => true, 'analysis' => $analysis, 'repo_path' => $this->repoPath];
            
        } catch (\Exception $e) {
            Log::error('[CodeIntelligence] Failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    
    private function scanFiles(): array
    {
        $files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->repoPath, \RecursiveDirectoryIterator::SKIP_DOTS)
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $path = str_replace($this->repoPath . '/', '', $file->getPathname());
                if (!str_contains($path, 'node_modules') && !str_contains($path, '.git')) {
                    $files[] = $path;
                }
            }
        }
        return $files;
    }
    
    private function readKeyFiles(array $files): array
    {
        $keyPatterns = [
            'package.json', 'requirements.txt', 'Pipfile', 'pyproject.toml',
            'composer.json', 'go.mod', 'Gemfile', 'Cargo.toml',
            'Dockerfile', 'docker-compose.yml', '.dockerignore',
            'pom.xml', 'build.gradle', '.csproj', '.fsproj',
            '.env.example', 'Procfile', 'app.json', 'vercel.json', 'netlify.toml'
        ];
        $content = [];
        
        foreach ($files as $file) {
            foreach ($keyPatterns as $pattern) {
                if (str_contains($file, $pattern) || basename($file) === $pattern) {
                    $fullPath = $this->repoPath . '/' . $file;
                    if (file_exists($fullPath) && filesize($fullPath) < 100000) {
                        $content[$file] = file_get_contents($fullPath);
                        break;
                    }
                }
            }
        }
        return $content;
    }
}
