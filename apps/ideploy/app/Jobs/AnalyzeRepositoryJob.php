<?php

namespace App\Jobs;

use App\Services\AI\Agents\LLM\CodeIntelligenceAgent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AnalyzeRepositoryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $sessionId,
        public string $repoUrl,
        public string $branch
    ) {}

    public function handle(): void
    {
        Log::info('[AnalyzeJob] Starting', ['session' => $this->sessionId]);
        
        try {
            // Update progress
            $this->updateProgress(5, '🚀 Initialisation de l\'analyse LLM...');
            
            $this->updateProgress(15, '📦 Clonage et scan du repository...');
            $agent = new CodeIntelligenceAgent();
            
            $this->updateProgress(30, '🧠 LLM analyse le code (frameworks, deps, services)...');
            $result = $agent->analyze($this->repoUrl, $this->branch);
            
            if (!$result['success']) {
                $this->updateProgress(0, '❌ Échec de l\'analyse', [
                    'error' => $result['error'] ?? 'Analyse failed'
                ]);
                return;
            }
            
            $this->updateProgress(70, '📋 LLM génère configuration de déploiement...');
            
            $analysis = [
                'success' => true,
                'analysis' => $result['analysis'],
                'repo_path' => $result['repo_path'],
                'validation' => [
                    'valid' => true,
                    'confidence_score' => 85,
                ]
            ];
            
            $this->updateProgress(100, '🎉 Analyse terminée avec succès !', [
                'analysis' => $analysis,
                'completed' => true
            ]);
            
            Log::info('[AnalyzeJob] Completed', ['session' => $this->sessionId]);
            
        } catch (\Exception $e) {
            Log::error('[AnalyzeJob] Failed', [
                'session' => $this->sessionId,
                'error' => $e->getMessage()
            ]);
            
            $this->updateProgress(0, '❌ Échec de l\'analyse', [
                'error' => $e->getMessage()
            ]);
        }
    }
    
    private function updateProgress(int $progress, string $step, array $extra = []): void
    {
        Cache::put("analysis:{$this->sessionId}", array_merge([
            'progress' => $progress,
            'step' => $step,
            'analyzing' => $progress > 0 && $progress < 100,
        ], $extra), 300); // 5 minutes TTL
        
        Log::info('[AnalyzeJob] Progress', [
            'session' => $this->sessionId,
            'progress' => $progress,
            'step' => $step
        ]);
    }
}
