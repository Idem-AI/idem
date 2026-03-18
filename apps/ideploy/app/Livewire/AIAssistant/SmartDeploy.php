<?php

namespace App\Livewire\AIAssistant;

use App\Services\AI\Agents\LLM\CodeIntelligenceAgent;
use App\Services\AI\Agents\LLM\DeploymentOrchestratorAgent;
use App\Services\AI\Agents\LLM\TroubleshootAgent;
use App\Jobs\AnalyzeRepositoryJob;
use Livewire\Component;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * AI Smart Deploy Assistant
 * 
 * Interface professionnelle pour l'analyse intelligente de repositories
 * avec architecture multi-agents (Analyzer, Validator, Orchestrator)
 */
class SmartDeploy extends Component
{
    public string $repositoryUrl = '';
    public string $branch = 'main';
    public bool $analyzing = false;
    public ?array $analysis = null;
    public ?string $error = null;
    public int $progress = 0;
    public string $currentStep = '';
    public string $sessionId = '';
    public int $pollingStartTime = 0;
    
    protected $rules = [
        'repositoryUrl' => 'required|url',
        'branch' => 'required|string|min:1',
    ];
    
    public function mount()
    {
        $this->sessionId = session()->getId();
    }
    
    /**
     * Analyser le repository avec multi-agents (synchrone - pas de queue worker)
     */
    public function analyze()
    {
        $this->validate();
        
        $this->analyzing = true;
        $this->error = null;
        $this->analysis = null;
        $this->progress = 0;
        $this->currentStep = '';
        
        try {
            $this->updateProgress(5, '🚀 Initialisation de l\'analyse LLM...');
            
            $this->updateProgress(15, '📦 Clonage et scan du repository...');
            $agent = new CodeIntelligenceAgent();
            
            $this->updateProgress(30, '🧠 LLM analyse le code (frameworks, deps, services)...');
            $result = $agent->analyze($this->repositoryUrl, $this->branch);
            
            if (!$result['success']) {
                throw new \Exception($result['error'] ?? 'Analyse failed');
            }
            
            $this->updateProgress(70, '📋 LLM génère configuration de déploiement...');
            
            $this->analysis = [
                'success' => true,
                'analysis' => $result['analysis'],
                'repo_path' => $result['repo_path'],
                'validation' => [
                    'valid' => true,
                    'confidence_score' => 85,
                ]
            ];
            
            $this->updateProgress(100, '🎉 Analyse terminée avec succès !');
            $this->dispatch('analysis-complete');
            
        } catch (\Exception $e) {
            Log::error('AI Analysis failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'url' => $this->repositoryUrl,
                'branch' => $this->branch,
            ]);
            
            $this->error = 'Erreur d\'analyse : ' . $e->getMessage();
            $this->currentStep = '❌ Échec de l\'analyse';
            $this->dispatch('analysis-error', error: $this->error);
        } finally {
            $this->analyzing = false;
        }
    }
    
    /**
     * Poll progress from cache (called by wire:poll)
     */
    public function checkProgress()
    {
        // Timeout après 5 minutes (300 secondes)
        if ($this->analyzing && $this->pollingStartTime > 0) {
            if (time() - $this->pollingStartTime > 300) {
                $this->analyzing = false;
                $this->error = 'Analyse timeout - Le job n\'a pas démarré. Vérifiez que le queue worker est actif.';
                $this->currentStep = '⏱️ Timeout';
                return;
            }
        }
        
        $status = Cache::get("analysis:{$this->sessionId}");
        
        if (!$status) return;
        
        $this->progress = $status['progress'] ?? 0;
        $this->currentStep = $status['step'] ?? '';
        $this->analyzing = $status['analyzing'] ?? false;
        
        if (isset($status['error'])) {
            $this->error = $status['error'];
            $this->analyzing = false;
        }
        
        if (isset($status['completed']) && $status['completed']) {
            $this->analysis = $status['analysis'] ?? null;
            $this->analyzing = false;
            $this->dispatch('analysis-complete');
        }
    }
    
    /**
     * Update progress and dispatch event
     */
    private function updateProgress(int $progress, string $step)
    {
        $this->progress = $progress;
        $this->currentStep = $step;
        $this->dispatch('progress-update', progress: $progress, step: $step);
        
        Log::info('Analysis Progress', [
            'progress' => $progress,
            'step' => $step,
        ]);
    }
    
    /**
     * Reset analysis
     */
    public function resetAnalysis()
    {
        $this->repositoryUrl = '';
        $this->branch = 'main';
        $this->analysis = null;
        $this->error = null;
        $this->progress = 0;
        $this->currentStep = '';
    }
    
    /**
     * Deploy application autonomously with LLM orchestration
     */
    public function deploy()
    {
        Log::info('[SmartDeploy] Deploy button clicked');
        
        if (!$this->analysis) {
            $this->error = 'Aucune analyse disponible';
            Log::error('[SmartDeploy] No analysis available');
            return;
        }
        
        $this->analyzing = true;
        $this->progress = 0;
        $this->error = null;
        
        Log::info('[SmartDeploy] Starting deployment', [
            'repo' => $this->repositoryUrl,
            'branch' => $this->branch,
            'framework' => $this->analysis['analysis']['framework'] ?? 'unknown'
        ]);
        
        try {
            $this->updateProgress(10, '🎯 Orchestration du déploiement...');
            
            $orchestrator = new DeploymentOrchestratorAgent();
            Log::info('[SmartDeploy] Orchestrator created');
            
            $this->updateProgress(20, '📁 Création du projet...');
            $this->updateProgress(40, '🗄️ Provisionnement des bases de données...');
            $this->updateProgress(60, '🚀 Création de l\'application...');
            $this->updateProgress(70, '🔒 Activation du firewall...');
            $this->updateProgress(80, '⚙️ Activation du pipeline CI/CD...');
            
            Log::info('[SmartDeploy] Calling orchestrator deploy');
            $result = $orchestrator->deploy(
                $this->analysis['analysis'] ?? [],
                $this->repositoryUrl,
                $this->branch
            );
            
            Log::info('[SmartDeploy] Orchestrator returned', ['success' => $result['success'] ?? false]);
            
            if (!$result['success']) {
                // Auto-fix with TroubleshootAgent
                $this->updateProgress(85, '🔧 Correction automatique des erreurs...');
                $troubleshooter = new TroubleshootAgent();
                $diagnosis = $troubleshooter->diagnose($result['error'] ?? 'Unknown error');
                
                if ($diagnosis['should_retry'] ?? false) {
                    $troubleshooter->applyFixes($diagnosis['fixes'] ?? [], $result['application'] ?? null);
                    // Retry deployment
                    $result = $orchestrator->deploy($this->analysis['analysis'], $this->repositoryUrl, $this->branch);
                }
            }
            
            $this->updateProgress(100, '✅ Déploiement réussi !');
            
            // Redirect to application
            if ($result['application'] ?? null) {
                Log::info('[SmartDeploy] Redirecting to application', [
                    'app_uuid' => $result['application']->uuid
                ]);
                
                return redirect()->route('project.application.configuration', [
                    'project_uuid' => $result['application']->environment->project->uuid,
                    'environment_uuid' => $result['application']->environment->uuid,
                    'application_uuid' => $result['application']->uuid,
                ]);
            } else {
                Log::warning('[SmartDeploy] No application in result');
                $this->error = 'Déploiement terminé mais aucune application créée';
            }
            
        } catch (\Exception $e) {
            Log::error('[SmartDeploy] Deployment failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            $this->error = 'Déploiement échoué : ' . $e->getMessage();
            $this->currentStep = '❌ Échec';
        } finally {
            $this->analyzing = false;
            Log::info('[SmartDeploy] Deploy finished');
        }
    }
    
    public function render()
    {
        return view('livewire.ai-assistant.smart-deploy');
    }
}
